# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Pacote de domínio: `modules/orders` (`@jaja/orders`), com os agregados `cart` e `order` (prompt 15). Backend: `apps/backend` (NestJS 12, ESM com imports relativos terminando em `.js`, Vitest). Frontend: `apps/frontend` (Next.js 16, React 19, React Compiler). Shared: `@mentoria-360/shared` (submódulo em `packages/shared`). Skills em `.claude/skills/*`; padrão de nomes em `.claude/skills/skills-standards.md`.
- **Pré-requisitos: prompts 14 (`infra-mensageria`), 15 (`pedido`) e 16 (`consumo-eventos`) já implementados.**
  - `POST /me/orders` grava o pedido `PLACED` e o evento `order.placed` na mesma transação, e o outbox o publica no exchange `jaja.events`.
  - O backend consome eventos pelo `EventConsumerRegistry` (`apps/backend/src/messaging/consumer/`), com:
    - uma fila `jaja.<consumidor>` por consumidor;
    - idempotência em `processed_messages`;
    - a transação do consumidor reaproveitada pelo caso de uso (`ActiveTransactionManager`);
    - `causationId`/`correlationId` gravados no `metadata`;
    - novas tentativas pela `.wait`, descarte pela `.dead` e espera inicial `delayMs`.
  - Ainda não existe nenhum consumidor de negócio.
- **Objetivo:** fazer o pedido andar sozinho até ser entregue, com eventos reais passando pelo RabbitMQ, e o cliente acompanhar cada passo **ao vivo**, sem recarregar a página. O pagamento, a separação na loja e a entrega são **serviços simulados**: cada um é um consumidor que espera um tempo (a "demora" do serviço), avança o status do pedido e grava o próximo evento no outbox. O fluxo em si é real: outbox → RabbitMQ → consumidor → caso de uso → outbox → …
- **Propósito didático:** o projeto ensina arquitetura orientada a eventos com o mínimo de complexidade. Este prompt mostra:
  - **coreografia:** não existe orquestrador; cada serviço reage ao evento do anterior;
  - a **cadeia de causa e correlação:** todos os eventos de um pedido compartilham o `correlationId` do `order.placed`;
  - a diferença entre **fila de trabalho** (uma cópia dividida entre instâncias, durável, com idempotência, nos consumidores de negócio) e **difusão** (uma cópia por instância, transitória, nas notificações ao vivo).
- **Fluxo do pedido** (a espera vale para `ORDER_SIMULATION_DELAY_FACTOR=1`):

  | Status | Passo na tela | Evento gravado | Serviço simulado (consumidor) | Reage a | Espera |
  | --- | --- | --- | --- | --- | --- |
  | `PLACED` | Pedido recebido | `order.placed` (prompt 15) | — | — | — |
  | `PAYMENT_APPROVED` | Pagamento aprovado | `order.payment-approved` | `payment.approve-order` | `order.placed` | 3 s |
  | `PICKING` | Separando na loja | `order.picking-started` | `store.start-picking` | `order.payment-approved` | 2 s |
  | `OUT_FOR_DELIVERY` | A caminho | `order.out-for-delivery` | `delivery.dispatch-order` | `order.picking-started` | 6 s |
  | `DELIVERED` | Entregue | `order.delivered` | `delivery.complete-order` | `order.out-for-delivery` | 8 s |

