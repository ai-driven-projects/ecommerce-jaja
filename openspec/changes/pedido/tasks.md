> **Execução:** três subagentes separados, com contexto limpo, **nessa ordem**:
> - **Negócio:** grupo 1;
> - **Backend:** grupos 2–4;
> - **Frontend:** grupos 5–7.
>
> O grupo 8 (conferências no navegador com login, formulários e o painel do RabbitMQ) é feito **na conversa principal, com o usuário**, com o painel do navegador visível.
>
> Um grupo só começa depois de o anterior terminar com as validações passando.
>
> **Leitura prévia de cada subagente:**
> - todos:
>   - `.claude/skills/skills-standards.md`;
>   - o prompt `openspec/extras/prompts/15-pedido.md`;
>   - o `design.md` e as specs desta change;
>   - as referências de código da sua camada listadas no Contexto do prompt;
> - Frontend, além disso: `apps/frontend/DESIGN.md`.
>
> **Leitura em CQRS** (Decisão 9 do `design.md`): as leituras do pedido são interfaces no módulo, implementadas como atributos públicos de `OrderPrisma` e chamadas direto pelo controller. Esse princípio prevalece sobre o workflow da skill `module-query-cqrs`. Não criar `find-*.use-case.ts` nem teste unitário para as queries.
>
> **Regras de todos os subagentes:**
> - nenhum subagente altera `packages/shared`;
> - o Backend deixa o seed como estava (produto, preço e cliente restaurados);
> - cada subagente encerra listando os arquivos criados/alterados e o resultado das validações.

## 1. Domínio `@jaja/orders` (subagente Negócio)

- [x] 1.1 Conferir o pré-requisito do prompt 14: existem `apps/backend/src/messaging/outbox/domain-event.prisma.ts` (`DomainEventPrisma implements DomainEventRepository`) e `apps/backend/src/messaging/outbox/outbox-relay.ts`, e `MessagingModule` exporta `DomainEventPrisma`. Se faltar algo, parar e reportar. Verificar com `grep -n "DomainEventPrisma" apps/backend/src/messaging/messaging.module.ts`.
- [x] 1.2 Criar o agregado `order` com a skill `module-aggregate --mode example`:
  - apagar o use case e o teste gerados, mantendo `model/`, `provider/`, `dto/` e o mock `test/mock/in-memory-order.repository.ts`;
  - criar a pasta `src/order/event/`.

  Criar `src/order/errors.ts`:
  - `OrderErrors` (`as const`) com os 15 códigos do prompt e o tipo `OrderErrorCode`;
  - com JSDoc: `ORDER_STATUSES = ['PLACED'] as const` com o tipo `OrderStatus`, `ORDER_RECIPIENT_NAME_MAX_LENGTH = 100` e `ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH = 200`.

  Criar `src/order/index.ts`, reexportando `dto`, `errors`, `event`, `model`, `provider` e `use-case`, e acrescentar `export * from './order'` em `src/index.ts`. Verificar com `npx tsc --noEmit -p modules/orders`.
- [x] 1.3 Criar os VOs em `src/order/model/` com a skill `module-value-object`, reaproveitando `CART_ITEM_MAX_QUANTITY` de `../cart`:
  - `order-item.vo.ts` (`OrderItem`, composto como `CartItem`): `productId` (`Id.required`), `name` (`Text` 1–255), `unit` (`Text` 1–40), `thumbUrl` (`Url` opcional, ausente → `null`), `unitPriceCents` inteiro ≥ 1 (`ORDER_ITEM_PRICE_INVALID`), `quantity` inteira de 1 a 99 (`ORDER_ITEM_QUANTITY_INVALID`), `lineTotalCents`, `toProps()` e `toDTO()`;
  - `order-delivery-address.vo.ts` (`OrderDeliveryAddress`): CEP com 8 dígitos, logradouro, número, complemento (vazio → `null`), bairro, cidade e UF com 2 letras maiúsculas; obrigatório em branco ou formato inválido → `ORDER_DELIVERY_ADDRESS_INVALID`; `toDTO()`.

  Verificar com `test/order/order-item.vo.test.ts` e `test/order/order-delivery-address.vo.test.ts`, com os casos do prompt:
  - item: `productId` malformado, nome vazio, preço 0, quantidade 0/100/1.5, `thumbUrl` ausente vira `null` e `lineTotalCents`;
  - endereço: obrigatório em branco, CEP com 7 dígitos, UF inválida e complemento vazio vira `null`.
