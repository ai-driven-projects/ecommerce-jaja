# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Backend: `apps/backend` (NestJS, ESM, imports relativos com sufixo `.js`). Frontend: `apps/frontend` (Next.js App Router, Tailwind, componentes em `src/shared/components/ui`, design em `apps/frontend/DESIGN.md`). Shared: `@mentoria-360/shared` (submódulo em `packages/shared`).
- As skills ficam em `.claude/skills/*`. Padrão de nomes: `.claude/skills/skills-standards.md`.
- **Pré-requisito (já implementado pela parte de autenticação, prompts 03 a 05):** a entidade `user` de `modules/auth` possui o atributo booleano `isAdmin`; o payload do JWT (`apps/backend/src/shared/types/jwt-payload.type.ts`) e o `AuthenticatedUser` de `@mentoria-360/shared` carregam `isAdmin`; o `useAuth` do frontend (`apps/frontend/src/modules/auth/data/auth.context.tsx`) expõe `user.isAdmin`; o `auth-guard.component` protege as rotas privadas; o seed de usuários (`apps/backend/prisma/seed/data/users.json`) marca `usuario@formacao.dev` com `isAdmin: true` e os demais com `false`. Se algum desses itens não existir, criar o mínimo necessário no módulo `auth` antes de seguir, sem alterar o restante do fluxo de autenticação.
- Estado atual do frontend: o grupo `src/app/(private)` (rotas `/principal`, `/catalog`, `/orders`, `/customers`, `/stores`, `/auth/dashboard`) usa `AdminShell` + `AppSidebarNavigation` + um `RouteGuard` provisório em `src/shared/auth`. As constantes de rota ficam em `src/shared/navigation/*-routes.ts` e o menu em `src/shared/navigation/app-modules.ts`.
- Esta funcionalidade cria a **base da área administrativa** que os cadastros do catálogo (prompts 11, 12 e 13) vão usar. Nenhuma entidade de negócio é criada aqui.

# Regras da área administrativa

- Toda a parte administrativa fica sob o caminho `/admin` no frontend. Ela exige usuário autenticado **e** com `isAdmin = true`.
- A raiz do e-commerce (vitrine pública em `/`, cabeçalho, rodapé, sacola, página de produto) **não pode ter nenhum link** para `/admin`. O acesso é apenas digitando a URL.
- No backend, os endpoints administrativos exigem JWT válido e `isAdmin = true`; caso contrário respondem `401` (sem token) ou `403` (token válido de usuário não administrador).

# Backend

- Criar o decorator `@AdminOnly()` em `apps/backend/src/shared/decorators/admin-only.decorator.ts` (metadata `ADMIN_ONLY_ROUTE`), exportado em `decorators/index.ts`.
- Criar o `AdminGuard` em `apps/backend/src/shared/auth/admin.guard.ts`: lê a metadata `ADMIN_ONLY_ROUTE` (handler e classe) via `Reflector`; se a rota for `@AdminOnly()`, exige `request.user?.isAdmin === true`, senão lança `ForbiddenException`. Rotas sem a metadata passam. Exportar em `auth/index.ts`.
- Registrar o `AdminGuard` como guard global em `apps/backend/src/shared/shared.module.ts` (`APP_GUARD`). Hoje o `JwtGuard` é apenas um provider exportado desse módulo: se a autenticação ainda não o tiver registrado como `APP_GUARD`, registrá-lo também, **antes** do `AdminGuard`, para que `request.user` já esteja preenchido quando o `AdminGuard` executar.
- Garantir que o `auth-user.mapper` (`apps/backend/src/shared/auth/auth-user.mapper.ts`) e a `JwtStrategy` propaguem `isAdmin` do payload para `request.user`.
- Não criar endpoints nesta funcionalidade. O guard será exercitado pelos testes de integração dos cadastros (prompt 11 em diante).

# Frontend

- Mover o conteúdo de `apps/frontend/src/app/(private)` para `apps/frontend/src/app/admin`, de forma que as rotas passem a ser `/admin` (antigo `/principal`), `/admin/catalog`, `/admin/orders`, `/admin/customers`, `/admin/stores` e `/admin/auth`. Atualizar as constantes em `src/shared/navigation/*-routes.ts` (`PRINCIPAL_ROUTE = '/admin'`, `CATALOG_ROUTE = '/admin/catalog'` etc.) e o `resolveAppSidebarState` em `app-modules.ts` para continuar resolvendo o módulo ativo com os novos prefixos (o módulo `principal` deve casar apenas com `/admin` exato, para não capturar `/admin/catalog`).
- Criar o componente `admin-guard.component.tsx` em `apps/frontend/src/modules/auth/components`: usa `useAuth`; sem usuário → redireciona para `/join`; usuário sem `isAdmin` → redireciona para `/` e exibe `toast.error("Acesso restrito a administradores")`. Enquanto decide, não renderiza nada (mesma estratégia do `auth-guard`: estado inicial lido sincronamente, nunca via `useEffect`).
- O `layout.tsx` de `src/app/admin` passa a usar `AdminGuard` (que já cobre a checagem de autenticação) + `ShellProvider` + `AdminShell` + `AppSidebarNavigation`. Remover o `RouteGuard` provisório de `src/shared/auth` se não houver mais uso.
- Preencher o `AdminShell` com os dados reais do usuário logado (`userName`, `userEmail`, `userAvatarUrl`, `onLogout` via `useAuth`), `logoHref = '/admin'` e remover o `profileHref` padrão `/auth/profile` (não existe tela de perfil).
- No menu lateral do módulo **Catálogo** (`sidebarStateByModuleId.catalog` em `app-modules.ts`), manter o item "Visão Geral Catálogo" e criar a seção com label **"Cadastros"**, inicialmente vazia (os prompts 11, 12 e 13 adicionam "Marcas", "Categorias" e "Produtos"). Se o componente `SidebarMenu` não renderizar seções vazias, deixar um comentário indicando onde os itens entram.
- Verificar (grep por `/admin`, `/principal`, `PRINCIPAL_ROUTE`) que nenhum componente da vitrine (`src/shared/components/store/*`, `src/modules/catalog/components/storefront*`, `src/app/(public)/*`) aponta para a área administrativa. O redirecionamento pós-login definido pelo prompt 05 é mantido como está.
- Validação: `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` sem erros. Subir o frontend e conferir: `/admin` sem login redireciona para `/join`; logado como usuário comum redireciona para `/` com o toast; logado como `usuario@formacao.dev` abre o shell administrativo com o menu do módulo Catálogo.

> Obs: IMPORTANTE!!! Executar as duas partes (Backend e Frontend) em subagentes separados com contexto limpo em cada um deles. Cada subagente deve ler `.claude/skills/skills-standards.md`; o do frontend deve ler também `apps/frontend/DESIGN.md`.
