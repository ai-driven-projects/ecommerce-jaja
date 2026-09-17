## Context

A motivação e o escopo estão em `proposal.md`. O comportamento está nas specs:
- `orders/order-lifecycle` e `messaging/live-event-feed` (novas);
- `orders/order-placement`, `orders/order-tracking` e `messaging/message-broker` (deltas).

O roteiro detalhado de implementação é o prompt `openspec/extras/prompts/17-ciclo-pedido.md`. Este é o estado atual relevante.

**Domínio (`modules/orders`)**
- `Order extends AggregateRoot<Order, OrderProps, OrderPlacedEvent>`:
  - `place` cria o pedido `PLACED` e adiciona `OrderPlacedEvent`;
  - `tryCreate` reidrata sem eventos;
  - `cloneWith` leva os eventos pendentes para o clone;
  - os totais são calculados a partir dos itens.
- `ORDER_STATUSES = ['PLACED']`, e `ORDER_STATUS_INVALID` já existe. `placedAt` inválido também é reportado como `ORDER_STATUS_INVALID`.
- `OrderRepository extends CrudRepository<Order>`:
  - `update(entity, tx?)` recebe transação;
  - `findById(id)` **não** recebe (contrato do shared, somente leitura).
- `PlaceOrder` é o modelo de caso de uso com `runInTransaction`, `append(order.pullEvents(), tx)` e `ResultError` capturado.

**Backend**
- A infraestrutura de consumo (prompt 16) está em `src/messaging/`:
  - `EventConsumerRegistry.register(consumer)`, com a regra do nome `<módulo>.<ação>`;
  - o runner abre a transação, marca a mensagem e passa `ActiveTransactionManager` ao handler, que devolve `Result`;
  - `delayMs` usa a fila `.wait`;
  - `RabbitMqSubscription` (`ConsumeMessageIn` + `delayMs?`) sempre declara fila durável + `.wait` + `.dead`;
  - `MESSAGE_CONSUMER` **não** é exportado pelo `MessagingModule`, só `DomainEventPrisma`, `MESSAGE_PUBLISHER` e `EventConsumerRegistry`.
- O `DomainEventPrisma` preenche `causationId`/`correlationId` quando a gravação acontece dentro de um consumidor, então a cadeia do pedido sai sem código novo.
- `OrderPrisma.update` já existe, e `findMyOrderById` mapeia a linha direto para `OrderDetailDTO`. `MyOrderController` usa `@UseGuards(JwtGuard)` na classe.
- Nest (versão do monorepo): um handler `@Sse` pode ser `async`. O `RouterResponseController.sse` só faz o `pipe` do `SseStream` na resposta (e envia os cabeçalhos `text/event-stream`) depois de a promessa resolver com o `Observable`. Uma exceção lançada antes disso segue o fluxo normal de filtros, e um `NotFoundException` vira JSON `404`.
- `rxjs` já é dependência do backend.

**Frontend**
- `useMyOrder` carrega o pedido uma vez, com o estado chaveado por token e id. `OrderTracking` marca só o primeiro passo como concluído (`ORDER_STEPS` fixo no componente).
- `apiRequest` é o único cliente HTTP. Ainda não existe utilitário de stream.
- `useClientMinute` já resolve horários só depois da hidratação.

## Goals / Non-Goals

**Goals:**
- Um ciclo de pedido completo e visível, usando só as peças dos prompts 14–16 (outbox, relay, consumo) mais uma difusão para avisos.
- Regras de status no agregado, testáveis sem banco nem broker.
- Consumidores de negócio finos: só traduzem a mensagem em chamada de caso de uso.
- Tela do cliente sempre consistente com a API, mesmo perdendo avisos.

**Non-Goals:**
- Garantia de entrega dos avisos ao vivo e ordem garantida entre passos.
- Controle de concorrência otimista no pedido. Nesta versão, só um serviço avança cada passo.
- Reaproveitar o stream no admin, que fica para o prompt 18. Esta change só deixa `OrderLiveUpdates` pronto para ganhar `forAll`.
- Escalar SSE entre instâncias além da difusão por instância (sem Redis nem sticky sessions).

