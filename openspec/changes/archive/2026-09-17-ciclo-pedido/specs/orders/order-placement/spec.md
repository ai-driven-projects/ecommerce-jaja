## MODIFIED Requirements

### Requirement: Status inicial e pagamento simulado
Todo pedido criado SHALL começar com o status `PLACED` ("Pedido recebido") e com `placedAt` igual ao momento da confirmação. Os passos seguintes seguem `orders/order-lifecycle`.

O cliente MUST NOT informar forma de pagamento nem dados de pagamento. O pedido não guarda forma de pagamento. O pagamento é simulado e aprovado automaticamente pelo serviço simulado de pagamento depois da confirmação, sem nenhuma ação do cliente.

#### Scenario: Pedido nasce recebido
- **WHEN** um pedido é criado
- **THEN** ele tem `status: "PLACED"`, `placedAt` com a data e hora da confirmação, as datas dos demais passos vazias e nenhum campo de forma ou dados de pagamento

#### Scenario: Pagamento aprovado automaticamente
- **WHEN** um pedido é criado com a simulação ligada
- **THEN** alguns segundos depois ele está `PAYMENT_APPROVED`, com `paymentApprovedAt` preenchida, sem nenhuma requisição do cliente

### Requirement: Consultar o próprio pedido
`GET /me/orders/:id` SHALL devolver o detalhe de um pedido não excluído cujo cliente pertence ao usuário do token, com os itens na ordem gravada. O endpoint MUST exigir token válido e responder `401` sem token.

Pedido inexistente, excluído, de outro usuário ou com id malformado MUST responder `404` com `ORDER_NOT_FOUND`, sem revelar se o pedido existe.

O detalhe do pedido, devolvido por este endpoint e por `POST /me/orders`, MUST ter:
- `id`, `customerId` e `status`;
- `items`, cada um com `productId`, `name`, `unit`, `thumbUrl`, `unitPriceCents`, `quantity` e `lineTotalCents`;
- `deliveryAddress`, com `zipCode`, `street`, `number`, `complement`, `neighborhood`, `city` e `state`;
- `recipientName` e `deliveryInstructions`;
- `itemCount`, `subtotalCents`, `deliveryFeeCents` e `totalCents`;
- `placedAt`, `paymentApprovedAt`, `pickingStartedAt`, `outForDeliveryAt` e `deliveredAt` (as quatro últimas `null` enquanto o pedido não chegou ao passo).

#### Scenario: Próprio pedido
- **WHEN** a cliente chama `GET /me/orders/:id` com o id de um pedido dela
- **THEN** o sistema responde `200` com o detalhe do pedido

#### Scenario: Pedido em andamento
- **WHEN** a cliente chama `GET /me/orders/:id` de um pedido que está `PICKING`
- **THEN** a resposta tem `status: "PICKING"`, `placedAt`, `paymentApprovedAt` e `pickingStartedAt` preenchidas, e `outForDeliveryAt` e `deliveredAt` `null`

#### Scenario: Pedido de outro usuário
- **WHEN** outro usuário autenticado chama `GET /me/orders/:id` com o id do pedido da cliente
- **THEN** o sistema responde `404` com `ORDER_NOT_FOUND`

#### Scenario: Id malformado
- **WHEN** a cliente chama `GET /me/orders/nao-e-uuid`
- **THEN** o sistema responde `404` com `ORDER_NOT_FOUND`

#### Scenario: Consulta sem token
- **WHEN** um cliente sem token chama `GET /me/orders/:id`
- **THEN** o sistema responde `401`

## ADDED Requirements

### Requirement: Acompanhar o pedido ao vivo
`GET /me/orders/:id/stream` SHALL abrir um stream `text/event-stream` que avisa a dona do pedido sempre que um evento dele é publicado. O endpoint MUST exigir token válido no cabeçalho `Authorization`. O dono MUST ser conferido **antes** de abrir o stream: sem token, o sistema responde `401`, e pedido inexistente, excluído, de outro usuário ou com id malformado responde `404` com `ORDER_NOT_FOUND`, ambos como resposta JSON comum, sem abrir o stream.

Cada aviso MUST ser um evento SSE `order` com `data` JSON contendo só `orderId`, `eventType`, `messageId` e `occurredAt` (texto ISO 8601), sem nenhum dado do pedido ou do payload do evento. O stream MUST enviar um evento `ping` a cada 20 s enquanto estiver aberto. O stream é só aviso: o estado do pedido MUST ser lido por `GET /me/orders/:id`.

#### Scenario: Avisos durante o ciclo
- **WHEN** a cliente abre o stream de um pedido recém-confirmado e o pedido avança até `DELIVERED`
- **THEN** ela recebe avisos `order` com `eventType` `order.payment-approved`, `order.picking-started`, `order.out-for-delivery` e `order.delivered`, cada um sem dados do pedido

#### Scenario: Stream de pedido de outro usuário
- **WHEN** outro usuário autenticado abre `GET /me/orders/:id/stream` com o id do pedido da cliente
- **THEN** o sistema responde `404` em JSON com `ORDER_NOT_FOUND` e não abre o stream

#### Scenario: Stream sem token
- **WHEN** um cliente abre `GET /me/orders/:id/stream` sem o cabeçalho `Authorization`
- **THEN** o sistema responde `401` e não abre o stream

#### Scenario: Sinal de vida
- **WHEN** o stream fica aberto 20 s sem nenhum evento do pedido
- **THEN** a cliente recebe um evento `ping`
