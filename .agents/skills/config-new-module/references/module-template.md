# Module Template Contract

## Goal

Gerar um módulo novo de forma determinística em três áreas do monorepo:

- domain package: `modules/<module-name>`
- backend: `<backendAppPath>/src/modules/<module-name>` + `<backendAppPath>/prisma/models/<module-name>.model.prisma`
- frontend: `<frontendAppPath>/src/modules/<module-name>` + rota em `<frontendAppPath>/src/app/(private)/<module-name>` quando `(private)` existir

## Required Files

### Package

- `package.json`
- `tsconfig.json`
- `jest.config.ts`
- `src/index.ts`
- `src/<module-name>/dto/`, `model/`, `provider/`, `use-case/` (via `module-aggregate` modo `example`)
- `test/index.test.ts`
- `test/<module-name>/` (testes do use case exemplo)
- `test/mock/in-memory-<module-name>.repository.ts`

### Backend

- `<module-name>.controller.ts`
- `<module-name>.prisma.ts`
- `<module-name>.module.ts`
- `index.ts` (re-export do módulo)
- Registro do `<ModuleName>Module` em `<backendAppPath>/src/app.module.ts`
- `<backendAppPath>/prisma/models/<module-name>.model.prisma`
- Dependência `<scope>/<module-name>` em `<backendAppPath>/package.json`

### Frontend

- `<frontendAppPath>/src/modules/<module-name>/components/<module-name>-dashboard.component.tsx`
- `<frontendAppPath>/src/modules/<module-name>/data/index.ts`
- `<frontendAppPath>/src/modules/<module-name>/pages/dashboard.page.tsx`
- `<frontendAppPath>/src/modules/<module-name>/index.ts`
- atualização em `<frontendAppPath>/src/app/(private)/dashboard/layout.tsx` (quando existir) com item do novo módulo no menu principal (`moduleItems` com label/href/icon)
- `<frontendAppPath>/src/app/(private)/<module-name>/page.tsx` quando `(private)` existir
- `<frontendAppPath>/src/app/(private)/<module-name>/layout.tsx` quando `(private)` existir
- Dependência `<scope>/<module-name>` em `<frontendAppPath>/package.json`

> A arquitetura esperada usa `src/modules` e `src/app` dentro de `apps/frontend`.

## Package Rules

- Nome do pacote: `<scope>/<module-name>`.
- Dependência obrigatória em `<scope>/<basename(sharedModulePath)>`.
- Dependência do módulo novo também deve ser adicionada em backend e frontend:
  - `<backendAppPath>/package.json` -> `<scope>/<module-name>: "*"`
  - `<frontendAppPath>/package.json` -> `<scope>/<module-name>: "*"`
- O nome real do módulo shared é derivado de `basename(sharedModulePath)`.
- Namespace por precedência:
  - `--scope`
  - `PROJECT_NAMESPACE` ou `SKILLS_NAMESPACE`
  - `skills.config.local.json` (na raiz do repositório consumidor ou em `.env/` do projeto)
  - `skills.config.json` (na raiz do repositório consumidor ou em `.env/` do projeto)
  - fallback de `packages/shared/package.json`
- Scripts padrão:
  - `dev: tsc --watch`
  - `build: tsc`
  - `test: jest --coverage`
  - `test:watch: jest --watchAll`

## Source Rules

- `src/index.ts` deve exportar uma API mínima do módulo (`getModuleName`).
- `test/index.test.ts` deve validar essa API mínima.

## Backend Rules

- `controller` deve expor endpoint `GET /<module-name>` de exemplo.
- `<module-name>.prisma.ts` deve encapsular acesso ao `PrismaService`.
- `module` deve declarar o controller no decorator `@Module`.
- `module` deve importar `DbModule` e registrar/exportar o provider Prisma do módulo.
- `<module-name>.model.prisma` deve existir como placeholder de modelos do módulo.
- O módulo novo deve ser importado e adicionado no array `imports` do `AppModule`.

## Frontend Rules

- A estrutura de menu do módulo deve seguir padrão obrigatório:
  - primeiro item `Voltar` (`/dashboard`);
  - separador visual;
  - label com nome do módulo;
  - itens específicos do módulo.
- Os labels dos menus (principal e lateral) devem respeitar grafia PT-BR com acentuação correta quando aplicável.
- No scaffold inicial, o único item específico deve ser `Visão Geral <Nome do Módulo>`.
- O dashboard deve usar `EmptyDashboardState` de `shared/components/ui/empty-dashboard-state.tsx` quando o componente existir no projeto.
- `EmptyDashboardState` deve aceitar `moduleName?: string`; para dashboards de modulo, passar `moduleName`, e sem essa prop manter "Dashboard Vazio".
- Se o componente base de dashboard vazio não existir, gerar fallback local simples para evitar erro de compilação.
- A página de dashboard deve renderizar o componente de dashboard.
- A rota principal do módulo deve renderizar a página de dashboard dentro de `<frontendAppPath>/src/app/(private)` quando esse grupo existir.
- A rota principal do módulo deve possuir `layout.tsx` próprio no mesmo diretório da rota.
- O `layout.tsx` do módulo deve definir localmente o sidebar no padrão do `auth/layout.tsx`, usando `SidebarMenu` + `SidebarMenuItem` e passando `<ModuleName>SidebarMenu` para `PrivateAppShell` (de `modules/auth/components/private-app-shell.component.tsx`).
- O menu lateral do módulo não deve depender de arquivos separados (`data/*-menu.data.ts` ou `*-navigation.component.tsx`).
- O `<frontendAppPath>/src/app/(private)/dashboard/layout.tsx` deve receber `upsert` da entrada do módulo novo em `moduleItems`, com ícone de `lucide-react` definido por regras determinísticas.
- Após o `upsert`, aplicar ordenação semântica determinística com heurística de IA local: módulos com maior uso provável acima e módulos administrativos no bloco inferior.
- Pastas e arquivos do frontend devem seguir kebab-case em minúsculo.
- O arquivo de componente deve usar sufixo `.component.tsx`.
- O arquivo de página interna deve usar sufixo `.page.tsx`.

## Notes

- `--scope` permite forçar namespace explícito (ex.: `@namespace`, `@acme`).
- Sem `--scope`, usar a precedência de configuração global da skill.
- `--force` permite sobrescrever os diretórios de package/backend/frontend do módulo.
- Seguir convenção global em `../../skills-standards.md`.
- Comando recomendado (cross-platform): `node <SKILLS_DIR>/config-new-module/scripts/create-module.mjs <module-name>` (ou ajuste para `<SKILLS_DIR>` quando aplicável).