## Decisions

### 1. Três etapas sequenciais com contexto limpo
Negócio → Backend → Frontend, cada uma em um subagente, como pede o prompt. O backend depende do build de `@jaja/orders`, e o frontend, da API e do stream rodando.

### 2. Status em sequência com uma data por passo, no agregado
`ORDER_STATUSES` passa a ser a sequência ordenada, e `advanceTo(status)` só aceita o próximo status. Cada passo tem uma coluna de data anulável (`payment_approved_at`, …), e `tryCreate` valida a coerência entre status e datas.

Alternativas descartadas:
- **Tabela de histórico de status:** mais flexível para ciclos com idas e voltas, mas o fluxo é linear, e colunas deixam a leitura (tela do cliente, lista do admin no prompt 18) em uma linha, sem join.
- **Métodos por passo (`approvePayment`, `startPicking`, …):** mais explícitos, mas repetem a mesma regra quatro vezes. `advanceTo` com a tabela de sequência mantém uma regra só, e os eventos continuam com `type` específico por passo.
- **Status como enum Prisma:** o projeto já guarda status como texto (outbox, pedido), e novos status não exigem migration de tipo.

### 3. Um evento com tipo por passo (`OrderStatusChangedEvent`)
Uma classe com `type` derivado do status (`ORDER_STATUS_EVENT_TYPES`) e payload comum (`customerId`, `previousStatus`, `status`, `changedAt`). Os consumidores assinam por routing key, então cada passo continua com seu próprio tipo de evento e sua própria fila.

Alternativa descartada: **uma classe por evento**. Seriam quatro arquivos quase idênticos, sem ganho para o consumidor.

### 4. `AdvanceOrderStatus`: um caso de uso idempotente para todos os passos
O caso de uso:
1. lê o pedido com `findById`, fora da transação (contrato do shared);
2. se o pedido já chegou ao destino, devolve `changed: false` sem abrir transação;
3. senão, `advanceTo` + `update(tx)` + `append(tx)` numa `runInTransaction`.

Chamado por um consumidor, o `runInTransaction` é o `ActiveTransactionManager`, então a atualização entra na mesma transação da marca de processada.

"Já chegou" terminando com sucesso é a regra do prompt 16 para mensagens que não se aplicam mais, e cobre repetição e atraso mesmo que a marca de processada se perca (ex.: consumidor renomeado).

Risco aceito: a leitura fora da transação permite que duas execuções simultâneas para o **mesmo** passo passem pela checagem. A marca de processada impede isso para a mesma mensagem, e só um serviço avança cada passo (Riscos).

### 5. Serviços simulados no backend, como consumidores do registro
`OrderSimulationConsumers` (`OnModuleInit`) registra quatro `TransactionalEventConsumer` a partir de uma tabela (`ORDER_SIMULATION_STEPS`). O handler lê `payload.aggregateId` e chama `AdvanceOrderStatus` com o `transactionManager` recebido. A espera é o `delayMs` do consumidor (fila `.wait`), multiplicada por `ORDER_SIMULATION_DELAY_FACTOR` e limitada a 300 000 ms (o teto do registro).

Os nomes seguem `<serviço>.<ação>` (`payment.approve-order`, …). O prefixo é o serviço simulado, e não `orders`, porque cada um representa um sistema externo. O código documenta a simplificação: num sistema real, cada serviço teria processo e eventos próprios, e o pedido reagiria a `payment.approved`.

Alternativas descartadas:
- **Orquestrador (saga) que chama os passos em sequência:** esconde a coreografia, que é o ponto didático.
- **`setTimeout` no backend para simular a demora:** seguraria mensagem ou transação e perderia a espera se o processo caísse.
- **Serviços simulados em `modules/orders`:** o módulo de domínio não conhece o registro nem o broker.

