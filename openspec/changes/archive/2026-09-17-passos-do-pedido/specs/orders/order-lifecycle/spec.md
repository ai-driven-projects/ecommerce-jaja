## ADDED Requirements

### Requirement: Evento de negócio de cada passo
Cada passo concluído SHALL gravar um evento do seu fato **na mesma transação** em que o pedido é atualizado: se a transação for desfeita, nem o novo status nem o evento ficam gravados. O evento MUST ter:
- `type` conforme o passo: `order.payment-approved`, `order.picking-started`, `order.out-for-delivery` ou `order.delivered`;
- `aggregateType` `Order` e `aggregateId` igual ao id do pedido;
- `occurredAt` igual à data do passo;
- `payload` com a base `customerId`, `previousStatus`, `status` e `changedAt` (texto ISO 8601), mais os dados do passo:

| Evento | Dados do passo |
| --- | --- |
| `order.payment-approved` | `transactionId` (texto não vazio, até 64 caracteres), `paymentMethod` e `amountCents` (o total do pedido, em centavos) |
| `order.picking-started` | `pickingListId` (texto não vazio, até 64 caracteres) e `itemCount` (soma das quantidades dos itens do pedido) |
| `order.out-for-delivery` | `courierName`, `trackingCode` e `estimatedDeliveryAt` (texto ISO 8601, nunca anterior a `changedAt`) |
| `order.delivered` | `receivedBy`, nunca vazio: sem essa informação, o nome do destinatário do pedido |

`amountCents` e `itemCount` MUST ser lidos do próprio pedido, e não recebidos de quem dispara a operação. Os eventos MUST ser publicados pelo outbox, com routing key igual ao `type`. Ler um pedido gravado MUST NOT gerar eventos.

#### Scenario: Pagamento aprovado
- **WHEN** o pagamento de um pedido `PLACED` de R$ 90,00 é aprovado com a transação `TX-A1B2C3D4`
- **THEN** o outbox recebe, na mesma transação, um evento `order.payment-approved` do pedido com `previousStatus: "PLACED"`, `status: "PAYMENT_APPROVED"`, `changedAt` igual a `paymentApprovedAt`, `transactionId: "TX-A1B2C3D4"`, o meio de pagamento e `amountCents: 9000`

#### Scenario: Separação iniciada
- **WHEN** a separação de um pedido `PAYMENT_APPROVED` com 2 itens de quantidade 3 e 1 é iniciada
- **THEN** o outbox recebe um evento `order.picking-started` com a lista de separação informada e `itemCount: 4`

#### Scenario: Entrega concluída sem quem recebeu
- **WHEN** a entrega de um pedido `OUT_FOR_DELIVERY` é concluída sem informar quem recebeu
- **THEN** o outbox recebe um evento `order.delivered` com `receivedBy` igual ao nome do destinatário do pedido

#### Scenario: Falha ao gravar o evento
- **WHEN** o evento de um passo não pode ser gravado
- **THEN** o passo falha e o pedido continua no status anterior

### Requirement: Operações de cada passo do pedido
O sistema SHALL oferecer **uma operação por passo** do ciclo: aprovar o pagamento (leva a `PAYMENT_APPROVED`), iniciar a separação (`PICKING`), despachar o pedido (`OUT_FOR_DELIVERY`) e concluir a entrega (`DELIVERED`). Cada operação recebe o pedido e os dados do seu passo; o status de destino MUST NOT ser entrada de nenhuma delas. Toda operação MUST gravar o pedido e o evento do passo na mesma transação.

- Pedido que **já concluiu** o passo (ou um posterior) MUST terminar com sucesso, sem gravar nada e sem gerar evento, informando que nada mudou.
- Pedido inexistente MUST falhar com `ORDER_NOT_FOUND`.
- Pedido em um passo fora de ordem (o passo anterior ainda não foi concluído) MUST falhar com `ORDER_STATUS_TRANSITION_INVALID`, sem alterar o pedido e sem gerar evento.
- Dado do passo inválido MUST falhar com o código do passo, sem alterar o pedido e sem gerar evento:
  - pagamento: `transactionId` vazio ou com mais de 64 caracteres, ou meio de pagamento desconhecido → `ORDER_PAYMENT_DATA_INVALID`;
  - separação: `pickingListId` vazio ou com mais de 64 caracteres → `ORDER_PICKING_DATA_INVALID`;
  - despacho: entregador fora de 2 a 100 caracteres, `trackingCode` vazio ou com mais de 64 caracteres, ou previsão de entrega inválida ou anterior à data do passo → `ORDER_DISPATCH_DATA_INVALID`;
  - entrega: quem recebeu, quando informado, fora de 2 a 100 caracteres → `ORDER_DELIVERY_DATA_INVALID`.

#### Scenario: Passo concluído
- **WHEN** a separação de um pedido `PAYMENT_APPROVED` é iniciada com dados válidos
- **THEN** o pedido passa a `PICKING`, com `pickingStartedAt` preenchida, e o evento do passo é gravado na mesma transação

#### Scenario: Mensagem repetida
- **WHEN** o pedido já está `PAYMENT_APPROVED` e chega de novo a aprovação do pagamento
- **THEN** a operação termina com sucesso, sem alterar o pedido e sem novo evento

#### Scenario: Mensagem atrasada
- **WHEN** o pedido já está `OUT_FOR_DELIVERY` e chega o início da separação
- **THEN** a operação termina com sucesso, sem alterar o pedido e sem novo evento

#### Scenario: Passo fora de ordem
- **WHEN** a entrega de um pedido `PICKING` é concluída
- **THEN** a operação falha com `ORDER_STATUS_TRANSITION_INVALID` e o pedido continua `PICKING`

