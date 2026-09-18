## Why

O ciclo do pedido (prompt 17) foi entregue com um desenho genérico: **uma** classe de evento (`OrderStatusChangedEvent`, com o `type` derivado do status e payload igual nos quatro passos) e **um** caso de uso (`AdvanceOrderStatus`, entrada `{ orderId, status }`) para pagamento, separação, despacho e entrega. Isso tem três consequências que já incomodam:

- **a sequência do negócio vive na camada de adapter**: quem decide que `order.placed` leva o pedido a `PAYMENT_APPROVED` é a tabela `ORDER_SIMULATION_STEPS`, em `apps/backend`. O consumidor não informa um fato ("o pagamento foi aprovado"), ele manda o pedido para um status;
- **o contrato de entrada não tem onde receber o dado de cada passo**: id da transação e meio de pagamento, lista de separação, entregador, código de rastreio e previsão, quem recebeu. O primeiro passo que ganhar dado próprio força um saco genérico ou o split assim mesmo;
- **o vocabulário do negócio está no lugar errado**: `payment.approve-order`, `store.start-picking`, `delivery.dispatch-order` e `delivery.complete-order` são nomes de negócio que só existem no backend; o domínio tem `AdvanceOrderStatus`, nome de máquina de estado.

Fazer a separação agora custa pouco e evita pagar caro depois: **os `type` publicados não mudam**, então não há migration, nem quebra do outbox, do consumo de eventos, do SSE do cliente, do monitor administrativo ou do frontend.

## What Changes

- **Eventos de negócio (`@jaja/orders`):** `OrderStatusChangedEvent` é substituída por quatro classes, uma por fato — `OrderPaymentApprovedEvent`, `OrderPickingStartedEvent`, `OrderOutForDeliveryEvent` e `OrderDeliveredEvent` —, com base comum (`customerId`, `previousStatus`, `status`, `changedAt`) mais os campos do passo:
  - `order.payment-approved`: `transactionId`, `paymentMethod`, `amountCents`;
  - `order.picking-started`: `pickingListId`, `itemCount`;
  - `order.out-for-delivery`: `courierName`, `trackingCode`, `estimatedDeliveryAt`;
  - `order.delivered`: `receivedBy`.

  Os `type`, o `aggregateType`, o `aggregateId`, o `occurredAt` e a publicação pelo outbox **não mudam**.
- **Operações de negócio no lugar de "avançar status" (`@jaja/orders`):** `AdvanceOrderStatus` é substituído por `ApproveOrderPayment`, `StartOrderPicking`, `DispatchOrder` e `CompleteOrderDelivery`, cada um com entrada própria. A mecânica comum (validar o id, ler o pedido, terminar sem gravar quando o passo já foi concluído, gravar pedido e evento na mesma transação) fica em uma base abstrata interna, não em quatro cópias.
- **Entidade (`@jaja/orders`):** `Order.advanceTo` passa a ser privado e deixa de criar evento; entram `approvePayment`, `startPicking`, `dispatch` e `completeDelivery`, que validam os dados do passo e gravam o evento do seu fato. A regra da sequência continua em um lugar só.
- **Dado do passo inválido** falha com código próprio (`ORDER_PAYMENT_DATA_INVALID`, `ORDER_PICKING_DATA_INVALID`, `ORDER_DISPATCH_DATA_INVALID`, `ORDER_DELIVERY_DATA_INVALID`), sem gravar nada e sem evento. O status **deixa de ser entrada** de operação, então `ORDER_STATUS_INVALID` por status de destino inválido desaparece. **BREAKING** para quem consome a API do pacote (só os consumidores simulados do backend).
- **Serviços simulados (`@jaja/backend`):** `ORDER_SIMULATION_STEPS` perde a coluna `status` e passa a apontar para a operação de cada serviço; os dados simulados (id de transação, lista de separação, entregador, rastreio e previsão) nascem em `order-simulation.data.ts`, **determinísticos a partir do id do pedido**. Nomes dos consumidores, eventos assinados, esperas, `ORDER_SIMULATION_DELAY_FACTOR` e `ORDER_SIMULATION_ENABLED` não mudam.
- **Testes:** um arquivo por evento e um por caso de uso em `@jaja/orders`; ajuste dos testes da entidade, do spec dos consumidores simulados e do e2e do ciclo (que passa a conferir o payload de cada passo).
- Fora do escopo:
  - novos status e desfechos alternativos (pagamento recusado, cancelamento, estorno, item em falta, entrega frustrada, compensação);
  - guardar o dado do passo em colunas do pedido, exibi-lo no acompanhamento ou no monitor, e qualquer migration;
  - dar eventos próprios aos serviços simulados (`payment.approved`, `delivery.dispatched`, …) com o pedido reagindo a eles — a simplificação didática do prompt 17 continua valendo;
  - qualquer alteração no frontend, em `packages/shared`, no seed, no schema Prisma e no agregado `cart`;
  - endpoint administrativo para avançar um pedido à mão.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `orders/order-lifecycle`:
  - "Evento a cada mudança de status" passa a descrever **um evento de negócio por passo**, com o payload próprio de cada um;
  - "Avanço idempotente" passa a descrever as **quatro operações** (passo já concluído, pedido inexistente, passo fora de ordem e dado do passo inválido), sem o status como entrada;
  - "Serviços simulados do pedido" troca "Avança para" pela operação de cada serviço e pelos dados simulados determinísticos.

  "Sequência de status do pedido", "Data de cada passo" e "Cadeia de causa e correlação do pedido" não mudam.

As capabilities `orders/order-placement`, `orders/order-tracking`, `orders/order-monitor` e as de `messaging/*` **não** mudam: os `type` publicados, o outbox, o consumo de eventos e os avisos ao vivo continuam iguais.

## Impact

- **Código (`modules/orders/src/order/`):** `event/` (remove `order-status-changed.event.ts`, cria `order-step.event.ts` e quatro eventos), `model/order.entity.ts`, `use-case/` (remove `advance-order-status.use-case.ts`, cria a base abstrata e quatro casos de uso), `dto/order.dto.ts` e `errors.ts`.
- **Código (`apps/backend/src/modules/orders/simulation/`):** `order-simulation.steps.ts`, `order-simulation.consumers.ts` e o novo `order-simulation.data.ts`.
- **Testes:** `modules/orders/test/order/**`, `apps/backend/test/modules/orders/simulation/order-simulation.consumers.spec.ts` e `apps/backend/test/order-lifecycle.e2e-spec.ts`.
- **Contrato publicado:** inalterado nos `type` e na rotulagem; o **payload** dos quatro eventos de passo ganha campos (acréscimo, sem remoção dos existentes). Eventos já gravados continuam legíveis: ninguém lê esses campos hoje.
- **Banco:** nenhuma migration; o dado do passo vive no payload em `domain_event`.
- **Frontend:** nenhuma alteração esperada. Se alguma for necessária, é sinal de que o contrato publicado mudou sem querer.
- **Dependências:** nenhuma nova. `packages/shared` não muda.
