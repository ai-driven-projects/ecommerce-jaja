## Why

O próximo passo da loja é gravar pedidos, e todo pedido precisa de um cliente com os dados para entregá-lo. Hoje não existe esse cadastro: `@jaja/customers` é só um scaffold sem regras, gerado sem spec, e o passo "Endereço de entrega" do `/checkout` mostra campos com valores fixos que não são salvos. Esta change cria o cadastro de cliente, 1:1 com o usuário e feito pelo próprio usuário no checkout, para que o prompt de pedidos já encontre um `customer.id` a referenciar.

## What Changes

- **Modelo de negócio**: criar conta ou entrar continua criando só o **usuário**. O **cliente** nasce quando esse usuário salva, no checkout, CPF, telefone e endereço de entrega. Os dados ficam salvos para os próximos pedidos, e confirmar um pedido passa a exigir esse cadastro. Nome e email continuam sendo do usuário e só são exibidos no cliente.
- **Domínio (`@jaja/customers`)**: substituir o scaffold `customers` (entidade `Customers`, `CreateCustomers`, DTO, mock e teste de exemplo) pelo agregado `customer`. Ele terá a entidade `Customer` (`userId` único e imutável, `cpf` único, `phone`, `address`, `isActive`), os VOs `ZipCode`, `StateCode` e `CustomerAddress`, `CustomerRepository` (com `findByUserId`/`findByCpf`), DTOs de detalhe, item de lista e página, as queries `FindCustomersQuery` (paginada, com busca), `FindCustomerByIdQuery` e `FindCustomerByUserIdQuery`, e o caso de uso `SaveCustomer`. Sem `id`, `SaveCustomer` atende o próprio cliente: localiza pelo `userId`, cria ou altera e ignora `isActive`. Com `id`, atende o administrador: só altera, nunca cria. Testes com jest e mock in-memory.
- **Backend (`@jaja/backend`)**:
  - model `Customer` (tabela `customers`, FK única para `users`, CPF único, endereço em colunas próprias) e migration `customers_customer`;
  - adapter `CustomerPrisma` com a busca textual SQL; `text-search.sql.ts` sai do catálogo para `src/db/`;
  - `GET`/`PUT /me/customer` para qualquer usuário autenticado;
  - `GET /customers`, `GET /customers/:id` e `PUT /customers/:id` restritos a administradores, sem `POST` nem `DELETE`;
  - seed idempotente de 40 clientes fictícios e testes de integração Rest Client.
  - **BREAKING**: o endpoint de exemplo `GET /customers`, hoje público, é removido, e `/customers` passa a exigir JWT de administrador.
- **Frontend (`@jaja/frontend`)**:
  - mensagens pt/en dos códigos `CUSTOMER_*`, `CPF_*`, `PHONE_*` e `TEXT_TOO_SHORT`;
  - em `/admin/customers`, a lista paginada de clientes (busca por nome, email, CPF ou telefone e filtro de status na URL) substitui o placeholder "Clientes"; a edição fica em `/admin/customers/[id]`, com nome/email somente leitura e sem criação;
  - no passo 1 do `/checkout`, um formulário de dados de entrega salvo em `/me/customer`, pré-preenchido com o bairro da vitrine, Fortaleza e CE; com cadastro, um resumo com "Alterar";
  - "Quem recebe" e "Instruções para o entregador" continuam no pedido; "Confirmar pedido" fica desabilitado enquanto não houver cadastro de cliente salvo;
  - `withQuery` é extraído para `src/shared/navigation/with-query.util.ts`.
- **Fora do escopo**: criar pedidos na API e gravar `customerId`; vários endereços; busca de endereço por CEP; validar a cobertura do bairro do cliente; CNPJ/faturamento; exclusão de cliente; criação de cliente pelo administrador; página "Minha conta"; alterar nome, email ou senha.

## Capabilities

### New Capabilities

- `customers/customer-registration`: dados do cliente e vínculo 1:1 com o usuário, validações de CPF, telefone e endereço, unicidade de CPF, cadastro e alteração pelo próprio usuário (`/me/customer`), consulta paginada, detalhe e alteração pelo administrador (`/customers`, incluindo ativar/desativar) e carga inicial de clientes de desenvolvimento.
- `customers/customer-admin`: telas administrativas de clientes em `/admin/customers`: lista paginada com busca e filtro de status refletidos na URL, sem criação nem exclusão, e edição em página com os dados da conta somente leitura.

### Modified Capabilities

- `orders/checkout-access`: o estado autenticado do checkout passa a descrever a tela atual ("Finalizar pedido") com o passo de dados de entrega, que salva o cadastro de cliente; e confirmar o pedido passa a exigir esse cadastro.
- `admin/admin-api-authorization`: `/customers` deixa de estar entre os endpoints acessíveis sem token, porque passa a ser restrito a administradores.

## Impact

- `modules/customers`: remoção de `src/customers`, `test/customers` e `test/mock/in-memory-customers.repository.ts`; novos `src/customer/{model,provider,dto,use-case,errors.ts,index.ts}`, `test/customer/**` e `test/mock/in-memory-customer.repository.ts`. O backend e o frontend dependem de `npm run build --workspace=@jaja/customers`.
- `apps/backend`:
  - banco: `prisma/models/customers.model.prisma`, a relação inversa em `prisma/models/auth.model.prisma`, a nova migration, `prisma/seed/tasks/customers.seed.ts`, `prisma/seed/data/customers.json` (novo, gerado uma vez) e `prisma/seed/main.ts`;
  - módulo: `src/modules/customers/{customer.prisma.ts,customer-http.ts,customer.controller.ts,my-customer.controller.ts,customers.module.ts,index.ts,test/customer.integration.http}`, com remoção de `customers.controller.ts` e `customers.prisma.ts`;
  - busca textual: `src/db/text-search.sql.ts` (movido) e os imports em `brand.prisma.ts`/`category.prisma.ts`;
  - API nova: `GET/PUT /me/customer` e `GET /customers`, `GET/PUT /customers/:id`.
- `apps/frontend`:
  - compartilhado: `src/shared/i18n/messages.{pt,en}.ts` e `src/shared/navigation/{customers-routes.ts,catalog-routes.ts,with-query.util.ts}`;
  - módulo: `src/modules/customers/{data,components,pages,index.ts}`, com remoção do dashboard placeholder;
  - rotas: `src/app/admin/(shell)/customers/{page.tsx,[id]/page.tsx}`;
  - checkout: `src/modules/orders/pages/checkout.page.tsx`.
- Dados: tabela `customers` com 40 registros após o seed; 38 usuários comuns seguem sem cadastro de cliente.
- Sem novas dependências externas.
