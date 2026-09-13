---
name: confg-auth-core-full
description: Criar/recriar a autenticação completa do monorepo (módulo `modules/auth` + backend Nest + frontend Next) de forma determinística, incluindo email/senha, roles/permissions, OAuth Google e artefatos Prisma. Usar quando o pedido envolver bootstrap/rebootstrap full de autenticação no padrão Genérico.
---

# Config Auth Core Full

## Overview

Configura a autenticação do projeto como um todo a partir de templates versionados na skill:

1. **Core** — `modules/auth` (domínio puro: `user`, `password`, `role`, `permission`, `oauth`, `application`, `audit`)
2. **Backend** — `apps/backend/src/modules/auth` (Nest controllers/adapters Prisma + `GoogleOAuthProvider`)
3. **Frontend** — usa o template alinhado de `config-auth-web-basic` (rotas `(public)`/`(private)` + shared atual) com botão Google no sign-in
4. **Prisma** — `apps/backend/prisma/models/auth.prisma` (+ `audit.prisma` quando presente) e migrations de auth/OAuth
5. **Env** — chaves `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`
6. **Infra Nest** — `PrismaTransactionManager`, guards/decorators de permission, reexport de erros

Padrão de nomenclatura do domínio segue o setup de autenticação de referência:

- pastas `usecase/` e arquivos `*.usecase.ts`
- erros em `errors/`
- `create-user` em `application/`
- OAuth com `LoginOAuthUseCase` + provider Google no backend

## Workflow

1. Executar na **raiz do monorepo** (cwd = repo): `node scripts/create-auth-core-full.mjs` (ou via `<SKILLS_DIR>/...`).
2. Resolver namespace: `--scope` > `PROJECT_NAMESPACE`/`SKILLS_NAMESPACE` > `skills.config.local.json` > `skills.config.json` > fallback do template.
3. Validar contratos dos templates core e apps.
4. Com `--force`, sobrescrever `modules/auth` e reaplicar backend/frontend auth.
5. Aplicar template de apps (Nest + Next + Google) salvo com `--skip-apps`.
   - Frontend: copia `providers.tsx`, `(private)/layout.tsx` (`PrivateRoute`, não o `RouteGuard` do shared-frontend) + rotas auth e faz **patch idempotente** do `src/app/layout.tsx` raiz para envolver `{children}` com `<AppProviders>` (e `<Toaster />` quando existir), sem sobrescrever fontes/metadata.
6. Sincronizar dependência `<scope>/auth` em backend/frontend e rodar `npm install` (salvo flags de skip).
7. Registrar execução em `.log/skills.log`.

> O root do monorepo é sempre `process.cwd()` — rode o script a partir da raiz do projeto destino.

## Commands

```bash
node <SKILLS_DIR>/confg-auth-core-full/scripts/create-auth-core-full.mjs
```

```bash
node <SKILLS_DIR>/confg-auth-core-full/scripts/create-auth-core-full.mjs --scope @namespace --force
```

```bash
node <SKILLS_DIR>/confg-auth-core-full/scripts/create-auth-core-full.mjs --force --run-tests
```

```bash
node <SKILLS_DIR>/confg-auth-core-full/scripts/create-auth-core-full.mjs --force --skip-apps
```

```bash
node <SKILLS_DIR>/confg-auth-core-full/scripts/create-auth-core-full.mjs --force --skip-apps-sync --skip-install
```

## Google OAuth

Endpoints backend:

- `GET /auth/google/start`
- `GET /auth/google/callback`

Frontend:

- botão Google em sign-in aponta para `/auth/google/start`

Env mínimo (merge em `apps/backend/.env.example`):

```bash
JWT_SECRET="YOUR_SECRET_HERE"
GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
GOOGLE_REDIRECT_URI="http://localhost:4000/auth/google/callback"
FRONTEND_URL="http://localhost:3000"
```

## Resources

- `scripts/create-auth-core-full.mjs`: gerador determinístico (core + apps).
- `assets/auth-core-full-template`: template do pacote `modules/auth`.
- `assets/auth-full-apps-template`: template backend/frontend/Prisma/env.
- `references/auth-core-full-template-contract.md`: contrato dos artefatos gerados.

## Output Contract

A skill deve gerar exatamente a estrutura descrita em `references/auth-core-full-template-contract.md`, cobrindo core + backend + frontend com Google OAuth.

## Global Standards

- Consultar `../skills-standards.md` para padrões globais.
- Exceção desta skill: pastas/arquivos de use case no domínio auth usam `usecase` / `*.usecase.ts` (padrão do setup de autenticação de referência), não `use-case`.