- [x] 1.4 Criar `src/order/dto/order.dto.ts` com a skill `module-dto`: `OrderItemDTO`, `OrderDeliveryAddressDTO` (mesmos campos de `CustomerAddressDTO`, declarados no módulo), `OrderDTO`, `OrderDetailDTO` (sem `createdAt`/`updatedAt`), `OrderCustomerDTO`, `PlaceOrderInputDTO` e `PlaceOrderOutputDTO`, com os campos do prompt. Verificar com `npx tsc --noEmit -p modules/orders` e `grep -rn "@jaja/customers\|@jaja/catalog" modules/orders/src` vazio.
- [x] 1.5 Criar `src/order/event/order-placed.event.ts` no padrão de `packages/shared/test/events/event-flow.integration.test.ts` (Decisão 6):
  - `OrderPlacedEvent extends AbstractDomainEvent`, com construtor privado e `tryCreate`/`create` via `super.tryCreateFromProps`;
  - `ORDER_PLACED_EVENT_TYPE = 'order.placed'` e o tipo `OrderPlacedPayload`;
  - `aggregateType: 'Order'`, `occurredAt = placedAt`, `metadata: {}` e o payload de `orders/order-placement`;
  - JSDoc: fato consumado, gravado na mesma transação do pedido, publicado pelo outbox, payload autossuficiente.

  Criar `src/order/event/index.ts`. Verificar com `test/order/order-placed.event.test.ts`: `type`, `aggregateType`, `aggregateId` e payload com totais e `placedAt` em ISO.
- [x] 1.6 Criar `src/order/model/order.entity.ts` (`Order extends AggregateRoot<Order, OrderProps, OrderPlacedEvent>`) com a skill `module-entity`:
  - atributos e validações do prompt, com `Result.combine`, e limites `CART_MAX_ITEMS` de `../cart`;
  - getters e totais calculados (`itemCount`, `subtotalCents`, `deliveryFeeCents` com `DELIVERY_FEE_CENTS`/`FREE_DELIVERY_THRESHOLD_CENTS` e `totalCents`);
  - `toDTO()` com os totais;
  - `tryCreate`/`create` sem eventos;
  - `static place(input)`, que gera id, `PLACED` e `placedAt` e adiciona o `OrderPlacedEvent` na instância criada (Decisões 5 e 6).

  Verificar com `test/order/order.entity.test.ts`:
  - `place` gera id, `PLACED`, `placedAt` e exatamente um evento com o payload esperado, e `pullEvents` esvazia a lista;
  - `tryCreate` não gera eventos;
  - sem itens, 51 itens, item repetido, `recipientName` de 1 caractere, instruções com 201 caracteres e status desconhecido;
  - frete de 490 abaixo de 7900 e 0 a partir de 7900.
- [x] 1.7 Criar em `src/order/provider/`:
  - `order.repository.ts` (`OrderRepository extends CrudRepository<Order>`), com o JSDoc do prompt (skill `module-repository`);
  - as interfaces `find-order-customer-by-user-id.query.ts` (`FindOrderCustomerByUserIdQuery`) e `find-my-order-by-id.query.ts` (`FindMyOrderByIdQuery`), com o comportamento no JSDoc (skill `module-query-cqrs`, só contrato);
  - o `index.ts`.

  Verificar com `npx tsc --noEmit -p modules/orders` e `find modules/orders/src -name "find-*.use-case.ts"` vazio.
- [x] 1.8 Criar os mocks em `modules/orders/test/mock/` (Decisão 10):
  - `in-memory-order.repository.ts`: id repetido → `ORDER_ALREADY_EXISTS`; `update`/`delete` de inexistente → `ORDER_NOT_FOUND`; buscas ignoram excluídos; acesso ao que foi gravado;
  - `in-memory-domain-event.repository.ts`: eventos e `tx` de cada chamada, com opção de falhar;
  - `fake-transaction.manager.ts`: `context`, `calls` e `rolledBack` (`true` quando a operação lança, relançando o erro);
  - `in-memory-find-order-customer-by-user-id.query.ts` e `in-memory-find-cart-by-user-id.query.ts`, configuráveis.

  Verificar que os testes da tarefa 1.9 os usam sem erro de tipo.
