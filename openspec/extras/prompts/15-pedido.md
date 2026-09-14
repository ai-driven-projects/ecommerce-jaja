# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Pacote de domínio: `modules/orders` (`@jaja/orders`), que hoje só tem o agregado `cart` (prompt 13): `Cart` (`Entity`), `CartItem`, `CartRepository`, as queries `FindCartByUserIdQuery`, `PreviewCartQuery` e `FindAvailableProductIdsQuery`, os casos de uso do carrinho, `errors.ts` com `DELIVERY_FEE_CENTS = 490` e `FREE_DELIVERY_THRESHOLD_CENTS = 7900` (documentados como "também usados pelo pedido"), mocks in-memory e testes. Shared: `@mentoria-360/shared` (submódulo em `packages/shared`). Skills em `.claude/skills/*`; padrão de nomes em `.claude/skills/skills-standards.md`.
- **Pré-requisito: o prompt 14 (`infra-mensageria`) já implementado.** O backend tem `MessagingModule` (`apps/backend/src/messaging/`), que exporta `DomainEventPrisma` (implementa `DomainEventRepository` e grava na tabela interna do outbox, exigindo a transação), e o `OutboxRelay`, que publica os eventos pendentes no exchange `jaja.events` do RabbitMQ com routing key igual ao `type` do evento. A fila `jaja.events.all` (desenvolvimento) recebe cópia de todos os eventos.
- **Objetivo:** tornar real o "Confirmar pedido". O pedido é persistido no banco **junto com o evento `order.placed`, na mesma transação**, e o evento chega ao RabbitMQ pelo outbox, pronto para ser processado nos próximos prompts. Esta funcionalidade termina aí: nenhum consumidor reage ao evento ainda.
- **Propósito didático:** o projeto ensina arquitetura orientada a eventos com o mínimo de complexidade. Pagamento, separação e entrega serão simulados por consumidores automáticos nos próximos prompts.
- **Pagamento simulado:** o cliente **não informa nada** sobre o pagamento. O checkout deixa de pedir forma de pagamento ou dados de cartão e só avisa que o pagamento é simulado e aprovado automaticamente depois da confirmação. O pedido não guarda forma de pagamento.
- **Regras prometidas em prompts anteriores, cumpridas aqui:**
  - prompt 11: o pedido referencia o **cliente** (`customerId`), e não o usuário; nenhum pedido sem cadastro de cliente; cliente inativo não faz pedidos;
  - prompt 13: o pedido **congela o preço** e reaproveita a regra de frete do carrinho; confirmar esvazia o carrinho da conta.
- **Adiada:** a regra do prompt 10 que impede excluir uma loja com pedidos continua pendente, porque o pedido ainda não referencia loja (a cobertura continua simulada pelo bairro da vitrine).
- **Decisões de arquitetura:**
  - **Agregado com eventos:** `Order` estende `AggregateRoot` do shared. A criação de um pedido novo (`Order.place`) adiciona `OrderPlacedEvent`; reidratar do banco (`tryCreate`) **nunca** adiciona eventos. `cloneWith` leva os eventos pendentes para o clone, então métodos de comportamento futuros adicionam o evento na instância devolvida.
  - **Uma transação:** o caso de uso `PlaceOrder` abre a transação com `TransactionManager.runInTransaction` e, dentro dela, cria o pedido, grava o carrinho esvaziado e chama `DomainEventRepository.append(order.pullEvents(), tx)`, como `CreateUser` (`modules/auth/src/app/use-case/create-user.use-case.ts`): erro lançado dentro do callback desfaz tudo. Carrinho e pedido estão no mesmo módulo, então esvaziar o carrinho não é um evento.
  - **Outbox encapsulado:** o módulo só conhece `DomainEventRepository`; tabela e publicação são do backend.
  - **Módulos independentes:** `@jaja/orders` não importa `@jaja/customers` nem `@jaja/catalog`. Os dados do cliente chegam por uma query do próprio módulo, como `FindAvailableProductIdsQuery` no carrinho; os vínculos com `customers` e `products` ficam no Prisma.
  - **Evento com dados suficientes:** `order.placed` leva o que os consumidores futuros precisam sem consultar o pedido.
  - **Nome do evento:** `type: 'order.placed'`, `aggregateType: 'Order'`.