- **Decisões de arquitetura:**
  - **Regras no agregado:**
    - `Order` conhece a sequência de status e só avança para o **próximo** (`advanceTo`), registrando a data do passo e adicionando `OrderStatusChangedEvent` na instância devolvida;
    - reidratar do banco nunca adiciona eventos (como no prompt 15);
    - pular um passo é inválido (`ORDER_STATUS_TRANSITION_INVALID`).
  - **Um caso de uso para todos os passos:** `AdvanceOrderStatus` recebe o pedido e o status de destino. Se o pedido **já chegou** a esse status (ou passou dele), termina com sucesso sem gravar nada (`changed: false`). É a regra "mensagem que não se aplica mais termina com sucesso" do prompt 16, e protege contra mensagens repetidas ou fora de ordem mesmo sem a tabela de processadas.
  - **Serviços simulados no backend:** os quatro consumidores ficam em `apps/backend/src/modules/orders/simulation/`, registrados no `EventConsumerRegistry`, e só chamam `AdvanceOrderStatus` com o `transactionManager` recebido. Documentar no código a simplificação didática: num sistema real, cada serviço seria um processo próprio, com eventos próprios (ex.: o gateway publicaria `payment.approved`, e o pedido reagiria a ele).
  - **Espera no broker:** a demora de cada serviço é o `delayMs` do consumidor (fila `.wait` do prompt 16), multiplicado por `ORDER_SIMULATION_DELAY_FACTOR`. Nada de `setTimeout` segurando a transação.
  - **Notificação ao vivo por difusão:**
    - o backend mantém um `LiveEventFeed` (em `messaging`) que assina, **por instância**, uma fila transitória exclusiva ligada a `jaja.events` com `#`;
    - cada instância recebe cópia de todos os eventos publicados e os repassa, em memória, às conexões SSE abertas nela;
    - não tem idempotência, novas tentativas nem descarte: é só aviso;
    - mensagens publicadas enquanto a instância está sem broker se perdem, o que é aceitável porque o cliente relê o pedido ao reconectar.
  - **A notificação é só um aviso:**
    - o stream SSE manda `{ orderId, eventType, messageId, occurredAt }`, e a página relê o pedido pela API REST, que é a fonte da verdade;
    - o stream nunca manda dados do pedido.
  - **SSE autenticado sem token na URL:**
    - o navegador abre o stream com `fetch` e o cabeçalho `Authorization` (a `EventSource` nativa não envia cabeçalhos), lendo `text/event-stream` pelo `ReadableStream`;
    - o token nunca vai para a query string.
- **Referências de código** (o código é a fonte da verdade do **padrão**; este prompt é a fonte da verdade das **regras**):
  - domínio: `modules/orders/src/order/**`, principalmente:
    - `model/order.entity.ts` (`place`, `tryCreate`, `cloneWith`, eventos);
    - `event/order-placed.event.ts`;
    - `errors.ts`;
    - `use-case/place-order.use-case.ts` (transação, `append`, `ResultError`);
  - testes e mocks do domínio: `modules/orders/test/order/**` e `modules/orders/test/mock/**`; `packages/shared/src/base/aggregate-root.ts`;
  - backend:
    - pedidos: `apps/backend/src/modules/orders/` (`order.prisma.ts`, `my-order.controller.ts`, `order-http.ts`, `orders.module.ts`, `test/order.integration.http`) e `apps/backend/prisma/models/orders.model.prisma`;
    - mensageria: `apps/backend/src/messaging/` (`consumer/event-consumer.ts`, `event-consumer.registry.ts`, `event-consumer.runner.ts`, `rabbitmq/rabbitmq-message.consumer.ts`, `messaging.module.ts`, `config.util.ts`);
    - e2e: `apps/backend/test/messaging-consumer.e2e-spec.ts`;
  - frontend:
    - pedido: `modules/orders/components/order-tracking.component.tsx`, `modules/orders/pages/tracking.page.tsx`, `modules/orders/data/order.api.ts`, `order.util.ts` e `use-my-order.hook.ts`;
    - utilitários: `src/shared/util/api-client.util.ts` (`API_URL`, `ApiError`, `readErrorPayload`);
    - design: `apps/frontend/DESIGN.md` ("Acompanhamento").
- Backend é ESM: imports relativos com sufixo `.js`. `@jaja/orders` é consumido via `dist`: rodar `npm run build --workspace=@jaja/orders` antes de usá-lo no backend. O contrato `FindByIdRepository.findById(id)` do shared **não recebe** transação: o caso de uso lê o pedido antes e grava dentro da transação. `rxjs` já é dependência do backend. Os testes do pacote de domínio usam jest; os do backend, Vitest.
- Spec desta funcionalidade: change `openspec/changes/ciclo-pedido`, gerada a partir deste prompt. Em caso de dúvida sobre comportamento, valem as specs e o `design.md` da change.
- **Fora do escopo desta funcionalidade:**
  - área administrativa de pedidos (lista real, painel ao vivo, dashboard sem dados de exemplo e limpeza dos pedidos): prompt 18 (`monitor-pedidos`);
  - pagamento recusado, cancelamento, estorno, falhas simuladas e compensação;
  - loja atribuída ao pedido, entregador, ETA, mapa, notificações por e-mail ou push, "Meus pedidos" e número sequencial;
  - ordem garantida, orquestrador (saga) e processos separados por serviço;
  - alterações em `packages/shared`.

# Negócio

