/** Usuário autenticado como devolvido por `POST /auth/login` e `GET /auth/me`. */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  admin: boolean;
};

/** Sessão guardada no navegador: o token JWT e o usuário que ele representa. */
export type AuthSession = {
  token: string;
  user: AuthUser;
};

/** Dados enviados a `POST /auth/register`; `admin` nunca é aceito pela API. */
export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};