- [x] 1.9 Criar `src/order/use-case/place-order.use-case.ts` (`PlaceOrder implements UseCase<PlaceOrderInputDTO, PlaceOrderOutputDTO>`) com a skill `module-use-case`:
  - fluxo de 7 passos do prompt e Decisões 3 e 7;
  - `runInTransaction` com `create`, `update` do carrinho e `append(order.pullEvents(), tx)`, cada um com `throwsIfFailed()`, e `ResultError` → `Result.fail`;
  - JSDoc sobre a divergência aceita do carrinho entre os passos 3 e 6.

  Criar `use-case/index.ts`. Verificar com `test/order/place-order.use-case.test.ts`:
  - sucesso: pedido com os preços do carrinho, carrinho vazio, um `order.placed` gravado com o mesmo `tx` do pedido e do carrinho, `calls === 1` e `{ orderId }`;
  - `recipientName` vazio usa o nome do usuário;
  - sem cliente, cliente inativo, carrinho vazio e item indisponível falham com `calls === 0` e sem eventos;
  - falha ao gravar o evento: falha com o código e `rolledBack === true`;
  - `userId` malformado.
- [x] 1.10 Rodar `npm test --workspace=@jaja/orders` e `npm run build --workspace=@jaja/orders`. Verificar:
  - os testes do carrinho e do pedido passam;
  - `modules/orders/dist/index.d.ts` (e os `.d.ts` reexportados) expõe `Order`, `OrderItem`, `OrderDeliveryAddress`, `OrderErrors`, `ORDER_STATUSES`, `OrderPlacedEvent`, `ORDER_PLACED_EVENT_TYPE`, `OrderRepository`, `FindOrderCustomerByUserIdQuery`, `FindMyOrderByIdQuery`, `OrderDetailDTO` e `PlaceOrder`.

## 2. Backend: banco (subagente Backend)

