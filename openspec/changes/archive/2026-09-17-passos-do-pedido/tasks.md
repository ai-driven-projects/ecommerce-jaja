## 1. Domínio — erros e eventos (`@jaja/orders`)

- [x] 1.1 Em `src/order/errors.ts`, acrescentar a `OrderErrors` os códigos `ORDER_PAYMENT_DATA_INVALID`, `ORDER_PICKING_DATA_INVALID`, `ORDER_DISPATCH_DATA_INVALID` e `ORDER_DELIVERY_DATA_INVALID`, mais `ORDER_PAYMENT_METHODS` (`'SIMULATED' | 'CREDIT_CARD' | 'PIX'`) e `OrderPaymentMethod`, com o comentário de que só `SIMULATED` é usado hoje
- [x] 1.2 Criar `src/order/event/order-step.event.ts` com `ORDER_STATUS_EVENT_TYPES` (mesmos valores, movido de `order-status-changed.event.ts`), `OrderStatusEventType`, o tipo `OrderStepPayload` e a entrada comum `OrderStepEventInput`; importar `ORDER_AGGREGATE_TYPE` de `order-placed.event.ts`, sem copiá-lo
- [x] 1.3 Criar `src/order/event/order-payment-approved.event.ts` (`order.payment-approved`, payload com `transactionId`, `paymentMethod` e `amountCents`), no padrão de `OrderPlacedEvent` (construtor privado, `tryCreate` com `Result.try`, `create`)
- [x] 1.4 Criar `src/order/event/order-picking-started.event.ts` (`order.picking-started`, com `pickingListId` e `itemCount`)
- [x] 1.5 Criar `src/order/event/order-out-for-delivery.event.ts` (`order.out-for-delivery`, com `courierName`, `trackingCode` e `estimatedDeliveryAt` em ISO 8601)
- [x] 1.6 Criar `src/order/event/order-delivered.event.ts` (`order.delivered`, com `receivedBy`)
- [x] 1.7 Apagar `src/order/event/order-status-changed.event.ts` e atualizar `src/order/event/index.ts` (exports e o union `OrderEvent` com os cinco eventos)
- [x] 1.8 Criar um teste por evento em `test/order/` (`order-payment-approved.event.test.ts` e os outros três), no padrão de `order-placed.event.test.ts`: `type`, `aggregateType`, `aggregateId`, `occurredAt`, `metadata` vazio, payload completo, id único por criação, `orderId` inválido e data inválida; apagar `test/order/order-status-changed.event.test.ts`

## 2. Domínio — entidade (`@jaja/orders`)

- [x] 2.1 Em `src/order/model/order.entity.ts`, tornar `advanceTo` privado e remover dele a criação de evento (mantendo a checagem de transição, o clone com a data do passo e `updatedAt`)
- [x] 2.2 Criar `approvePayment({ transactionId, paymentMethod })`: valida `transactionId` (não vazio após `trim`, até 64) e o meio de pagamento, senão `ORDER_PAYMENT_DATA_INVALID`; avança e grava `OrderPaymentApprovedEvent` com `amountCents: this.totalCents`
- [x] 2.3 Criar `startPicking({ pickingListId })`: valida `pickingListId` (não vazio, até 64), senão `ORDER_PICKING_DATA_INVALID`; grava `OrderPickingStartedEvent` com `itemCount: this.itemCount`
- [x] 2.4 Criar `dispatch({ courierName, trackingCode, estimatedDeliveryAt })`: valida entregador (2 a 100), rastreio (não vazio, até 64) e previsão (data válida, não anterior à data do passo), senão `ORDER_DISPATCH_DATA_INVALID`; grava `OrderOutForDeliveryEvent`
- [x] 2.5 Criar `completeDelivery({ receivedBy })`: opcional — ausente, `null` ou vazio usa `recipientName`; informado, de 2 a 100, senão `ORDER_DELIVERY_DATA_INVALID`; grava `OrderDeliveredEvent` com `receivedBy` nunca vazio
- [x] 2.6 Atualizar o comentário da classe (ordem "valida os dados do passo → avança → grava o evento" e o fato de os dados do passo não virarem props do pedido); confirmar que `OrderProps` e `OrderDTO` não mudam
- [x] 2.7 Em `test/order/order.entity.test.ts`, trocar os testes de `advanceTo` pelos dos quatro métodos: evento e payload certos, data do passo preenchida, `this` intacto, pulo de passo, pedido entregue, dado inválido de cada passo, `receivedBy` ausente caindo no `recipientName` e previsão anterior à data do passo

## 3. Domínio — DTOs e casos de uso (`@jaja/orders`)

