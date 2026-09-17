## Purpose

Define como o pedido do Jaja anda sozinho da confirmação até a entrega. Cobre a sequência de status, o avanço de um passo por vez com a data de cada passo, os eventos de mudança de status, os serviços simulados de pagamento, separação e entrega (consumidores de eventos com espera) e a cadeia de causa e correlação que liga os eventos de um pedido.

## ADDED Requirements

### Requirement: Sequência de status do pedido
O pedido SHALL ter um destes status, nesta ordem: `PLACED` ("Pedido recebido"), `PAYMENT_APPROVED` ("Pagamento aprovado"), `PICKING` ("Separando na loja"), `OUT_FOR_DELIVERY` ("A caminho") e `DELIVERED` ("Entregue"). O pedido MUST avançar só para o **status seguinte** da sequência. Avançar para o próprio status, para um anterior, pular um passo ou avançar depois de `DELIVERED` MUST falhar com `ORDER_STATUS_TRANSITION_INVALID`, sem alterar o pedido e sem gerar evento.

#### Scenario: Avanço para o próximo status
- **WHEN** um pedido `PLACED` avança para `PAYMENT_APPROVED`
- **THEN** o pedido passa a `PAYMENT_APPROVED`

#### Scenario: Pulo de passo
- **WHEN** um pedido `PLACED` tenta avançar direto para `PICKING`
- **THEN** a operação falha com `ORDER_STATUS_TRANSITION_INVALID` e o pedido continua `PLACED`

#### Scenario: Pedido já entregue
- **WHEN** um pedido `DELIVERED` tenta avançar para qualquer status
- **THEN** a operação falha com `ORDER_STATUS_TRANSITION_INVALID`

### Requirement: Data de cada passo
O pedido SHALL guardar a data e hora em que chegou a cada passo: `placedAt` (`PLACED`), `paymentApprovedAt` (`PAYMENT_APPROVED`), `pickingStartedAt` (`PICKING`), `outForDeliveryAt` (`OUT_FOR_DELIVERY`) e `deliveredAt` (`DELIVERED`). A data de um passo MUST ser preenchida quando o pedido chega a ele e MUST ficar vazia enquanto o pedido não chegou. Um pedido gravado com status e datas inconsistentes MUST ser recusado com `ORDER_STATUS_INVALID`.

#### Scenario: Datas até o status atual
- **WHEN** um pedido chega a `PICKING`
- **THEN** `placedAt`, `paymentApprovedAt` e `pickingStartedAt` estão preenchidas, em ordem crescente, e `outForDeliveryAt` e `deliveredAt` estão vazias

#### Scenario: Status e datas inconsistentes
- **WHEN** um pedido `PLACED` é lido com `paymentApprovedAt` preenchida
- **THEN** a leitura falha com `ORDER_STATUS_INVALID`

### Requirement: Evento a cada mudança de status
Cada avanço de status SHALL gravar um evento **na mesma transação** em que o pedido é atualizado: se a transação for desfeita, nem o novo status nem o evento ficam gravados. O evento MUST ter:
- `type` conforme o status alcançado: `order.payment-approved`, `order.picking-started`, `order.out-for-delivery` ou `order.delivered`;
- `aggregateType` `Order` e `aggregateId` igual ao id do pedido;
- `occurredAt` igual à data do passo;
- `payload` com `customerId`, `previousStatus`, `status` e `changedAt` (texto ISO 8601).

Os eventos MUST ser publicados pelo outbox, com routing key igual ao `type`. Ler um pedido gravado MUST NOT gerar eventos.

#### Scenario: Pagamento aprovado
- **WHEN** um pedido `PLACED` avança para `PAYMENT_APPROVED`
- **THEN** o outbox recebe, na mesma transação, um evento `order.payment-approved` do pedido com `previousStatus: "PLACED"`, `status: "PAYMENT_APPROVED"` e `changedAt` igual a `paymentApprovedAt`

#### Scenario: Falha ao gravar o evento
- **WHEN** o evento de um avanço não pode ser gravado
- **THEN** o avanço falha e o pedido continua no status anterior