- [x] 2.1 Em `apps/backend/prisma/models/orders.model.prisma`, com a skill `backend-prisma-data` e a Decisão 4:
  - criar os models `Order` (`orders`) e `OrderItem` (`order_items`) com as colunas, FKs, unique e índices do prompt;
  - acima dos models, o comentário pedido (cliente e não usuário, cópias congeladas, totais gravados para leitura, evento no outbox na mesma transação);
  - acrescentar `orders Order[]` em `Customer` (`customers.model.prisma`) e `orderItems OrderItem[]` em `Product` (`catalog.model.prisma`).

  Rodar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name orders_order --create-only`, conferir e aplicar. Verificar:
  - o SQL gerado só cria `orders`, `order_items`, `order_items_order_id_position_key`, as FKs (`orders_customer_id_fkey`, `order_items_order_id_fkey`, `order_items_product_id_fkey`) e os índices, sem tocar em `products.search_document`;
  - depois de aplicado com `prisma:migrate:dev`, rodar de novo não propõe outra migration;
  - `npm run prisma:generate --workspace=@jaja/backend` conclui.

## 3. Backend: adapter e API do pedido (subagente Backend)

- [x] 3.1 Criar `apps/backend/src/modules/orders/order.prisma.ts` (`OrderPrisma`, `@Injectable()`, `implements OrderRepository`) no padrão de `cart.prisma.ts`:
  - `create(order, tx)`: grava o pedido, os totais da entidade e os itens aninhados (`position` = índice) com o client da transação recebida;
  - `update`, `findById` e `delete` (soft delete) com `toDomain`/`fromDomain`, sem ir ao banco com id que não é uuid;
  - erros: `P2002` com `orders_pkey` → `ORDER_ALREADY_EXISTS`; `P2003` com a FK de `customer_id` → `ORDER_CUSTOMER_NOT_FOUND` e a de `product_id` → `ORDER_PRODUCT_NOT_FOUND`.

  Verificar com `npm run build --workspace=@jaja/backend` e, na tarefa 4.1, com o cenário de sucesso gravando itens na ordem.
- [x] 3.2 Em `OrderPrisma`, implementar as queries como atributos públicos tipados (Decisão 9):
  - `findOrderCustomerByUserId`: `customers` não excluído do usuário com `users.name` e o endereço, devolvendo o cadastro inativo também;
  - `findMyOrderById`: filtro por `orders.id`, `orders.deleted_at IS NULL` e `customers.user_id`, itens por `position` e totais lidos das colunas;
  - ids malformados devolvem `null` sem ir ao banco.

  Verificar com `npm run build --workspace=@jaja/backend` e, na tarefa 4.1, com os cenários de isolamento e de id malformado.
- [x] 3.3 Criar `apps/backend/src/modules/orders/order-http.ts` com:
  - `PlaceOrderBody`;
  - `toPlaceOrderInput(userId, body)`, que repassa só `recipientName` e `deliveryInstructions` quando são strings;
  - `throwOrderFailure(errors)`: `ORDER_NOT_FOUND` → 404, `ORDER_ALREADY_EXISTS` → 409, demais → 400, sem códigos repetidos.

  Verificar com `npm run lint --workspace=@jaja/backend` e, na tarefa 4.1, com o cenário de campos extras ignorados.
- [x] 3.4 Criar `my-order.controller.ts` (`MyOrderController`, `@Controller('me/orders')`, `@UseGuards(JwtGuard)`) com a skill `backend-controller` e a Decisão 8:
  - `POST /` com `@HttpCode(201)`: `PlaceOrder` com `OrderPrisma`, `CartPrisma`, `DomainEventPrisma` e `PrismaService`, resposta por `findMyOrderById`;
  - `GET /:id`: `404` com `[ORDER_NOT_FOUND]` quando `null`;
  - `userId` sempre de `@CurrentUser('id')`.

  Em `orders.module.ts`, importar `MessagingModule`, registrar `OrderPrisma` em `providers`/`exports` e `MyOrderController` em `controllers`; ajustar `index.ts`. Verificar:
  - `npm run build --workspace=@jaja/backend` passa;
  - com o backend no ar, `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:4000/me/orders` e `curl -s -o /dev/null -w "%{http_code}" localhost:4000/me/orders/x` respondem `401`.

## 4. Backend: integração, evento e validação (subagente Backend)

- [x] 4.1 Criar `apps/backend/src/modules/orders/test/order.integration.http` no estilo de `cart.integration.http`:
  - cabeçalho com os pré-requisitos: backend, Postgres e RabbitMQ no ar e seeds `auth`, `customers` e `catalog`;
  - variáveis do prompt e usuário novo por `POST /auth/register` com timestamp;
  - produtos obtidos por `GET /storefront/products` com `sort`;
  - todos os cenários do prompt: acesso, cliente, carrinho, indisponível, cliente inativo, sucesso, frete grátis, quem recebe padrão, preço congelado e isolamento;
  - cada alteração no seed (produto desativado, preço e cliente inativo) restaurada no próprio arquivo.

  Subir o backend (`npm run dev --workspace=@jaja/backend`, porta 4000) e executar as requisições em ordem. Verificar:
  - cada resposta tem o status e os campos de `orders/order-placement`;
  - no fim, o produto está ativo e com o preço original, e o cliente do seed está ativo.
- [x] 4.2 Conferir o evento do cenário de sucesso da 4.1:
  - com `docker compose exec postgres psql -U jaja -d jaja` em `apps/backend`, rodar `SELECT id, type, aggregate_id, status, published_at FROM outbox_events WHERE aggregate_id = '<id do pedido>';`. Deve haver uma linha `order.placed` que, alguns segundos depois, tem `status = 'PUBLISHED'`;
  - pela API de gerenciamento do RabbitMQ (`POST http://localhost:15672/api/queues/%2F/jaja.events.all/get` com `jaja`/`jaja`, `ackmode: ack_requeue_true`), ver a mensagem com `type` `order.placed` e o payload com `customerId`, itens e totais.

  Registrar na saída do subagente o id do pedido, a linha do outbox e a mensagem vista.
- [x] 4.3 Rodar `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` e verificar que passam sem erros. Executar de novo `cart.integration.http` e verificar que as respostas continuam as esperadas por `orders/cart`.

## 5. Frontend: mensagens e dados do pedido (subagente Frontend)