- **Leitura em CQRS:** consultas são interfaces `*Query` no módulo (em `provider/`, DTOs em `dto/`), implementadas como atributos públicos tipados no adapter Prisma e chamadas direto no controller, sem caso de uso e sem teste unitário (cobertas pelo `.http`). Queries que o comando precisa (cliente e carrinho) são dependências do caso de uso.
- **Referências de código** (o código é a fonte da verdade do **padrão**; este prompt é a fonte da verdade das **regras**):
  - domínio: `modules/orders/src/cart/**` (entidade pura com `cloneWith`, VO de item, `errors.ts` com constantes, repositório, queries e casos de uso) e `modules/orders/test/**` (mocks in-memory e testes); `modules/auth/src/app/use-case/create-user.use-case.ts` e `modules/auth/test/mock/fake-transaction.manager.ts` (transação e seu mock); `packages/shared/src/base/aggregate-root.ts`, `packages/shared/src/events/abstract-domain-event.ts` e `packages/shared/test/events/event-flow.integration.test.ts` (evento concreto e agregado);
  - backend: `apps/backend/src/modules/orders/` (`cart.prisma.ts` com `UNIQUE_VIOLATIONS`/`FOREIGN_KEY_VIOLATIONS`, `my-cart.controller.ts`, `cart-http.ts`, `orders.module.ts`, `test/cart.integration.http`), `apps/backend/src/modules/customers/customer.prisma.ts` (join com `users`), `apps/backend/src/modules/auth/auth.controller.ts` (`PrismaService` passado como `TransactionManager`) e `apps/backend/src/messaging/` (prompt 14);
  - frontend: `modules/orders/pages/checkout.page.tsx`, `modules/orders/components/order-tracking.component.tsx`, `modules/orders/pages/tracking.page.tsx`, `modules/orders/data/tracking.mock.ts`, `modules/orders/data/cart.context.tsx` e `cart.api.ts`, `modules/customers/data/use-my-customer.hook.ts` (estado chaveado pelo token), `src/app/(public)/pedidos/[id]/acompanhar/page.tsx` e `src/shared/navigation/storefront-routes.ts` (`orderTrackingRoute`).
- Backend é ESM (`"type": "module"`): imports relativos com sufixo `.js`; testes com Vitest. `@jaja/orders` é consumido via `dist`: rodar `npm run build --workspace=@jaja/orders` antes de usá-lo no backend. Endpoints do próprio usuário usam `@UseGuards(JwtGuard)` e `@CurrentUser('id')`. `PrismaService` implementa `TransactionManager` e exporta `PrismaTransactionContext`. VOs do shared: `Id` (`Id.required` para obrigatórios), `Text` (códigos `TEXT_TOO_SHORT`/`TEXT_TOO_LONG`), `Url`, `PositiveInteger`, `NonNegative`. Casos de uso implementam `UseCase<Input, Output>`. Os testes do pacote usam jest.
- Frontend em Next.js 16 com React 19 e React Compiler. O frontend **não importa** os pacotes `@jaja/*`: tipos da API são espelhados em `data/*.api.ts`. Sessão por `useAuth()` (cookie lido no cliente; no servidor a sessão é `null`, por isso `useHydrated`). API com `apiRequest`/`ApiError`/`toErrorMessage`; mensagens em `src/shared/i18n/messages.pt.ts` e `messages.en.ts`; toasts com `sonner`. `/entrar` aceita `?voltar=<rota>`. Design em `apps/frontend/DESIGN.md`.
- Spec desta funcionalidade: change `openspec/changes/pedido`, gerada a partir deste prompt. Em caso de dúvida sobre comportamento, valem as specs e o `design.md` da change.
- **Fora do escopo desta funcionalidade:**
  - consumidores de eventos, pagamento aprovado, mudanças de status além de `PLACED`, linha do tempo em tempo real (SSE) e notificações;
  - forma de pagamento, dados de cartão, Pix, estorno e cancelamento;
  - "Meus pedidos", pedidos no admin (`/admin/orders` e o dashboard continuam mock);
  - loja no pedido, cobertura real, ETA real e entregador (o mapa e o entregador do acompanhamento saem da tela até existir o fluxo de entrega);
  - número sequencial do pedido (a tela usa os 8 primeiros caracteres do id) e chave de idempotência: um segundo envio encontra o carrinho vazio;
  - seed de pedidos: eles nascem do uso.

# Negócio

- Criar o agregado `order` em `modules/orders/src/order` (skill: module-aggregate, `--mode example`, apagando o use case e o teste gerados e mantendo `model/`, `provider/`, `dto/` e o mock `test/mock/in-memory-order.repository.ts`). Criar a pasta `event/` do agregado para os eventos de domínio. Criar `modules/orders/src/order/errors.ts` com `OrderErrors` (objeto `as const`): `ORDER_NOT_FOUND`, `ORDER_ALREADY_EXISTS`, `ORDER_CUSTOMER_REQUIRED`, `ORDER_CUSTOMER_INACTIVE`, `ORDER_CUSTOMER_NOT_FOUND`, `ORDER_CART_EMPTY`, `ORDER_CART_HAS_UNAVAILABLE_ITEMS`, `ORDER_PRODUCT_NOT_FOUND`, `ORDER_ITEMS_REQUIRED`, `ORDER_ITEMS_LIMIT_EXCEEDED`, `ORDER_ITEM_DUPLICATED`, `ORDER_ITEM_QUANTITY_INVALID`, `ORDER_ITEM_PRICE_INVALID`, `ORDER_DELIVERY_ADDRESS_INVALID` e `ORDER_STATUS_INVALID`, e o tipo `OrderErrorCode`; e as constantes, com JSDoc, `ORDER_STATUSES = ['PLACED'] as const` (os próximos prompts acrescentam os demais) com o tipo `OrderStatus`, `ORDER_RECIPIENT_NAME_MAX_LENGTH = 100` e `ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH = 200`. Os limites de itens e de quantidade reaproveitam `CART_MAX_ITEMS` e `CART_ITEM_MAX_QUANTITY`, e o frete, `DELIVERY_FEE_CENTS` e `FREE_DELIVERY_THRESHOLD_CENTS` (importados de `../cart`).

  Criar `modules/orders/src/order/index.ts` reexportando `dto`, `errors`, `event`, `model`, `provider` e `use-case`, e exportar `./order` em `modules/orders/src/index.ts`.

