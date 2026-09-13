import { errorMessagesPt } from '@/shared/i18n/messages.pt';
import type { AuthSession, RegisterInput } from './auth.types';

/**
 * Cliente HTTP do módulo auth. Erros da API viram `Error` com mensagem já
 * traduzida para o usuário; o formulário só precisa exibir `error.message`.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

type ApiErrorPayload = {
  statusCode?: number;
  error?: string;
  message?: string[] | string;
  details?: unknown;
};

const ERROR_MESSAGE_BY_CODE: Readonly<Record<string, string>> = {
  INVALID_CREDENTIALS: 'Email ou senha inválidos',
  EMAIL_ALREADY_EXISTS: 'Este email já está cadastrado',
};

const GENERIC_ERROR_MESSAGE = 'Não foi possível concluir. Tente novamente.';
const NETWORK_ERROR_MESSAGE = 'Não foi possível falar com o servidor. Tente novamente.';

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string' && value.trim() !== '') return [value];
  return [];
}

/** `details` só existe em erros de validação: lista de `{ code, message }` ou textos. */
function extractDetails(details: unknown): string[] {
  if (!Array.isArray(details)) return [];

  return details.flatMap((detail) => {
    if (typeof detail === 'string') return [detail];
    if (typeof detail === 'object' && detail !== null) {
      const record = detail as Record<string, unknown>;
      const text = record.message ?? record.code;
      return typeof text === 'string' ? [text] : [];
    }
    return [];
  });
}

export function describeApiError(payload: ApiErrorPayload | null | undefined): string {
  const codes = toStringList(payload?.message);
  const dictionary = errorMessagesPt as Record<string, string | undefined>;
  const known = codes.map((code) => ERROR_MESSAGE_BY_CODE[code] ?? dictionary[code]).find(Boolean);
  if (known) return known;

  const reasons = [...codes, ...extractDetails(payload?.details)];
  if (reasons.length === 0) return GENERIC_ERROR_MESSAGE;

  return `Não foi possível concluir (${reasons.join(', ')}).`;
}

async function readErrorPayload(response: Response): Promise<ApiErrorPayload | null> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return null;
  }
}

/** Envia JSON para a API e devolve a resposta; falha de rede vira `Error` legível. */
async function postJson(path: string, body: unknown): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(describeApiError(await readErrorPayload(response)));
  }

  return response;
}

/** Autentica por email e senha. Lança `Error` com mensagem legível em qualquer falha. */
export async function login(email: string, password: string): Promise<AuthSession> {
  const response = await postJson('/auth/login', { email, password });
  return (await response.json()) as AuthSession;
}

/**
 * Registra um usuário comum (`POST /auth/register`, 201 sem corpo). Email já
 * cadastrado (`409 EMAIL_ALREADY_EXISTS`) vira "Este email já está cadastrado".
 */
export async function register({ name, email, password }: RegisterInput): Promise<void> {
  await postJson('/auth/register', { name, email, password });
}
