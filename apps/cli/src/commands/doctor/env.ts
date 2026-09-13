/** Utilidades puras para inspeção de arquivos .env e DATABASE_URL. */

export function parseEnv(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().replace(/^export\s+/, '');
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const PLACEHOLDER = /(YOUR_|_HERE\b|CHANGE_?ME|REPLACE_?ME|<[^>]+>|^xxx+$)/i;

export function isPlaceholder(value: string): boolean {
  return value.trim() === '' || PLACEHOLDER.test(value);
}

export interface EnvDiff {
  missing: string[];
  placeholders: string[];
}

/** Compara o .env real com o .env.example: chaves faltando e valores não preenchidos. */
export function diffEnv(example: Record<string, string>, actual: Record<string, string>): EnvDiff {
  const missing = Object.keys(example).filter((key) => !(key in actual));
  const placeholders = Object.keys(actual).filter((key) => key in example && isPlaceholder(actual[key] ?? ''));
  return { missing, placeholders };
}

export interface DatabaseTarget {
  host: string;
  port: number;
  isLocal: boolean;
}

export function parseDatabaseUrl(url: string): DatabaseTarget | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (!host) return null;
    const port = parsed.port ? Number(parsed.port) : 5432;
    const isLocal = ['localhost', '127.0.0.1', '::1', 'host.docker.internal'].includes(host);
    return { host, port, isLocal };
  } catch {
    return null;
  }
}

export function meetsMinimumMajor(version: string, minimumMajor: number): boolean {
  const major = Number(version.replace(/^v/, '').split('.')[0]);
  return Number.isFinite(major) && major >= minimumMajor;
}

export interface SubmoduleState {
  path: string;
  state: 'ok' | 'uninitialized' | 'mismatch' | 'conflict';
}

/** Interpreta a saída de `git submodule status`. */
export function parseSubmoduleStatus(output: string): SubmoduleState[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const prefix = line[0];
      const parts = line.slice(1).trim().split(/\s+/);
      const submodulePath = parts[1] ?? '';
      const state: SubmoduleState['state'] = prefix === '-' ? 'uninitialized' : prefix === '+' ? 'mismatch' : prefix === 'U' ? 'conflict' : 'ok';
      return { path: submodulePath, state };
    });
}
