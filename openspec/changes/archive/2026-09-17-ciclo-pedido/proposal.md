## Why

O pedido do Jaja nasce `PLACED`, publica `order.placed` no RabbitMQ e para aí: a infraestrutura de consumo (prompt 16) está pronta, mas nenhum consumidor de negócio reage, e o acompanhamento do cliente mostra só "Pedido recebido". O objetivo do projeto é demonstrar a arquitetura orientada a eventos no fluxo de pedido. Para isso, o pedido precisa andar sozinho até ser entregue, com eventos reais passando pelo broker e serviços simulados (pagamento, separação, entrega), e o cliente precisa ver cada passo **ao vivo**. Esta change também é pré-requisito do painel administrativo ao vivo (prompt 18, `monitor-pedidos`).

## What Changes

- **Ciclo do pedido (`@jaja/orders`):**
  - status em sequência `PLACED` → `PAYMENT_APPROVED` → `PICKING` → `OUT_FOR_DELIVERY` → `DELIVERED`, com a data de cada passo no pedido;
  - o agregado só avança para o **próximo** status (pular é `ORDER_STATUS_TRANSITION_INVALID`) e registra um evento por avanço: `order.payment-approved`, `order.picking-started`, `order.out-for-delivery` e `order.delivered`;
  - caso de uso `AdvanceOrderStatus`, que grava o pedido e o evento na mesma transação e termina com sucesso, sem gravar, quando o pedido já chegou ao status (mensagem repetida ou fora de ordem).
- **Serviços simulados (`@jaja/backend`):**
  - quatro consumidores registrados no `EventConsumerRegistry`, cada um reagindo ao evento do passo anterior (coreografia, sem orquestrador): `payment.approve-order` (3 s), `store.start-picking` (2 s), `delivery.dispatch-order` (6 s) e `delivery.complete-order` (8 s);
  - a espera fica no broker (fila `.wait`) e é multiplicada por `ORDER_SIMULATION_DELAY_FACTOR`; `ORDER_SIMULATION_ENABLED="false"` desliga a simulação;
  - os eventos do pedido herdam o `correlationId` do `order.placed`, e cada `causationId` aponta para o evento anterior (infraestrutura do prompt 16).
- **Notificações ao vivo (`@jaja/backend`):**
  - o adapter RabbitMQ ganha a **assinatura transitória**: fila exclusiva e temporária, sem espera, descarte nem idempotência, com `ack` sempre;
  - `LiveEventFeed` assina, por instância do backend, uma fila transitória com todos os eventos e os repassa em memória; `LIVE_EVENTS_ENABLED="false"` desliga;
  - novo endpoint `GET /me/orders/:id/stream` (SSE):
    - dono conferido antes de abrir (`401`/`404` em JSON);
    - avisos `{ orderId, eventType, messageId, occurredAt }` sem dados do pedido;
    - sinal de vida a cada 20 s;
  - `GET /me/orders/:id` (e a resposta de `POST /me/orders`) passa a trazer as datas dos passos.
- **Banco:** migration `orders_order_status_steps`, com quatro colunas de data e o índice `(status, placed_at)`.
- **Acompanhamento do cliente (`@jaja/frontend`):**
  - o stream é aberto com `fetch` e o cabeçalho `Authorization` (sem token na URL) e reconecta sozinho;
  - a página relê o pedido a cada aviso;
  - o badge segue o status atual, e há o indicador "Ao vivo";
  - passos concluídos mostram o horário, o passo atual aparece como "Em andamento…", e o pedido entregue tem mensagem própria;
  - o stream fecha na entrega.
- **Testes:**
  - unitários do domínio (evento, entidade, caso de uso);
  - unitários do backend (assinatura transitória, feed, atualizações ao vivo, serviços simulados);
  - e2e opcional (`MESSAGING_E2E=true`) do ciclo completo contra Postgres e RabbitMQ reais.
- Fora do escopo:
  - área administrativa de pedidos (prompt 18);
  - pagamento recusado, cancelamento, estorno e compensação;
  - loja no pedido, entregador, ETA, mapa e notificações;
  - "Meus pedidos";
  - orquestrador e processos separados por serviço;
  - alterações em `packages/shared`.

## Capabilities

### New Capabilities

- `orders/order-lifecycle`:
  - sequência de status e avanço de um passo por vez, com a data de cada passo;
  - eventos de mudança de status gravados na mesma transação;
  - serviços simulados como consumidores (nomes, eventos assinados, esperas, fator e desligamento);
  - pedido que já chegou ao status termina sem alteração;
  - cadeia de causa e correlação de um pedido.
- `messaging/live-event-feed`: cópia de todos os eventos publicados por instância do backend, para avisos ao vivo, sem garantia de entrega e desligável.

### Modified Capabilities

- `orders/order-placement`:
  - "Status inicial e pagamento simulado": o pagamento passa a ser aprovado automaticamente pelo serviço simulado;
  - "Consultar o próprio pedido": o detalhe traz as datas dos passos;
  - novo requisito "Acompanhar o pedido ao vivo" (`GET /me/orders/:id/stream`).
- `orders/order-tracking`:
  - "Cabeçalho do pedido": badge pelo status e indicador "Ao vivo";
  - "Passos do pedido": concluído com horário, atual em andamento, pendente e entregue;
  - novo requisito "Atualização ao vivo".
- `messaging/message-broker`:
  - novo requisito "Assinatura transitória";
  - "Serviço RabbitMQ no ambiente local" passa a documentar `LIVE_EVENTS_ENABLED`.

## Impact

- `modules/orders`:
  - `src/order/errors.ts` (novos status, `ORDER_STATUS_TRANSITION_INVALID`, `orderStatusIndex`);
  - novo `event/order-status-changed.event.ts`;
  - `model/order.entity.ts` (datas, `advanceTo`, `hasReached`);
  - `dto/order.dto.ts`;
  - novo `use-case/advance-order-status.use-case.ts`;
  - mocks e testes em `test/order/**`.
- `apps/backend`:
  - banco: `prisma/models/orders.model.prisma` e a migration `orders_order_status_steps` (aditiva, colunas anuláveis);
  - pedidos: `src/modules/orders/order.prisma.ts`, `my-order.controller.ts`, `orders.module.ts`, `test/order.integration.http`, e os novos `order-live-updates.ts` e `simulation/*`;
  - mensageria: `src/messaging/rabbitmq/rabbitmq-message.consumer.ts`, `messaging.module.ts`, `index.ts` e o novo `live/live-event-feed.ts`;
  - testes `*.spec.ts` e `test/order-lifecycle.e2e-spec.ts`; `.env.example`.
- `apps/frontend`:
  - novos `src/shared/util/event-stream.util.ts` e `modules/orders/data/order-status.util.ts`;
  - alterados `modules/orders/data/order.api.ts`, `use-my-order.hook.ts`, `data/index.ts`, `modules/orders/components/order-tracking.component.tsx` e `modules/orders/index.ts`;
  - `src/shared/i18n/messages.pt.ts` e `messages.en.ts`;
  - `DESIGN.md`.
- RabbitMQ local:
  - quatro filas de consumidor com `.wait` e `.dead`;
  - uma fila `jaja.live.*` exclusiva por instância do backend.
- Comportamento visível: todo pedido novo chega a `DELIVERED` em cerca de 20 s com `ORDER_SIMULATION_DELAY_FACTOR=1`. Pedidos já existentes em `PLACED` avançam quando seus `order.placed` forem processados; os que já foram publicados antes dos consumidores existirem ficam em `PLACED`, porque as filas não existiam.
- Sem mudanças em `packages/shared`, nas rotas administrativas ou no checkout.