- Em `modules/orders/src/order/errors.ts`:
  - `ORDER_STATUSES = ['PLACED', 'PAYMENT_APPROVED', 'PICKING', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const`, **nessa ordem**, com JSDoc explicando que a ordem é a sequência do pedido e que cada status só avança para o seguinte;
  - acrescentar `ORDER_STATUS_TRANSITION_INVALID` a `OrderErrors`;
  - função `orderStatusIndex(status: OrderStatus): number` (posição na sequência).

- Criar o evento `event/order-status-changed.event.ts` (`OrderStatusChangedEvent extends AbstractDomainEvent`), no padrão de `order-placed.event.ts`:
  - constante `ORDER_STATUS_EVENT_TYPES` (`as const`): `PAYMENT_APPROVED: 'order.payment-approved'`, `PICKING: 'order.picking-started'`, `OUT_FOR_DELIVERY: 'order.out-for-delivery'` e `DELIVERED: 'order.delivered'`, com o tipo `OrderStatusEventType`;
  - `type` = `ORDER_STATUS_EVENT_TYPES[status]`, `aggregateType: 'Order'`, `aggregateId` = id do pedido e `occurredAt` = `changedAt`;
  - `payload` (`OrderStatusChangedPayload`): `customerId`, `previousStatus`, `status` e `changedAt` (texto ISO);
  - `metadata`: `{}` (causa e correlação são preenchidas pelo outbox quando o evento nasce num consumidor);
  - `tryCreate({ orderId, customerId, previousStatus, status, changedAt })` falha com `ORDER_STATUS_INVALID` para `status` `PLACED` ou desconhecido;
  - JSDoc: fato consumado ("o pedido avançou para `<status>`"), gravado na mesma transação da mudança de status e publicado pelo outbox; o próximo serviço simulado reage a ele.
  - Exportar em `event/index.ts` e o tipo `OrderEvent = OrderPlacedEvent | OrderStatusChangedEvent`.

- Alterar a entidade `Order` (skill: module-entity):
  - `extends AggregateRoot<Order, OrderProps, OrderEvent>`;
  - novas props, opcionais na reidratação (ausente vira `null`): `paymentApprovedAt`, `pickingStartedAt`, `outForDeliveryAt` e `deliveredAt` (`Date | null`);
  - em `tryCreate`, cada data MUST ser válida quando presente, e MUST estar presente **se e somente se** o status já passou pelo passo correspondente (ex.: `PICKING` exige `paymentApprovedAt` e `pickingStartedAt`, sem `outForDeliveryAt` nem `deliveredAt`). Uma inconsistência falha com `ORDER_STATUS_INVALID`;
  - getters das quatro datas (cópias) e `hasReached(status): boolean` (`orderStatusIndex(this.status) >= orderStatusIndex(status)`);
  - `advanceTo(status: OrderStatus, now = new Date()): Result<Order>`:
    - `status` diferente do **próximo** da sequência (inclusive o atual, um anterior, um pulo ou depois de `DELIVERED`) → `ORDER_STATUS_TRANSITION_INVALID`;
    - `cloneWith({ status, <data do passo>: now, updatedAt: now })`;
    - na instância devolvida, `addEvent(OrderStatusChangedEvent)` com `previousStatus` = status atual e `changedAt` = `now`;
    - a instância original não muda e não recebe eventos;
  - `toDTO()` inclui as quatro datas.
  - Atualizar o comentário da classe com a sequência e a regra de avançar só um passo.

- DTOs em `dto/order.dto.ts` (skill: module-dto):
  - `OrderDTO` (e, por consequência, `OrderDetailDTO`) ganha `paymentApprovedAt`, `pickingStartedAt`, `outForDeliveryAt` e `deliveredAt` (`Date | null`);
  - `AdvanceOrderStatusInputDTO` (`orderId`, `status`) e `AdvanceOrderStatusOutputDTO` (`status` atual e `changed: boolean`).

- Criar o caso de uso `use-case/advance-order-status.use-case.ts` (`AdvanceOrderStatus implements UseCase<AdvanceOrderStatusInputDTO, AdvanceOrderStatusOutputDTO>`), que recebe `OrderRepository`, `DomainEventRepository` e `TransactionManager` (skill: module-use-case). Fluxo:
  1. `orderId` malformado → erro do `Id`; `status` fora de `ORDER_STATUSES` ou `PLACED` → `ORDER_STATUS_INVALID`;
  2. `orderRepository.findById(orderId)` (falha, inclusive `ORDER_NOT_FOUND`, para o fluxo);
  3. `order.hasReached(status)` → devolve `{ status: order.status, changed: false }` **sem abrir transação**;
  4. `order.advanceTo(status)` (falha para o fluxo, ex.: pulo de passo);
  5. numa única `runInTransaction`: `orderRepository.update(next, tx)` e `domainEventRepository.append(next.pullEvents(), tx)`, lançando a falha de cada passo; `ResultError` capturado vira `Result.fail`, como em `PlaceOrder`;
  6. devolve `{ status, changed: true }`.

  JSDoc:
  - chamado pelos serviços simulados com o `transactionManager` do consumidor, então a gravação entra na transação da mensagem;
  - `findById` não recebe transação no contrato do shared: o pedido é lido antes. Nesta versão, só um serviço avança cada passo, e a idempotência do consumidor cobre repetições;
  - "já chegou" termina com sucesso para tolerar mensagens repetidas ou fora de ordem.

