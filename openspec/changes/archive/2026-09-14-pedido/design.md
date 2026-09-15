## Context

A motivação e o escopo estão em `proposal.md`. O comportamento está nas specs desta change:
- `orders/order-placement` e `orders/order-tracking`;
- `orders/checkout-access` e `admin/admin-api-authorization`.

O roteiro de implementação detalhado é o prompt `openspec/extras/prompts/15-pedido.md`. Este é o estado atual relevante.

**Domínio (`modules/orders`)**
- Só existe o agregado `cart`:
  - `Cart` (`Entity`) e `CartItem`;
  - `CartRepository` e as queries `FindCartByUserIdQuery` (linhas com preço atual, `isAvailable` e `hasUnavailableItems`), `PreviewCartQuery` e `FindAvailableProductIdsQuery`;
  - casos de uso de comando `Result<void>`;
  - `errors.ts` com `CART_MAX_ITEMS`, `CART_ITEM_MAX_QUANTITY`, `DELIVERY_FEE_CENTS` e `FREE_DELIVERY_THRESHOLD_CENTS` (estas duas já documentadas como "também usadas pelo pedido").
- O shared oferece:
  - `AggregateRoot` (`addEvent`, `pullEvents`, `cloneWith` que carrega os eventos pendentes);
  - `AbstractDomainEvent` (`tryCreateFromProps`);
  - a porta `DomainEventRepository.append(events, tx)` e `TransactionManager`.
- O padrão transacional está em `CreateUser` (`modules/auth`): lança dentro de `runInTransaction` para desfazer e converte `ResultError` em `Result.fail`. O `FakeTransactionManager` do auth não registra rollback.

**Backend**
- `CartPrisma` implementa o repositório e as queries do carrinho, mapeia `P2002`/`P2003` por constraint (`UNIQUE_VIOLATIONS`/`FOREIGN_KEY_VIOLATIONS`), grava itens com `position` e usa o client da transação recebida.
- `MessagingModule` (change `infra-mensageria`, arquivada) exporta `DomainEventPrisma`:
  - `append` só grava dentro de uma transação e grava na tabela `outbox_events`;
  - o `OutboxRelay` publica no exchange `jaja.events` com routing key igual ao `type`;
  - a fila `jaja.events.all` recebe cópia em desenvolvimento.
- `customers` tem uma linha por usuário, com o endereço em colunas próprias e `is_active`; o nome fica em `users`.
- `AuthController` passa `PrismaService` como `TransactionManager`.

**Frontend**
- `checkout.page.tsx`:
  - "Quem recebe" e "Instruções" são inputs não controlados;
  - o passo "Pagamento" tem pílulas Pix/Cartão/Faturado e campos de cartão;
  - a confirmação chama `cart.clear()` e `nextOrderId()` do mock.
- `order-tracking.component.tsx` monta tudo a partir de `tracking.mock.ts`: mapa, entregador, janela de chegada, loja e itens com emoji.
- `useMyCustomer` guarda o estado chaveado pelo token, mas não tem como recarregar.
- `ProductArt` exige `category` (tom e emoji de reserva), e o item do pedido não tem categoria.
- `/entrar` aceita `?voltar=`.

**Specs e changes em andamento**
- `infra-mensageria` está concluída, com o CLI e as conferências manuais, e arquivada em `archive/2026-09-14-infra-mensageria`. As specs `messaging/event-outbox` e `messaging/message-broker` já estão em `openspec/specs/`.
- O `## Purpose` de `orders/checkout-access` diz que a criação do pedido não faz parte da capacidade.

## Goals / Non-Goals

**Goals:**
- Um pedido real e imutável nos dados copiados, gravado de forma atômica com o carrinho esvaziado e o evento.
- O primeiro evento de domínio de negócio publicado pelo outbox, com payload autossuficiente para os consumidores das próximas entregas.
- Domínio independente: `@jaja/orders` não conhece `customers`, `catalog`, a tabela do outbox nem o broker.
- Leitura em CQRS leve, como no carrinho.

**Non-Goals:**
- Idempotência de envio (chave de idempotência) e controle de concorrência entre a leitura e o esvaziamento do carrinho.
- Máquina de estados do pedido além de `PLACED`.
- Listagem de pedidos (cliente ou admin) e busca por número.
- Consumidores do evento e idempotência de consumo.