- Criar os objetos de valor em `model/` (skill: module-value-object):
  - `order-item.vo.ts` (`OrderItem`, VO composto como `CartItem`), a linha congelada no momento do pedido:
    - `productId` — obrigatório (`Id.required`);
    - `name` — nome do produto na hora do pedido (`Text` de 1 a 255);
    - `unit` — unidade de venda (`Text` de 1 a 40);
    - `thumbUrl` — miniatura da imagem principal (opcional, `Url`; ausente vira `null`);
    - `unitPriceCents` — preço unitário congelado, inteiro ≥ 1 → `ORDER_ITEM_PRICE_INVALID`;
    - `quantity` — inteiro de 1 a `CART_ITEM_MAX_QUANTITY` → `ORDER_ITEM_QUANTITY_INVALID`;
    - getter `lineTotalCents` (`unitPriceCents * quantity`), `toProps()` e `toDTO()`.
  - `order-delivery-address.vo.ts` (`OrderDeliveryAddress`), cópia do endereço do cliente na hora do pedido, que não muda se o cliente alterar o cadastro depois: `zipCode` (8 dígitos), `street`, `number`, `complement` (opcional; vazio vira `null`), `neighborhood`, `city` e `state` (2 letras maiúsculas). Campos obrigatórios em branco ou formato inválido falham com `ORDER_DELIVERY_ADDRESS_INVALID`. As regras finas continuam no cadastro de cliente: aqui só se garante que a cópia está completa. `toDTO()`.

- Criar o evento `event/order-placed.event.ts` (`OrderPlacedEvent extends AbstractDomainEvent`), no padrão de `event-flow.integration.test.ts` (construtor privado, `tryCreate`/`create` com `super.tryCreateFromProps`), exportando a constante `ORDER_PLACED_EVENT_TYPE = 'order.placed'` e o tipo `OrderPlacedPayload`:
  - `type: 'order.placed'`, `aggregateType: 'Order'`, `aggregateId` = id do pedido, `occurredAt` = `placedAt`;
  - `payload`: `customerId`, `items` (`productId`, `name`, `quantity`, `unitPriceCents`, `lineTotalCents`), `itemCount`, `subtotalCents`, `deliveryFeeCents`, `totalCents` e `placedAt` (texto ISO);
  - `metadata`: `{}`.

  Documentar no JSDoc que o evento é fato consumado ("o cliente fez o pedido"), gravado na mesma transação do pedido e publicado depois pelo outbox, e que o payload traz o suficiente para os consumidores não precisarem consultar o pedido.

- Criar a entidade `Order` em `model/order.entity.ts` (`OrderProps extends EntityProps`, `extends AggregateRoot<Order, OrderProps, OrderPlacedEvent>`) com os atributos: (skill: module-entity)
  - `id` — identificador único (`Id`)
  - `customerId` — cliente do pedido (obrigatório, `Id.required`); não muda
  - `status` — um de `ORDER_STATUSES` → `ORDER_STATUS_INVALID`
  - `items` — lista de `OrderItem` na ordem do carrinho: de 1 (`ORDER_ITEMS_REQUIRED`) a `CART_MAX_ITEMS` (`ORDER_ITEMS_LIMIT_EXCEEDED`) itens, sem `productId` repetido (`ORDER_ITEM_DUPLICATED`)
  - `deliveryAddress` — `OrderDeliveryAddress` (obrigatório)
  - `recipientName` — quem recebe (`Text` de 2 a `ORDER_RECIPIENT_NAME_MAX_LENGTH`, com trim)
  - `deliveryInstructions` — instruções para o entregador (opcional, `Text` até `ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH`; vazio vira `null`)
  - `placedAt` — data e hora do pedido (obrigatória)

  Validar com `Result.combine`, expor `tryCreate`/`create` (reidratação: **sem eventos**), getters e os totais **calculados** a partir dos itens: `itemCount` (soma das quantidades), `subtotalCents` (soma de `lineTotalCents`), `deliveryFeeCents` (0 quando o subtotal é ≥ `FREE_DELIVERY_THRESHOLD_CENTS`, senão `DELIVERY_FEE_CENTS`) e `totalCents`; `toDTO()` inclui os totais.

  Criar `static place(input): Result<Order>` com `{ customerId, items, deliveryAddress, recipientName, deliveryInstructions? }`: gera `Id.createUUID()`, `status = 'PLACED'` e `placedAt = new Date()`, valida por `tryCreate` e, em caso de sucesso, adiciona `OrderPlacedEvent` na instância criada.