- Mocks em `modules/orders/test/mock/`: `in-memory-order.repository.ts` passa a guardar e devolver as datas dos passos, e `update` substitui o pedido guardado.

- Testes unitários (jest, em `modules/orders/test/order/`):
  - `order-status-changed.event.test.ts`: `type` por status, `aggregateType`, `aggregateId`, payload com `previousStatus`, `status` e `changedAt` em ISO; `PLACED` e status desconhecido falham;
  - `order.entity.test.ts` (acrescentar):
    - sequência completa `PLACED` → `DELIVERED` com uma data por passo e um evento por avanço, com o `type` correto;
    - `advanceTo` do status atual, de um anterior, com pulo e depois de `DELIVERED` falham com `ORDER_STATUS_TRANSITION_INVALID`, sem evento;
    - a instância original fica igual;
    - `tryCreate` com status e datas inconsistentes (ex.: `PLACED` com `paymentApprovedAt`, `PICKING` sem `paymentApprovedAt`) falha com `ORDER_STATUS_INVALID`;
    - reidratação em `DELIVERED` não gera eventos; `hasReached`;
  - `advance-order-status.use-case.test.ts`:
    - sucesso: pedido atualizado, um evento gravado com o **mesmo `tx`** do `update`, uma transação e `{ changed: true }`;
    - já no status (ou depois): `{ changed: false }` sem abrir transação e sem evento;
    - pulo de passo: `ORDER_STATUS_TRANSITION_INVALID` sem transação;
    - pedido inexistente: `ORDER_NOT_FOUND`;
    - `status` `PLACED` ou inválido: `ORDER_STATUS_INVALID`;
    - falha ao gravar o evento: falha com o código e `rolledBack = true`;
    - `orderId` malformado.

  Rodar `npm test --workspace=@jaja/orders` e `npm run build --workspace=@jaja/orders`.

> Os passos dos casos de uso podem gerar erros e parar o processo.

# Backend

- **Ambiente** em `apps/backend/.env.example`, com comentários:
  - `ORDER_SIMULATION_ENABLED="true"`: `"false"` não registra os serviços simulados (os pedidos ficam em `PLACED`);
  - `ORDER_SIMULATION_DELAY_FACTOR="1"`: multiplica a demora de cada serviço (número de 0 a 10; `0` = sem espera; `0.2` deixa o fluxo 5× mais rápido);
  - `LIVE_EVENTS_ENABLED="true"`: `"false"` desliga a assinatura de difusão, e os streams ao vivo ficam só com o sinal de vida.

- **Banco** em `apps/backend/prisma/models/orders.model.prisma` (skill: backend-prisma-data):
  - no model `Order`: `paymentApprovedAt DateTime? @map("payment_approved_at")`, `pickingStartedAt DateTime? @map("picking_started_at")`, `outForDeliveryAt DateTime? @map("out_for_delivery_at")` e `deliveredAt DateTime? @map("delivered_at")`, e `@@index([status, placedAt])`;
  - atualizar o comentário do model: a data de cada passo é gravada quando o pedido chega a ele, e a regra de sequência é da entidade.
