## Context

Ver `proposal.md` para a motivação e os specs em `specs/**` para o comportamento. Estado atual e restrições que moldam a abordagem:

- `packages/shared` (`@mentoria-360/shared`) é submódulo e não é alterado. Fornece `Entity`, `Result` (`ok`/`fail`/`combine`, `isFailure`, `errors`, `instance`), `UseCase<IN, OUT>`, `CrudRepository<T>`, `TransactionManager`/`TransactionContext`, `AuthenticatedUser` (`{ id, name, email }`, sem `admin`) e os VOs `Id`, `PersonName`, `Email`, `Url`, `Flag`, `Password` (só aceita hash bcrypt) e `StrongPassword`.
- `modules/auth` é scaffold placeholder (`src/auth` com `Auth`/`CreateAuth`). O pacote `@jaja/auth` é consumido via `dist`, então o backend só enxerga o domínio após `npm run build --workspace=@jaja/auth`.
- Backend NestJS em ESM (`.js` nos imports relativos). `PrismaService` já implementa `TransactionManager<PrismaTransactionContext>` (contexto com `client: Prisma.TransactionClient`). `SharedModule` (global) registra `JwtModule` (segredo `JWT_SECRET`, `expiresIn: 7d`), `JwtStrategy` (mapeia `JwtPayload { sub, name, email }` para `AuthenticatedUser`), `JwtGuard` (respeita `@Public()`) e `@CurrentUser()`. O `JwtGuard` não é `APP_GUARD`: nenhum controller está protegido hoje. `AuthModule` já importa `DbModule`. O seed técnico (`prisma/seed/main.ts`) tem o array `seedTasks` vazio. O Postgres já roda na porta 5433.
- Frontend Next.js 16 App Router, React 19, Tailwind v4, componentes flat em `src/shared/components/ui` (incluindo `MetricCard`, `DashboardRankingListCard`, `Card`, `Tabs`, `FormErrorMessage`, `Toaster` do `sonner`), validador `v` em `src/shared/components/form/validator` (schemas a partir dos VOs do shared), `react-hook-form`. O grupo `(public)` envolve tudo em `StorefrontShell` exceto `/auth`; o grupo `(private)` usa um `RouteGuard` provisório baseado em `localStorage`. `AdminShell` já aceita `userName`, `userEmail`, `userAvatarUrl`, `logoHref`, `profileHref` e `onLogout`. Nem `AuthProvider` nem `<Toaster />` estão montados no root layout.
- Padrões do projeto: pastas `model/`, `provider/`, `use-case/`, `dto/` e sufixos `.entity.ts`, `.repository.ts`, `.use-case.ts`; scaffold via skill `module-aggregate` (`--mode example`, apagando o use case gerado); controllers instanciam os casos de uso dentro de cada método recebendo adapters concretos no construtor; testes de integração no formato Rest Client (`*.http`); toda tela segue `apps/frontend/DESIGN.md`.

## Goals / Non-Goals

**Goals:**
- Um único modelo de usuário com a flag `admin` fluindo de ponta a ponta: entidade → Prisma → JWT → `request.user` → sessão no navegador → guard da área administrativa.
- Área administrativa fechada no frontend sem middleware do Next e sem chamadas extras na navegação: a sessão (token + usuário) é lida do cookie de forma síncrona.
- Casos de uso e adapters prontos para o checkout (funcionalidade 05) sem retrabalho: `CreateUser`, `AuthenticateUser`, `AuthProvider`/`useAuth` e `login()` na API do frontend são reutilizados lá.

**Non-Goals:**
- Guard de administrador no backend: não existe endpoint administrativo ainda; ele nasce junto com o primeiro (a flag já está no `request.user`).
- Refresh de token, expiração tratada no cliente, recuperação de senha, perfil, cadastro de administradores pela interface.
- Mover os casos de uso para `modules/auth/src/app/use-case` (é a funcionalidade 04) e o formulário de registro do cliente (funcionalidade 05).

## Decisions

