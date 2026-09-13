import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Texto enviado ao stdin do processo. */
  input?: string;
  /** Não transmite a saída para o reporter (o resultado continua disponível em stdout/stderr). */
  quiet?: boolean;
  onOutput?: (line: string, stream: 'stdout' | 'stderr') => void;
}

export interface ExecResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  /** `true` quando o binário não foi encontrado no PATH. */
  notFound: boolean;
  timedOut: boolean;
}

function splitLines(buffer: string, onLine: (line: string) => void): string {
  const parts = buffer.split(/\r?\n/);
  const rest = parts.pop() ?? '';
  for (const line of parts) onLine(line);
  return rest;
}

export function exec(command: string, args: string[] = [], options: ExecOptions = {}): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env, FORCE_COLOR: '0' },
      shell: process.platform === 'win32',
      stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });

    if (options.input !== undefined && child.stdin) {
      child.stdin.end(options.input);
    }

    let stdout = '';
    let stderr = '';
    let pendingOut = '';
    let pendingErr = '';
    let timedOut = false;
    let settled = false;

    const finish = (result: Omit<ExecResult, 'stdout' | 'stderr' | 'timedOut'>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      if (pendingOut) options.onOutput?.(pendingOut, 'stdout');
      if (pendingErr) options.onOutput?.(pendingErr, 'stderr');
      resolve({ ...result, stdout, stderr, timedOut });
    };

    const onAbort = () => child.kill('SIGTERM');
    options.signal?.addEventListener('abort', onAbort, { once: true });

    const timer = setTimeout(() => {
      if (options.timeoutMs) {
        timedOut = true;
        child.kill('SIGTERM');
      }
    }, options.timeoutMs ?? 0x7fffffff);

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      pendingOut = splitLines(pendingOut + text, (line) => options.onOutput?.(line, 'stdout'));
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      pendingErr = splitLines(pendingErr + text, (line) => options.onOutput?.(line, 'stderr'));
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      stderr += error.message;
      finish({ ok: false, code: null, notFound: error.code === 'ENOENT' });
    });
    child.on('close', (code) => {
      finish({ ok: code === 0 && !timedOut, code, notFound: false });
    });
  });
}

/** Procura um executável no PATH sem depender de `which`/`where`. */
export function findOnPath(binary: string): string | null {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- leitura em runtime, não input de build
  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const extensions =
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of pathEntries) {
    for (const ext of extensions) {
      const candidate = path.join(dir, binary + ext.toLowerCase());
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // continua procurando
      }
    }
  }
  return null;
}

/** Primeira ocorrência de algo parecido com uma versão (ex.: 1.2.3) em um texto. */
export function extractVersion(text: string): string | null {
  const match = text.match(/\d+\.\d+(?:\.\d+)?/);
  return match ? match[0] : null;
}
