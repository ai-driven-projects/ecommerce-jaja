import { describeApiError, NETWORK_ERROR_MESSAGE, readErrorPayload } from '@/shared/util/api-client.util';
import type { AuthSession, RegisterInput } from './auth.types';

/**
 * Cliente HTTP do módulo auth. Erros da API viram `Error` com mensagem já
 * traduzida para o usuário (`describeApiError`, do cliente compartilhado);
 * o formulário só precisa exibir `error.message`.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

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