## Decisions

### 1. Três etapas sequenciais com contexto limpo
Negócio → Backend → Frontend, cada uma em um subagente com contexto limpo, como pede o prompt:
- o backend consome o `dist` de `@jaja/orders`;
- o frontend precisa da API do pedido rodando;
- antes de começar, confirmar que `apps/backend/src/messaging/` tem `DomainEventPrisma` e o relay.

As conferências no navegador que exigem entrar, criar conta ou enviar formulários, e a do painel do RabbitMQ, ficam na conversa principal, com o usuário e o painel do navegador visível.

### 2. O pedido referencia o cliente, lido por uma query do próprio módulo
`Order.customerId` aponta para `customers`, e não para `users`: o pedido é de quem tem dados de entrega. O caso de uso chega ao cliente pelo `userId` do token com `FindOrderCustomerByUserIdQuery`, uma interface de `@jaja/orders` que devolve `OrderCustomerDTO` (`customerId`, `isActive`, nome do usuário e endereço). O backend a implementa em `OrderPrisma` com `customers JOIN users`.

A query devolve o cadastro mesmo inativo, porque a regra de inatividade (`ORDER_CUSTOMER_INACTIVE`) é do caso de uso e precisa ser testável. O vínculo com `customers` fica na FK do Prisma.

Alternativas descartadas:
- **Importar `@jaja/customers` e usar `CustomerRepository`:** acopla os pacotes, contra o padrão do carrinho com o catálogo.
- **Pedido vinculado ao usuário:** contraria a regra prometida em `cadastro-cliente` e permitiria pedido sem endereço.

### 3. Pedido montado no servidor a partir do carrinho da conta
O caso de uso lê o carrinho com `FindCartByUserIdQuery`, a mesma projeção que o checkout exibe, com preço atual e disponibilidade. Dessa leitura:
- carrinho sem linhas falha com `ORDER_CART_EMPTY`;
- `hasUnavailableItems` falha com `ORDER_CART_HAS_UNAVAILABLE_ITEMS`;
- cada linha vira `OrderItem`: `name`, `unit`, `thumbUrl`, `priceCents` como `unitPriceCents` e `quantity`.

Do corpo, `toPlaceOrderInput` só aproveita `recipientName` e `deliveryInstructions` quando são strings.

Ordem das verificações:
1. `userId`;
2. cliente (ausente, depois inativo);
3. carrinho (vazio, depois indisponível);
4. validação de `Order.place`.

Todas acontecem antes de abrir a transação, então as falhas de negócio nunca abrem transação.

Alternativas descartadas:
- **O navegador enviar os itens e preços:** permitiria adulterar preço e pedir produto indisponível.
- **Revalidar a disponibilidade com `FindAvailableProductIdsQuery`:** a projeção do carrinho já traz `isAvailable` pela mesma regra de visibilidade.

### 4. Cópias congeladas em colunas e tabela filha
- **`orders`:**
  - `customer_id`, `status` e `recipient_name`;
  - `delivery_instructions` e o endereço em colunas `delivery_*` (`delivery_zip_code char(8)`, `delivery_state char(2)`);
  - `subtotal_cents`, `delivery_fee_cents`, `total_cents` e `placed_at`;
  - timestamps e `deleted_at`;
  - índice `(customer_id, placed_at)` para a futura listagem "Meus pedidos".
- **`order_items`:**
  - `order_id` (Cascade) e `product_id` (Restrict);
  - `position`, `name`, `unit`, `thumb_url`, `unit_price_cents`, `quantity` e `line_total_cents`;
  - `@@unique([orderId, position])` e índice em `product_id`.
- **`status`:** `String`, e não enum do Postgres, para os próximos prompts acrescentarem status só em `ORDER_STATUSES`, sem migration de tipo. A validação é da entidade (`ORDER_STATUS_INVALID`).
- **`OrderItem` sem identidade no domínio:** a lista é criada inteira com o pedido. O `id` da linha existe só no banco.

