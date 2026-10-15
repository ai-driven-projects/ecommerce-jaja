import { type ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Processos filhos vivos: são encerrados se a iteração for interrompida. */
const alive = new Set<ChildProcess>();

/**
 * Os pids dos filhos também ficam em disco. Cada filho roda no próprio grupo de
 * processos (`detached`), então um crash da iteração não os leva junto: sem este
 * registro, um `claude` órfão continuaria editando arquivos enquanto o vigia
 * retoma o mesmo passo.
 */
let childrenFile: string | undefined;

export function setChildrenRegistry(file: string | undefined) {
  childrenFile = file;
}

function registerChildren() {
  if (!childrenFile) return;
  try {
    fs.mkdirSync(path.dirname(childrenFile), { recursive: true });
    fs.writeFileSync(childrenFile, JSON.stringify([...alive].map((child) => child.pid).filter(Boolean)));
  } catch {
    // sem registro, o pior caso é um órfão que o vigia não acha
  }
}

const groupAlive = (pid: number) => {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Espera `ms`, ou menos se o sinal for abortado. */
export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

/** Encerra os grupos de processos que uma iteração anterior deixou (depois de um crash). Retorna os pids encontrados. */
export async function killOrphans(file: string, waitMs = 5000): Promise<number[]> {
  let pids: number[];
  try {
    pids = (JSON.parse(fs.readFileSync(file, 'utf8')) as number[]).filter((pid) => Number.isInteger(pid) && pid > 1);
  } catch {
    return [];
  }
  const aliveNow = pids.filter(groupAlive);
  for (const pid of aliveNow) {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      // já saiu
    }
  }
  if (aliveNow.length) await sleep(waitMs);
  for (const pid of aliveNow.filter(groupAlive)) {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // já saiu
    }
  }
  fs.rmSync(file, { force: true });
  return aliveNow;
}

/** Encerra todos os filhos vivos, cada um com o seu grupo (claude → ferramentas; npm → node). */
export function killChildren(signal: NodeJS.Signals = 'SIGTERM') {
  for (const child of alive) {
    try {
      if (child.pid) process.kill(-child.pid, signal);
    } catch {
      child.kill(signal);
    }
  }
}

export const aliveChildren = () => alive.size;

export interface RunResult {
  code: number | null;
  durationMs: number;
  timedOut: boolean;
  cancelled: boolean;
  /** As últimas linhas da saída (stdout + stderr), para relatórios. */
  tail: string[];
}

export interface RunOptions {
  cwd: string;
  timeoutMs: number;
  /** Arquivo que recebe a saída completa. */
  file?: string;
  onLine?: (line: string, stream: 'out' | 'err') => void;
  env?: NodeJS.ProcessEnv;
  /** Cancela o comando (e o grupo dele) quando abortado. */
  signal?: AbortSignal;
}

export const MAX_TAIL = 200;

/**
 * Roda um comando sem shell, linha a linha, com limite de tempo e sem herdar o
 * terminal. Só as últimas MAX_TAIL linhas ficam em memória; o resto vai para o arquivo.
 */
export function run(command: string, args: string[], options: RunOptions): Promise<RunResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tail: string[] = [];
    const output = options.file ? fs.createWriteStream(options.file, { flags: 'a' }) : undefined;
    let timedOut = false;
    let cancelled = false;
    let finished = false;

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, FORCE_COLOR: '0', CI: '1', ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    alive.add(child);
    registerChildren();

    const killGroup = () => {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    };

    const reader = (stream: 'out' | 'err') => {
      let rest = '';
      return (data: Buffer) => {
        output?.write(data);
        rest += data.toString();
        const lines = rest.split('\n');
        rest = lines.pop() ?? '';
        for (const line of lines) {
          tail.push(line);
          if (tail.length > MAX_TAIL) tail.shift();
          options.onLine?.(line, stream);
        }
      };
    };
    child.stdout?.on('data', reader('out'));
    child.stderr?.on('data', reader('err'));

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, options.timeoutMs);
    const onAbort = () => {
      cancelled = true;
      killGroup();
    };
    if (options.signal?.aborted) onAbort();
    options.signal?.addEventListener('abort', onAbort);

    const finish = (code: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      alive.delete(child);
      registerChildren();
      output?.end();
      resolve({ code, durationMs: Date.now() - start, timedOut, cancelled, tail });
    };
    child.on('error', (error) => {
      tail.push(`erro ao iniciar ${command}: ${error.message}`);
      finish(127);
    });
    child.on('close', (code) => finish(timedOut || cancelled ? null : code));
  });
}

/** O comando está no PATH (o do processo, ou o informado)? */
// eslint-disable-next-line turbo/no-undeclared-env-vars -- PATH do processo, não input de build
export function onPath(command: string, searchPath = process.env.PATH ?? ''): boolean {
  const dirs = searchPath.split(path.delimiter).filter(Boolean);
  return dirs.some((dir) => {
    try {
      fs.accessSync(path.join(dir, command), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}
