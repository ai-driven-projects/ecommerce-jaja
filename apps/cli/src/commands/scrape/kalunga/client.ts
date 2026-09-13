import { sleep } from '../../../core/net.js';

export interface ClientOptions {
  signal?: AbortSignal;
  /** Requisições simultâneas no máximo. */
  concurrency?: number;
  /** Pausa mínima entre o início de duas requisições, para não sobrecarregar o site. */
  minIntervalMs?: number;
  timeoutMs?: number;
  retries?: number;
  userAgent?: string;
}

export interface HttpClient {
  text(url: string, init?: RequestInit): Promise<string>;
  json<T>(url: string, init?: RequestInit): Promise<T>;
  /** Requisições feitas até agora (para o resumo). */
  readonly requests: number;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} em ${url}`);
  }
}

const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

/** Cliente HTTP com limite de concorrência, intervalo mínimo, tempo limite e novas tentativas em falhas transitórias. */
export function createClient(options: ClientOptions = {}): HttpClient {
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const minInterval = options.minIntervalMs ?? 150;
  const timeoutMs = options.timeoutMs ?? 30000;
  const retries = options.retries ?? 2;
  let active = 0;
  let lastStart = 0;
  let requests = 0;
  const queue: Array<() => void> = [];

  const acquire = () =>
    new Promise<void>((resolve) => {
      const tryStart = () => {
        if (active >= concurrency) {
          queue.push(tryStart);
          return;
        }
        const wait = Math.max(0, lastStart + minInterval - Date.now());
        active += 1;
        lastStart = Date.now() + wait;
        if (wait > 0) setTimeout(resolve, wait);
        else resolve();
      };
      tryStart();
    });
  const release = () => {
    active -= 1;
    queue.shift()?.();
  };

  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    await acquire();
    try {
      for (let attempt = 0; ; attempt += 1) {
        options.signal?.throwIfAborted();
        const signals = [AbortSignal.timeout(timeoutMs), ...(options.signal ? [options.signal] : [])];
        try {
          requests += 1;
          const response = await fetch(url, {
            ...init,
            signal: AbortSignal.any(signals),
            headers: { 'user-agent': options.userAgent ?? DEFAULT_UA, accept: 'application/json, text/html;q=0.9, */*;q=0.8', ...(init.headers ?? {}) },
          });
          if (response.ok) return response;
          if (response.status < 500 && response.status !== 429) throw new HttpError(response.status, url);
          if (attempt >= retries) throw new HttpError(response.status, url);
        } catch (error) {
          if (options.signal?.aborted) throw error;
          if (error instanceof HttpError && (error.status < 500 && error.status !== 429)) throw error;
          if (attempt >= retries) throw error;
        }
        await sleep(500 * 2 ** attempt);
      }
    } finally {
      release();
    }
  }

  return {
    get requests() {
      return requests;
    },
    async text(url, init) {
      return (await request(url, init)).text();
    },
    async json<T>(url: string, init?: RequestInit) {
      return (await request(url, init)).json() as Promise<T>;
    },
  };
}

/** Executa `fn` para cada item com no máximo `limit` em paralelo, preservando a ordem dos resultados. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index] as T, index);
    }
  });
  await Promise.all(workers);
  return results;
}
