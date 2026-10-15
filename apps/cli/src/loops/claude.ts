import fs from 'node:fs';
import path from 'node:path';
import { longDuration, oneLine, stamp } from './format.js';
import { run, sleep } from './process.js';
import type { Activity, SessionSummary } from './types.js';

/** Resultado final de uma sessão (o evento "result" do stream-json). */
export interface ClaudeResult {
  is_error: boolean;
  subtype?: string;
  result?: string;
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
  api_error_status?: number | null;
  structured_output?: unknown;
}

export interface ParsedEvent {
  activities: Activity[];
  result?: ClaudeResult;
  /** Ids de ferramentas que começaram (tool_use) e que terminaram (tool_result) neste evento. */
  tools?: { opened: string[]; closed: string[] };
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null;
const contentOf = (event: Json): Json[] | undefined => {
  const message = event.message;
  if (!isObject(message) || !Array.isArray(message.content)) return undefined;
  return message.content.filter(isObject);
};

/** Converte uma linha do stream-json em atividades legíveis (ou o resultado final). */
export function parseEvent(jsonLine: string, root: string): ParsedEvent {
  let event: unknown;
  try {
    event = JSON.parse(jsonLine);
  } catch {
    return { activities: [] };
  }
  if (!isObject(event)) return { activities: [] };
  const brief = (text: unknown, max: number) =>
    oneLine(
      String(text ?? '')
        .split(`${root}/`)
        .join(''),
      max,
    );
  if (event.type === 'result') return { activities: [], result: event as unknown as ClaudeResult };
  const content = contentOf(event);
  if (event.type === 'user' && content) {
    const closed = content.filter((c) => c.type === 'tool_result' && c.tool_use_id).map((c) => String(c.tool_use_id));
    return { activities: [], tools: { opened: [], closed } };
  }
  if (event.type !== 'assistant' || !content) return { activities: [] };
  const activities: Activity[] = [];
  const opened: string[] = [];
  for (const c of content) {
    if (c.type === 'tool_use' && c.id) opened.push(String(c.id));
    if (c.type === 'tool_use') {
      if (c.name === 'TodoWrite' || c.name === 'StructuredOutput') continue;
      const input = isObject(c.input) ? c.input : {};
      const target =
        input.command ??
        input.file_path ??
        input.pattern ??
        input.skill ??
        input.description ??
        input.path ??
        input.url ??
        '';
      activities.push({ ts: Date.now(), kind: 'tool', text: `${String(c.name)} ${brief(target, 160)}`.trim() });
    } else if (c.type === 'text' && typeof c.text === 'string' && c.text.trim()) {
      activities.push({ ts: Date.now(), kind: 'text', text: brief(c.text, 400) });
    }
  }
  return { activities, tools: { opened, closed: [] } };
}

/**
 * Sessão parada: nenhum sinal do Claude há `idleMs` e nenhuma ferramenta em
 * execução (um build ou teste longo rodando pelo Bash não conta como parada).
 */
export const sessionIdle = (now: number, lastSignal: number, openTools: number, idleMs: number) =>
  openTools === 0 && now - lastSignal >= idleMs;

/** Falhas que passam sozinhas: vale esperar mais antes de tentar de novo. */
export function isTemporaryLimit(result: ClaudeResult | undefined, stderr: string): boolean {
  if (result?.api_error_status && [429, 500, 502, 503, 529].includes(result.api_error_status)) return true;
  return /rate.?limit|usage limit|overloaded|temporarily unavailable|ECONNRESET|ETIMEDOUT/i.test(
    `${result?.result ?? ''}\n${stderr}`,
  );
}

export interface SessionOptions {
  label: string;
  prompt: string;
  /** Pasta que recebe o stream completo (<hhmmss>-<label>.jsonl). */
  dir: string;
  root: string;
  /** Prompt de sistema (regras gerais + regras do loop). */
  system: string;
  forbidden: string[];
  model?: string;
  /** Esquema JSON da resposta estruturada. */
  schema?: object;
  timeoutMs: number;
  /** Sem sinal do Claude por este tempo (fora de ferramenta em execução), a tentativa é encerrada. */
  idleMs?: number;
  signal?: AbortSignal;
  onActivity?: (activity: Activity) => void;
  onLog?: (text: string) => void;
  /** Mostra (ou limpa, com undefined) que a sessão está esperando para tentar de novo. */
  onWait?: (text: string | undefined) => void;
  onAttemptStart?: (label: string, attempt: number) => void;
  /** Cada tentativa, com custo e turnos: é por aqui que os totais do loop crescem. */
  onAttemptEnd?: (summary: SessionSummary) => void;
}

export interface SessionEnd {
  ok: boolean;
  result?: ClaudeResult;
  file: string;
  error?: string;
  cancelled: boolean;
}

export const RETRY_WAITS_MS = [30_000, 120_000];
export const LIMIT_WAIT_MS = 10 * 60_000;

export function claudeArgs(
  options: Pick<SessionOptions, 'prompt' | 'system' | 'forbidden' | 'model' | 'schema'>,
): string[] {
  const args = [
    '-p',
    `${options.prompt}\n\n(Escreva todas as mensagens em português, inclusive a primeira.)`,
    '--output-format',
    'stream-json',
    '--verbose',
    '--append-system-prompt',
    options.system,
    '--dangerously-skip-permissions',
    '--disallowedTools',
    ...options.forbidden,
  ];
  if (options.model) args.push('--model', options.model);
  if (options.schema) args.push('--json-schema', JSON.stringify(options.schema));
  return args;
}

/**
 * Roda o Claude sem interação (claude -p, stream-json), sempre numa sessão nova,
 * guardando o stream completo em arquivo. Tenta de novo quando a sessão termina
 * com erro; espera mais se for limite de uso.
 */
export async function claudeSession(options: SessionOptions): Promise<SessionEnd> {
  const args = claudeArgs(options);
  fs.mkdirSync(options.dir, { recursive: true });
  let last: SessionEnd = { ok: false, file: '', cancelled: false };
  for (let attempt = 1; attempt <= RETRY_WAITS_MS.length + 1; attempt++) {
    const file = path.join(options.dir, `${stamp()}-${options.label}.jsonl`);
    const stderr: string[] = [];
    let result: ClaudeResult | undefined;
    options.onAttemptStart?.(options.label, attempt);
    options.onLog?.(
      `claude -p (${options.label})${attempt > 1 ? ` · tentativa ${attempt}` : ''} → ${path.relative(options.root, file)}`,
    );

    // a API às vezes para de responder no meio de uma geração: sem este vigia,
    // a sessão só cairia no sessionMin (60 min) e seria refeita do zero
    const stop = new AbortController();
    const forward = () => stop.abort();
    if (options.signal?.aborted) forward();
    options.signal?.addEventListener('abort', forward);
    let lastSignal = Date.now();
    const tools = new Set<string>();
    let idle = false;
    const idleMs = options.idleMs;
    const watchdog = idleMs
      ? setInterval(
          () => {
            if (!sessionIdle(Date.now(), lastSignal, tools.size, idleMs)) return;
            idle = true;
            stop.abort();
          },
          Math.min(30_000, Math.max(50, idleMs / 4)),
        )
      : undefined;

    const output = await run('claude', args, {
      cwd: options.root,
      timeoutMs: options.timeoutMs,
      file,
      signal: stop.signal,
      onLine: (line, stream) => {
        lastSignal = Date.now();
        if (stream === 'err') {
          if (stderr.length < 200) stderr.push(line);
          return;
        }
        const event = parseEvent(line, options.root);
        event.tools?.opened.forEach((id) => tools.add(id));
        event.tools?.closed.forEach((id) => tools.delete(id));
        event.activities.forEach((activity) => options.onActivity?.(activity));
        if (event.result) result = event.result;
      },
    });
    clearInterval(watchdog);
    options.signal?.removeEventListener('abort', forward);
    if (stderr.length) fs.writeFileSync(`${file}.stderr`, stderr.join('\n'));

    const cancelled = output.cancelled && !idle;
    const ok = !!result && !result.is_error && output.code === 0;
    const error = ok
      ? undefined
      : idle
        ? `sessão ficou ${longDuration(idleMs ?? 0)} sem nenhum sinal do Claude e foi encerrada`
        : cancelled
          ? 'cancelada'
          : output.timedOut
            ? `sessão passou de ${Math.round(options.timeoutMs / 60_000)} min e foi encerrada`
            : oneLine(result?.result || stderr.slice(-3).join(' ') || `claude saiu com código ${output.code}`, 300);
    options.onAttemptEnd?.({
      label: options.label,
      attempt,
      ok,
      error,
      cost: result?.total_cost_usd ?? 0,
      turns: result?.num_turns ?? 0,
      durationMs: output.durationMs,
      file: path.relative(options.root, file),
      end: Date.now(),
    });
    last = { ok, result, file, error, cancelled };
    if (ok || cancelled || options.signal?.aborted) return last;
    if (attempt > RETRY_WAITS_MS.length) break;

    const limit = isTemporaryLimit(result, stderr.join('\n'));
    const wait = limit ? LIMIT_WAIT_MS : (RETRY_WAITS_MS[attempt - 1] ?? LIMIT_WAIT_MS);
    options.onWait?.(
      `${limit ? 'aguardando limite de uso' : 'sessão do Claude falhou'}; nova tentativa em ${Math.round(wait / 1000)}s`,
    );
    await sleep(wait, options.signal);
    options.onWait?.(undefined);
    if (options.signal?.aborted) return { ...last, cancelled: true };
  }
  return last;
}
