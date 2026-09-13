## Why

A funcionalidade 03 (`auth-registrar-usuario`) deixou os casos de uso `CreateUser` e `AuthenticateUser` dentro do agregado `user` (`modules/auth/src/user/use-case/`), mas os dois orquestram `user` **e** `password` (repositório de senha, provider de criptografia e a própria entidade `Password`). Pela convenção do projeto, caso de uso que atravessa mais de um agregado fica na camada de aplicação do módulo (`modules/<módulo>/src/app/use-case/`), não na pasta de um agregado. Fazer isso agora, antes dos próximos módulos (`catalog`, `orders`, `stores`) ganharem casos de uso próprios, fixa o padrão enquanto ele só custa mover dois arquivos.

## What Changes

- Mover `create-user.use-case.ts` e `authenticate-user.use-case.ts` de `modules/auth/src/user/use-case/` para `modules/auth/src/app/use-case/`, preservando histórico do git, comportamento, nomes exportados e assinaturas. Só os imports relativos dos dois arquivos mudam.
- Criar os índices `modules/auth/src/app/use-case/index.ts` e `modules/auth/src/app/index.ts`; remover o reexport de `./use-case` em `modules/auth/src/user/index.ts` (a pasta `src/user/use-case/` deixa de existir) e adicionar `export * from './app'` em `modules/auth/src/index.ts`. A raiz do pacote `@jaja/auth` continua exportando exatamente `CreateUser`, `CreateUserInput`, `AuthenticateUser` e `AuthenticateUserInput`.
- Mover os testes `create-user.use-case.test.ts` e `authenticate-user.use-case.test.ts` de `modules/auth/test/user/` para `modules/auth/test/app/`, ajustando apenas os imports. Os testes de entidade e repositório de `user` ficam onde estão.
- Limpar `modules/auth/dist` e rebuildar o pacote, depois rebuildar o backend para provar que nenhum consumidor dependia do caminho interno.
- Nenhuma mudança de API HTTP, banco, seed, frontend ou no submódulo `packages/shared`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

Nenhuma. O change é um refactor estrutural: os requisitos de registro e autenticação definidos em `auth-registrar-usuario` (`auth/user-registration`, `auth/user-authentication`) continuam válidos e inalterados. Por isso `.openspec.yaml` declara `skip_specs: true`; a convenção de organização de casos de uso fica registrada em `design.md`.

## Impact

- `modules/auth/src/**` e `modules/auth/test/**`: arquivos movidos e índices ajustados.
- `modules/auth/dist`: regenerado do zero (o `tsc` não limpa a pasta de saída; sem a limpeza sobrariam `dist/user/use-case/*` órfãos).
- `apps/backend`: rebuild sem alteração de código. Os consumidores (`auth.controller.ts`, `user.prisma.ts`, `password.prisma.ts`, `bcrypt.provider.ts`) importam pelo índice `'@jaja/auth'`, e o `exports` do pacote só expõe `"."`, então caminhos internos nunca foram importáveis.
- `apps/frontend`: sem impacto; declara `@jaja/auth` como dependência mas nenhum arquivo o importa.
- O prompt 05 (`05-auth-login-usuario.md`) já assume os casos de uso em `modules/auth/src/app/use-case`; este change é o que torna essa afirmação verdadeira.