- Criar a interface `order.repository` em `provider/` estendendo `CrudRepository<Order>`. `findById` falha com `ORDER_NOT_FOUND`. `create` grava o pedido e os itens na mesma operação; `update` e `delete` existem pelo contrato do shared, sem caso de uso nesta entrega. Registros com `deletedAt` preenchido nunca são retornados. (skill: module-repository)

- Criar os DTOs em `dto/order.dto.ts` (skill: module-dto):
  - `OrderItemDTO` (`productId`, `name`, `unit`, `thumbUrl`, `unitPriceCents`, `quantity`, `lineTotalCents`);
  - `OrderDeliveryAddressDTO` (mesmos campos de `CustomerAddressDTO`, declarados neste módulo);
  - `OrderDTO` (`id`, `customerId`, `status`, `items`, `deliveryAddress`, `recipientName`, `deliveryInstructions`, `itemCount`, `subtotalCents`, `deliveryFeeCents`, `totalCents`, `placedAt`, `createdAt`, `updatedAt`), devolvido por `toDTO()`;
  - `OrderDetailDTO` (`OrderDTO` sem `createdAt`/`updatedAt`), devolvido pela query do acompanhamento;
  - `OrderCustomerDTO` (`customerId`, `isActive`, `name` do usuário, `deliveryAddress: OrderDeliveryAddressDTO`);
  - `PlaceOrderInputDTO` (`userId`, `recipientName?`, `deliveryInstructions?`) e `PlaceOrderOutputDTO` (`orderId`).

- Criar as interfaces de query em `provider/`, documentando o comportamento no JSDoc (skill: module-query-cqrs, só contrato e DTOs):
  - `find-order-customer-by-user-id.query.ts` — `FindOrderCustomerByUserIdQuery`, `execute(userId: string): Promise<Result<OrderCustomerDTO | null>>`: o cadastro de cliente não excluído do usuário, com o nome do usuário e o endereço; `null` sem cadastro ou com `userId` malformado. Usada pelo caso de uso.
  - `find-my-order-by-id.query.ts` — `FindMyOrderByIdQuery`, `execute(input: { userId: string; orderId: string }): Promise<Result<OrderDetailDTO | null>>`: o pedido não excluído cujo cliente pertence ao usuário, com os itens na ordem gravada; `null` quando não existir, pertencer a outro usuário ou algum id for malformado. Usada pelo controller.

- Criar o caso de uso `use-case/place-order.use-case.ts` (`PlaceOrder implements UseCase<PlaceOrderInputDTO, PlaceOrderOutputDTO>`), que recebe por parâmetro `OrderRepository`, `CartRepository`, `FindOrderCustomerByUserIdQuery`, `FindCartByUserIdQuery`, `DomainEventRepository` e `TransactionManager`. Fluxo (skill: module-use-case):
  1. `userId` ausente ou malformado → erro do `Id`;
  2. busca o cliente: `null` → `ORDER_CUSTOMER_REQUIRED`; `isActive = false` → `ORDER_CUSTOMER_INACTIVE`;
  3. lê o carrinho com `FindCartByUserIdQuery` (preços atuais): sem linhas → `ORDER_CART_EMPTY`; `hasUnavailableItems` → `ORDER_CART_HAS_UNAVAILABLE_ITEMS`;
  4. monta os itens a partir das linhas (nome, unidade, miniatura, `priceCents` como `unitPriceCents` e quantidade), o endereço a partir do cliente e `recipientName` = o informado (com trim) ou, vazio, o nome do usuário; cria o pedido com `Order.place` (falhas de validação param o fluxo);
  5. busca o carrinho da conta com `CartRepository.findByUserId` e aplica `clear()`;
  6. numa única `runInTransaction`: `orderRepository.create(order, tx)`, `cartRepository.update(cart, tx)` e `domainEventRepository.append(order.pullEvents(), tx)`, lançando a falha de cada passo (`validator.throwsIfFailed()`) para desfazer a transação; `ResultError` capturado vira `Result.fail` com os códigos, como em `CreateUser`;
  7. devolve `{ orderId }`.

  Documentar no JSDoc que o carrinho lido no passo 3 e o esvaziado no passo 6 podem divergir se o cliente mudar o carrinho em outro dispositivo nesse intervalo (aceito nesta versão).