### 1. `admin` é atributo da entidade `User`, validado por `Flag`, e o registro nunca o aceita
`UserProps` ganha `admin: boolean`; `User.tryCreate` valida com `Flag.tryCreate(admin)` dentro do `Result.combine` e expõe `isAdmin`. A entrada de `CreateUser` (`{ name, email, password, avatarUrl? }`) não tem `admin`, e o caso de uso cria a entidade com `admin: false` sempre. O controller de registro não repassa nada além desses campos, então `admin: true` no body é descartado sem esforço extra.
Alternativa rejeitada: `admin` como `role` enum. Não há terceiro papel previsto; um boolean mantém o VO existente e a coluna simples. Se surgirem papéis, migra-se para enum com um único ponto de mudança (a entidade).

### 2. Um único código `INVALID_CREDENTIALS` em `AuthenticateUser`
Usuário inexistente, senha ausente e `compare === false` retornam `Result.fail('INVALID_CREDENTIALS')`. O controller mapeia esse código para `UnauthorizedException`; qualquer outro código (ex.: email malformado) vira `BadRequestException`. Evita enumeração de emails pela diferença de resposta.
Alternativa rejeitada: `USER_NOT_FOUND` vs `INVALID_PASSWORD`. Mais informativo para depurar, mas vaza quais emails existem.

### 3. `AppUser` local no backend em vez de alterar `AuthenticatedUser` do shared
`src/shared/types/app-user.type.ts` define `AppUser = AuthenticatedUser & { admin: boolean }`. `JwtPayload` ganha `admin: boolean`; `mapPayloadToAuthenticatedUser` retorna `AppUser`; `AuthenticatedRequest.user` e o tipo do `@CurrentUser()` passam a `AppUser`. O shared continua intacto (é submódulo publicado em outro repositório) e o backend é o único lugar que precisa da flag na requisição.
Alternativa rejeitada: adicionar `admin?: boolean` em `AuthenticatedUser` no shared. Exigiria commit e publicação no submódulo e acoplaria o pacote genérico a uma regra deste projeto.

### 4. `JwtGuard` aplicado na classe do `AuthController`, não como guard global
`@UseGuards(JwtGuard)` no `AuthController` com `@Public()` em `register` e `login`; `me` fica protegido. Registrar `APP_GUARD` fecharia também os controllers de exemplo de `catalog`, `orders`, `customers` e `stores` e o `AppController`, o que não é objetivo desta mudança.
Alternativa: `APP_GUARD` + `@Public()` nos exemplos. Fica para quando os módulos de negócio tiverem endpoints reais; nesse momento o guard vira global e a anotação por classe é removida.

### 5. Controller com adapters concretos e casos de uso instanciados por método
`AuthController` recebe `UserPrisma`, `PasswordPrisma`, `BcryptProvider`, `PrismaService` e `JwtService` no construtor e instancia `new CreateUser(...)`/`new AuthenticateUser(...)` dentro de cada método. É o padrão do projeto (sem tokens de injeção para interfaces). O login assina `{ sub: user.id, name, email, admin }` com `JwtService.sign` (expiração vem do `SharedModule`) e responde `{ token, user }` com o `UserDTO` devolvido pelo caso de uso.

### 6. Prisma: `users` e `passwords` 1:1 com cascade; transação via `PrismaTransactionContext`
`User { id uuid, name, email @unique, avatarUrl?, admin Boolean @default(false), createdAt, updatedAt, password Password? }` mapeado para `users`; `Password { id uuid, userId @unique, value, createdAt, user @relation(onDelete: Cascade) }` mapeado para `passwords`. Os adapters recebem `tx?: TransactionContext` e usam `(tx as PrismaTransactionContext)?.client ?? this.prisma.client`, então `CreateUser` roda `runInTransaction` e repassa o contexto aos dois `create`. `findByEmail` e `findByUserId` retornam `Result.ok(null)` quando não há linha.
Alternativa rejeitada: hash na tabela `users`. Separar permite histórico/rotação de senha depois sem tocar no agregado `user`, e mantém o `UserDTO` incapaz de vazar o hash por construção.

### 7. Seed por `upsert` de email com um único hash
`auth.seed.ts` lê `users.json`, calcula `bcrypt.hash('#Senha123', 10)` uma vez e faz `upsert` por email gravando `admin` e a senha (`create`/`update` aninhados). 80 hashes bcrypt custariam segundos; um só mantém o seed rápido e idempotente.

