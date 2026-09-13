# Auth Core Full Template Contract

## Goal

Inicializar autenticação completa no monorepo:

- **Core** em `modules/auth`
- **Backend** em `apps/backend/src/modules/auth` (+ Prisma models/migrations)
- **Frontend** em `apps/frontend/src/modules/auth` (+ rotas App Router)
- **Google OAuth** end-to-end (provider Nest, rotas `/auth/google/*`, botão no sign-in, env)

## Core (`assets/auth-core-full-template`)

Obrigatório:

- configs (`package.json`, `tsconfig.json`, `jest.config.ts`)
- `src/user`, `src/password`, `src/role`, `src/permission`, `src/oauth`, `src/application`, `src/audit`, `src/index.ts`
- nomenclatura `usecase/` + `*.usecase.ts` e `errors/`
- `CreateUserUseCase` em `src/application/usecase`
- `LoginOAuthUseCase` em `src/oauth/usecase`
- testes em `test/**` cobrindo user/password/role/permission/oauth/application/audit

## Apps (`assets/auth-full-apps-template`)

Obrigatório:

- Backend:
  - `auth.controller.ts` com login/register/me/users e `google/start` + `google/callback`
  - `auth.module.ts` registrando `GoogleOAuthProvider` e `OAuthAccountPrisma`
  - `providers/google-oauth.provider.ts`
  - adapters `*.prisma.ts` (user/password/role/permission/oauth/audit)
  - `prisma/models/auth.prisma` com `OAuthAccount` + enum `OAuthProvider.GOOGLE`
  - migrations de auth/OAuth
  - `auth.env.example` com JWT + Google
- Frontend:
  - módulo `src/modules/auth` com sign-in contendo CTA Google → `/auth/google/start`
  - rotas App Router de auth (external + admin)
  - `src/app/(private)/layout.tsx` com `PrivateRoute` (substitui o `RouteGuard` do config-shared-frontend)
  - `src/app/providers.tsx` com `AuthProvider`
  - `src/app/layout.tsx` raiz com patch idempotente: `{children}` envolvido por `<AppProviders>` (sem sobrescrever o arquivo inteiro)

## Required Rules

- Nome do pacote core: `<scope>/auth`
- Tokens nos templates:
  - `__SHARED_PACKAGE_NAME__`
  - `__AUTH_PACKAGE_NAME__` (apps)
- Dependência `<scope>/auth` sincronizada em `apps/backend` e `apps/frontend`
- Após sync, `npm install` no root (salvo `--skip-install`)
- `Password` valida `HashPassword`
- `ChangePasswordUseCase` aplica política e evita reuso recente
- `CreateUserUseCase` usa `TransactionManager.runInTransaction`
- Google OAuth exige `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`

## Command

```bash
node <SKILLS_DIR>/confg-auth-core-full/scripts/create-auth-core-full.mjs [--scope @namespace] [--force] [--run-tests] [--target <path>] [--skip-apps] [--skip-apps-sync] [--skip-install]
```

## Namespace Resolution

1. `--scope`
2. `PROJECT_NAMESPACE` / `SKILLS_NAMESPACE`
3. `skills.config.local.json`
4. `skills.config.json`
5. scope do template em `assets/auth-core-full-template/package.json`

## Deterministic Source

- `assets/auth-core-full-template/**`
- `assets/auth-full-apps-template/**`

Sem geração dinâmica via LLM e sem shell específico.
