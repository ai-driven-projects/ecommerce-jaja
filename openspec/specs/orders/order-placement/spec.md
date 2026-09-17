# Fechamento do Pedido (Order Placement) Specification

## Purpose

Define como o cliente faz um pedido a partir do carrinho da conta na API do Jaja: quem pode pedir, o que é copiado e congelado no pedido, os totais, a gravação atômica com o carrinho esvaziado e o evento `order.placed`, o pagamento simulado e a consulta e o acompanhamento ao vivo do próprio pedido.

## Requirements

### Requirement: Confirmar pedido pela API
`POST /me/orders` SHALL criar um pedido para o usuário do token a partir do carrinho da conta dele. O endpoint MUST exigir token válido de qualquer usuário, administrador ou não, e responder `401` sem token. Usuário, cliente e itens MUST vir sempre do token e do servidor.

Do corpo, só são lidos `recipientName` e `deliveryInstructions`, e apenas quando são texto. Os demais campos (`customerId`, `items`, preços, totais, `status`, forma ou dados de pagamento) MUST ser ignorados.

Em caso de sucesso, o sistema MUST responder `201` com o detalhe do pedido criado.

#### Scenario: Pedido confirmado
- **WHEN** a cliente do seed `ana.pereira.carvalho@jaja.dev`, com cadastro ativo e dois produtos disponíveis no carrinho, chama `POST /me/orders` com `recipientName` e `deliveryInstructions`
- **THEN** o sistema responde `201` com o id do pedido, `status: "PLACED"`, os dois itens com os preços do carrinho, os totais, o endereço do cadastro dela, quem recebe e as instruções enviadas

#### Scenario: Campos extras do corpo são ignorados
- **WHEN** o cliente envia em `POST /me/orders`, além de `recipientName`, os campos `customerId` de outro cliente, `totalCents: 1`, `status: "DELIVERED"` e `paymentMethod: "pix"`
- **THEN** o pedido é criado para o cliente do token, com os totais calculados pelo servidor e `status: "PLACED"`, e a resposta não tem forma de pagamento

#### Scenario: Sem token
- **WHEN** um cliente sem token chama `POST /me/orders`
- **THEN** o sistema responde `401` e nenhum pedido é criado

### Requirement: Cadastro de cliente obrigatório e ativo
O pedido SHALL pertencer ao cadastro de cliente do usuário, e não ao usuário. Sem cadastro de cliente, ou com o cadastro excluído, `POST /me/orders` MUST responder `400` com `ORDER_CUSTOMER_REQUIRED`. Com cadastro inativo, MUST responder `400` com `ORDER_CUSTOMER_INACTIVE`.

O cadastro de cliente MUST ser verificado antes do carrinho. Nesses casos nenhum pedido nem evento é gravado, e o carrinho MUST continuar como estava.

#### Scenario: Usuário sem cadastro de cliente
- **WHEN** um usuário recém-registrado, sem cadastro de cliente e com um produto no carrinho, chama `POST /me/orders`
- **THEN** o sistema responde `400` com `ORDER_CUSTOMER_REQUIRED`, e `GET /me/cart` continua com o produto

#### Scenario: Cliente inativo
- **WHEN** um administrador desativa o cadastro de cliente de `ana.pereira.carvalho@jaja.dev` e ela chama `POST /me/orders` com itens no carrinho
- **THEN** o sistema responde `400` com `ORDER_CUSTOMER_INACTIVE`, e nenhum pedido nem evento é gravado

### Requirement: Carrinho com itens e sem indisponíveis
O pedido SHALL ser montado a partir do carrinho da conta lido no momento da confirmação, com os preços atuais do catálogo. As falhas possíveis são:
- carrinho vazio ou inexistente: `400` com `ORDER_CART_EMPTY`;
- algum item indisponível na loja: `400` com `ORDER_CART_HAS_UNAVAILABLE_ITEMS`.

Nesses casos nada é gravado, e o carrinho continua como estava.

#### Scenario: Carrinho vazio
- **WHEN** a cliente do seed esvazia o carrinho com `DELETE /me/cart` e chama `POST /me/orders`
- **THEN** o sistema responde `400` com `ORDER_CART_EMPTY`

#### Scenario: Item indisponível
- **WHEN** um produto do carrinho da cliente é desativado pelo administrador e ela chama `POST /me/orders`
- **THEN** o sistema responde `400` com `ORDER_CART_HAS_UNAVAILABLE_ITEMS`, e o carrinho continua com o produto, marcado como indisponível