- Mocks em `modules/orders/test/mock/`:
  - `in-memory-order.repository.ts` espelhando as restrições do banco (id repetido → `ORDER_ALREADY_EXISTS`; `update`/`delete` de inexistente → `ORDER_NOT_FOUND`; buscas ignoram excluídos) e, para teste, acesso ao que foi gravado;
  - `in-memory-domain-event.repository.ts` (`DomainEventRepository`), guardando os eventos recebidos e o `tx` de cada chamada, com opção de falhar;
  - `fake-transaction.manager.ts` no padrão do `auth`, com o contexto repassado a cada operação, o contador `calls` e a flag `rolledBack`, que fica `true` quando a operação lança erro (o erro é relançado); o rollback de verdade é do banco e já foi coberto no prompt 14;
  - `in-memory-find-order-customer-by-user-id.query.ts` e `in-memory-find-cart-by-user-id.query.ts`, configuráveis no teste.

- Criar testes unitários (jest, em `modules/orders/test/order/`):
  - `order-item.vo.test.ts`: `productId` malformado, nome vazio, preço 0, quantidade 0/100/1.5, `thumbUrl` ausente vira `null`, `lineTotalCents`;
  - `order-delivery-address.vo.test.ts`: campo obrigatório em branco, CEP com 7 dígitos, UF inválida, complemento vazio vira `null`;
  - `order-placed.event.test.ts`: `type`, `aggregateType`, `aggregateId` e o payload com totais e `placedAt` em ISO;
  - `order.entity.test.ts`:
    - `place` gera id, `PLACED`, `placedAt` e exatamente um `OrderPlacedEvent` com o payload esperado; `pullEvents` esvazia a lista;
    - `tryCreate` (reidratação) não gera eventos;
    - sem itens, 51 itens, item repetido, `recipientName` de 1 caractere, instruções com 201 caracteres, status desconhecido;
    - totais: frete de 490 abaixo de R$ 79,00 e 0 a partir de R$ 79,00;
  - `place-order.use-case.test.ts`:
    - sucesso: pedido gravado com os preços do carrinho, carrinho esvaziado, um evento `order.placed` gravado com o **mesmo `tx`** do pedido e do carrinho, uma única transação e `{ orderId }` devolvido;
    - `recipientName` vazio usa o nome do usuário;
    - sem cliente, cliente inativo, carrinho vazio e item indisponível falham **sem abrir transação** e sem gravar evento;
    - falha ao gravar o evento: o caso de uso falha com o código e a transação é desfeita (`rolledBack = true`);
    - `userId` malformado.

  Rodar `npm test --workspace=@jaja/orders` e `npm run build --workspace=@jaja/orders`.

> Os passos dos casos de uso podem gerar erros e parar o processo.

# Backend

- Mapear o agregado em `apps/backend/prisma/models/orders.model.prisma` (skill: backend-prisma-data):
  - model `Order`, tabela `orders`: `id String @id @db.Uuid`, `customerId` (`customer_id`, uuid) com relação obrigatória para `Customer` (`onDelete: Restrict`), `status String`, `recipientName`, `deliveryInstructions String?`, o endereço copiado em colunas próprias com prefixo `delivery_` (`deliveryZipCode @db.Char(8)`, `deliveryStreet`, `deliveryNumber`, `deliveryComplement String?`, `deliveryNeighborhood`, `deliveryCity`, `deliveryState @db.Char(2)`), `subtotalCents Int`, `deliveryFeeCents Int`, `totalCents Int`, `placedAt DateTime`, `createdAt @default(now())`, `updatedAt @updatedAt`, `deletedAt DateTime?`, `items OrderItem[]` e `@@index([customerId, placedAt])`;
  - model `OrderItem`, tabela `order_items`: `id String @id @default(uuid()) @db.Uuid`, `orderId` com FK para `Order` (`onDelete: Cascade`), `productId` com FK para `Product` (`onDelete: Restrict`), `position Int`, `name`, `unit`, `thumbUrl String?`, `unitPriceCents Int`, `quantity Int`, `lineTotalCents Int`, `@@unique([orderId, position])` e `@@index([productId])`;
  - relações inversas: `orders Order[]` em `Customer` (`customers.model.prisma`) e `orderItems OrderItem[]` em `Product` (`catalog.model.prisma`);
  - comentar acima dos models: o pedido referencia o cliente (não o usuário); itens, preços, endereço e quem recebe são **cópias** feitas na confirmação e não mudam quando o catálogo ou o cadastro mudam; os totais ficam gravados para leitura, mas a regra é da entidade; o evento `order.placed` é gravado no outbox na mesma transação.
