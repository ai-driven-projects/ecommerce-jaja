## Context

Ver `proposal.md - Why` para a motivação. Estado atual que condiciona a abordagem:

- `modules/auth/src/user/use-case/{create-user,authenticate-user}.use-case.ts` importam `Password`, `PasswordCryptoProvider` e `PasswordRepository` de `../../password` e `UserErrors`, `User`/`UserDTO` e `UserRepository` das pastas irmãs (`../errors`, `../model`, `../dto`, `../provider`).
- Cadeia de exports: `src/index.ts` -> `./user`, `./password`; `src/user/index.ts` reexporta `./dto`, `./errors`, `./model`, `./provider`, `./use-case`.
- Testes em `test/user/*.use-case.test.ts` importam os casos de uso e `User` de `../../src/user`, `Password` de `../../src/password` e os fakes de `../mock/*`. Jest usa `testMatch: ["**/test/**/*.test.ts"]`, então qualquer subpasta de `test/` é descoberta.
- `@jaja/auth` é consumido via `dist` (`main`/`types` em `dist/index.*`, `exports` só `"."`). O `tsc` não limpa `outDir`.
- `.claude/skills/skills-standards.md` (§4.1) só documenta a estrutura por agregado (`dto/`, `model/`, `provider/`, `use-case/`); a camada `app` é uma decisão deste projeto e ainda não consta na skill.
- Baseline de testes do pacote: 6 suites, 41 testes passando.

## Goals / Non-Goals

**Goals:**
- Casos de uso multi-agregado do módulo `auth` em `src/app/use-case/`, com a superfície pública do pacote idêntica antes e depois.
- Testes dos casos de uso acompanhando a mudança (`test/app/`), sem alteração de asserções.
- Prova mecânica de que o backend não dependia do caminho antigo (rebuild limpo do pacote + build do backend).

**Non-Goals:**
- Não mover casos de uso de agregado único (não existe nenhum hoje em `auth`).
- Não replicar a convenção nos módulos `catalog`, `customers`, `orders`, `stores` (ainda são scaffolds).
- Não alterar `.claude/skills/*` (submódulo) nem `packages/shared` (submódulo).
- Não tocar em endpoints, Prisma, seed ou frontend.

## Decisions

### 1. Camada `app` por módulo (`src/app/use-case/`), não `src/use-case/` nem `src/application/`
Um caso de uso que precisa de dois agregados não pertence a nenhum deles; colocá-lo em `user/` cria uma dependência `user -> password` que não é de domínio. `src/app/` é o nome escolhido pelo projeto (curto, já usado nos prompts 04 e 05). Alternativas: `src/application/` (usado pelo template `confg-auth-core-full`, mais verboso e não adotado aqui) ou `src/use-case/` na raiz (mistura com as pastas de agregado no mesmo nível). A camada `app` reexporta pelo índice `src/app/index.ts`, no mesmo formato dos agregados.

### 2. Os casos de uso importam pelo índice do agregado (`../../user`, `../../password`)
Depois do move, `../errors` etc. deixam de existir. Em vez de apontar para as subpastas (`../../user/errors`, `../../user/model`, ...), usar o índice do agregado, como já é feito com `../../password`. Sem risco de ciclo: `user/` e `password/` não importam nada de `app/`.

### 3. `git mv` para código e testes
Preserva o histórico dos arquivos e deixa o diff do change legível (rename + poucas linhas de import). Alternativa (recriar os arquivos) perde o blame.

### 4. Reexport pela raiz do pacote, sem `exports` adicionais
`src/index.ts` ganha `export * from './app'` e `src/user/index.ts` perde `./use-case`. Não se adiciona subpath `"./app"` ao `exports` do `package.json`: manter apenas `"."` é o que garante que nenhum consumidor acople a estrutura interna. Se `CreateUser` fosse exportado por dois caminhos (via `user` e via `app`) o `export *` duplicado seria erro de compilação, por isso a remoção em `user/index.ts` é obrigatória.

### 5. Limpar `dist` antes do build
Sem limpar, `dist/user/use-case/*.js` e `.d.ts` continuariam existindo e o build do backend passaria mesmo com o índice quebrado. `rm -rf modules/auth/dist && npm run build --workspace=@jaja/auth` seguido de `npm run build --workspace=@jaja/backend` é a verificação real. Não se adiciona `rimraf`/`prebuild` ao pacote nesta entrega (mudança de tooling fora do escopo).

### 6. Testes movidos para `test/app/`, espelhando `src/`
`test/` espelha `src/`: os testes de casos de uso vão para `test/app/`; `user.entity.test.ts` e `user.repository.test.ts` ficam em `test/user/`. Só os imports de `CreateUser`, `CreateUserInput` e `AuthenticateUser` mudam (`../../src/user` -> `../../src/app`); `User`, `Password` e os `../mock/*` permanecem.

## Risks / Trade-offs

- [Convenção `app` não está na skill `module-use-case`/`skills-standards.md`; um agente que siga a skill pode recolocar casos de uso no agregado] → Registrado neste design e nos prompts 04/05; documentar na skill é trabalho futuro no submódulo de skills.
- [`dist` antigo mascarando erro de import no backend] → Decisão 5: rebuild a partir de `dist` apagado.
- [Duplicidade de export (`CreateUser` via `user` e via `app`) gera erro `TS2308`] → Remover `./use-case` de `user/index.ts` na mesma tarefa em que se adiciona `./app` na raiz.
- [Cobertura do jest muda de caminho nos relatórios] → Irrelevante; `coverage/` é ignorado pelo git.

## Migration Plan

1. `git mv` dos dois casos de uso e dos dois testes; criar índices de `app`; ajustar imports e índices de `user`/raiz.
2. `npm test --workspace=@jaja/auth` (6 suites / 41 testes).
3. `rm -rf modules/auth/dist`, `npm run build --workspace=@jaja/auth`, `npm run build --workspace=@jaja/backend`.
4. Rollback: reverter o commit; nenhum estado externo (banco, dist publicado) é afetado.
