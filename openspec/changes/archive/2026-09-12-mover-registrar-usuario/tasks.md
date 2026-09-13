## 1. Domínio `@jaja/auth`: mover casos de uso para a camada `app`

- [x] 1.1 Criar `modules/auth/src/app/use-case/` e mover com `git mv` `modules/auth/src/user/use-case/create-user.use-case.ts` e `authenticate-user.use-case.ts` para lá. Ajustar apenas os imports relativos: manter `../../password`; trocar `../errors`, `../model`, `../dto` e `../provider` por `../../user`. Verificar que `git status` mostra os dois arquivos como rename e que `grep -n "from '\.\./" modules/auth/src/app/use-case/*.use-case.ts` só retorna `../../user` e `../../password`.
- [x] 1.2 Criar `modules/auth/src/app/use-case/index.ts` (reexportando `./authenticate-user.use-case` e `./create-user.use-case`) e `modules/auth/src/app/index.ts` (`export * from './use-case'`). Remover `export * from './use-case'` de `modules/auth/src/user/index.ts`, apagar a pasta `modules/auth/src/user/use-case/` (incluindo o `index.ts` antigo) e adicionar `export * from './app'` em `modules/auth/src/index.ts`. Verificar com `find modules/auth/src -type d -name use-case` que só existe `modules/auth/src/app/use-case` e que `npx tsc --noEmit -p modules/auth` compila sem `TS2308` (export duplicado) nem `TS2307` (módulo não encontrado).

## 2. Testes do pacote

- [x] 2.1 Criar `modules/auth/test/app/` e mover com `git mv` `modules/auth/test/user/create-user.use-case.test.ts` e `authenticate-user.use-case.test.ts` para lá. Ajustar apenas os imports: `CreateUser`, `CreateUserInput` e `AuthenticateUser` passam a vir de `../../src/app`; `User` continua em `../../src/user`, `Password` em `../../src/password` e os fakes em `../mock/*`. Verificar que `modules/auth/test/user/` mantém apenas `user.entity.test.ts` e `user.repository.test.ts` e que nenhuma asserção foi alterada (`git diff -M --stat` dos testes mostra só linhas de import).
- [x] 2.2 Rodar `npm test --workspace=@jaja/auth`. Verificar que o resultado é `Test Suites: 6 passed` e `Tests: 41 passed`, com os dois suites de caso de uso listados sob `test/app/`.

## 3. Build do pacote e do backend

- [x] 3.1 Apagar `modules/auth/dist` e rodar `npm run build --workspace=@jaja/auth`. Verificar que `modules/auth/dist/app/use-case/` existe, que `modules/auth/dist/user/use-case/` não existe e que `grep -c "CreateUser\|AuthenticateUser" modules/auth/dist/index.d.ts` continua expondo os dois (via `export * from './app'`).
- [x] 3.2 Rodar `npm run build --workspace=@jaja/backend` sem alterar código em `apps/backend`. Verificar que o build passa e que `grep -rn "@jaja/auth/" apps/backend/src` (import de subcaminho) retorna vazio; se algum aparecer, trocar pelo índice `'@jaja/auth'` e repetir o build.
- [x] 3.3 Conferir que o escopo ficou restrito: `git status --short` mostra mudanças apenas em `modules/auth/src`, `modules/auth/test` e (se houver) `apps/backend/src/modules/auth`; `git diff --stat packages/shared .claude/skills apps/frontend` vazio. Frontend não precisa de build: nenhum arquivo em `apps/frontend/src` importa `@jaja/auth`.