- Executar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name orders_order_status_steps`, conferir que a migration só acrescenta as quatro colunas e o índice, e rodar `npm run prisma:generate --workspace=@jaja/backend`.

- **Adapter do pedido** (`apps/backend/src/modules/orders/order.prisma.ts`):
  - `toDomain`/`fromDomain` com as quatro datas; `update(order, tx)` grava `status`, as datas e `updatedAt` com o client da transação recebida;
  - `findMyOrderById` devolve as quatro datas.

- **Assinatura transitória no adapter de consumo** (`apps/backend/src/messaging/rabbitmq/rabbitmq-message.consumer.ts`):
  - `RabbitMqSubscription` ganha `transient?: boolean`;
  - com `transient`, a fila é declarada `{ durable: false, exclusive: true, autoDelete: true }` e ligada às routing keys, **sem** `.wait` nem `.dead`;
  - `delayMs` junto com `transient` → `MESSAGE_SUBSCRIPTION_INVALID`;
  - cada mensagem é confirmada (`ack`) depois de `onMessage`, qualquer que seja o resultado: falha e exceção só vão para o log (`warn`, sem payload), e o corpo inválido é descartado com log;
  - a reconexão declara a fila de novo; mensagens publicadas enquanto a conexão estava fora se perdem;
  - comentar a diferença entre fila de trabalho (durável, dividida entre instâncias) e fila transitória (exclusiva, uma por instância, some quando a conexão fecha);
  - acrescentar os casos ao `rabbitmq-message.consumer.spec.ts`: declaração transitória sem `.wait`/`.dead`; `ack` também na falha; `delayMs` com `transient` rejeitado; nova declaração ao reconectar.

- **Feed de eventos ao vivo** em `apps/backend/src/messaging/live/live-event-feed.ts`: `LiveEventFeed` (`@Injectable()`, `OnApplicationBootstrap`, `OnModuleDestroy`):
  - lê `LIVE_EVENTS_ENABLED` (`"false"` desliga; padrão ligado);
  - ao iniciar, se ligado, assina com `MessageConsumer.subscribe` uma fila transitória `jaja.live.<host>.<pid>.<sufixo aleatório de 6 caracteres>` (só `[a-z0-9.-]`), com routing key `#`, e registra no log a fila assinada;
  - expõe `events$: Observable<BrokerMessage>` (um `Subject` do rxjs), que emite cada mensagem recebida; `onMessage` sempre devolve `Result.ok()`;
  - ao desligar, completa o `Subject`;
  - JSDoc: uma cópia de cada evento por instância do backend, só para avisos ao vivo, sem garantia de entrega;
  - registrar em `messaging.module.ts` (providers e exports) e exportar em `index.ts`;
  - teste `live-event-feed.spec.ts` (fake de `MessageConsumer`, `ConfigService` simples): desligado não assina; ligado assina uma fila `jaja.live.*` transitória com `#`; a mensagem entregue sai em `events$`; `onModuleDestroy` completa o observable.

- **Atualizações ao vivo do pedido** em `apps/backend/src/modules/orders/order-live-updates.ts`: `OrderLiveUpdates` (`@Injectable()`), com `LiveEventFeed` injetado:
  - `forOrder(orderId): Observable<MessageEvent>`: filtra `events$` pelas mensagens com `payload.aggregateType === 'Order'` e `payload.aggregateId === orderId`, e as transforma em `{ type: 'order', data: { orderId, eventType, messageId, occurredAt } }` (`occurredAt` em ISO, **sem** o payload do evento);
  - junta um sinal de vida `{ type: 'ping', data: {} }` a cada `ORDER_STREAM_HEARTBEAT_MS = 20_000`;
  - teste `order-live-updates.spec.ts` (`Subject` falso, `vi.useFakeTimers`): repassa só os eventos do pedido; ignora outro pedido e outros agregados; não inclui payload; emite o sinal de vida no intervalo.

- **Stream do cliente** em `my-order.controller.ts`: `GET /me/orders/:id/stream` com `@Sse`:
  - o dono é conferido **antes** de abrir o stream, com `findMyOrderById`: pedido inexistente, de outro usuário ou id malformado respondem `404 [ORDER_NOT_FOUND]` em JSON, e sem token `401`;
  - em seguida devolve `orderLiveUpdates.forOrder(orderId)`;
  - conferir com `curl` que o `404` e o `401` saem como resposta JSON comum, e não como stream aberto. Se o `@Sse` do Nest não permitir isso, implementar o endpoint com `@Get` + `@Res()`, escrevendo `text/event-stream` à mão, com o mesmo comportamento;
  - comentar que o stream é só aviso: a página relê o pedido por `GET /me/orders/:id`.

