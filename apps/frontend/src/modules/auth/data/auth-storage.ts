import type { AuthSession } from './auth.types';

/**
 * Sessão em cookie legível pelo cliente (o token precisa ir no `Authorization`).
 * Leitura síncrona para que o estado inicial já venha com a sessão no cliente.
 */

export const AUTH_COOKIE_NAME = 'jaja_auth';
const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;
const COOKIE_ATTRIBUTES = 'path=/; SameSite=Lax';

function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.token !== 'string' || candidate.token === '') return false;
  if (typeof candidate.user !== 'object' || candidate.user === null) return false;

  const user = candidate.user as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.name === 'string' &&
    typeof user.email === 'string' &&
    typeof user.admin === 'boolean'
  );
}

/** Retorna `null` no servidor, sem cookie ou com conteúdo inválido. */
export function readAuthSession(): AuthSession | null {
  if (typeof document === 'undefined') return null;

  const prefix = `${AUTH_COOKIE_NAME}=`;
  const row = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
  if (!row) return null;

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(row.slice(prefix.length)));
    return isAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeAuthSession(session: AuthSession): void {
  if (typeof document === 'undefined') return;
  const value = encodeURIComponent(JSON.stringify(session));
  document.cookie = `${AUTH_COOKIE_NAME}=${value}; ${COOKIE_ATTRIBUTES}; max-age=${SEVEN_DAYS_IN_SECONDS}`;
}

export function clearAuthSession(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; ${COOKIE_ATTRIBUTES}; max-age=0`;
}
