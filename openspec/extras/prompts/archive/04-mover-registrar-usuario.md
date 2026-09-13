# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Pacote de domínio: `modules/auth` (`@jaja/auth`). Shared: `@mentoria-360/shared` (submódulo em `packages/shared`, **não alterar**).
- Estado atual (entregue pela funcionalidade 03): `modules/auth/src/user/use-case/` contém `create-user.use-case.ts` (`CreateUser`, `CreateUserInput`) e `authenticate-user.use-case.ts` (`AuthenticateUser`, `AuthenticateUserInput`), mais um `index.ts` que reexporta os dois. Ambos trabalham com os agregados `user` **e** `password` (importam `Password`, `PasswordCryptoProvider` e `PasswordRepository` de `../../password`, e `UserErrors`, `User`/`UserDTO` e `UserRepository` das pastas irmãs de `user`).
- Cadeia de exports do pacote hoje: `src/index.ts` -> `./user` e `./password`; `src/user/index.ts` -> `./dto`, `./errors`, `./model`, `./provider`, `./use-case`; `src/password/index.ts` -> `./dto`, `./errors`, `./model`, `./provider`.
- Convenção deste projeto (decisão de arquitetura, **não** documentada em `.claude/skills/skills-standards.md`, que só descreve as pastas por agregado): casos de uso que orquestram múltiplos agregados ficam em `modules/<módulo>/src/app/use-case/`, e não dentro da pasta de um agregado. Seguir este prompt, não o padrão por agregado da skill, para esses dois arquivos.
- Testes: jest com `ts-jest`, `testMatch: ["**/test/**/*.test.ts"]` (qualquer subpasta de `test/` é aceita). Os testes dos casos de uso ficam em `modules/auth/test/user/create-user.use-case.test.ts` e `modules/auth/test/user/authenticate-user.use-case.test.ts` e importam `CreateUser`, `CreateUserInput`, `AuthenticateUser` e `User` de `../../src/user`, `Password` de `../../src/password` e os fakes de `../mock/*` (`fake-password-crypto.provider`, `fake-transaction.manager`, `in-memory-password.repository`, `in-memory-user.repository`). `test/user/user.entity.test.ts` e `test/user/user.repository.test.ts` **não** se movem.
- `@jaja/auth` é consumido pelo backend via `dist` (`main`/`types` apontam para `dist/index.*` e `exports` expõe apenas `"."`): nenhum consumidor consegue importar caminho interno do pacote. `tsc` não limpa `dist`; após mover arquivos, apagar `modules/auth/dist` antes de rebuildar para não deixar `dist/user/use-case/*` órfão.
- Backend: NestJS ESM (`"type": "module"`), build com `npm run build --workspace=@jaja/backend` (`nest build`). Consumidores de `@jaja/auth` no backend: `apps/backend/src/modules/auth/auth.controller.ts` (importa `AuthenticateUser`, `CreateUser`, `UserDTO`, `UserErrors`), `user.prisma.ts`, `password.prisma.ts` e `bcrypt.provider.ts` — todos pelo índice `'@jaja/auth'`.
- Frontend: `apps/frontend/package.json` declara `@jaja/auth` como dependência, mas nenhum arquivo em `apps/frontend/src` importa o pacote.

# Negócio

- Criar `modules/auth/src/app/use-case/` e mover para lá `create-user.use-case.ts` e `authenticate-user.use-case.ts` (usar `git mv` para preservar histórico), sem alterar comportamento, nomes exportados nem assinaturas. Ajustar apenas os imports relativos dos dois arquivos: `../../password` continua válido na nova profundidade; os imports de `../errors`, `../model`, `../dto` e `../provider` passam a `../../user` (índice do agregado).
- Criar `modules/auth/src/app/use-case/index.ts` (reexportando os dois arquivos) e `modules/auth/src/app/index.ts` (`export * from './use-case'`).
- Atualizar `modules/auth/src/user/index.ts` removendo `export * from './use-case'` e remover a pasta `modules/auth/src/user/use-case/` (fica vazia). Atualizar `modules/auth/src/index.ts` adicionando `export * from './app'`. Os nomes exportados pela raiz do pacote (`CreateUser`, `CreateUserInput`, `AuthenticateUser`, `AuthenticateUserInput`) continuam os mesmos.
- Mover (`git mv`) `modules/auth/test/user/create-user.use-case.test.ts` e `modules/auth/test/user/authenticate-user.use-case.test.ts` para `modules/auth/test/app/`, ajustando apenas os imports: `CreateUser`, `CreateUserInput` e `AuthenticateUser` passam a vir de `../../src/app`; `User` continua em `../../src/user`; `Password` continua em `../../src/password`; os `../mock/*` não mudam de caminho. Os testes de entidade e repositório permanecem em `test/user/`.
- Rodar `npm test --workspace=@jaja/auth` e confirmar que os 6 suites e 41 testes atuais continuam passando.

# Backend

- Apagar `modules/auth/dist` e rodar `npm run build --workspace=@jaja/auth`; conferir que `dist/app/use-case/` existe e `dist/user/use-case/` não.
- Rodar `npm run build --workspace=@jaja/backend`. Nenhuma alteração de código é esperada em `apps/backend`: o `auth.controller.ts` e os adapters importam pelo índice `'@jaja/auth'`. Se algum import de caminho interno aparecer, trocar pelo índice do pacote.

# Frontend

- Sem alterações: o frontend não importa nada de `@jaja/auth`.

> Obs: funcionalidade pequena; executar em um único subagente com contexto limpo. Não criar migrations, seeds nem endpoints.