#### Scenario: Pedido inexistente
- **WHEN** chega a aprovação de pagamento de um pedido que não existe
- **THEN** a operação falha com `ORDER_NOT_FOUND`

#### Scenario: Dado do passo inválido
- **WHEN** o despacho de um pedido `PICKING` chega com o código de rastreio vazio
- **THEN** a operação falha com `ORDER_DISPATCH_DATA_INVALID`, o pedido continua `PICKING` e nenhum evento é gravado

## MODIFIED Requirements

### Requirement: Serviços simulados do pedido
O backend SHALL simular os serviços de pagamento, separação e entrega como consumidores de eventos, cada um reagindo ao evento do passo anterior (coreografia, sem orquestrador) e concluindo **um** passo do pedido pela operação correspondente:

| Consumidor | Evento assinado | Operação | Dados simulados | Espera base |
| --- | --- | --- | --- | --- |
| `payment.approve-order` | `order.placed` | aprovar o pagamento | id da transação e meio de pagamento | 3 000 ms |
| `store.start-picking` | `order.payment-approved` | iniciar a separação | id da lista de separação | 2 000 ms |
| `delivery.dispatch-order` | `order.picking-started` | despachar o pedido | entregador, código de rastreio e previsão de entrega | 6 000 ms |
| `delivery.complete-order` | `order.out-for-delivery` | concluir a entrega | quem recebeu (o destinatário do pedido) | 8 000 ms |

Nenhum consumidor MUST escolher o status que o pedido alcança: ele informa o fato do seu serviço, e o status é consequência da operação. Os dados simulados MUST ser derivados do id do pedido de forma **determinística** (sem valor aleatório), para o mesmo pedido produzir sempre os mesmos dados.

A espera de cada consumidor MUST ser a espera base multiplicada por `ORDER_SIMULATION_DELAY_FACTOR`, arredondada e limitada a 300 000 ms. O fator vale de 0 a 10, com padrão 1, e valores inválidos voltam a 1. A espera MUST acontecer antes de o consumidor processar a mensagem, sem manter transação aberta. Com `ORDER_SIMULATION_ENABLED="false"`, nenhum dos consumidores MUST ser registrado, e os pedidos ficam em `PLACED`. O `apps/backend/.env.example` SHALL documentar as duas variáveis. Nenhum serviço simulado MUST pedir dados ao cliente ou a sistemas externos.

#### Scenario: Pedido entregue sozinho
- **WHEN** um cliente confirma um pedido com a simulação ligada e `ORDER_SIMULATION_DELAY_FACTOR=1`
- **THEN** sem nenhuma outra ação, o pedido passa por `PAYMENT_APPROVED`, `PICKING` e `OUT_FOR_DELIVERY` e chega a `DELIVERED` em cerca de 20 s (mais o tempo de publicação), com a data de cada passo

#### Scenario: Dados simulados do pedido
- **WHEN** a simulação leva um pedido até `DELIVERED`
- **THEN** cada evento de passo traz os dados simulados do seu serviço, derivados do id do pedido, e dois ciclos do mesmo pedido produziriam os mesmos valores

#### Scenario: Fator de espera
- **WHEN** o backend inicia com `ORDER_SIMULATION_DELAY_FACTOR=0.5`
- **THEN** as esperas dos consumidores são 1 500, 1 000, 3 000 e 4 000 ms

#### Scenario: Simulação desligada
- **WHEN** o backend inicia com `ORDER_SIMULATION_ENABLED="false"` e um pedido é confirmado
- **THEN** nenhum consumidor da simulação é assinado e o pedido continua `PLACED`

#### Scenario: Mensagem sem pedido
- **WHEN** um consumidor da simulação recebe uma mensagem sem `aggregateId` no payload
- **THEN** o processamento falha com `ORDER_NOT_FOUND` e segue as novas tentativas e o descarte do consumo de eventos

## REMOVED Requirements

### Requirement: Evento a cada mudança de status
**Reason**: Cada passo do pedido é um fato de negócio diferente (pagamento, separação, despacho, entrega) e precisa carregar os seus próprios dados, o que um evento único de "mudança de status" com payload comum não comporta.
**Migration**: Substituído por "Evento de negócio de cada passo". Os `type` publicados, o `aggregateType`, o `aggregateId`, o `occurredAt` e a publicação pelo outbox continuam iguais; o payload de cada evento **ganha** os campos do seu passo, mantendo `customerId`, `previousStatus`, `status` e `changedAt`. Eventos já gravados continuam válidos: nenhum consumidor lê esses campos.

### Requirement: Avanço idempotente
**Reason**: O status de destino deixa de ser entrada: quem dispara um passo informa o fato do seu serviço, e o status é consequência da operação. Com isso, "avançar para um status" deixa de existir como operação, e com ela a falha por status de destino inválido.
**Migration**: Substituído por "Operações de cada passo do pedido", que mantém o passo já concluído terminando com sucesso sem gravar nada, `ORDER_NOT_FOUND` para pedido inexistente e `ORDER_STATUS_TRANSITION_INVALID` para passo fora de ordem. A falha `ORDER_STATUS_INVALID` por status de destino `PLACED` ou fora da sequência deixa de existir; no lugar dela entram os códigos de dado do passo inválido (`ORDER_PAYMENT_DATA_INVALID`, `ORDER_PICKING_DATA_INVALID`, `ORDER_DISPATCH_DATA_INVALID` e `ORDER_DELIVERY_DATA_INVALID`). `ORDER_STATUS_INVALID` continua em uso para pedido gravado com status e datas inconsistentes.
