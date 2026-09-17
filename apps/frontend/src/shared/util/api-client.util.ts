import { errorMessagesPt } from '@/shared/i18n/messages.pt';

/**
 * Cliente HTTP compartilhado com a API. Respostas com erro viram `ApiError`
 * com o status, os códigos devolvidos em `message` e uma mensagem já traduzida
 * para o usuário; a tela só precisa exibir `error.message` ou olhar `codes`.
 */

/** Origem da API (`NEXT_PUBLIC_API_URL`); os caminhos começam com `/`. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export type ApiErrorPayload = {
  statusCode?: number;
  error?: string;
  message?: string[] | string;
  details?: unknown;
};

const ERROR_MESSAGE_BY_CODE: Readonly<Record<string, string>> = {
  INVALID_CREDENTIALS: 'Email ou senha inválidos',
  EMAIL_ALREADY_EXISTS: 'Este email já está cadastrado',
};

export const GENERIC_ERROR_MESSAGE = 'Não foi possível concluir. Tente novamente.';
export const NETWORK_ERROR_MESSAGE = 'Não foi possível falar com o servidor. Tente novamente.';

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

export async function readErrorPayload(response: Response): Promise<ApiErrorPayload | null> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return null;
  }
}

/**
 * Erro de uma resposta da API. A API sempre devolve os códigos em `message`
 * (ex.: `{ statusCode: 409, message: ["BRAND_NAME_ALREADY_EXISTS"] }`), que
 * ficam em `codes`; `message` é a versão legível de `describeApiError`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly codes: string[];

  constructor(status: number, payload: ApiErrorPayload | null) {
    super(describeApiError(payload));
    this.name = 'ApiError';
    this.status = status;
    this.codes = toStringList(payload?.message);
  }
}

/** Mensagem para toaster a partir de qualquer erro lançado por `apiRequest`. */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : GENERIC_ERROR_MESSAGE;
}

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
};

/**
 * Chama a API e devolve o corpo JSON (`undefined` em `204`). Envia
 * `Content-Type` só quando há corpo e `Authorization` só quando há token.
 * Resposta com erro lança `ApiError`; falha de rede lança `Error` legível.
 */
export async function apiRequest<T>(path: string, { method = 'GET', token, body }: ApiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorPayload(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
