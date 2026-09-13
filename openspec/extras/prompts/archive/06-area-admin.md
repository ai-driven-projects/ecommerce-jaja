# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Backend: `apps/backend` (NestJS, ESM, imports relativos com sufixo `.js`, testes com Vitest em `**/*.spec.ts`). Frontend: `apps/frontend` (Next.js App Router, Tailwind, componentes em `src/shared/components/ui`, design em `apps/frontend/DESIGN.md`). Shared: `@mentoria-360/shared` (submódulo em `packages/shared`).
- As skills ficam em `.claude/skills/*`. Padrão de nomes: `.claude/skills/skills-standards.md`.
- **Já implementado (não refazer nem alterar o fluxo):**
  - Autenticação completa: `POST /auth/register`, `POST /auth/login` e `GET /auth/me` em `apps/backend/src/modules/auth/auth.controller.ts`.
  - A flag de administrador se chama **`admin`** (não `isAdmin`) em toda a API: no payload do JWT (`apps/backend/src/shared/types/jwt-payload.type.ts`), no `AppUser = AuthenticatedUser & { admin: boolean }` (`shared/types/app-user.type.ts`) e no `mapPayloadToAuthenticatedUser` (`shared/auth/auth-user.mapper.ts`), que a `JwtStrategy` usa para preencher `request.user`.
  - `JwtGuard` (`shared/auth/jwt.guard.ts`) respeita `@Public()` e é **provider exportado do `SharedModule`, não um guard global**: cada controller o aplica com `@UseGuards(JwtGuard)` (ver `auth.controller.ts`). Os controllers placeholder (`GET /`, `/catalog`, `/orders`, `/customers`, `/stores`) não têm guard.
  - Seed (`apps/backend/prisma/seed/data/users.json`): `usuario@formacao.dev` e `admin@jaja.dev` com `admin: true`, demais `false`, senha `#Senha123`.
  - Frontend: a área administrativa já vive em `src/app/admin`. `/admin/login` fica fora do shell; as telas protegidas ficam no grupo `src/app/admin/(shell)` (`/admin`, `/admin/catalog`, `/admin/orders`, `/admin/couriers`, `/admin/customers`, `/admin/stores`), cujo `layout.tsx` já usa `AdminGuard` + `ShellProvider` + `AdminShell` (com nome, email, avatar e "Sair" do usuário logado) + `AppSidebarNavigation`.
  - `AdminGuard` (`src/modules/auth/components/admin-guard.component.tsx`): sem sessão redireciona para `/admin/login`; com sessão de não administrador exibe o toast "Acesso restrito a administradores" e redireciona para `/admin/login` **sem descartar a sessão**. `useAuth()` expõe `isAdmin` derivado de `session.user.admin`.
  - Constantes de rota em `src/shared/navigation/*-routes.ts` (`ADMIN_ROUTE = '/admin'`, `ADMIN_LOGIN_ROUTE`, `CATALOG_ROUTE = '/admin/catalog'` etc.) e menu em `src/shared/navigation/app-modules.ts` (o módulo `dashboard` já casa só com `/admin` exato).
  - A loja oferece acesso à área administrativa (link "Área administrativa" no rodapé e link no menu da conta para administradores). Manter como está.
- Esta funcionalidade completa a **base da área administrativa** que os cadastros do catálogo (prompts 07, 08 e 09) vão usar: o decorator `@AdminOnly()` no backend e a seção "Cadastros" no menu do módulo Catálogo. Nenhuma entidade de negócio nem endpoint é criado aqui.

# Regras da área administrativa

- Endpoints administrativos exigem JWT válido **e** `admin = true`: sem token, token expirado ou adulterado → `401`; token válido de usuário não administrador → `403`.
- Não alterar o fluxo de autenticação, o `AdminGuard` do frontend, a tela `/admin/login`, o layout de `admin/(shell)` nem os links da loja para a área administrativa.

# Backend

