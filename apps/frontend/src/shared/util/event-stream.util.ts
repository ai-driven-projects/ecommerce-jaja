import { API_URL, ApiError, readErrorPayload } from '@/shared/util/api-client.util';

/**
 * Stream de eventos da API (`text/event-stream`, Server-Sent Events) com
 * autenticação.
 *
 * Por que não `EventSource`: a `EventSource` nativa não envia cabeçalhos, e a
 * alternativa seria pôr o token na query string, onde ele vaza em logs de acesso,
 * no histórico e em proxies. Aqui o stream é aberto com `fetch` e o cabeçalho
 * `Authorization: Bearer <token>`, e o corpo é lido pelo `ReadableStream`. O token
 * **nunca** vai para a URL.
 */

/**
 * Estado da conexão:
 * - `connecting`: primeira tentativa em andamento;
 * - `live`: a API respondeu `200` e o corpo está sendo lido;
 * - `reconnecting`: a conexão caiu (rede, fim do corpo ou erro do servidor) e uma
 *   nova tentativa está agendada ou em andamento;
 * - `closed`: a API recusou o stream (`401`, `403` ou `404`) e não há nova tentativa.
 */
export type EventStreamStatus = 'connecting' | 'live' | 'reconnecting' | 'closed';

/** Evento recebido: o nome (`event:`, `message` quando ausente) e o `data` já convertido de JSON. */
export type EventStreamMessage = {
  type: string;
  data: unknown;
};

export type OpenEventStreamOptions = {
  /** Caminho na API, começando com `/` (ex.: `/me/orders/<id>/stream`). */
  path: string;
  token: string;
  /** Cada evento do stream, exceto o sinal de vida `ping`. */
  onEvent: (event: EventStreamMessage) => void;
  /** Cada mudança de estado, sem repetir o estado atual. */
  onStatusChange?: (status: EventStreamStatus) => void;
  /** Recusa definitiva da API (`401`, `403` ou `404`), logo antes de `closed`. */
  onError?: (error: ApiError) => void;
};

/** Evento de sinal de vida da API: mantém a conexão aberta e não é repassado. */
const PING_EVENT = 'ping';

/** Nome do evento sem a linha `event:` (formato SSE). */
const DEFAULT_EVENT = 'message';

/** Respostas que encerram o stream sem nova tentativa: sem sessão, sem permissão ou recurso inexistente. */
const FINAL_STATUSES: ReadonlySet<number> = new Set([401, 403, 404]);

/** Espera antes da primeira nova tentativa; dobra a cada falha seguida, até `RETRY_MAX_DELAY_MS`. */
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 10_000;

/** Espera da tentativa `attempt` (0, 1, 2…): 1 s, 2 s, 4 s, 8 s e 10 s daí em diante. */
function retryDelayMs(attempt: number): number {
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
}

/**
 * Leitor incremental do formato SSE. Recebe o texto em pedaços (`push`), em
 * qualquer ponto de corte, e chama `onMessage` a cada evento completo:
 * - linhas terminam em `\n`, `\r\n` ou `\r`;
 * - `event:` define o nome, e várias linhas `data:` são juntadas com `\n`;
 * - a linha em branco despacha o evento (sem `data`, nada é despachado);
 * - linhas começando com `:` são comentários; `id:`, `retry:` e campos desconhecidos são ignorados;
 * - o `data` é convertido de JSON, e o que não for JSON válido é descartado.
 */
export function createEventStreamParser(onMessage: (message: EventStreamMessage) => void) {
  let buffer = '';
  let eventName = '';
  let dataLines: string[] = [];

  const dispatch = () => {
    const type = eventName || DEFAULT_EVENT;
    const lines = dataLines;
    eventName = '';
    dataLines = [];
    if (lines.length === 0) return;

    let data: unknown;
    try {
      data = JSON.parse(lines.join('\n'));
    } catch {
      return;
    }
    onMessage({ type, data });
  };

  const processLine = (line: string) => {
    if (line === '') {
      dispatch();
      return;
    }
    if (line.startsWith(':')) return;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      let match = /\r\n|\r|\n/.exec(buffer);
      while (match) {
        // Um `\r` no fim do pedaço pode ser a metade de um `\r\n`: espera o próximo.
        if (match[0] === '\r' && match.index === buffer.length - 1) break;
        processLine(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
        match = /\r\n|\r|\n/.exec(buffer);
      }
    },
  };
}

/**
 * Abre um stream SSE autenticado da API e devolve a função que o fecha.
 *
 * - `fetch(`${API_URL}${path}`)` com `Accept: text/event-stream` e
 *   `Authorization: Bearer <token>` (o token nunca vai para a URL);
 * - `connecting` ao abrir e `live` quando a resposta `200` chega;
 * - queda de rede, fim do corpo ou outra resposta de erro → `reconnecting` e nova
 *   tentativa com espera crescente (1 s, 2 s, 4 s… até 10 s), que volta a 1 s
 *   depois de uma conexão bem-sucedida;
 * - `401`, `403` e `404` → `onError` com o `ApiError` da resposta e `closed`,
 *   sem nova tentativa;
 * - cada evento completo vai para `onEvent`, exceto `ping`.
 *
 * Fechar cancela a leitura em andamento (`AbortController`) e a tentativa
 * agendada; depois disso nenhum callback é chamado, nem mesmo `closed`.
 */
export function openEventStream({ path, token, onEvent, onStatusChange, onError }: OpenEventStreamOptions): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let status: EventStreamStatus | null = null;

  const setStatus = (next: EventStreamStatus) => {
    if (stopped || status === next) return;
    status = next;
    onStatusChange?.(next);
  };

  const scheduleRetry = () => {
    if (stopped) return;
    setStatus('reconnecting');
    const delay = retryDelayMs(attempt);
    attempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, delay);
  };

  const connect = async () => {
    if (stopped) return;
    const current = new AbortController();
    controller = current;

    try {
      const response = await fetch(`${API_URL}${path}`, {
        headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
        signal: current.signal,
        cache: 'no-store',
      });

      if (stopped) return;

      if (FINAL_STATUSES.has(response.status)) {
        const error = new ApiError(response.status, await readErrorPayload(response));
        if (stopped) return;
        onError?.(error);
        setStatus('closed');
        return;
      }

      if (!response.ok || !response.body) {
        void response.body?.cancel().catch(() => undefined);
        scheduleRetry();
        return;
      }

      attempt = 0;
      setStatus('live');

      const parser = createEventStreamParser((message) => {
        if (!stopped && message.type !== PING_EVENT) onEvent(message);
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
    } catch {
      // Queda de rede ou leitura abortada ao fechar: tratado abaixo.
    }

    // O corpo terminou ou a conexão caiu sem ter sido fechada por quem abriu.
    if (!stopped) scheduleRetry();
  };

  setStatus('connecting');
  void connect();

  return () => {
    stopped = true;
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
    controller?.abort();
    controller = null;
  };
}
