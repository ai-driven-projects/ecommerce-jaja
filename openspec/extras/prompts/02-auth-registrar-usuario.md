# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Pacote de domínio: `modules/auth` (`@jaja/auth`). Shared: `@mentoria-360/shared` (submódulo em `packages/shared`).
- As skills ficam em `.claude/skills/*` (submódulo). Os scripts das skills mencionam `.agents/skills/...`; usar `.claude/skills/...` no lugar.
- Padrão de nomes: `../.claude/skills/skills-standards.md` (pastas `model/`, `provider/`, `use-case/`, `dto/`; sufixos `.entity.ts`, `.repository.ts`, `.use-case.ts`, `.vo.ts`).
- VOs disponíveis no shared: `Id`, `PersonName`, `Name`, `Email`, `Url`, `Password` (valida **hash bcrypt**), `StrongPassword` (valida força). Não existem `HashPassword` nem `URL`.
- Base para transação: `TransactionManager`/`TransactionContext` do shared. No backend, `PrismaService` (`apps/backend/src/db/prisma.service.ts`) já implementa `TransactionManager` e entrega `{ client }` no contexto.
- `modules/auth` hoje contém apenas o scaffold placeholder `src/auth` (entidade `Auth`, `CreateAuth`, `AuthDTO`, mock e teste). Ele deve ser removido nesta funcionalidade.
- Backend é ESM (`"type": "module"`): imports relativos com sufixo `.js`.
- `@jaja/auth` é consumido pelo backend/frontend via `dist`: rodar `npm run build --workspace=@jaja/auth` antes de usar no backend.

# Negócio

- Remover o scaffold placeholder `modules/auth/src/auth`, `modules/auth/test/auth` e `modules/auth/test/mock/in-memory-auth.repository.ts`, ajustando `modules/auth/src/index.ts`.
- Criar o agregado de `user` (skill: module-aggregate). A skill exige `--mode crud|example`: usar `--mode example` e apagar o use case e o teste gerados, mantendo apenas `model/`, `provider/`, `dto/` e o mock in-memory (`test/mock/in-memory-user.repository.ts`).
- Alterar a entidade `user` para possuir os atributos: id, name, email, avatarUrl (opcional). Validar com os VOs `Id`, `PersonName`, `Email` e `Url` (opcional) via `Result.combine`, expondo `create`/`tryCreate` e getters. (skill: module-entity)
- Criar a interface de `user.repository` estendendo `CrudRepository<User>` e adicionando `findByEmail(email: string): Promise<Result<User | null>>` (ok com `null` quando não existir). (skill: module-repository)

- Criar o agregado de `password` (skill: module-aggregate, mesmo procedimento: `--mode example` e remover o use case gerado).
- Alterar a entidade `password` para possuir os atributos: id, userId, value. O `value` é o **hash** da senha e deve ser validado pelo VO `Password` (que aceita apenas hash bcrypt); `userId` validado com `Id`. A validação de senha forte (`StrongPassword`) NÃO fica na entidade, fica no caso de uso antes de criptografar. (skill: module-entity)
- Criar a interface de `password.repository` com `create(password: Password, tx?: TransactionContext): Promise<Result<void>>` e `findByUserId(userId: string): Promise<Result<Password | null>>`. (skill: module-repository)
- Criar a interface `password-crypto.provider` em `modules/auth/src/password/provider/password-crypto.provider.ts` com `hash(plain: string): Promise<string>` e `compare(plain: string, hash: string): Promise<boolean>`.

- Criar o caso de uso `create-user.use-case.ts` em `modules/auth/src/user/use-case/` (skill: module-use-case). Ele recebe no construtor: `UserRepository`, `PasswordRepository`, `PasswordCryptoProvider` e `TransactionManager`. Entrada: `{ name, email, password, avatarUrl? }`. Fluxo: verificar se o email já existe via `findByEmail` (falha `EMAIL_ALREADY_EXISTS`), validar nome, validar email, validar senha forte com `StrongPassword`, criptografar a senha, criar a entidade `user`, criar a entidade `password` (com o `userId`), persistir as duas dentro de `transactionManager.runInTransaction`, repassando o `tx` para os `create` dos repositórios.
  > Cada passo pode falhar e interrompe o processo com `Result.fail(...)`.
- Criar testes unitários (jest, em `modules/auth/test/**`) para as entidades `user` e `password` e para o caso de uso, usando os mocks in-memory e um `TransactionManager` fake. Rodar `npm test --workspace=@jaja/auth`.

# Backend