#### Scenario: Segundo envio da mesma confirmação
- **WHEN** um pedido acabou de ser criado e o mesmo cliente chama `POST /me/orders` de novo, sem incluir produtos
- **THEN** o sistema responde `400` com `ORDER_CART_EMPTY`, e nenhum segundo pedido é criado

### Requirement: Itens copiados com preço congelado
Cada linha do carrinho SHALL virar um item do pedido, na mesma ordem. O item copia:
- o produto (`productId`), o nome, a unidade e a miniatura da imagem principal (ou `null`);
- o preço unitário atual e a quantidade;
- o total da linha, com `lineTotalCents = unitPriceCents × quantity`.

Os itens do pedido MUST NOT mudar quando o produto for alterado, desativado ou excluído depois.

Um pedido MUST ter:
- de 1 a 50 itens, sem produto repetido;
- em cada item, quantidade inteira de 1 a 99 e preço unitário inteiro de pelo menos 1 centavo.

Se um produto do carrinho deixar de existir no banco entre a leitura do carrinho e a gravação, o sistema MUST responder `400` com `ORDER_PRODUCT_NOT_FOUND`, e nada é gravado.

#### Scenario: Preço congelado
- **WHEN** depois de um pedido criado o administrador altera o preço de um dos produtos do pedido e a cliente chama `GET /me/orders/:id`
- **THEN** o item mantém o `unitPriceCents` e o `lineTotalCents` da confirmação, e os totais do pedido não mudam

#### Scenario: Dados e ordem dos itens
- **WHEN** o carrinho tem o produto A (2 unidades) incluído antes do produto B (1 unidade) e o pedido é confirmado
- **THEN** os itens do pedido são A e depois B, cada um com nome, unidade, miniatura, preço unitário e quantidade iguais aos da linha do carrinho na confirmação

### Requirement: Endereço de entrega e quem recebe
O pedido SHALL guardar uma cópia do endereço de entrega do cadastro de cliente no momento da confirmação: CEP, logradouro, número, complemento (ou `null`), bairro, cidade e UF. Essa cópia MUST NOT mudar quando o cliente alterar o cadastro depois.

Quem recebe (`recipientName`):
- é o texto enviado, sem espaços nas pontas;
- ausente ou em branco, é o nome do usuário;
- MUST ter de 2 a 100 caracteres. Com menos, a resposta é `400` com `TEXT_TOO_SHORT`; com mais, `400` com `TEXT_TOO_LONG`.

Instruções para o entregador (`deliveryInstructions`):
- são opcionais, com até 200 caracteres. Acima disso, a resposta é `400` com `TEXT_TOO_LONG`;
- ausentes ou em branco, viram `null`.

#### Scenario: Quem recebe padrão
- **WHEN** a cliente confirma o pedido com `recipientName: ""`
- **THEN** o pedido é criado com `recipientName` igual ao nome do usuário dela

#### Scenario: Endereço não muda com o cadastro
- **WHEN** depois de um pedido criado a cliente altera o número do endereço com `PUT /me/customer` e chama `GET /me/orders/:id`
- **THEN** o endereço do pedido continua com o número da confirmação

#### Scenario: Quem recebe curto demais
- **WHEN** a cliente confirma o pedido com `recipientName: "A"`
- **THEN** o sistema responde `400` com `TEXT_TOO_SHORT`, nenhum pedido é criado e o carrinho continua com os itens

### Requirement: Totais e entrega do pedido
O pedido SHALL ter os totais abaixo, calculados a partir dos itens congelados com a mesma regra de entrega do carrinho:
- `itemCount`: soma das quantidades;
- `subtotalCents`: soma dos totais das linhas;
- `deliveryFeeCents`: `490` quando o subtotal é menor que `7900`, e `0` a partir de `7900`;
- `totalCents`: subtotal mais entrega.

Os totais MUST continuar iguais nas leituras seguintes, mesmo que os preços do catálogo mudem.

#### Scenario: Entrega cobrada
- **WHEN** a cliente confirma um pedido com subtotal abaixo de R$ 79,00
- **THEN** o pedido tem `deliveryFeeCents: 490` e `totalCents` igual ao subtotal mais 490

#### Scenario: Entrega grátis
- **WHEN** a cliente confirma um pedido com subtotal de pelo menos R$ 79,00
- **THEN** o pedido tem `deliveryFeeCents: 0` e `totalCents` igual ao subtotal

### Requirement: Status inicial e pagamento simulado
Todo pedido criado SHALL começar com o status `PLACED` ("Pedido recebido") e com `placedAt` igual ao momento da confirmação. Os passos seguintes seguem `orders/order-lifecycle`.