- Executar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name orders_order`, conferir que a migration só cria as tabelas, as FKs e os índices do pedido, e `npm run prisma:generate --workspace=@jaja/backend`.
- Criar `apps/backend/src/modules/orders/order.prisma.ts` (`OrderPrisma`, `@Injectable()`, `implements OrderRepository`) no padrão de `cart.prisma.ts`:
  - `create(order, tx)`: grava o pedido, os totais da entidade e os itens (`position` = índice) com o client da transação recebida, ou numa transação própria sem `tx`; `update`, `findById` e `delete` (soft delete) no mesmo padrão, com `toDomain`/`fromDomain`; id que não é uuid não vai ao banco;
  - `P2002` por constraint: `orders_pkey` → `ORDER_ALREADY_EXISTS`; `P2003` pela FK violada: a de `customer_id` → `ORDER_CUSTOMER_NOT_FOUND`, a de `product_id` → `ORDER_PRODUCT_NOT_FOUND`;
  - queries como atributos públicos tipados, mapeando direto para DTO:
    - `findOrderCustomerByUserId: FindOrderCustomerByUserIdQuery`: `customers` não excluído do usuário com `users.name`;
    - `findMyOrderById: FindMyOrderByIdQuery`: o pedido com os itens ordenados por `position`, filtrando por `orders.id` **e** pelo `customers.user_id` do usuário (pedido de outro usuário devolve `null`).
- Criar `apps/backend/src/modules/orders/order-http.ts`:
  - `PlaceOrderBody` (`recipientName?`, `deliveryInstructions?`); `toPlaceOrderInput(userId, body)` repassa só esses campos (strings; outros tipos viram ausentes), descartando `customerId`, `items`, preços, status e qualquer dado de pagamento do corpo;
  - `throwOrderFailure(errors)`, sem códigos repetidos: `ORDER_NOT_FOUND` → `NotFoundException`; `ORDER_ALREADY_EXISTS` → `ConflictException`; demais falhas (inclusive `ORDER_CUSTOMER_REQUIRED`, `ORDER_CUSTOMER_INACTIVE`, `ORDER_CART_EMPTY` e `ORDER_CART_HAS_UNAVAILABLE_ITEMS`) → `BadRequestException` com os códigos.
- Criar `apps/backend/src/modules/orders/my-order.controller.ts` (`MyOrderController`, `@Controller('me/orders')`, `@UseGuards(JwtGuard)` na classe; qualquer usuário autenticado; `401` sem token) (skill: backend-controller):
  - `POST /me/orders` — `@HttpCode(201)`; instancia `PlaceOrder` com `OrderPrisma` (repositório e `findOrderCustomerByUserId`), `CartPrisma` (repositório e `findCartByUserId`), `DomainEventPrisma` e `PrismaService` (como `TransactionManager`); `userId` sempre de `@CurrentUser('id')`; em caso de sucesso responde com `findMyOrderById` do pedido criado;
  - `GET /me/orders/:id` — `findMyOrderById` direto; `404` com `[ORDER_NOT_FOUND]` quando `null`.
- Em `orders.module.ts`: importar `MessagingModule`, registrar `OrderPrisma` em `providers` e `exports` e `MyOrderController` em `controllers`; injetar `PrismaService` no controller (o `DbModule` já está importado). Ajustar `index.ts`.
- Criar `apps/backend/src/modules/orders/test/order.integration.http` (Rest Client, estilo de `cart.integration.http`):
  - cabeçalho com os pré-requisitos: backend rodando, Postgres e RabbitMQ do `docker-compose.yml` no ar e seeds `auth`, `customers` e `catalog` aplicados;
  - variáveis `@baseUrl`, `@adminEmail = usuario@formacao.dev`, `@customerEmail = ana.pereira.carvalho@jaja.dev` (usuário do seed com cadastro de cliente, o mesmo de `customer.integration.http`) e `@seedPassword = #Senha123`; um usuário novo criado por `POST /auth/register` com sufixo de timestamp (sem cadastro de cliente);
  - produtos disponíveis obtidos por `GET /storefront/products` (um de preço baixo e outro de preço ≥ R$ 79,00, com `sort`).

  Cenários:
  - **acesso:** `POST /me/orders` e `GET /me/orders/:id` sem token (401);
  - **cliente:** usuário novo sem cadastro, com um item no carrinho (400 `ORDER_CUSTOMER_REQUIRED`);
  - **carrinho:** `DELETE /me/cart` do cliente do seed e `POST /me/orders` (400 `ORDER_CART_EMPTY`);
  - **indisponível:** incluir um produto, desativá-lo com token de administrador (`PUT /products/:id`), `POST /me/orders` (400 `ORDER_CART_HAS_UNAVAILABLE_ITEMS`) e reativar o produto;
  - **cliente inativo:** desativar o cliente pelo administrador (`PUT /customers/:id` com os dados atuais e `isActive: false`), `POST /me/orders` (400 `ORDER_CUSTOMER_INACTIVE`) e reativar;
  - **sucesso:** carrinho com dois produtos (subtotal abaixo de R$ 79,00), `POST /me/orders` com `recipientName` e `deliveryInstructions` e campos extras no corpo (`customerId`, `totalCents`, `status`, `paymentMethod`), que são ignorados (201, `status: "PLACED"`, preços do carrinho, `deliveryFeeCents: 490`, endereço do cliente); `GET /me/cart` vazio; `GET /me/orders/:id` (200);
  - **frete grátis:** pedido com subtotal ≥ R$ 79,00 (`deliveryFeeCents: 0`);
  - **quem recebe padrão:** `recipientName` vazio usa o nome do usuário;
  - **preço congelado:** com token de administrador, alterar o preço de um produto do pedido; `GET /me/orders/:id` mantém o preço antigo; restaurar o preço;
  - **isolamento:** `GET /me/orders/:id` do pedido com o token de outro usuário (404 `ORDER_NOT_FOUND`); id malformado (404).

  Subir o backend (`npm run dev --workspace=@jaja/backend`, porta 4000) e validar as chamadas, deixando o seed como estava (produto, preço e cliente restaurados).