- [x] 5.1 Adicionar as mensagens dos 15 códigos `ORDER_*` em `src/shared/i18n/messages.pt.ts` e `messages.en.ts`, na ordem alfabética das chaves, com os textos do prompt para `ORDER_CUSTOMER_REQUIRED`, `ORDER_CUSTOMER_INACTIVE`, `ORDER_CART_EMPTY`, `ORDER_CART_HAS_UNAVAILABLE_ITEMS`, `ORDER_NOT_FOUND` e `ORDER_PRODUCT_NOT_FOUND`. Verificar que `getMessage('ORDER_CUSTOMER_INACTIVE')` devolve "Seu cadastro está inativo. Fale com o atendimento." e que `npm run lint --workspace=@jaja/frontend` passa.
- [x] 5.2 Criar em `src/modules/orders/data/`:
  - `order.api.ts`: tipos `OrderItem`, `OrderDeliveryAddress`, `OrderDetail` e `PlaceOrderInput`; `placeMyOrder(token, input)`; e `getMyOrder(token, orderId)` com `encodeURIComponent`, `null` no `404` com `ORDER_NOT_FOUND` e os demais erros propagados;
  - `order.util.ts`: `formatOrderNumber` e as constantes espelhadas de `@jaja/orders`, com comentário.

  Verificar com `npx tsc --noEmit -p apps/frontend` e que `formatOrderNumber('3f1c9a52-7b1e-4d2a-9c4f-8e6b2a1d0c55')` devolve `3F1C9A52`.
- [x] 5.3 Criar `src/modules/orders/data/use-my-order.hook.ts` (`useMyOrder(orderId)`, Decisão 11):
  - estado chaveado por token e id;
  - expõe `order`, `loading` e `notFound`;
  - sem sessão, não chama a API;
  - erro diferente de 404 vira `toast.error(toErrorMessage(error))`.

  Acrescentar `refresh()` a `useMyCustomer` (`src/modules/customers/data/use-my-customer.hook.ts`), que recarrega o cadastro da sessão atual. Apagar `data/tracking.mock.ts` e atualizar `data/index.ts`. Verificar:
  - `grep -rn "tracking.mock\|buildTrackingOrder\|nextOrderId" apps/frontend/src` retorna só usos que as tarefas 6 e 7 vão remover;
  - `npx tsc --noEmit -p apps/frontend` passa ao fim do grupo 7.

## 6. Frontend: checkout (subagente Frontend)

- [x] 6.1 Em `checkout.page.tsx`:
  - remover `PAYMENT_METHODS`, o seletor e os campos de cartão;
  - o passo 2 "Pagamento" mostra o badge "Simulado" e o texto do prompt;
  - "Quem recebe" (inicial = nome do usuário, `maxLength` 100) e "Instruções para o entregador" (`maxLength` 200) viram campos controlados.

  Verificar com `grep -n "PAYMENT_METHODS\|card-number\|Faturado" apps/frontend/src/modules/orders/pages/checkout.page.tsx` vazio.
- [x] 6.2 Em `checkout.page.tsx`, trocar a confirmação por `placeMyOrder(token, { recipientName, deliveryInstructions })`, mantendo `canConfirm` e "Confirmando…":
  - sucesso: `cart.refresh()`, `toast.success("Pedido #<número> recebido", { description: "Pagamento simulado em andamento." })` e `router.push(orderTrackingRoute(order.id))`;
  - erro: `toast.error(toErrorMessage(error))`, `cart.refresh()` e `myCustomer.refresh()` para os códigos `ORDER_CUSTOMER_*`, continuando em `/checkout`;
  - sem `cart.clear()` nem `nextOrderId`;
  - JSDoc da página atualizado.

  Verificar com `npm run lint --workspace=@jaja/frontend` e, no grupo 8, com os fluxos de sucesso e erro.

## 7. Frontend: acompanhamento, design e build (subagente Frontend)