- **Serviços simulados** em `apps/backend/src/modules/orders/simulation/`:
  - `order-simulation.steps.ts`: `ORDER_SIMULATION_STEPS` com os quatro passos da tabela do Contexto (`consumerName`, `eventType`, `status` de destino e `baseDelayMs`), com um comentário por serviço sobre o que ele simula;
  - `order-simulation.consumers.ts`: `OrderSimulationConsumers` (`@Injectable()`, `OnModuleInit`), com `EventConsumerRegistry`, `OrderPrisma`, `DomainEventPrisma` e `ConfigService`:
    - lê `ORDER_SIMULATION_ENABLED` (padrão ligado) e `ORDER_SIMULATION_DELAY_FACTOR` (número finito de 0 a 10; inválido volta a 1);
    - se ligado, registra um `TransactionalEventConsumer` por passo, com `delayMs = min(round(baseDelayMs * fator), 300_000)`;
    - `handle(message, transactionManager)` lê o `orderId` de `message.payload.aggregateId` (ausente ou não texto → `Result.fail(ORDER_NOT_FOUND)`), executa `new AdvanceOrderStatus(orderPrisma, domainEventPrisma, transactionManager)` com o status do passo e devolve o resultado sem o valor;
    - log: `Pedido <número> → <status>` quando `changed`, e `debug` quando já estava no status; o número são os 8 primeiros caracteres do id em maiúsculas;
    - registra no log, uma vez, se a simulação está desligada ou o fator usado;
    - comentar a simplificação didática (serviços reais seriam processos próprios com eventos próprios);
  - teste `order-simulation.consumers.spec.ts` (registro falso, `ConfigService` simples):
    - ligado registra quatro consumidores com os nomes, eventos e esperas da tabela;
    - fator `0.5` divide as esperas, `0` zera, e inválido usa 1;
    - desligado não registra nada;
    - `handle` sem `aggregateId` falha com `ORDER_NOT_FOUND`.
- Em `orders.module.ts`: registrar `OrderLiveUpdates` e `OrderSimulationConsumers` em `providers`.

- **Teste de integração** `apps/backend/test/order-lifecycle.e2e-spec.ts`, com `describe.runIf(process.env.MESSAGING_E2E === 'true')` e o cabeçalho de pré-requisitos no padrão dos e2e de mensageria (Postgres e RabbitMQ rodando, migrations e seeds `auth`, `customers` e `catalog` aplicados, **nenhum backend rodando**):
  - monta o `AppModule` com `ORDER_SIMULATION_DELAY_FACTOR=0` e o relay ligado com `OUTBOX_POLL_INTERVAL_MS=200`;
  - cria um pedido para o cliente do seed (`ana.pereira.carvalho@jaja.dev`) com `Order.place`, `OrderPrisma.create` e `DomainEventPrisma.append` numa transação, usando dois produtos disponíveis do seed;
  - assina `OrderLiveUpdates.forOrder(orderId)` antes de gravar;
  - espera, com timeout de 20 s, o pedido chegar a `DELIVERED`.

  Cenários:
  - o pedido termina `DELIVERED`, com as quatro datas preenchidas e em ordem crescente;
  - `outbox_events` do pedido tem os cinco eventos na ordem (`order.placed` → `order.delivered`), todos `PUBLISHED`. Os quatro últimos têm `metadata.correlationId` = id do `order.placed`, e cada `causationId` é o id do evento anterior;
  - `processed_messages` tem uma linha para cada um dos quatro consumidores;
  - o stream recebeu os cinco `eventType`, sem payload;
  - ao final: apagar as linhas de `processed_messages` e `outbox_events` do pedido e o pedido (itens em cascata), e fechar o app.

- **`apps/backend/src/modules/orders/test/order.integration.http`:** acrescentar, depois do cenário de sucesso, a leitura `GET /me/orders/:id` alguns segundos depois (com o status avançando) e a abertura do stream (`GET /me/orders/:id/stream`, com a observação de que o Rest Client não mostra SSE: usar `curl -N`). Acrescentar também `GET /me/orders/:id/stream` sem token (401) e com o pedido de outro usuário (404).

- Validação:
  - `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` sem erros;
  - com o broker no ar e nenhum backend rodando, `MESSAGING_E2E=true npm run test:e2e --workspace=@jaja/backend` passando (inclusive os e2e de mensageria);
  - subir o backend (`npm run dev --workspace=@jaja/backend`, porta 4000; se já houver um rodando, usar outra porta), confirmar um pedido com o cliente do seed e acompanhar com `curl -N -H "Authorization: Bearer <token>" http://localhost:4000/me/orders/<id>/stream`. Os cinco avisos devem chegar em cerca de 20 s, e o `GET /me/orders/:id` deve terminar em `DELIVERED` com as datas;
  - no painel do RabbitMQ (`http://localhost:15672`), as filas `jaja.payment.approve-order`, `jaja.store.start-picking`, `jaja.delivery.dispatch-order` e `jaja.delivery.complete-order` (com `.wait` e `.dead`) e a fila `jaja.live.*` (exclusiva, sem `.wait`);
  - parar o RabbitMQ no meio do fluxo e subir de novo: o pedido continua de onde parou, sem reiniciar o backend;
  - registrar na saída do subagente o id do pedido, os horários de cada passo e as linhas do outbox com `causationId`/`correlationId`.