- **Conferência do evento:** depois do cenário de sucesso, conferir no banco (`docker compose exec postgres psql -U jaja -d jaja`) que a tabela do outbox tem uma linha `order.placed` com `aggregate_id` = id do pedido, `status = 'PUBLISHED'` alguns segundos depois, e no painel do RabbitMQ (`http://localhost:15672`) que a fila `jaja.events.all` recebeu a mensagem com `type` `order.placed` e o payload com `customerId`, itens e totais. Registrar na saída do subagente o id do pedido, a linha do outbox e a mensagem vista.
- Validação: `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` sem erros; `cart.integration.http` continua passando.

# Frontend

- Adicionar as mensagens dos códigos `ORDER_*` em `src/shared/i18n/messages.pt.ts` e `messages.en.ts`, na ordem alfabética das chaves, com textos para o cliente, entre eles: `ORDER_CUSTOMER_REQUIRED` ("Preencha os dados de entrega para confirmar o pedido."), `ORDER_CUSTOMER_INACTIVE` ("Seu cadastro está inativo. Fale com o atendimento."), `ORDER_CART_EMPTY` ("Seu carrinho está vazio."), `ORDER_CART_HAS_UNAVAILABLE_ITEMS` ("Remova os itens indisponíveis para confirmar o pedido."), `ORDER_NOT_FOUND` ("Pedido não encontrado.") e `ORDER_PRODUCT_NOT_FOUND` ("Um produto do carrinho não está mais disponível.").

- **Dados do pedido** em `apps/frontend/src/modules/orders/data/` (flat; atualizar `data/index.ts`):
  - `order.api.ts` — tipos `OrderItem`, `OrderDeliveryAddress`, `OrderDetail` (datas em ISO) e `PlaceOrderInput` (`recipientName`, `deliveryInstructions`), espelhando os DTOs; funções `placeMyOrder(token, input)` e `getMyOrder(token, orderId)` (devolve `null` no `404` com `ORDER_NOT_FOUND` e propaga os demais erros), com `apiRequest` e o id em `encodeURIComponent`;
  - `order.util.ts` — `formatOrderNumber(orderId)` (8 primeiros caracteres do id em maiúsculas, ex.: `3F1C9A52`), `ORDER_RECIPIENT_NAME_MAX_LENGTH` e `ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH`, com comentário de que espelham `@jaja/orders`;
  - `use-my-order.hook.ts` — `useMyOrder(orderId)`: com sessão, carrega `getMyOrder`, com o estado chaveado pelo token e pelo id como em `useMyCustomer`, e expõe `order` (`OrderDetail | null`), `loading` e `notFound`; sem sessão, não chama a API; erro diferente de 404 vira `toast.error(toErrorMessage(error))`.
  - Apagar `data/tracking.mock.ts` (fica sem uso) e tirá-lo de `data/index.ts`.

- **Checkout** (`modules/orders/pages/checkout.page.tsx`):
  - "Quem recebe" e "Instruções para o entregador" passam a ser campos controlados: "Quem recebe" começa com o nome do usuário e aceita até 100 caracteres; as instruções, até 200. Continuam fora do cadastro de cliente;
  - **passo 2 "Pagamento":** remover `PAYMENT_METHODS`, o seletor de forma de pagamento e os campos de cartão. O card mostra o badge "Simulado" e o texto "Não pedimos nenhum dado de pagamento: nesta versão ele é simulado e aprovado automaticamente depois que você confirma o pedido.";
  - **"Confirmar pedido"** chama `placeMyOrder(token, { recipientName, deliveryInstructions })`, mantendo as condições atuais de `canConfirm` e o estado "Confirmando…":
    - sucesso: `cart.refresh()` (o servidor já esvaziou o carrinho), `toast.success("Pedido #<número> recebido", { description: "Pagamento simulado em andamento." })` e `router.push(orderTrackingRoute(order.id))`;
    - erro: `toast.error(toErrorMessage(error))`, `cart.refresh()` e `myCustomer` recarregado quando o código for de cliente; a página continua em `/checkout`;
    - não chama mais `cart.clear()` nem `nextOrderId`.
  - Atualizar o JSDoc da página.

