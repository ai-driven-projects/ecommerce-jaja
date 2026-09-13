# Negócio

- Criar o agregado de `account` sem nenhum caso de uso. (skill: module-aggregate)

- Alterar a entidade `account` para possuir os seguintes atributos:
  - `id` — identificador único da conta
  - `userId` — id do usuário dono da conta (relacionamento por ID)
  - `name` — nome da conta (obrigatório)
  - `description` — descrição da conta (opcional)
  - `type` — tipo da conta: enum `AccountType` com os valores `CHECKING` (Corrente), `SAVINGS` (Poupança), `CASH` (Dinheiro Físico), `INVESTMENT` (Investimento) e `OTHER` (Outro)
  - `accountNumber` — número da conta (opcional)
  - `agency` — agência da conta (opcional)
  - `financialInstitution` — nome da instituição financeira (opcional)
  - `color` — cor em hexadecimal, ex: `#FF5733` (opcional)
  - `icon` — nome ou identificador do ícone (opcional)
  - `isActive` — indica se a conta está ativa; padrão `true`

  Usar objetos de valor para validar os atributos (ex.: validar formato hexadecimal da cor, garantir que `name` não seja vazio). (skill: module-entity)

- Criar a interface de `account.repository` para persistir a entidade `account`, incluindo: salvar, buscar por id e deletar. Seguir o padrão de nomenclatura do projeto. (skill: module-repository)

- Criar o DTO `AccountDTO` em `modules/account/src/account/dto/account.dto.ts`. No primeiro momento pode herdar de `AccountProps` diretamente, caso isso seja apropriado, ou com `Omit` se algum campo não fizer sentido expor ao consumidor. (skill: module-dto)

- Criar a interface de query `FindAccountsByUserIdQuery` em `modules/account/src/account/provider/find-accounts-by-user-id.query.ts` seguindo o contrato `execute(userId: string): Promise<Result<AccountDTO[]>>`. (skill: module-query-cqrs)

- Criar o caso de uso `save-account.use-case` dentro de `modules/account/src/account/use-case` que recebe por parâmetro o repositório `account`. O `id` sempre é informado. O caso de uso suporta os fluxos de criação e alteração determinados pela busca no repositório: se a conta **não existir** para o `id` informado, é um fluxo de criação (verificar se já existe conta com o mesmo nome para o usuário — pode gerar erro, criar a entidade com `isActive = true` por padrão e persistir); se a conta **já existir**, é um fluxo de alteração (verificar se pertence ao usuário autenticado — pode gerar erro de autorização, aplicar as alterações permitidas e persistir). (skill: module-use-case)

- Criar o caso de uso `delete-account.use-case` dentro de `modules/account/src/account/use-case` que recebe por parâmetro o repositório `account`. O fluxo é: buscar a conta por id (pode gerar erro caso não exista), verificar se pertence ao usuário autenticado (pode gerar erro de autorização) e deletar via soft delete usando o campo apropriado da entidade (ex.: `deletedAt`). (skill: module-use-case)

> Os passos dos casos de uso podem gerar erros e parar o processo.

# Backend

- Mapear a entidade `account` com o Prisma, incluindo o enum `AccountType`. O campo `userId` deve ter uma relação com o model `User`. (skill: backend-prisma-data)
- Executar as migrations do Prisma para criar a tabela `account`

- Criar uma implementação do repositório de `account` usando o Prisma (`apps/backend/src/modules/account/account.prisma.ts`). As queries também são implementadas nessa mesma classe, cada uma exposta como um atributo público tipado com a interface correspondente (ex.: `findAccountsByUserId: FindAccountsByUserIdQuery`), retornando `AccountDTO[]` mapeado diretamente do resultado do banco.

- Criar o `account.controller` em `apps/backend/src/modules/account/account.controller.ts` com os seguintes endpoints (todos protegidos por JWT):
  - `POST /accounts` — criar conta, instanciando `save-account.use-case` sem `id`
  - `GET /accounts` — listar contas do usuário autenticado, chamando `FindAccountsByUserIdQuery` diretamente no método do controller (sem caso de uso)
  - `PUT /accounts/:id` — atualizar conta, instanciando `save-account.use-case` com `id`
  - `DELETE /accounts/:id` — desativar conta (exclusão lógica), instanciando `delete-account.use-case`

  O `userId` deve ser extraído do token JWT em todos os endpoints, nunca vir do body da requisição.

- Criar o seed de banco de dados em `apps/backend/prisma/seed/data/accounts.json` com ao menos 5 contas de exemplo vinculadas ao usuário `usuario@formacao.dev`, distribuindo os diferentes tipos de conta (`AccountType`).
- Executar o seed para popular o banco com as contas de exemplo.

- Criar os testes de integração (usando o padrão do Rest Client — Plugin do VS Code) para todos os endpoints de conta.

# Frontend

- Criar a página `accounts.page.tsx` em `apps/frontend/src/modules/account/pages` que lista as contas do usuário autenticado. A lista deve exibir: nome, tipo, instituição financeira, cor (indicador visual) e ícone da conta. Rota: `/accounts`.

- Criar o componente `account-list.component.tsx` em `apps/frontend/src/modules/account/components` responsável por renderizar a lista de contas recebida como prop.

- Criar o componente `account-form.component.tsx` em `apps/frontend/src/modules/account/components` com suporte aos fluxos de criação e edição. O formulário **não deve ser implementado via modal** — deve utilizar o componente `form-section-layout` como estrutura de layout. O formulário deve conter os campos da entidade `account`. Usar validação com schema (mesmo padrão dos formulários existentes no projeto) (skill: frontend-form-schema). O campo `type` deve ser um select com os valores do enum `AccountType` traduzidos para português. O campo `color` deve ter um color picker ou input de texto aceitando hex. O campo `isActive` deve aparecer apenas no fluxo de edição.

- Separar as chamadas de API e o gerenciamento de estado em `apps/frontend/src/modules/account/data`:
  - `account-api.client.ts` — funções de chamada à API (criar, listar, atualizar, deletar)
  - `account.schema.ts` — schema de validação do formulário
  - Hooks do React necessários para consumir os dados e disparar as ações

- Alterar o link para `/accounts` no menu lateral da área privada da aplicação. Criar um label para os cadastros da aplicação e o cadastro de conta será apenas o primeiro de muitos.

- Em caso de sucesso em qualquer operação (criar, editar, excluir), exibir toaster de sucesso e atualizar a lista de contas.

> Obs: IMPORTANTE!!! Executar as três partes (Negócio, Backend e Frontend) em subagentes separados com contexto limpo em cada um deles