- Criar o `AdminGuard` em `apps/backend/src/shared/auth/admin.guard.ts` (`@Injectable()`, `implements CanActivate`): lê `request.user` via `context.switchToHttp().getRequest<AuthenticatedRequest>()`; sem usuário lança `UnauthorizedException`; com `user.admin !== true` lança `ForbiddenException('ADMIN_REQUIRED')`; caso contrário retorna `true`. Exportar em `shared/auth/index.ts`.
- Criar o decorator `@AdminOnly()` em `apps/backend/src/shared/decorators/admin-only.decorator.ts` como composição: `applyDecorators(UseGuards(JwtGuard, AdminGuard))`, **nessa ordem**, para que o `JwtGuard` preencha `request.user` (ou responda `401`) antes do `AdminGuard`. Deve funcionar na classe do controller e em métodos. Importar `JwtGuard` e `AdminGuard` pelos arquivos (`../auth/jwt.guard.js`, `../auth/admin.guard.js`), não pelo `index`, para evitar import circular. Exportar em `shared/decorators/index.ts`. Documentar no JSDoc que `@AdminOnly()` não deve ser combinado com `@Public()`.
- Adicionar `AdminGuard` a `providers` e `exports` do `SharedModule` (`apps/backend/src/shared/shared.module.ts`).
- **Não** registrar `JwtGuard` nem `AdminGuard` como `APP_GUARD`: guards globais executam antes dos guards do controller (o `AdminGuard` rodaria sem `request.user` e responderia `403` em vez de `401`) e passariam a exigir token nos controllers placeholder e em `GET /`.
- Criar o teste unitário `apps/backend/src/shared/auth/admin.guard.spec.ts` (Vitest, no mesmo estilo de `shared/errors/api-exception.filter.spec.ts`, com `ExecutionContext` falso) cobrindo: usuário com `admin: true` → `true`; usuário com `admin: false` → `ForbiddenException`; sem `request.user` → `UnauthorizedException`. Criar também `apps/backend/src/shared/decorators/admin-only.decorator.spec.ts` verificando que, aplicado a uma classe de teste, os guards registrados (metadata `GUARDS_METADATA` de `@nestjs/common/constants`) são `[JwtGuard, AdminGuard]` nessa ordem.
- Não criar endpoints nesta funcionalidade. O comportamento `401`/`403` será exercitado pelos testes de integração dos cadastros (prompt 07 em diante).
- Validação: `npm run test --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` sem erros; subir o backend e conferir que `POST /auth/login` e `GET /auth/me` continuam funcionando como antes.

# Frontend

- Hoje o `SidebarMenu` (`src/shared/components/ui/sidebar-menu.component.tsx`) achata as seções do módulo ativo, descarta o `label` de cada seção e só exibe os sub-itens quando há mais de um no total. Ajustar para:
  - renderizar os sub-itens agrupados por seção, na ordem recebida, ignorando seções sem itens;
  - exibir o `label` da seção (quando houver) como um cabeçalho discreto acima dos seus itens, no estilo da sidebar escura do `DESIGN.md` (caixa alta pequena, cor `text-dark-muted`, sem ícone, alinhado ao recuo dos sub-itens);
  - manter a regra de só exibir os sub-itens quando o módulo ativo tiver mais de um sub-item no total, e manter inalterados os itens principais, o contador (`badge`) e o estado ativo.
- No `sectionsByModuleId.catalog` de `src/shared/navigation/app-modules.ts`, criar duas seções:
  - `{ id: 'catalog-overview', items: [{ id: 'catalog-overview', label: 'Visão geral', href: CATALOG_ROUTE, match: 'exact' }] }`;
  - `{ id: 'catalog-registrations', label: 'Cadastros', items: [] }`, com um comentário indicando que os prompts 07, 08 e 09 adicionam aqui "Marcas", "Categorias" e "Produtos", nessa ordem, com `match: 'prefix'`.
- Com apenas "Visão geral", o menu do Catálogo continua visualmente igual ao atual. O cabeçalho "Cadastros" e os sub-itens passam a aparecer quando o prompt 07 adicionar "Marcas".
- As telas dos cadastros devem ficar dentro do grupo `src/app/admin/(shell)/catalog/...` para herdar o `AdminGuard` e o shell. Não criar rotas nesta funcionalidade.
- Validação: `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` sem erros. Subir o frontend, entrar como `usuario@formacao.dev` e conferir que `/admin`, `/admin/catalog` e os demais módulos continuam com o mesmo menu. Para validar o cabeçalho de seção, adicionar temporariamente um item fictício em "Cadastros", conferir que "Visão geral", o rótulo "Cadastros" e o item aparecem sob "Produtos & estoque" em `/admin/catalog`, e **remover o item fictício antes de concluir**.

> Obs: IMPORTANTE!!! Executar as duas partes (Backend e Frontend) em subagentes separados com contexto limpo em cada um deles. Cada subagente deve ler `.claude/skills/skills-standards.md`; o do frontend deve ler também `apps/frontend/DESIGN.md`.