# Frontend

- **Stream autenticado** em `src/shared/util/event-stream.util.ts`: `openEventStream({ path, token, onEvent, onStatusChange }): () => void` (a função devolvida fecha o stream):
  - `fetch(`${API_URL}${path}`)` com `Accept: text/event-stream` e `Authorization: Bearer <token>`, lendo o corpo com `ReadableStream` + `TextDecoder`;
  - interpreta o formato SSE: linhas `event:` e `data:` (várias linhas `data:` juntas com `\n`); a linha em branco despacha; comentários (`:`) são ignorados; `data` é JSON, e o que não for JSON é ignorado;
  - `onEvent({ type, data })` para cada evento, exceto `ping`;
  - `onStatusChange('connecting' | 'live' | 'reconnecting' | 'closed')`: `live` quando a resposta `200` chega; queda de rede ou fim do corpo → `reconnecting` e nova tentativa com espera crescente (1 s, 2 s, 4 s… até 10 s); `401`, `403` e `404` → `closed` com um `ApiError` repassado em `onError?`, sem nova tentativa;
  - fechar cancela a leitura (`AbortController`) e as tentativas agendadas;
  - JSDoc: por que não `EventSource` (cabeçalho de autorização) e que o token nunca vai para a URL.

- **Dados do pedido** em `apps/frontend/src/modules/orders/data/`:
  - `order.api.ts`:
    - `OrderStatus` com os cinco status;
    - `OrderDetail` com `paymentApprovedAt`, `pickingStartedAt`, `outForDeliveryAt` e `deliveredAt` (`string | null`);
    - `myOrderStreamPath(orderId)` (`/me/orders/<id codificado>/stream`);
  - `order-status.util.ts` (novo, usado também pelo admin no prompt 18):
    - `ORDER_STATUS_LABEL` ("Pedido recebido", "Pagamento aprovado", "Separando na loja", "A caminho" e "Entregue");
    - `ORDER_STATUS_BADGE_VARIANT` (`PLACED`/`PAYMENT_APPROVED` `success`; `PICKING` `warning`; `OUT_FOR_DELIVERY` `success`; `DELIVERED` `muted`);
    - `ORDER_STEPS` (status, rótulo e a chave da data: `placedAt`, `paymentApprovedAt`…);
    - `orderStepState(order, index): 'done' | 'current' | 'pending'`: `done` para os passos até o status atual; `current` para o próximo, enquanto o pedido não estiver `DELIVERED`; o resto `pending`;
    - `isOrderFinished(order)`;
  - `use-my-order.hook.ts`:
    - expõe também `reload()`;
    - com o pedido carregado e não entregue, abre `openEventStream` em `myOrderStreamPath`;
    - relê o pedido em cada evento `order` e a cada volta para `live` depois de `reconnecting`, com no máximo uma leitura em andamento e uma pendente;
    - expõe `live: 'connecting' | 'live' | 'reconnecting' | 'closed' | 'off'` (`off` sem stream, ex.: pedido entregue);
    - fecha o stream ao desmontar, trocar de sessão ou de id, e quando o pedido chega a `DELIVERED`;
    - erro de releitura diferente de 404 não gera toast repetido: um aviso por queda.
  - Atualizar `data/index.ts`.

- **Acompanhamento** (`order-tracking.component.tsx`):
  - badge do cabeçalho com `ORDER_STATUS_LABEL[status]` e a variante do status;
  - ao lado do título, o indicador "Ao vivo":
    - bolinha verde pulsando quando `live`;
    - "Reconectando…" em cinza quando `connecting`/`reconnecting`;
    - oculto quando `off` ou `closed`;
    - `prefers-reduced-motion` desliga o pulso;
  - passos com `orderStepState`:
    - `done`: check verde e a hora da data do passo com segundos (`HH:MM:SS`), para mostrar a demora de cada serviço;
    - `current`: destaque laranja com "Em andamento…";
    - `pending`: "Aguardando";
    - a lista tem `aria-live="polite"`, para leitores de tela anunciarem a mudança;
  - quando o status muda com a página aberta, o novo passo concluído recebe um destaque breve (transição de cor, sem animação com `prefers-reduced-motion`);
  - com `DELIVERED`: badge "Entregue", todos os passos concluídos e o texto "Pedido entregue às HH:MM. Obrigado por comprar no já já!" abaixo dos passos;
  - atualizar os comentários ("nesta versão todo pedido está em `PLACED`" deixa de valer);
  - continua sem mapa, entregador e ETA.