- [x] 3.1 Em `src/order/dto/order.dto.ts`, apagar `AdvanceOrderStatusInputDTO`, renomear `AdvanceOrderStatusOutputDTO` para `OrderStepOutputDTO` e criar `ApproveOrderPaymentInputDTO`, `StartOrderPickingInputDTO`, `DispatchOrderInputDTO` e `CompleteOrderDeliveryInputDTO`
- [x] 3.2 Criar `src/order/use-case/order-step.use-case.ts` com a classe abstrata `OrderStepUseCase<IN>` (membros abstratos `status` e `applyTo`) e o `execute` com a mecânica de `AdvanceOrderStatus`: `Id.required` → `findById` → `hasReached` devolvendo `changed: false` sem transação → `applyTo` → `update` + `append` em uma `runInTransaction` com `throwsIfFailed` e `catch` de `ResultError`
- [x] 3.3 Criar `approve-order-payment.use-case.ts`, `start-order-picking.use-case.ts`, `dispatch-order.use-case.ts` e `complete-order-delivery.use-case.ts`, cada um com o seu `status`, o seu `applyTo` e JSDoc próprio (o que a operação significa, quem a dispara, o evento que grava e as falhas)
- [x] 3.4 Apagar `src/order/use-case/advance-order-status.use-case.ts` e atualizar `use-case/index.ts` exportando **só** os quatro casos de uso (a base abstrata não entra na API pública)
- [x] 3.5 Criar um teste por caso de uso em `test/order/`, cobrindo: caminho feliz (pedido e evento na mesma transação), passo já concluído (`changed: false`, nada gravado, nenhuma transação aberta), passo fora de ordem (`ORDER_STATUS_TRANSITION_INVALID`), `orderId` ausente ou inválido, pedido inexistente (`ORDER_NOT_FOUND`), dado do passo inválido e falha ao gravar o evento desfazendo tudo; apagar `test/order/advance-order-status.use-case.test.ts`
- [x] 3.6 Rodar `npm test --workspace=@jaja/orders` e `npm run build --workspace=@jaja/orders` sem erros

## 4. Backend — serviços simulados (`@jaja/backend`)

- [x] 4.1 Criar `src/modules/orders/simulation/order-simulation.data.ts` com os geradores determinísticos (`simulatedTransactionId`, `simulatedPickingListId`, `simulatedTrackingCode`, `SIMULATED_COURIER_NAME`, `estimatedDeliveryAt`), cada um comentado como dado de um sistema externo
- [x] 4.2 Em `order-simulation.steps.ts`, remover o campo `status` de `OrderSimulationStep`, declarar o tipo das dependências (`OrderRepository`, `DomainEventRepository`, `TransactionManager`) e acrescentar `execute(deps, orderId)`, que monta os dados simulados e chama o caso de uso do passo; manter `consumerName`, `eventType` e `baseDelayMs` dos quatro itens e atualizar o comentário do arquivo
- [x] 4.3 Em `order-simulation.consumers.ts`, trocar a chamada de `AdvanceOrderStatus` por `step.execute(...)` com os adapters e o `transactionManager` do consumidor, e passar a logar o status devolvido pela operação; registro, espera e variáveis de ambiente não mudam
- [x] 4.4 Atualizar `test/modules/orders/simulation/order-simulation.consumers.spec.ts`: manter os casos de registro e ajustar os de processamento (status gravado, evento do tipo certo com os dados simulados no payload, `transactionManager` recebido, passo já concluído só com log `debug`, falha repassada)
- [x] 4.5 Atualizar `test/order-lifecycle.e2e-spec.ts` para conferir também o payload de cada evento de passo (transação, lista de separação, entregador e rastreio, quem recebeu), mantendo a sequência dos cinco `type`
- [x] 4.6 Rodar `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` sem erros

## 5. Conferência e fechamento

- [x] 5.1 Com Postgres e RabbitMQ no ar, subir o backend e fazer um pedido pelo frontend: o acompanhamento do cliente anda ao vivo até "Entregue" e o monitor administrativo mostra os cinco eventos na ordem, com causa e correlação
- [x] 5.2 Conferir em `domain_event` que o payload de cada evento de passo traz os dados do seu passo, e que dois pedidos diferentes produzem dados derivados dos seus próprios ids
- [x] 5.3 Confirmar que nenhum arquivo do frontend, de `packages/shared`, do seed, do schema Prisma ou de migrations foi alterado; se algum ajuste no frontend tiver sido necessário, parar e reportar (é sinal de quebra do contrato publicado)
- [x] 5.4 Rodar `openspec validate passos-do-pedido` e conferir que as specs da change refletem o que foi implementado