### Requirement: Avanço idempotente
Pedir que um pedido avance para um status que ele **já alcançou ou ultrapassou** MUST terminar com sucesso, sem gravar nada e sem gerar evento, informando que nada mudou. Pedido inexistente MUST falhar com `ORDER_NOT_FOUND`. Status de destino `PLACED` ou fora da sequência MUST falhar com `ORDER_STATUS_INVALID`.

#### Scenario: Mensagem repetida
- **WHEN** o pedido já está `PAYMENT_APPROVED` e chega de novo o pedido de avançar para `PAYMENT_APPROVED`
- **THEN** a operação termina com sucesso, sem alterar o pedido e sem novo evento

#### Scenario: Mensagem atrasada
- **WHEN** o pedido já está `OUT_FOR_DELIVERY` e chega o pedido de avançar para `PICKING`
- **THEN** a operação termina com sucesso, sem alterar o pedido

#### Scenario: Pedido inexistente
- **WHEN** chega o pedido de avançar um pedido que não existe
- **THEN** a operação falha com `ORDER_NOT_FOUND`

### Requirement: Serviços simulados do pedido
O backend SHALL simular os serviços de pagamento, separação e entrega como consumidores de eventos, cada um reagindo ao evento do passo anterior (coreografia, sem orquestrador) e avançando o pedido um passo:

| Consumidor | Evento assinado | Avança para | Espera base |
| --- | --- | --- | --- |
| `payment.approve-order` | `order.placed` | `PAYMENT_APPROVED` | 3 000 ms |
| `store.start-picking` | `order.payment-approved` | `PICKING` | 2 000 ms |
| `delivery.dispatch-order` | `order.picking-started` | `OUT_FOR_DELIVERY` | 6 000 ms |
| `delivery.complete-order` | `order.out-for-delivery` | `DELIVERED` | 8 000 ms |

A espera de cada consumidor MUST ser a espera base multiplicada por `ORDER_SIMULATION_DELAY_FACTOR`, arredondada e limitada a 300 000 ms. O fator vale de 0 a 10, com padrão 1, e valores inválidos voltam a 1. A espera MUST acontecer antes de o consumidor processar a mensagem, sem manter transação aberta. Com `ORDER_SIMULATION_ENABLED="false"`, nenhum dos consumidores MUST ser registrado, e os pedidos ficam em `PLACED`. O `apps/backend/.env.example` SHALL documentar as duas variáveis. Nenhum serviço simulado MUST pedir dados ao cliente ou a sistemas externos.

#### Scenario: Pedido entregue sozinho
- **WHEN** um cliente confirma um pedido com a simulação ligada e `ORDER_SIMULATION_DELAY_FACTOR=1`
- **THEN** sem nenhuma outra ação, o pedido passa por `PAYMENT_APPROVED`, `PICKING` e `OUT_FOR_DELIVERY` e chega a `DELIVERED` em cerca de 20 s (mais o tempo de publicação), com a data de cada passo

#### Scenario: Fator de espera
- **WHEN** o backend inicia com `ORDER_SIMULATION_DELAY_FACTOR=0.5`
- **THEN** as esperas dos consumidores são 1 500, 1 000, 3 000 e 4 000 ms

#### Scenario: Simulação desligada
- **WHEN** o backend inicia com `ORDER_SIMULATION_ENABLED="false"` e um pedido é confirmado
- **THEN** nenhum consumidor da simulação é assinado e o pedido continua `PLACED`

#### Scenario: Mensagem sem pedido
- **WHEN** um consumidor da simulação recebe uma mensagem sem `aggregateId` no payload
- **THEN** o processamento falha com `ORDER_NOT_FOUND` e segue as novas tentativas e o descarte do consumo de eventos

### Requirement: Cadeia de causa e correlação do pedido
Os eventos de um mesmo pedido SHALL formar uma cadeia rastreável: os eventos de mudança de status MUST ter no `metadata` o `correlationId` igual ao `id` do `order.placed` do pedido, e o `causationId` igual ao `id` do evento que causou o avanço (o evento imediatamente anterior da sequência).

#### Scenario: Cadeia completa
- **WHEN** um pedido chega a `DELIVERED` pela simulação
- **THEN** o outbox tem, na ordem, `order.placed`, `order.payment-approved`, `order.picking-started`, `order.out-for-delivery` e `order.delivered`; os quatro últimos têm `correlationId` igual ao id do `order.placed`, e cada um tem `causationId` igual ao id do evento anterior