Alternativas descartadas:
- **Endereço e itens em colunas JSON:** perdem a FK para `products` (que a regra adiada de exclusão de loja e produto vai precisar) e a leitura tipada.
- **Referenciar o endereço atual do cliente:** o pedido mudaria quando o cliente alterasse o cadastro.

### 5. Totais calculados na entidade e gravados para leitura
`Order` calcula `itemCount`, `subtotalCents`, `deliveryFeeCents` e `totalCents` a partir dos itens. A regra de entrega usa `DELIVERY_FEE_CENTS` e `FREE_DELIVERY_THRESHOLD_CENTS`, importados de `../cart`. O subtotal de um pedido é sempre maior que 0, porque há de 1 a 50 itens e preço de pelo menos 1.

`OrderPrisma.create` grava os totais que a entidade calculou. `findMyOrderById` lê as colunas direto para o DTO, sem recalcular, e `toDomain` não lê os totais: a entidade os recalcula.

Alternativas descartadas:
- **Calcular os totais no SQL, como no carrinho:** o pedido é um fato. O total cobrado não pode depender de uma consulta, e os consumidores recebem os totais no evento.
- **Não gravar os totais:** a leitura do acompanhamento e as listagens futuras precisariam somar itens em toda consulta.

### 6. Agregado com evento criado em `Order.place`
- `Order extends AggregateRoot<Order, OrderProps, OrderPlacedEvent>`.
- `Order.place(input)` gera `Id.createUUID()`, `status = 'PLACED'` e `placedAt = new Date()`, valida por `tryCreate` e, se der certo, chama `addEvent(OrderPlacedEvent.create(...))` na instância criada.
- `tryCreate`/`create` servem para reidratar do banco e **nunca** adicionam eventos.
- `cloneWith` do shared leva os eventos pendentes ao clone, o que serve aos métodos de comportamento dos próximos prompts.

O `OrderPlacedEvent` segue `event-flow.integration.test.ts`: construtor privado, `tryCreate`/`create` com `super.tryCreateFromProps`, e `ORDER_PLACED_EVENT_TYPE = 'order.placed'`. O payload é "gordo", com cliente, itens, totais e `placedAt` em ISO, e exclui endereço e quem recebe, que só a entrega precisará e que o consumidor pode ler do pedido.

Alternativas descartadas:
- **O caso de uso criar o evento:** a regra "pedido novo gera `order.placed`" ficaria fora da entidade e dos testes dela.
- **Evento só com o id do pedido:** obrigaria cada consumidor a consultar o pedido, acoplando serviços ao banco do pedido.
- **Evento gerado em `tryCreate`:** reidratar do banco publicaria o evento de novo.

### 7. Uma transação no caso de uso, com o carrinho esvaziado pelo repositório
Depois das verificações, `PlaceOrder`:
1. busca o carrinho da conta com `CartRepository.findByUserId` e aplica `clear()`. Carrinho `null` nesse ponto falha com `ORDER_CART_EMPTY`;
2. dentro de `runInTransaction`:
   - `orderRepository.create(order, tx)`;
   - `cartRepository.update(cart, tx)`;
   - `domainEventRepository.append(order.pullEvents(), tx)`;
   - cada resultado passa por `validator.throwsIfFailed()`.

Um `ResultError` capturado vira `Result.fail(error.errors)`; qualquer outro erro é relançado, como em `CreateUser`.

O carrinho e o pedido estão no mesmo módulo, então esvaziar o carrinho é parte da mesma transação, e não um evento. O módulo só conhece `DomainEventRepository`; tabela e publicação são do backend (`DomainEventPrisma`).

Alternativas descartadas:
- **Chamar `ClearCart` depois do commit:** uma falha entre os dois deixaria pedido criado com carrinho cheio, e um reenvio criaria pedido duplicado.
- **Esvaziar o carrinho consumindo `order.placed`:** complexidade de consumidor e consistência eventual para uma regra interna do módulo.
- **Publicar direto no broker dentro do caso de uso:** perde a garantia do outbox ("evento gravado se e somente se o pedido for").