- Antes de tudo: a porta 5432 está ocupada pelo container `poupig-db-postgres` de outro projeto. Alterar `apps/backend/docker-compose.yml` e `DATABASE_URL` em `apps/backend/.env` e `.env.example` para a porta `5433` e subir o banco com `npm run db:start --workspace=@jaja/backend`.
- Instalar `bcrypt` e `@types/bcrypt` em `apps/backend`.
- Mapear a entidade `user` no arquivo já existente `apps/backend/prisma/models/auth.model.prisma` (tabela `users`, email único, `@@map`). (skill: backend-prisma-data)
- Mapear a entidade `password` no mesmo arquivo (tabela `passwords`), com relação 1:1 obrigatória com `user` (`userId` único, FK com `onDelete: Cascade`). (skill: backend-prisma-data)
- Executar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name auth_user_password` e `npm run prisma:generate --workspace=@jaja/backend`.
- Criar a implementação Prisma do repositório de `user` em `apps/backend/src/modules/auth/user.prisma.ts` (`UserPrisma`), com `toDomain`/`fromDomain`, retornando `Result`, e usando `(tx as PrismaTransactionContext)?.client ?? this.prisma.client` quando receber transação.
- Criar a implementação Prisma do repositório de `password` em `apps/backend/src/modules/auth/password.prisma.ts` (`PasswordPrisma`), mesmo padrão.
- Criar a implementação do `password-crypto.provider` em `apps/backend/src/modules/auth/bcrypt.provider.ts` (`BcryptProvider`, salt rounds 10).
- Remover `apps/backend/src/modules/auth/auth.prisma.ts` e registrar `UserPrisma`, `PasswordPrisma` e `BcryptProvider` como providers em `auth.module.ts` (o `DbModule` já está importado e fornece o `PrismaService`).
- Atualizar o `auth.controller` para receber diretamente no construtor `UserPrisma`, `PasswordPrisma`, `BcryptProvider` e `PrismaService` (como `TransactionManager`), sem interfaces. Remover o `GET /auth` de exemplo. (skill: backend-controller)
- Criar em `auth.controller` o método `POST /auth/register`, decorado com `@Public()` (`apps/backend/src/shared/decorators`), que instancia o caso de uso `CreateUser` dentro do método, executa e mapeia falhas: `EMAIL_ALREADY_EXISTS` -> `ConflictException`; demais falhas do `Result` -> `BadRequestException` com os códigos de erro. Sucesso responde `201` sem corpo.

- Criar o seed em `apps/backend/prisma/seed/data/users.json` com 80 usuários (id uuid v4, name com nome e sobrenome válidos para `PersonName`, email único, avatarUrl http(s) válida ou null, `password: "#Senha123"`). O primeiro tem o email `usuario@formacao.dev`.
- Criar a task `apps/backend/prisma/seed/tasks/auth.seed.ts` que lê o JSON, faz `upsert` por email e grava a senha com hash bcrypt (hashear `#Senha123` uma única vez e reutilizar). Registrar a task no array `seedTasks` de `apps/backend/prisma/seed/main.ts`.
- Executar `npm run prisma:seed --workspace=@jaja/backend`.
- Criar os testes de integração no padrão Rest Client (VS Code) em `apps/backend/src/modules/auth/test/auth.integration.http` cobrindo: registro com sucesso (201), email duplicado (409), senha fraca (400) e nome/email inválidos (400). Subir o backend (`npm run dev --workspace=@jaja/backend`, porta 4000) e validar as chamadas.

# Frontend

- Criar `apps/frontend/.env.local` com `NEXT_PUBLIC_API_URL=http://localhost:4000` (e o mesmo em um `.env.example`).
- Em `apps/frontend/src/modules/auth/data/` (arquivos flat, sem subpastas): `auth.api.ts` (chamada `POST /auth/register` com `fetch` e tratamento do payload de erro `{ statusCode, message, details }` do backend), `register.schema.ts` e `login.schema.ts` usando o validador `v` de `@/shared/components/form/validator` com os VOs `PersonName`, `Email`, `StrongPassword` (registro com `confirmPassword` via `.refine`), e o hook `use-auth-form.hook.ts` para estado (modo registrar/login, loading, erro). Atualizar o `data/index.ts`. (skill: frontend-form-schema)
  > Os componentes `Form/FormField/FormMessage/FormButtonSubmit` citados na skill NÃO existem neste projeto. Usar `react-hook-form` com `Input`, `Label`, `Button`, `Card`, `Tabs` e `FormErrorMessage` de `@/shared/components/ui`.
- Criar `auth-form.component.tsx` em `apps/frontend/src/modules/auth/components` com os dois modos (registrar e login, alternados por tabs ou link). Nesta funcionalidade apenas o modo **registrar** é integrado com a API; o modo login fica com formulário e validação prontos, mas o submit apenas exibe um toast informativo ("login disponível na próxima funcionalidade"). A integração de login e o redirecionamento pós-login ficam para a funcionalidade 04.
- Aplicar todas as validações no formulário e, no sucesso do registro, exibir o toaster de sucesso (`toast.success` do `sonner`) e alternar para o modo login. Montar o `<Toaster />` de `@/shared/components/ui/toaster` no `apps/frontend/src/app/layout.tsx` (hoje ele não está montado).
- Criar a rota pública `/join` em `apps/frontend/src/app/(public)/join/page.tsx` renderizando o `auth-form.component`, remover a página placeholder `apps/frontend/src/app/(public)/auth/page.tsx`, ajustar `AUTH_ROUTE` em `apps/frontend/src/shared/navigation/auth-routes.ts` para `/join` e o `PublicGroupLayout` para tratar `/join` sem o `PublicBoxedLayout` (como faz hoje com `/auth`).
- NÃO criar nem alterar proteção de rotas no frontend. Já existe um `RouteGuard` provisório em `apps/frontend/src/shared/auth` usado no layout privado; deixá-lo como está (será substituído na funcionalidade 04).

> Obs: IMPORTANTE!!! Executar as três partes (Negócio, Backend e Frontend) em subagentes separados com contexto limpo em cada um deles, de forma sequencial (Backend e Frontend dependem do build de `@jaja/auth`).
