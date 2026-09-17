## Purpose

Define o monitoramento de um pedido pela operação do Jaja: a linha do tempo dos eventos do pedido, lida das tabelas internas de mensageria, e o painel `/admin/orders/:id`, que mostra ao vivo os passos de negócio e o fluxo técnico (outbox, publicação, consumidores, causa e correlação).

## ADDED Requirements

### Requirement: Linha do tempo de eventos do pedido
`GET /orders/:id/events` (administrativo) SHALL devolver os eventos gravados no outbox para o pedido (`aggregateType` `Order`, `aggregateId` igual ao id), em ordem cronológica (`occurredAt`, desempate por `id`). Pedido inexistente, excluído ou com id malformado MUST responder `404` com `ORDER_NOT_FOUND`.

Cada evento MUST ter:
- `id`, `type`, `occurredAt`, `payload` e `metadata`;
- `causationId` e `correlationId`, lidos do `metadata`, ou `null`;
- `outbox`, com `status` (`PENDING` ou `PUBLISHED`), `attempts`, `availableAt`, `publishedAt` e `lastError`;
- `consumers`: um item por consumidor registrado para o `type` do evento, na ordem de registro, mais os consumidores não registrados que já processaram o evento.

Cada consumidor MUST ter `name`, `delayMs` (`null` quando não registrado), `registered`, `processedAt`, `expectedAt` e `state`:
- `processed`, quando existe a marca de processamento do consumidor para o evento;
- `event-pending`, quando ainda não há marca e o evento ainda não foi publicado;
- `waiting`, nos demais casos, com `expectedAt = publishedAt + delayMs` (ou `null` sem `delayMs`).

A linha do tempo MUST ser lida só do banco, sem consultar o broker. Falhas e descartes de consumidores MUST NOT aparecer nela.

#### Scenario: Logo após a confirmação
- **WHEN** a cliente confirma um pedido e, depois da publicação do `order.placed`, o administrador chama `GET /orders/:id/events`
- **THEN** a resposta tem um evento `order.placed`, `PUBLISHED`, com o consumidor `payment.approve-order` em `waiting`, `delayMs` 3000 (com fator 1) e `expectedAt` 3 s depois de `publishedAt`

#### Scenario: Pedido entregue
- **WHEN** o pedido chega a `DELIVERED` e o administrador chama `GET /orders/:id/events`
- **THEN** a resposta tem os cinco eventos em ordem. Os quatro consumidores estão `processed`, cada um no evento que assina. Os quatro últimos eventos têm o `correlationId` igual ao id do `order.placed`, e cada `causationId` é o id do evento anterior. `order.delivered` não tem consumidores

#### Scenario: Consumidor não registrado
- **WHEN** um evento foi processado por um consumidor que não está registrado na instância que responde
- **THEN** o consumidor aparece com `registered: false`, `delayMs` `null` e `state` `processed`

#### Scenario: Pedido inexistente
- **WHEN** o administrador chama `GET /orders/:id/events` com um id sem pedido
- **THEN** o sistema responde `404` com `ORDER_NOT_FOUND`

### Requirement: Painel do pedido
A página `/admin/orders/:id` SHALL exibir, para administradores:
- **cabeçalho:** o link "← Pedidos" de volta à lista (mantendo filtros), o título "Pedido #`número`" com o badge do status e o indicador ao vivo, e "Feito às HH:MM:SS · há `X`", com o tempo decorrido atualizado a cada segundo; com o pedido entregue, também "Entregue em `Y`" (de `placedAt` a `deliveredAt`, como "21 s" ou "3 min 12 s");
- **"Progresso":**
  - os cinco passos, cada um concluído com `HH:MM:SS` e a duração desde o passo anterior (ex.: "+3,2 s");
  - o passo seguinte ao status atual com "Em andamento…";
  - os demais com "Aguardando";
- **"Cliente e entrega":** nome, e-mail, telefone, endereço copiado, quem recebe e instruções;
- **"Itens":** miniatura, nome, quantidade e total da linha, subtotal, entrega e total;
- **"Eventos":** a correlação abreviada (8 caracteres) e a quantidade de eventos, e a linha do tempo em ordem cronológica. Cada evento aparece com:
  - o `type` em fonte mono;
  - a hora `HH:MM:SS.mmm`;
  - o `messageId` abreviado;
  - "causado por `xxxxxxxx`", com link para o evento anterior, quando houver;
  - a situação no outbox: "Publicado às HH:MM:SS.mmm", ou "Pendente" com tentativas e último erro;
  - os consumidores, conforme o estado:
    - `processed`: "Processado às HH:MM:SS";
    - `waiting`: "Aguardando · espera de `N` s", com contagem regressiva até `expectedAt` e depois "processando…";
    - `event-pending`: "Aguardando publicação";
    - não registrado: a marca "não registrado nesta instância";
  - payload e metadata num bloco expansível;
- a nota "Atualizado pelos eventos que chegam do RabbitMQ. Falhas e descartes: painel do RabbitMQ ou `jaja broker:queues`.".

Pedido inexistente MUST mostrar "Pedido não encontrado." com "Voltar para os pedidos". A aba MUST ter o título "Pedido #`número` — Operação". Em 375px, a página MUST caber sem rolagem horizontal.

#### Scenario: Painel de um pedido entregue
- **WHEN** o administrador abre o painel de um pedido `DELIVERED`
- **THEN** vê os cinco passos concluídos com horários e durações, "Entregue em `Y`", os dados do cliente e itens, e os cinco eventos, cada um com "Publicado às…", causa e consumidores "Processado às…"

#### Scenario: Pedido inexistente
- **WHEN** o administrador abre `/admin/orders/<id sem pedido>`
- **THEN** vê "Pedido não encontrado." e "Voltar para os pedidos"

### Requirement: Painel atualizado ao vivo
Com o painel aberto, a página SHALL reler o pedido e a linha do tempo pela API a cada aviso do stream administrativo **daquele pedido** e a cada reconexão, com no máximo uma leitura em andamento e uma pendente, sem recarregar. Eventos novos MUST entrar na linha do tempo com destaque breve, e as animações MUST respeitar `prefers-reduced-motion`.

#### Scenario: Acompanhar o ciclo com duas janelas
- **WHEN** o administrador abre o painel de um pedido recém-confirmado numa janela, enquanto a cliente acompanha o mesmo pedido em outra sessão
- **THEN** em cerca de 20 s, com o fator de espera 1, o painel mostra, sem recarregar:
  - os eventos `order.payment-approved`, `order.picking-started`, `order.out-for-delivery` e `order.delivered` aparecendo um a um;
  - cada consumidor passando de "Aguardando" (com contagem regressiva) a "Processado";
  - os passos concluindo com horários;
  - "Entregue em ~20 s" ao final;
  - o acompanhamento da cliente avançando igual

#### Scenario: Aviso de outro pedido
- **WHEN** o painel do pedido A está aberto e o pedido B muda de status
- **THEN** o painel do pedido A não relê a API