### 8. Sessão no frontend em cookie JSON lido de forma síncrona; sem middleware do Next
`auth-storage.ts` grava `jaja_auth` (JSON de `{ token, user }`, `path=/`, `SameSite=Lax`, 7 dias) e lê `document.cookie` sincronamente, protegido contra SSR (`typeof document === 'undefined'` → `null`). `AuthProvider` inicializa com `useState(readAuthSession)` e expõe `signIn` (chama `login()` da API, grava e atualiza o estado) e `signOut`. `AdminGuard` decide com o estado já hidratado, então o reload em `/admin/catalog` não passa por um render sem sessão.
Alternativa rejeitada: `middleware.ts` do Next lendo o cookie no servidor. Decidiria antes de renderizar, mas exigiria verificar o JWT no edge (segredo no frontend ou chamada ao backend) para saber se é admin; como os dados administrativos serão protegidos pelo backend de qualquer forma, o guard no cliente basta nesta fase. `localStorage` foi rejeitado por não permitir migrar para leitura no servidor depois.
Consequência: o `RouteGuard` provisório e a chave `auth_token` deixam de existir.

### 9. Formulário de acesso compartilhado; quem decide o destino é a página
`LoginForm` e `RegisterForm` só validam, chamam `signIn`/`signUp` do contexto e devolvem o usuário por `onSuccess(user)`; `AuthForm` os combina em `Tabs` ("Entrar" / "Criar conta") e expõe `onSignedIn(user, mode)`. O registro sempre autentica em seguida (`signUp` = `register` + `login`), então as duas abas terminam no mesmo callback. A página `/admin/login` aplica a regra administrativa: `admin === false` → `signOut()` + `toast.error` ("Acesso restrito a administradores" no login; "Conta criada, mas o acesso à área administrativa é restrito a administradores" no registro); `admin === true` → `toast.success` + `router.replace('/admin')`. A página `/entrar` da loja apenas agradece e volta para a origem. `AdminGuard` repete a regra para sessões antigas ou cookies manipulados.
Alternativa rejeitada: dois formulários distintos por contexto (admin e loja). Duplicaria validação e chamadas de API; a diferença entre os contextos cabe em um callback.

### 10. Rotas: `app/admin/(shell)/*` protegido e `app/admin/login` fora do grupo
`app/admin/(shell)/layout.tsx` = `AdminGuard` + `ShellProvider` + `AdminShell` + `AppSidebarNavigation`; dentro dele `page.tsx` (dashboard), `catalog/`, `orders/`, `customers/`, `stores/`. `app/admin/login/page.tsx` fica fora do grupo e por isso não herda guard nem shell. O grupo `(private)` e a exceção `/auth` no layout público são removidos.
Alternativa rejeitada: `app/(admin)/admin/...` com `login` dentro e o guard ignorando `/admin/login` por `pathname`. Funciona, mas espalha a exceção na lógica do guard em vez de resolvê-la na árvore de rotas.

### 11. Navegação com prefixo `/admin` e match exato do dashboard
`admin-routes.ts` (`ADMIN_ROUTE`, `ADMIN_LOGIN_ROUTE`) substitui `principal-routes.ts` e `auth-routes.ts`; `CATALOG_ROUTE` etc. viram `/admin/...`. Em `app-modules.ts` o módulo `principal` passa a `dashboard` ("Visão geral") e o módulo `auth` sai do rail. `resolveAppSidebarState` compara o item do dashboard por igualdade exata e os demais por `===` ou `startsWith(href + '/')`; sem isso, `/admin` capturaria todas as rotas.

### 12. Dashboard mock em um módulo frontend `admin`
`apps/frontend/src/modules/admin` (components, pages, data, index) guarda o dashboard: saudação via `useAuth().user`, quatro `MetricCard` e um `DashboardRankingListCard` com `isLoading: false`, `error: null`, `onRefresh` no-op e opções de limite fixas, alimentados por `data/dashboard.mock.ts` (números e produtos derivados do mock de `catalog`). O dashboard não pertence ao módulo `auth` nem a um módulo de negócio específico; quando houver API de pedidos, só `data/` muda.