- **Mensagens:** acrescentar `ORDER_STATUS_TRANSITION_INVALID` em `src/shared/i18n/messages.pt.ts` e `messages.en.ts`, na ordem alfabética ("Não foi possível atualizar o status do pedido.").
- **Design:** atualizar `apps/frontend/DESIGN.md` ("Acompanhamento"): passos por status com horário, passo atual em andamento, indicador "Ao vivo" e mensagem de entregue.
- Atualizar `apps/frontend/src/modules/orders/index.ts` com o que for novo e público.

- Validação: `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` sem erros. Conferir no navegador, com o backend e o broker no ar e `ORDER_SIMULATION_DELAY_FACTOR=1`:
  - com o cliente do seed, confirmar um pedido. O acompanhamento mostra "Ao vivo", e os passos avançam sozinhos até "Entregue" em cerca de 20 s, cada um com o horário, sem recarregar;
  - recarregar a página no meio do fluxo mantém o passo atual e continua ao vivo;
  - parar o RabbitMQ no meio: a página continua aberta e, ao subir o broker, os passos seguintes aparecem sem recarregar;
  - parar o backend no meio: aparece "Reconectando…" e, ao subir de novo, a página volta a "Ao vivo" com o passo atualizado;
  - no DevTools (Network), a requisição `stream` não tem token na URL e manda o cabeçalho `Authorization`;
  - um pedido já entregue não abre stream;
  - mobile (375px): sem rolagem horizontal.

- **Specs da change:**
  - nova capability `orders/order-lifecycle`:
    - sequência de status e avanço de um passo por vez, com a data de cada passo;
    - eventos `order.payment-approved`, `order.picking-started`, `order.out-for-delivery` e `order.delivered` gravados na mesma transação, com o payload;
    - serviços simulados como consumidores, com os nomes, os eventos assinados e as esperas, fator de espera e desligamento;
    - pedido que já chegou ao status termina sem alteração;
    - cadeia de causa e correlação do pedido;
  - nova capability `messaging/live-event-feed`: assinatura transitória e exclusiva por instância, ligada a todos os eventos, sem novas tentativas, descarte nem idempotência, perda aceita sem broker, e desligável;
  - em `orders/order-placement`:
    - alterar "Status inicial e pagamento simulado": o pedido nasce `PLACED`, e o pagamento é aprovado automaticamente pelo serviço simulado;
    - alterar "Consultar o próprio pedido": a resposta traz as datas dos passos;
    - adicionar "Acompanhar o pedido ao vivo" (`GET /me/orders/:id/stream`: dono conferido antes, `401`/`404` como JSON, avisos sem dados do pedido e sinal de vida);
  - em `orders/order-tracking`:
    - alterar "Cabeçalho do pedido" (badge pelo status e indicador "Ao vivo");
    - alterar "Passos do pedido" (concluído com horário, atual em andamento, pendente, entregue);
    - adicionar "Atualização ao vivo" (stream com cabeçalho de autorização, releitura a cada aviso, reconexão e fim do stream na entrega).

> Obs: IMPORTANTE!!! Executar as três partes (Negócio, Backend e Frontend) em subagentes separados, cada um com contexto limpo, de forma sequencial (o Backend depende do build de `@jaja/orders`; o Frontend depende da API e do stream rodando). Antes de começar, conferir que os prompts 14, 15 e 16 estão implementados (`EventConsumerRegistry` e `RabbitMqMessageConsumer` em `apps/backend/src/messaging/`); se não estiverem, parar e reportar.
>
> Cada subagente deve ler `.claude/skills/skills-standards.md` e, antes de criar seus arquivos, as referências de código da sua camada listadas no Contexto. O do backend deve também:
> - não matar backends que já estejam rodando: se a porta 4000 estiver ocupada, usar outra;
> - deixar o seed como estava;
> - apagar os pedidos de teste que criar.
>
> O do frontend deve ler também `apps/frontend/DESIGN.md`. Nenhum subagente altera `packages/shared`. Uma parte só começa depois de a anterior terminar com as validações passando, e cada subagente encerra listando os arquivos criados ou alterados e o resultado das validações.