- **Acompanhamento** (`/pedidos/[id]/acompanhar`, `order-tracking.component.tsx`), lendo o pedido real com `useMyOrder`:
  - até hidratar e durante a primeira carga: estrutura estática com blocos `bg-surface`;
  - sem sessão: "Entre para acompanhar seu pedido." com o link "Entrar" para `/entrar?voltar=<rota atual>`;
  - não encontrado (inclusive pedido de outro usuário): "Pedido não encontrado." com o link "Voltar para a loja";
  - com o pedido:
    - cabeçalho "Pedido #<número>" com o badge "Pedido recebido" e "Feito hoje às HH:MM" (ou a data, se não for hoje), com o endereço copiado e quem recebe;
    - status em passos: "Pedido recebido" (concluído, com a hora de `placedAt`), "Pagamento aprovado", "Separando na loja", "A caminho" e "Entregue" (pendentes, com o texto "Aguardando");
    - itens com `ProductArt` (miniatura), nome, "× quantidade" e total da linha; subtotal, entrega ("Grátis" quando 0) e total com o rótulo "Pagamento simulado";
    - instruções para o entregador, quando houver;
  - remover o mapa ilustrativo, o entregador, a janela de chegada e a loja fixa, que voltam com o fluxo de entrega;
  - `generateMetadata` da rota: título `Pedido #<número> — já já` com `formatOrderNumber`, e o JSDoc da rota deixa de falar em dados locais.

- **Design:** atualizar `apps/frontend/DESIGN.md` na mesma mudança: passo "Pagamento" simulado sem campos e acompanhamento com o pedido real, só com o primeiro passo concluído.
- Atualizar `apps/frontend/src/modules/orders/index.ts` com o que for novo e público.

- **Specs da change:**
  - nova capability `orders/order-placement`: pedido do cliente a partir do carrinho da conta (cadastro de cliente obrigatório e ativo, carrinho com itens e sem indisponíveis), cópia dos itens com preço congelado, do endereço e de quem recebe, totais e frete, carrinho esvaziado na mesma transação, status inicial `PLACED`, evento `order.placed` gravado na mesma transação e publicado pelo outbox (com o payload), pagamento simulado sem dados do cliente e os endpoints `POST /me/orders` e `GET /me/orders/:id`;
  - nova capability `orders/order-tracking`: a página de acompanhamento com o pedido real (sessão, não encontrado, itens, totais, endereço e passos com só o primeiro concluído);
  - em `orders/checkout-access`:
    - alterar "Estado autenticado do checkout": o passo 2 "Pagamento" é simulado, sem forma de pagamento nem campos;
    - alterar "Resumo do pedido com o carrinho da conta": a confirmação cria o pedido na API (o servidor esvazia o carrinho) e leva ao acompanhamento do pedido criado; em erro, exibe a mensagem e continua em `/checkout`;
    - alterar "Confirmar pedido exige cadastro de cliente": a API também exige cadastro ativo;
  - em `admin/admin-api-authorization`, alterar "Endpoints não administrativos não mudam": `/me/orders` exige apenas token válido, de qualquer usuário.

- Validação: `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` sem erros. Conferir no navegador:
  - com o cliente do seed (`ana.pereira.carvalho@jaja.dev`): carrinho com dois produtos, checkout com o passo "Pagamento" simulado, "Quem recebe" preenchido com o nome, confirmar com instruções, toast "Pedido #<número> recebido", acompanhamento com itens, totais, endereço e "Pedido recebido" concluído, contador do carrinho em 0 ao voltar para a loja;
  - recarregar o acompanhamento mantém o pedido; abrir a mesma URL depois de sair mostra "Entre para acompanhar seu pedido."; entrar com outra conta mostra "Pedido não encontrado.";
  - com uma conta criada no próprio checkout: salvar os dados de entrega e confirmar o primeiro pedido;
  - erro da API: com o carrinho aberto no checkout, desativar no admin um produto do carrinho e confirmar; a mensagem aparece, o resumo recarrega com o item indisponível e a página continua em `/checkout`; reativar o produto;
  - no painel do RabbitMQ, a fila `jaja.events.all` recebe uma mensagem `order.placed` por pedido confirmado;
  - mobile (375px): checkout e acompanhamento sem rolagem horizontal.

> Obs: IMPORTANTE!!! Executar as três partes (Negócio, Backend e Frontend) em subagentes separados com contexto limpo em cada um deles, de forma sequencial (o Backend depende do build de `@jaja/orders`; o Frontend depende da API do pedido rodando). Antes de começar, conferir que o prompt 14 está implementado (`apps/backend/src/messaging/` com `DomainEventPrisma` e o relay publicando no RabbitMQ); se não estiver, parar e reportar. Cada subagente deve ler `.claude/skills/skills-standards.md` e, antes de criar seus arquivos, as referências de código da sua camada listadas no Contexto. O princípio de leitura em CQRS do Contexto prevalece sobre o workflow da skill `module-query-cqrs`. O do backend deve deixar o seed como estava. O do frontend deve ler também `apps/frontend/DESIGN.md`. Nenhum subagente altera `packages/shared`. Uma parte só começa depois de a anterior terminar com as validações passando, e cada subagente encerra listando os arquivos criados/alterados e o resultado das validações.