### 13. `AuthProvider` e `<Toaster />` no root layout; sessão do cliente visível na loja
Ambos são montados uma vez em `app/layout.tsx`. `StorefrontShell` consome `useAuth` para alimentar o controle de conta do cabeçalho (`userName`, `signInHref`, `onSignOut`) — o `StorefrontHeader` continua controlado por props e sem conhecer o contexto. A vitrine em si (`storefront.component.tsx`, hook e mock) não muda.

### 14. Rota pública `/entrar` dentro do shell da loja, com retorno por `voltar`
`app/(public)/entrar/page.tsx` renderiza `StorefrontLoginPage` (título display "Entre ou crie sua conta." com o ponto em vermelho + `AuthForm`) dentro do `StorefrontShell`, como qualquer página pública. O cabeçalho monta o link `/entrar?voltar=<pathname+query atual>`; a página lê `voltar` com `useSearchParams` (em `Suspense`), aceita apenas caminhos relativos que começam com `/` (evita open redirect) e volta para lá após o login/registro (padrão `/`). Sessão já existente ao abrir `/entrar` → volta imediatamente para `voltar`.
Alternativa rejeitada: modal/sheet de login aberto no cabeçalho. Uma rota tem URL compartilhável, funciona no reload e reaproveita a mesma página no checkout (05).

### 15. Controle de conta no cabeçalho por props
`StorefrontHeader` ganha `userName?: string | null`, `signInHref?: string` e `onSignOut?: () => void`, renderizados entre o ETA e a sacola: com `userName`, "olá, <primeiro nome>" em `--muted-ink` e o botão de texto "sair" (hover vermelho); sem `userName` e com `signInHref`, o link "entrar" sublinhado; sem nenhum dos dois, nada (o componente continua utilizável sem sessão). "sair" limpa a sessão e mostra `toast.success("Até já já.")`, sem trocar de rota. Na própria página `/entrar` o link "entrar" aponta para a URL atual (não aninha `voltar` dentro de `voltar`).

## Risks / Trade-offs

- [Cookie legível por JavaScript e guard só no cliente] → Aceito nesta fase: o cookie não é `HttpOnly` porque o cliente precisa do token para o `Authorization: Bearer`; nada sensível é servido só pelo frontend, e os endpoints administrativos futuros validam o JWT e a flag no backend.
- [`JwtGuard` por classe pode ser esquecido em controllers futuros] → Decisão 4 registra que o guard vira `APP_GUARD` quando os módulos de negócio ganharem endpoints reais.
- [`Password` do shared aceita apenas hash bcrypt] → `PasswordCryptoProvider.hash` usa bcrypt com salt 10 e a entidade é criada só depois do hash; os testes unitários usam um provider fake que devolve um hash bcrypt válido fixo.
- [`useSearchParams`/hooks de cliente dentro de `/admin/login`] → A página de login não usa query string; `LoginForm` é cliente e a página é simples, sem `Suspense` extra.
- [Rotas antigas em links/documentação] → `grep -rn "'/principal'\|'/catalog'\|'/orders'\|'/customers'\|'/stores'\|'/auth'" apps/frontend/src` deve retornar vazio ao final (critério de aceite em `tasks.md`).
- [Seed com 80 usuários gerados à mão pode conter nome sem sobrenome ou email repetido] → Tarefa inclui checagem por script (unicidade de email, duas palavras no nome) antes de rodar o seed.
- [`DashboardRankingListCard` tem API voltada a dados assíncronos] → Usado com props fixas; se a API do componente exigir mais estado do que o mock justifica, cair para `Card` + `Table` mantendo o requisito de spec (ranking com preços em mono).

## Migration Plan

1. Domínio: remover o placeholder, criar agregados, casos de uso e testes; `npm run build --workspace=@jaja/auth`.
2. Backend: dependências, Prisma (modelos, migration, generate), adapters, tipos de JWT, controller, seed, testes `.http` com backend no ar.
3. Frontend: dados/contexto/componentes de auth, módulo `admin`, reorganização das rotas para `/admin`, navegação, root layout; `lint`, `build` e conferência manual dos fluxos.
4. Rollback: reverter os commits; a migration `auth_user_password` só cria tabelas novas, então `prisma migrate reset` em desenvolvimento é suficiente.

## Open Questions

- Nenhuma que altere specs, abordagem ou tarefas. O valor de `JWT_SECRET` é definido localmente por quem executa (não é versionado).