### 6. Difusão por instância: assinatura transitória + `LiveEventFeed`
Os avisos ao vivo precisam chegar à instância que tem a conexão SSE aberta, e uma fila de trabalho entrega cada mensagem a **uma** instância só. Por isso:
- o adapter ganha `transient`: fila não durável, exclusiva e `autoDelete`, sem `.wait`/`.dead`, com `ack` sempre e redeclarada ao reconectar;
- `LiveEventFeed` (em `messaging`) assina `jaja.live.<host>.<pid>.<sufixo>` com `#` e expõe `events$` (`Subject` do rxjs);
- o feed fica no `MessagingModule`, que já tem o `MESSAGE_CONSUMER`, e é exportado. `MESSAGE_CONSUMER` continua sem ser exportado.

A assinatura transitória vai **direto** para `MessageConsumer.subscribe`, sem o `EventConsumerRunner`: não há idempotência nem transação, porque o aviso não altera estado.

Alternativas descartadas:
- **Consumidor de negócio (fila durável) para os avisos:** com duas instâncias, metade dos avisos iria para a instância errada, e a idempotência seria desperdício.
- **Polling do banco em cada conexão SSE:** simples, mas não mostra o broker entregando o aviso, e escala mal com muitas abas.
- **`LISTEN/NOTIFY` do Postgres:** outro mecanismo de mensageria paralelo ao RabbitMQ, contra o objetivo didático.
- **Redis pub/sub:** nova dependência de infraestrutura.

### 7. `OrderLiveUpdates` e o stream do cliente
`OrderLiveUpdates.forOrder(orderId)` filtra `events$` por `payload.aggregateType === 'Order'` e `payload.aggregateId` (campos que `domainEventToBrokerMessage` já coloca no payload). Cada evento vira `MessageEvent` `order` com `{ orderId, eventType, messageId, occurredAt }`, e um `interval` acrescenta `ping` a cada 20 s, o que mantém proxies e o navegador com a conexão viva.

O endpoint `GET /me/orders/:id/stream` é um `@Sse` `async`: confere o dono com `findMyOrderById`, lança `NotFoundException([ORDER_NOT_FOUND])` quando `null` e só então devolve o `Observable` (ver Context sobre o momento dos cabeçalhos). O `JwtGuard` da classe cuida do `401`. A tarefa verifica com `curl` que `401`/`404` saem em JSON. Se não saírem, o fallback é `@Get` + `@Res()` escrevendo `text/event-stream` à mão.

O aviso não leva dados do pedido: evita vazar payload para quem abriu o stream e mantém uma única fonte da verdade (`GET /me/orders/:id`).

### 8. Stream no navegador com `fetch` e `Authorization`
`openEventStream`:
- faz `fetch` com `Accept: text/event-stream` e `Authorization`, e interpreta o formato SSE sobre `ReadableStream` (`event`, `data`, linha em branco, comentários);
- reconecta com espera de 1 s a 10 s;
- para em `401`/`403`/`404`;
- `onStatusChange` alimenta o indicador "Ao vivo".

A `EventSource` nativa não envia cabeçalhos, e pôr o token na query string vazaria o token em logs de acesso e no histórico.

`useMyOrder` relê o pedido a cada aviso e a cada reconexão, com no máximo uma leitura em andamento e uma pendente (avisos em rajada viram no máximo duas leituras). Fecha o stream na entrega.

### 9. Passos derivados do status e das datas (`order-status.util.ts`)
`ORDER_STEPS` associa status, rótulo e a chave da data. `orderStepState` deriva `done`/`current`/`pending` só do status, e a hora vem da data do passo. O utilitário fica em `modules/orders/data` para o painel do admin (prompt 18) reaproveitar rótulos, variantes e passos.

### 10. Validação por testes do domínio, unitários do backend e e2e do ciclo
- **Domínio:** jest, sem infraestrutura.
- **Backend:** Vitest com fakes (registro, `MessageConsumer`, `Subject`, timers).
- **e2e `order-lifecycle.e2e-spec.ts`** (com `MESSAGING_E2E=true`):
  - monta o `AppModule` com `ORDER_SIMULATION_DELAY_FACTOR=0` e o relay a cada 200 ms;
  - cria o pedido do cliente do seed pelo domínio (sem HTTP) e assina `forOrder` antes de gravar;
  - confere o `DELIVERED`, a ordem das datas, a cadeia no outbox, as quatro linhas processadas e os cinco avisos;
  - limpa o que criou.

