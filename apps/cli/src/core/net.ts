import net from 'node:net';

export function isPortOpen(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitForPort(
  host: string,
  port: number,
  options: { attempts?: number; delayMs?: number; signal?: AbortSignal } = {},
): Promise<boolean> {
  const attempts = options.attempts ?? 20;
  const delayMs = options.delayMs ?? 1500;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (options.signal?.aborted) return false;
    if (await isPortOpen(host, port)) return true;
    await sleep(delayMs);
  }
  return false;
}

export interface HttpProbe {
  /** Resposta 2xx. */
  ok: boolean;
  /** `null` quando não houve resposta (DNS, conexão recusada, tempo esgotado). */
  status: number | null;
  ms: number;
  body: string;
  error?: string;
}

function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (error.name === 'TimeoutError') return 'tempo esgotado';
  if (error.name === 'AbortError') return 'cancelado';
  // O fetch do Node embrulha a causa real (ENOTFOUND, ECONNREFUSED...) em `cause`.
  // Com `localhost` resolvendo para IPv4 e IPv6, a causa é um AggregateError sem mensagem: vale o código (ECONNREFUSED).
  const cause: unknown = (error as Error & { cause?: unknown }).cause;
  if (!(cause instanceof Error)) return error.message;
  const code: unknown = (cause as Error & { code?: unknown }).code;
  return cause.message || (typeof code === 'string' ? code : '') || error.message;
}

/**
 * Requisição HTTP com tempo limite (GET por padrão), para verificações de saúde e chamadas simples de API. Nunca lança.
 * `headers` permite autenticar (ex.: `Authorization`) sem colocar credenciais na URL, que pode aparecer em mensagens de erro.
 */
export async function httpProbe(
  url: string,
  options: { timeoutMs?: number; signal?: AbortSignal; headers?: Record<string, string>; method?: string } = {},
): Promise<HttpProbe> {
  const started = Date.now();
  const signals = [AbortSignal.timeout(options.timeoutMs ?? 15000), ...(options.signal ? [options.signal] : [])];
  try {
    const response = await fetch(url, { method: options.method ?? 'GET', signal: AbortSignal.any(signals), headers: { 'user-agent': 'jaja-cli', ...options.headers } });
    const body = await response.text();
    return { ok: response.ok, status: response.status, ms: Date.now() - started, body };
  } catch (error) {
    return { ok: false, status: null, ms: Date.now() - started, body: '', error: describeFetchError(error) };
  }
}