### 8. Contrato HTTP do pedido
- **`POST /me/orders`:** responde `@HttpCode(201)` com o `OrderDetailDTO` lido por `findMyOrderById` depois do commit, com o mesmo formato do `GET`.
- **`GET /me/orders/:id`:** `404` com `[ORDER_NOT_FOUND]` quando a query devolve `null`. Pedido de outro usuário também responde `404`, e não `403`, para não revelar que o id existe.
- **`throwOrderFailure`:** `ORDER_NOT_FOUND` → 404, `ORDER_ALREADY_EXISTS` → 409 e os demais → 400, sem códigos repetidos.
- **Sem chave de idempotência:** o segundo envio encontra o carrinho vazio (`ORDER_CART_EMPTY`), e o frontend bloqueia o botão enquanto confirma.
- **Dependências do caso de uso:** `MyOrderController` recebe `OrderPrisma`, `CartPrisma`, `DomainEventPrisma` e `PrismaService` e instancia `PlaceOrder` por requisição, como os controllers do carrinho. `OrdersModule` importa `MessagingModule`; os módulos Nest são singletons, então o relay continua único.

Alternativas descartadas:
- **`POST` devolvendo só `{ orderId }`:** o frontend precisaria de uma segunda chamada; o caso de uso continua devolvendo `{ orderId }`, e o controller lê o detalhe.
- **`403` para pedido de outro usuário:** expõe a existência de ids.

### 9. Leitura em CQRS no adapter
`findOrderCustomerByUserId` e `findMyOrderById` são atributos públicos tipados de `OrderPrisma`, chamados direto no controller, que mapeiam as linhas para DTOs:
- **`findOrderCustomerByUserId`:** `customers` não excluído do usuário, com `users.name`;
- **`findMyOrderById`:** filtra por `orders.id`, `orders.deleted_at IS NULL` e `customers.user_id` do token, com os itens ordenados por `position`;
- **ids malformados:** devolvem `null` sem ir ao banco.

Não há caso de uso de leitura nem teste unitário das queries; o `.http` cobre o comportamento.

### 10. Mocks do domínio registram a transação
Os mocks ficam em `modules/orders/test/mock/`:
- **`FakeTransactionManager`:** mantém `calls` e `context` e acrescenta `rolledBack`, que fica `true` quando a operação lança (o erro é relançado);
- **`InMemoryDomainEventRepository`:** guarda os eventos e o `tx` de cada chamada, com opção de falhar;
- **`InMemoryOrderRepository`:** espelha as restrições do banco (`ORDER_ALREADY_EXISTS` para id repetido, `ORDER_NOT_FOUND` em `update`/`delete` de inexistente) e dá acesso ao que foi gravado;
- **queries do cliente e do carrinho:** configuráveis.

Com esses mocks, o teste confirma um único `tx` compartilhado pelas três gravações e nenhuma transação aberta nas falhas de negócio. O rollback real é do banco e já foi coberto pelo e2e de `infra-mensageria`.

### 11. Frontend: dados, checkout e acompanhamento
- **Dados:**
  - `order.api.ts` espelha os DTOs; `getMyOrder` devolve `null` no `404` com `ORDER_NOT_FOUND`;
  - `order.util.ts` tem `formatOrderNumber` e espelha `ORDER_RECIPIENT_NAME_MAX_LENGTH` e `ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH`;
  - `useMyOrder(orderId)` usa estado chaveado por `token` e `orderId`, como `useMyCustomer`, e expõe `order`, `loading` e `notFound`.
- **Checkout:**
  - "Quem recebe" (inicial = nome do usuário, `maxLength` 100) e "Instruções" (`maxLength` 200) viram estados controlados;
  - a confirmação chama `placeMyOrder`. No sucesso: `cart.refresh()`, toaster e `router.push(orderTrackingRoute(order.id))`. No erro: toaster com `toErrorMessage`, `cart.refresh()` e, para os códigos `ORDER_CUSTOMER_*`, recarga do cadastro;
  - `useMyCustomer` ganha `refresh()` para essa recarga, sem mudar o restante do contrato.
- **Acompanhamento:**
  - os estados são: não hidratado ou carregando (blocos `bg-surface`), sem sessão, não encontrado e pedido;
  - horários ("hoje às HH:MM" e a hora do passo) só são formatados depois de hidratar, no fuso do navegador, para não divergir do HTML do servidor;
  - sem categoria no item, `ProductArt` recebe uma categoria neutra e mostra o tom e o emoji padrão quando não há miniatura;
  - `generateMetadata` usa `formatOrderNumber` sobre o id da URL, sem chamar a API: no servidor não há sessão.
