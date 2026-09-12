# Especificação: Configuração End-to-End do Projeto Jaja

Criar uma spec (via OpenSpec) para configurar o projeto **de ponta a ponta**, executando os passos abaixo **na ordem apresentada**.

## Passos

1. **Criar o projeto base**
   - Usar a skill `config-project`.
   - Namespace: `@jaja`.
   - Apps: `apps/backend` (NestJS, `@jaja/backend`) e `apps/frontend` (Next.js, `@jaja/frontend`).
   - Workspaces: `apps/*`, `packages/*`, `modules/*` e `packages/config/*`.

2. **Configurar o pacote `shared`**
   - Usar a skill `config-shared-core`.
   - O pacote é um submódulo Git em `packages/shared` (`https://github.com/mentoria-360/shared.git`).
   - Verificar que o pacote resultante é `@mentoria-360/shared` e que o workspace resolve a dependência.

3. **Configurar a camada compartilhada do backend (NestJS)**
   - Usar a skill `backend-nest-config`.
   - Objetivo: habilitar o tratamento centralizado de erros e o código compartilhado entre os módulos em `apps/backend/src/shared/`, compatível com a hierarquia de erros de `packages/shared`.

4. **Configurar o Prisma no backend**
   - Usar a skill `config-prisma`.
   - Garantir que a configuração do Docker e os arquivos `.env` referenciem o projeto `jaja`.
   - **Não executar nenhuma migration** após a configuração.

5. **Configurar a camada compartilhada do frontend (Next.js/React)**
   - Usar a skill `config-shared-frontend`.
   - Objetivo: instalar os componentes comuns e as rotas base (grupos public/private) em `apps/frontend`.

## Observações Gerais

- **Sempre que possível, usar as skills** indicadas em cada passo.
- **Executar cada passo em um subagente distinto**, com contexto limpo.
- **Executar os passos de forma sequencial**, respeitando a ordem (cada passo depende da conclusão do anterior).
