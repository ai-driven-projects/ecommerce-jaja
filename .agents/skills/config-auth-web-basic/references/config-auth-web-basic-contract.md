# Config Auth Web Basic Contract

## Objetivo

Garantir que o frontend tenha o modulo de autenticacao web basico funcional, com fluxo de login/cadastro, rotas privadas/publicas, controle de acesso admin e telas de usuarios/perfil.

## Pre-requisitos de infraestrutura

- `apps/frontend/src/shared/index.ts` deve existir.
- `apps/frontend/src/shared/i18n/index.ts` deve existir.
- `apps/frontend/src/shared/components/form/validator/index.ts` deve existir.
- `apps/frontend/src/shared/components/ui/empty-dashboard-state.tsx` deve existir.
- `apps/frontend/src/shared/components/ui/sidebar-menu.component.tsx` deve existir.
- `apps/frontend/src/shared/template/app-shell.component.tsx` deve existir.

## Artefatos obrigatorios

- `apps/frontend/src/modules/auth/**`
- `apps/frontend/src/app/providers.tsx`
- `apps/frontend/src/app/layout.tsx`
- `apps/frontend/src/app/page.tsx`
- `apps/frontend/src/app/(public)/layout.tsx`
- `apps/frontend/src/app/(private)/layout.tsx`
- `apps/frontend/src/app/(public)/auth/sign-in/page.tsx`
- `apps/frontend/src/app/(public)/auth/sign-up/page.tsx`
- `apps/frontend/src/app/(private)/auth/layout.tsx`
- `apps/frontend/src/app/(private)/auth/page.tsx`
- `apps/frontend/src/app/(private)/auth/users/page.tsx`
- `apps/frontend/src/app/(private)/auth/profile/page.tsx`
- `apps/frontend/src/modules/auth/components/private-app-shell.component.tsx`
- `apps/frontend/src/modules/auth/providers/auth-session.provider.tsx`
- `apps/frontend/src/modules/auth/data/api-client.ts`
- `apps/frontend/src/modules/auth/data/*.schema.ts` (flat em `data/`)

## Arquivos convergidos

- `apps/frontend/package.json` deve conter dependencias:
  - `<scope>/auth: "*"`
  - `<scope>/shared: "*"`
  - `lucide-react`
  - `react-hook-form`
  - `sonner`

## Endpoints consumidos pelo modulo web

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /auth/users`
- `GET /auth/users/by-email`
- `GET /auth/users/:id`
- `POST /auth/user/create`
- `PATCH /auth/users/:id`
- `PATCH /auth/password/change`
- `DELETE /auth/users/:id`

## Estrutura funcional esperada

- Provider global de auth (`AuthProvider`) com token em localStorage.
- Guards/components de rota:
  - `PrivateRoute`
  - `PublicOnlyRoute`
  - `AdminRoute`
  - `RequireAdmin`
- Composicao de shell privado:
  - `PrivateAppShell` em `modules/auth/components/private-app-shell.component.tsx`
  - `AuthProvider` em `modules/auth/providers/auth-session.provider.tsx`
  - `app/(private)/layout.tsx` deve aplicar apenas `ShellProvider` + `PrivateRoute`
  - `app/(private)/auth/layout.tsx` deve aplicar `AdminRoute` + `PrivateAppShell` com `AuthSidebarMenu`
  - `AuthSidebarMenu` deve usar `shared/components/ui/sidebar-menu.component.tsx`
  - qualquer `app/(private)/*/layout.tsx` (subpastas diretas) que nao estiver usando `PrivateAppShell` deve ser convergido automaticamente para usar
- Telas do modulo auth:
  - `SignInPage`
  - `SignUpPage`
  - `AuthDashboardPage` (renderizando `EmptyDashboardState` com `moduleName` de autenticacao)
  - `UsersPage` (com dialogs modais de criar/editar/visualizar)
  - `ProfilePage` (dados do usuario, troca de senha e avatar)
- Campos de usuario com suporte a:
  - `name`
  - `email`
  - `password`
  - `avatarUrl`
  - indicador de perfil admin (`admin: boolean`)

## Regras de compatibilidade

- Tipos de dominio devem vir de `<scope>/auth`.
- Value objects/suporte compartilhado devem vir de `<scope>/shared`.
- Rotas auth publicas devem funcionar sem shell privado.
- Rotas privadas e administrativas devem respeitar autenticacao e perfil admin.
- Chave de token local deve usar slug de scope (`__PROJECT_SCOPE_SLUG__.access_token`) apos replace.
- Preferencialmente o template deve manter placeholders `__AUTH_PACKAGE_NAME__`, `__SHARED_PACKAGE_NAME__` e `__PROJECT_SCOPE_SLUG__`; quando ausentes, a skill aplica fallback de replace por literais conhecidos.
