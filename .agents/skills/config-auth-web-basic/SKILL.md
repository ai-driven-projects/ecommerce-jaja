---
name: config-auth-web-basic
description: Criar/recriar de forma deterministica o modulo de autenticacao web no Next.js (sign-in/sign-up/dashboard/users/profile), com contexto de auth, schemas/formularios, rotas App Router e componentes de controle de acesso (private/public/admin), refletindo o estado atual do `apps/frontend` e compatibilidade com a infraestrutura base do shared-web. Usar quando o pedido envolver bootstrap/rebootstrap da camada web de autenticacao.
---

# Config Auth Web Basic

## Overview

Executar setup idempotente da autenticacao web no `apps/frontend`, cobrindo:

- modulo `src/modules/auth` completo:
  - `components` (private/public/admin route, navegacao por `SidebarMenu`, avatar, cards/forms, indicador admin)
  - `data` (`api-client.ts`, `*.api.ts`, `*.schema.ts`, `use-auth.ts`)
  - `providers` (`auth-session.provider.tsx` com `AuthProvider`)
  - `components` inclui `PrivateAppShell` para composicao de rotas privadas (tipagem via `ComponentProps<typeof AppShell>`, sem depender de export `AppShellProps`)
  - `pages` (`sign-in`, `sign-up`, `auth-dashboard`, `users`, `profile`), com `auth-dashboard` usando `EmptyDashboardState` com `moduleName`
- integracao no App Router:
  - rotas publicas em `src/app/(public)/auth/*`
  - rotas privadas/admin em `src/app/(private)/auth/*`
  - evitar colisao de rota `/auth`: quando existir `src/app/(private)/auth/page.tsx`, nao manter `src/app/(public)/auth/page.tsx`
  - `src/app/(private)/layout.tsx` com `ShellProvider` + `PrivateRoute` (sem shell visual acoplado)
  - `src/app/(private)/auth/layout.tsx` usando `PrivateAppShell` com `AuthSidebarMenu`
- convergencia automatica dos layouts privados:
  - todo `src/app/(private)/*/layout.tsx` (subpastas diretas) que ainda nao usa `PrivateAppShell` passa a envolver `{children}` com `PrivateAppShell` automaticamente
  - `src/app/(private)/layout.tsx` (layout raiz do grupo privado) nao deve ser envolvido por `PrivateAppShell`
  - a convergencia tambem vale para layouts criados por outras skills/modulos
- integracao de provider global:
  - `src/app/providers.tsx`
  - `src/app/layout.tsx` envolvendo `AppProviders`
- dependencia de workspace do pacote de dominio auth em `apps/frontend/package.json`
- validacao de pre-requisitos do shared-web (`src/shared`, `validator`, `AppShell` e `SidebarMenu`)

A skill aplica arquivos canonicos por template versionado e faz replace automatico de:

- `__AUTH_PACKAGE_NAME__` -> `<scope>/auth`
- `__SHARED_PACKAGE_NAME__` -> `<scope>/shared`
- `__PROJECT_SCOPE_SLUG__` -> slug do scope para chaves locais (ex.: `application`)

O script valida placeholders canonicos do template e, quando ausentes, aplica fallback automatico por literais conhecidos, mantendo a aplicacao idempotente. Tambem garante dependencias usadas diretamente pelo modulo (`react-hook-form`, `sonner`, `lucide-react`).

## Workflow

1. Garantir base shared-web pronta (ex.: skill `config-shared-web` ja aplicada).
2. Rodar simulacao:
   - `node <SKILLS_DIR>/config-auth-web-basic/scripts/init-config-auth-web-basic.mjs --dry-run`
3. Aplicar mudancas:
   - `node <SKILLS_DIR>/config-auth-web-basic/scripts/init-config-auth-web-basic.mjs --apply`
4. Opcionalmente instalar dependencias e validar build:
   - `node <SKILLS_DIR>/config-auth-web-basic/scripts/init-config-auth-web-basic.mjs --apply --install --run-build`

## Commands

Aplicar modulo auth web basico:

```bash
node <SKILLS_DIR>/config-auth-web-basic/scripts/init-config-auth-web-basic.mjs --apply
```

Aplicar e instalar dependencias:

```bash
node <SKILLS_DIR>/config-auth-web-basic/scripts/init-config-auth-web-basic.mjs --apply --install
```

Aplicar, instalar e validar build:

```bash
node <SKILLS_DIR>/config-auth-web-basic/scripts/init-config-auth-web-basic.mjs --apply --install --run-build
```

Forcar namespace fallback quando nao for possivel detectar o pacote auth automaticamente:

```bash
node <SKILLS_DIR>/config-auth-web-basic/scripts/init-config-auth-web-basic.mjs --apply --scope @namespace
```

## Resources

- `scripts/init-config-auth-web-basic.mjs`: orquestrador idempotente da skill com validacoes de pre-requisito e placeholders.
- `assets/config-auth-web-basic-template`: template canonico dos arquivos do auth web.
- `references/config-auth-web-basic-contract.md`: contrato de saida esperado.
- Log local: `.log/skills.log`.

## Output Contract

A skill deve convergir o frontend para o contrato descrito em `references/config-auth-web-basic-contract.md`, mantendo compatibilidade com `@namespace/auth`, `@mentoria-360/shared` e com execucao repetivel sem duplicacao estrutural.

## Risk Logging Guardrails

- Registrar fatos de execucao em `.log/skills.log` com marcador no inicio da linha.
- Marcadores minimos esperados: `[CMD]`, `[FILE_CREATE]`, `[FILE_UPDATE]`, `[FILE_DELETE]`, `[DIR_CREATE]`, `[RISK]`, `[FAIL]`, `[AI]`.
- Sempre registrar `[RISK]` quando houver sobrescrita, exclusao, rename/move, ou fallback forcado em arquivos/pastas.
- Toda falha inesperada deve gerar `[FAIL]` com descricao factual curta do evento.
- Operacoes de terminal e alteracoes de arquivos devem passar pelos utilitarios compartilhados em `../utils` para manter rastreabilidade consistente.

## Global Standards

- Consultar `../skills-standards.md` para padroes globais de nomenclatura e convencoes gerais entre skills.