- [x] 7.1 Reescrever `components/order-tracking.component.tsx` com `useMyOrder` e os estados de `orders/order-tracking`:
  - estados: carregando (blocos `bg-surface`), sem sessão (link para `/entrar?voltar=<rota atual>`), não encontrado e pedido;
  - cabeçalho com `formatOrderNumber`, badge, "Feito hoje às HH:MM" ou a data, endereço e quem recebe;
  - os cinco passos, com só o primeiro concluído;
  - itens com `ProductArt` (categoria neutra), totais com "Pagamento simulado" e instruções quando houver;
  - sem `RouteMap`, entregador, janela de chegada e loja.

  Verificar com `grep -n "RouteMap\|courier\|etaWindow\|bg-map" apps/frontend/src/modules/orders/components/order-tracking.component.tsx` vazio.
- [x] 7.2 Em `src/app/(public)/pedidos/[id]/acompanhar/page.tsx`, fazer `generateMetadata` usar `Pedido #${formatOrderNumber(id)} — já já` e atualizar o JSDoc da rota (sem "dados locais"); ajustar `pages/tracking.page.tsx` se preciso. Verificar com `npx tsc --noEmit -p apps/frontend`.
- [x] 7.3 Atualizar `apps/frontend/DESIGN.md` (passo "Pagamento" simulado e acompanhamento com o pedido real, só com o primeiro passo concluído, sem mapa nem entregador) e `src/modules/orders/index.ts`. Verificar:
  - `grep -n "Pix / Cartão / Faturado\|mapa ilustrativo" apps/frontend/DESIGN.md` não encontra o texto antigo;
  - `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` passam sem erros;
  - `grep -rn "tracking.mock\|nextOrderId" apps/frontend/src` vazio.

## 8. Verificação no navegador (conversa principal, com o usuário)

- [ ] 8.1 Com banco semeado, RabbitMQ, backend e frontend no ar e o painel do navegador visível, entrar com `ana.pereira.carvalho@jaja.dev`, montar o carrinho com dois produtos e abrir `/checkout`. Verificar:
  - o passo "Pagamento" simulado, sem campos;
  - "Quem recebe" preenchido com o nome;
  - confirmar com instruções mostra "Confirmando…" e o toaster "Pedido #<número> recebido";
  - o acompanhamento tem itens, totais, endereço, quem recebe, instruções e só "Pedido recebido" concluído;
  - ao voltar para a loja, o contador do carrinho está em 0.

  Registrar com captura de tela.
- [ ] 8.2 Verificar a sessão no acompanhamento:
  - recarregar mantém o pedido;
  - depois de sair, a mesma URL mostra "Entre para acompanhar seu pedido.", e "Entrar" volta ao pedido;
  - entrar com outra conta mostra "Pedido não encontrado.";
  - `/pedidos/4211/acompanhar` mostra "Pedido não encontrado.";
  - a aba tem o título "Pedido #<número> — já já".
- [ ] 8.3 Criar uma conta no próprio `/checkout` com itens de visitante, salvar os dados de entrega e confirmar o primeiro pedido. Verificar que o acompanhamento abre com o pedido dessa conta.
- [ ] 8.4 Verificar os erros da API no checkout:
  - com o resumo carregado, desativar no admin um produto do carrinho (em outra aba) e confirmar: o toaster "Remova os itens indisponíveis para confirmar o pedido." aparece, o resumo recarrega com "Indisponível" e a página continua em `/checkout`;
  - reativar o produto no fim e conferir que ele voltou à vitrine.
- [ ] 8.5 No painel do RabbitMQ (`http://localhost:15672`, `jaja`/`jaja`), verificar que a fila `jaja.events.all` recebeu uma mensagem `order.placed` por pedido confirmado nas tarefas 8.1 e 8.3, com o payload do pedido. Registrar com captura de tela.
- [ ] 8.6 Em 375px, verificar que `/checkout` e o acompanhamento não têm rolagem horizontal (`document.documentElement.scrollWidth <= window.innerWidth`). Voltar o painel ao tamanho padrão.

> **Ao arquivar esta change:**
> - ajustar à mão o `## Purpose` de `openspec/specs/orders/checkout-access/spec.md`, que ainda exclui "o pagamento e a criação do pedido" da capacidade (Decisão 12 do `design.md`);
> - conferir em `openspec/specs/admin/admin-api-authorization/spec.md` que "Endpoints não administrativos não mudam" mantém lojas, clientes, carrinho e pedido.
>
> A ordem de arquivamento em relação a `infra-mensageria` é indiferente: esta change não altera as specs `messaging/*`.
