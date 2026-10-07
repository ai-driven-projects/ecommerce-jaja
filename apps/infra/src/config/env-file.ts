import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { parse } from 'dotenv';

/** `apps/infra`. */
export const INFRA_DIR = resolve(__dirname, '..', '..');
/** Root of the monorepo (context of the Docker images). */
export const REPO_ROOT = resolve(INFRA_DIR, '..', '..');
export const DEFAULT_ENV_FILE = 'apps/infra/.env';

/**
 * Path of the .env of the environment: `INFRA_ENV_FILE` (relative to the root
 * of the repository, or absolute) or `apps/infra/.env`.
 */
export function resolveEnvFilePath(envFile: string | undefined, repoRoot = REPO_ROOT): string {
  const file = (envFile ?? '').trim() || DEFAULT_ENV_FILE;
  return isAbsolute(file) ? file : resolve(repoRoot, file);
}

/**
 * Reads the .env without touching `process.env`: the configuration of the
 * environment never mixes with the variables of the shell.
 */
export function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    throw new Error(
      `Arquivo de ambiente não encontrado: ${path}. Copie apps/infra/.env.example para apps/infra/.env ` +
        '(ou indique outro arquivo em INFRA_ENV_FILE) e preencha.',
    );
  }
  return parse(readFileSync(path, 'utf8'));
}