O cliente MUST NOT informar forma de pagamento nem dados de pagamento. O pedido não guarda forma de pagamento. O pagamento é simulado e aprovado automaticamente pelo serviço simulado de pagamento depois da confirmação, sem nenhuma ação do cliente.

#### Scenario: Pedido nasce recebido
- **WHEN** um pedido é criado
- **THEN** ele tem `status: "PLACED"`, `placedAt` com a data e hora da confirmação, as datas dos demais passos vazias e nenhum campo de forma ou dados de pagamento

#### Scenario: Pagamento aprovado automaticamente
- **WHEN** um pedido é criado com a simulação ligada
- **THEN** alguns segundos depois ele está `PAYMENT_APPROVED`, com `paymentApprovedAt` preenchida, sem nenhuma requisição do cliente

### Requirement: Pedido, carrinho e evento gravados juntos
Ao confirmar, o sistema SHALL gravar numa única transação:
- o pedido com os itens;
- o carrinho da conta esvaziado;
- o evento `order.placed` no outbox.

Se qualquer uma dessas gravações falhar, MUST NOT ficar gravado nenhum dos três. Falhas de cadastro de cliente, de carrinho e de validação MUST ser detectadas antes de qualquer gravação.

#### Scenario: Confirmação grava pedido, carrinho e evento
- **WHEN** a cliente confirma um pedido com sucesso
- **THEN** `GET /me/cart` responde o carrinho vazio, `GET /me/orders/:id` responde `200` e o outbox tem uma linha `order.placed` com `aggregate_id` igual ao id do pedido

#### Scenario: Falha ao gravar o evento
- **WHEN** a gravação do evento no outbox falha durante a confirmação
- **THEN** a confirmação falha, nenhum pedido é gravado e o carrinho continua com os itens

### Requirement: Evento order.placed
Cada pedido criado SHALL gerar exatamente um evento de domínio com:
- `type` `order.placed`, `aggregateType` `Order` e `aggregateId` igual ao id do pedido;
- `occurredAt` igual a `placedAt`;
- no `payload`: `customerId`; `items`, cada um com `productId`, `name`, `quantity`, `unitPriceCents` e `lineTotalCents`; `itemCount`, `subtotalCents`, `deliveryFeeCents` e `totalCents`; e `placedAt` em texto ISO 8601;
- `metadata` vazio (`{}`).

O evento registra um fato consumado (o cliente fez o pedido) e MUST trazer o suficiente para os consumidores não precisarem consultar o pedido.

A publicação segue `messaging/event-outbox` e `messaging/message-broker`: depois do commit, pelo outbox, no exchange `jaja.events` com routing key `order.placed`, pelo menos uma vez.

Ler um pedido já gravado MUST NOT gerar eventos. Nenhum consumidor reage ao evento nesta entrega.

#### Scenario: Evento publicado no broker
- **WHEN** um pedido é confirmado com o RabbitMQ e o relay no ar
- **THEN** em alguns segundos a linha `order.placed` do outbox fica com `status = 'PUBLISHED'`, e a fila `jaja.events.all` recebe uma mensagem com `type` `order.placed` e o payload com `customerId`, os itens e os totais do pedido

#### Scenario: Broker fora do ar
- **WHEN** um pedido é confirmado com o RabbitMQ parado
- **THEN** `POST /me/orders` responde `201`, e o evento fica pendente no outbox até o broker voltar

#### Scenario: Leitura não gera evento
- **WHEN** a cliente chama `GET /me/orders/:id` várias vezes
- **THEN** o outbox continua com uma única linha `order.placed` para esse pedido

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

### Requirement: Erros da API do pedido
As falhas de `/me/orders` SHALL usar o corpo de erro padrão da API, com cada código uma única vez. Os códigos respondem com:
- `ORDER_NOT_FOUND`: `404`;
- `ORDER_ALREADY_EXISTS`: `409`;
- as demais falhas, inclusive `ORDER_CUSTOMER_REQUIRED`, `ORDER_CUSTOMER_INACTIVE`, `ORDER_CART_EMPTY`, `ORDER_CART_HAS_UNAVAILABLE_ITEMS`, `ORDER_PRODUCT_NOT_FOUND` e os erros de validação: `400`.

A confirmação MUST parar na primeira regra que falhar.

#### Scenario: Primeira regra que falha
- **WHEN** uma cliente inativa, com o carrinho vazio, chama `POST /me/orders`
- **THEN** o sistema responde `400` apenas com `ORDER_CUSTOMER_INACTIVE`

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