- **Remoção:** `tracking.mock.ts` é apagado, com o mapa, o entregador e a janela de chegada.

Alternativas descartadas:
- **Guardar o pedido criado no estado de navegação e não chamar `GET`:** recarregar a página perderia o pedido.
- **Adicionar a categoria raiz ao item do pedido:** muda o contrato definido pelo prompt só para a ilustração de reserva.

### 12. Specs coordenadas
- **`orders/checkout-access`:** três requisitos modificados, copiados inteiros da spec principal atual.
- **`admin/admin-api-authorization`:** "Endpoints não administrativos não mudam" parte da spec principal atual e só acrescenta `/me/orders`.
- **`messaging/*`:** não são alteradas. `orders/order-placement` só referencia as specs principais `messaging/event-outbox` e `messaging/message-broker`, já sincronizadas no archive de `infra-mensageria`.
- **Purpose de `orders/checkout-access`:** ao arquivar, ajustar à mão, porque ainda exclui a criação do pedido; deltas não alteram o Purpose.

## Risks / Trade-offs

- **[O carrinho muda em outro dispositivo entre a leitura (passo 3) e o esvaziamento (passo 6), e o pedido não inclui a mudança, mas o carrinho é esvaziado]** → aceito nesta versão e documentado no JSDoc de `PlaceOrder`. O intervalo é de milissegundos, e o checkout recarrega o carrinho ao abrir.
- **[O preço muda entre o cliente abrir o checkout e confirmar, e o pedido usa o preço da confirmação, diferente do exibido]** → aceito. O acompanhamento mostra os valores gravados, e avisar mudança de preço fica fora do escopo.
- **[Dois envios simultâneos (duas abas) leem o carrinho cheio antes de qualquer commit e criam dois pedidos]** → risco aceito sem chave de idempotência; o botão bloqueia o reenvio na mesma aba. A chave fica para quando houver pagamento real.
- **[O broker está fora do ar]** → o pedido é criado e o evento fica `PENDING` até o relay conseguir publicar (`messaging/event-outbox`).
- **[Entrega pelo menos uma vez: o mesmo `order.placed` pode chegar duas vezes]** → nenhum consumidor nesta entrega. Os próximos devem deduplicar pelo `id` do evento.
- **[`order_items.product_id` e `orders.customer_id` com `Restrict` bloqueiam exclusão física de produtos e clientes com pedidos]** → produtos e clientes só são excluídos logicamente. Um `prisma migrate reset` apaga tudo junto.
- **[`prisma migrate dev` tenta alterar a coluna gerada `products.search_document`]** → conferir que a migration `orders_order` só cria `orders`, `order_items`, FKs e índices; remover qualquer trecho estranho antes de aplicar.
- **[O `.http` e as conferências no navegador alteram o seed (produto desativado, preço alterado, cliente inativo)]** → cada cenário restaura o estado no próprio arquivo, e a tarefa de validação confere o estado final. Os pedidos criados ficam no banco (não há seed de pedidos).
- **[URLs antigas de acompanhamento com números fictícios]** → passam a mostrar "Pedido não encontrado."; nunca representaram pedidos reais.
- **[Nome do usuário fora dos limites de quem recebe (menos de 2 ou mais de 100 caracteres) quando `recipientName` vem vazio]** → o pedido falha com o código de texto e a mensagem aparece no checkout; o cliente pode preencher "Quem recebe".

## Migration Plan

1. Aplicar a migration `orders_order`, que é aditiva: cria `orders` e `order_items`, com FKs e índices, sem mudar dados existentes.
2. Publicar backend e frontend juntos. O checkout novo depende de `POST /me/orders`, e o acompanhamento, de `GET /me/orders/:id`.
3. Nenhum dado é migrado: pedidos nascem do uso.

**Rollback:** reverter o código e remover as tabelas com `DROP TABLE order_items, orders;` (o Prisma não gera migration de descida), além da pasta da migration. Linhas `order.placed` do outbox, pendentes ou publicadas, podem ficar: não há consumidores.