## Risks / Trade-offs

- **[Pedidos antigos presos em `PLACED`: os `order.placed` publicados antes das filas dos consumidores existirem não chegam a elas]** → esperado. O prompt 18 apaga os pedidos antigos (`db:clear-orders`). Pedidos criados depois da subida da simulação andam normalmente.
- **[Aviso perdido (broker fora do ar, instância sem feed, aba abrindo durante um evento)]** → a página relê o pedido ao reconectar e a cada aviso seguinte. No pior caso, fica um passo atrás até o próximo evento, e o `DELIVERED` final sempre gera aviso se o feed estiver ligado.
- **[Broker cai só para o feed e o SSE continua aberto: a página mostra "Ao vivo" sem receber avisos]** → aceito e documentado. Ao voltar, os eventos seguintes chegam, e o ciclo continua porque os eventos pendentes ficam no outbox. O prompt pede para validar esse caso.
- **[Leitura do pedido fora da transação em `AdvanceOrderStatus`]** → só um consumidor avança cada passo, e a marca de processada evita a mesma mensagem em paralelo. Com dois produtores do mesmo passo no futuro, seria preciso `update` condicional (`WHERE status = anterior`).
- **[Conexões SSE longas consomem recursos por aba]** → uma conexão por acompanhamento aberto, fechada na entrega e ao sair da página, com sinal de vida a cada 20 s. Sem limite por usuário nesta versão.
- **[Fila `jaja.live.*` recebe todos os eventos (`#`) e filtra em memória]** → o volume didático é pequeno. Se crescer, o feed pode assinar só `order.*`.
- **[Espera na `.wait` com TTL por mensagem: uma espera longa atrasa uma curta atrás dela (risco do prompt 16)]** → cada consumidor tem espera constante, então as mensagens da mesma fila expiram em ordem.
- **[`ORDER_SIMULATION_DELAY_FACTOR=0` desliga a `.wait` (espera 0)]** → é o que o e2e usa. Com 0, a ordem entre passos continua garantida pela causalidade (cada passo só existe depois do anterior).
- **[e2e instável com outro backend rodando (relay e consumidores competindo), como no prompt 16]** → o cabeçalho do e2e exige nenhum backend rodando, e o subagente usa outra porta sem matar processos do usuário.
- **[`advanceTo` com `now` do backend e `placedAt` gravado antes: relógio do processo]** → mesmo processo e mesmo relógio. Durações negativas só com ajuste de relógio, sem impacto nas regras (a sequência é pelo status, não pelas datas).

## Migration Plan

1. Aplicar a migration `orders_order_status_steps`, que é aditiva: quatro colunas anuláveis e um índice. Os pedidos existentes continuam `PLACED`, com datas vazias e coerentes.
2. Atualizar o `.env` local com `ORDER_SIMULATION_ENABLED`, `ORDER_SIMULATION_DELAY_FACTOR` e `LIVE_EVENTS_ENABLED`. Sem elas, valem os padrões (simulação e feed ligados, fator 1).
3. Subir o backend. As filas dos quatro consumidores e a `jaja.live.*` são criadas na inicialização, e os pedidos novos passam a andar sozinhos.

**Rollback:**
- reverter o código;
- remover as colunas e o índice (`ALTER TABLE orders DROP COLUMN …; DROP INDEX …;`) e a pasta da migration;
- apagar pelo painel as filas `jaja.payment.approve-order`, `jaja.store.start-picking`, `jaja.delivery.dispatch-order` e `jaja.delivery.complete-order` (com `.wait` e `.dead`). As `jaja.live.*` somem sozinhas.

Pedidos que já avançaram ficariam com status desconhecido para o código antigo: antes de reverter, apagar esses pedidos ou voltá-los a `PLACED`.
