> **Execução:** três subagentes separados, cada um com contexto limpo, **nessa ordem**:
> - **Negócio:** grupos 1–3;
> - **Backend:** grupos 4–8;
> - **Frontend:** grupos 9–10.
>
> Um grupo só começa depois de o anterior terminar com as validações passando. O grupo 11 é da conversa principal, com o usuário.
>
> **Antes de começar:** conferir que os prompts 14, 15 e 16 estão implementados (`EventConsumerRegistry`, `EventConsumerRunner` e `RabbitMqMessageConsumer` em `apps/backend/src/messaging/`). Se não estiverem, parar e reportar.
>
> **Leitura prévia de cada subagente:**
> - todos: `.claude/skills/skills-standards.md`, o prompt `openspec/extras/prompts/17-ciclo-pedido.md`, o `design.md` e as specs desta change, e as referências de código da sua camada listadas no Contexto do prompt;
> - Frontend, além disso: `apps/frontend/DESIGN.md`.
>
> **Restrições:**
> - não alterar `packages/shared`;
> - não fazer commit nem operações git que mudem o working tree, e não tocar em alterações de outras frentes;
> - não matar backends que já estejam rodando: usar outra porta se a 4000 estiver ocupada;
> - deixar o seed como estava e apagar os pedidos de teste criados;
> - não digitar senhas em formulários do navegador: a conferência com login é da conversa principal (grupo 11).
>
> Cada subagente encerra listando os arquivos criados/alterados e o resultado das validações.

## 1. Status e evento de mudança (subagente Negócio)

- [x] 1.1 Em `modules/orders/src/order/errors.ts`:
  - `ORDER_STATUSES = ['PLACED', 'PAYMENT_APPROVED', 'PICKING', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const`, com JSDoc sobre a sequência;
  - `ORDER_STATUS_TRANSITION_INVALID` em `OrderErrors`;
  - `orderStatusIndex(status)`.

  Verificar com `npx tsc --noEmit -p modules/orders`.
- [x] 1.2 Criar `event/order-status-changed.event.ts` com `OrderStatusChangedEvent`, `ORDER_STATUS_EVENT_TYPES`, `OrderStatusEventType`, `OrderStatusChangedPayload` e `tryCreate({ orderId, customerId, previousStatus, status, changedAt })` (falha com `ORDER_STATUS_INVALID` para `PLACED` ou desconhecido), no padrão de `order-placed.event.ts`, com o JSDoc do prompt (Decisão 3). Exportar em `event/index.ts`, junto com o tipo `OrderEvent`. Verificar com `test/order/order-status-changed.event.test.ts`:
  - `type` de cada um dos quatro status;
  - `aggregateType` `Order` e `aggregateId`;
  - payload com `customerId`, `previousStatus`, `status` e `changedAt` em ISO;
  - `occurredAt` igual a `changedAt`;
  - `metadata` `{}`;
  - `PLACED` e status desconhecido falham.

## 2. Entidade e DTOs (subagente Negócio)

- [x] 2.1 Em `model/order.entity.ts`, com a skill `module-entity` (Decisão 2):
  - `AggregateRoot<Order, OrderProps, OrderEvent>`;
  - props opcionais `paymentApprovedAt`, `pickingStartedAt`, `outForDeliveryAt` e `deliveredAt` (ausente vira `null`);
  - validação da coerência entre status e datas em `tryCreate` (`ORDER_STATUS_INVALID`);
  - getters (cópias) e `hasReached(status)`;
  - `advanceTo(status, now = new Date())`, que só aceita o próximo status (`ORDER_STATUS_TRANSITION_INVALID`), usa `cloneWith` com status, data do passo e `updatedAt`, e adiciona `OrderStatusChangedEvent` na instância devolvida;
  - `toDTO()` com as quatro datas;
  - comentário da classe atualizado.

  Verificar com `test/order/order.entity.test.ts`, acrescentando:
  - a sequência completa com uma data e um evento por avanço;
  - avanço para o atual, para um anterior, com pulo e depois de `DELIVERED` falha sem evento;
  - a instância original fica igual;
  - `PLACED` com `paymentApprovedAt` e `PICKING` sem `paymentApprovedAt` falham com `ORDER_STATUS_INVALID`;
  - reidratação em `DELIVERED` sem eventos;
  - `hasReached`.

  Os testes existentes continuam passando.
- [x] 2.2 Em `dto/order.dto.ts`, com a skill `module-dto`: as quatro datas em `OrderDTO` (`Date | null`), `AdvanceOrderStatusInputDTO` (`orderId`, `status`) e `AdvanceOrderStatusOutputDTO` (`status`, `changed`). Verificar com `npx tsc --noEmit -p modules/orders`.

## 3. Caso de uso e mocks (subagente Negócio)

- [x] 3.1 Atualizar `test/mock/in-memory-order.repository.ts` para guardar e devolver as datas dos passos, com `update` substituindo o pedido guardado. Verificar com os testes existentes de `place-order.use-case.test.ts` passando.
- [x] 3.2 Criar `use-case/advance-order-status.use-case.ts` (`AdvanceOrderStatus`, com `OrderRepository`, `DomainEventRepository` e `TransactionManager`), com a skill `module-use-case` e o fluxo e o JSDoc do prompt (Decisão 4). Exportar em `use-case/index.ts`. Verificar com `test/order/advance-order-status.use-case.test.ts`:
  - sucesso: `update` e um evento com o **mesmo `tx`**, uma transação, `{ changed: true }`;
  - já no status ou depois: `{ changed: false }`, sem transação nem evento;
  - pulo: `ORDER_STATUS_TRANSITION_INVALID`, sem transação;
  - inexistente: `ORDER_NOT_FOUND`;
  - destino `PLACED` ou inválido: `ORDER_STATUS_INVALID`;
  - falha ao gravar o evento: falha com o código e `rolledBack = true`;
  - `orderId` malformado.
- [x] 3.3 Rodar `npm test --workspace=@jaja/orders` e `npm run build --workspace=@jaja/orders`. Verificar que os dois terminam sem erros.

## 4. Banco, ambiente e adapter do pedido (subagente Backend)

- [x] 4.1 Em `apps/backend/.env.example`, acrescentar com comentários `ORDER_SIMULATION_ENABLED="true"`, `ORDER_SIMULATION_DELAY_FACTOR="1"` (0 a 10) e `LIVE_EVENTS_ENABLED="true"`. Copiar para o `apps/backend/.env` local. Verificar com `git diff apps/backend/.env.example`.
- [x] 4.2 Em `prisma/models/orders.model.prisma`, com a skill `backend-prisma-data`, acrescentar ao `Order` `paymentApprovedAt`, `pickingStartedAt`, `outForDeliveryAt` e `deliveredAt` (`DateTime?`, `@map` snake_case) e `@@index([status, placedAt])`, atualizando o comentário. Rodar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name orders_order_status_steps` e `npm run prisma:generate --workspace=@jaja/backend`. Verificar que o `migration.sql` só tem os quatro `ADD COLUMN` e o `CREATE INDEX`. Se aparecer outra alteração, removê-la antes de aplicar; se o Prisma pedir reset, parar e reportar.
- [x] 4.3 Em `src/modules/orders/order.prisma.ts`:
  - `toDomain`/`fromDomain` com as quatro datas;
  - `update(order, tx)` grava `status`, as datas e `updatedAt`;
  - `findMyOrderById` devolve as datas.

  Verificar com `npx tsc --noEmit -p apps/backend`, `order.integration.http` (sucesso com as datas `null`) e o e2e da tarefa 8.1.

## 5. Assinatura transitória e feed ao vivo (subagente Backend)

- [x] 5.1 Em `src/messaging/rabbitmq/rabbitmq-message.consumer.ts` (Decisão 6):
  - `transient?: boolean` em `RabbitMqSubscription`;
  - fila `{ durable: false, exclusive: true, autoDelete: true }`, sem `.wait`/`.dead`;
  - `ack` sempre, com falha e corpo inválido só no log (sem payload);
  - `delayMs` com `transient` → `MESSAGE_SUBSCRIPTION_INVALID`;
  - nova declaração ao reconectar;
  - comentário sobre fila de trabalho × transitória.

  Verificar com os casos novos em `rabbitmq-message.consumer.spec.ts`:
  - declaração transitória sem `.wait`/`.dead`;
  - `ack` na falha e no corpo inválido;
  - `delayMs` + `transient` rejeitado;
  - nova declaração após `close`.

  Os casos existentes continuam passando.
- [x] 5.2 Criar `src/messaging/live/live-event-feed.ts` com `LiveEventFeed`:
  - `LIVE_EVENTS_ENABLED`;
  - fila `jaja.live.<host>.<pid>.<sufixo>` sanitizada, transitória, com `#`;
  - `events$` com `Subject`, e `onMessage` sempre `ok`;
  - log da fila assinada;
  - `complete` ao desligar.

  Registrar em `messaging.module.ts` (providers e exports) e exportar em `index.ts`. Verificar com `live-event-feed.spec.ts`:
  - desligado não assina;
  - ligado assina uma fila `jaja.live.*` que casa com `^[a-z0-9.-]+$`, `transient: true` e `['#']`;
  - a mensagem sai em `events$`;
  - `onModuleDestroy` completa.

## 6. Atualizações ao vivo e stream do cliente (subagente Backend)

- [x] 6.1 Criar `src/modules/orders/order-live-updates.ts` com `OrderLiveUpdates.forOrder(orderId)` (Decisão 7): filtro por `payload.aggregateType`/`aggregateId`, evento `order` com `{ orderId, eventType, messageId, occurredAt }` sem payload, e `ping` a cada `ORDER_STREAM_HEARTBEAT_MS = 20_000`. Verificar com `order-live-updates.spec.ts` (`Subject` falso, `vi.useFakeTimers`):
  - só os eventos do pedido;
  - outro pedido e outro agregado ignorados;
  - sem payload;
  - `ping` no intervalo.
- [x] 6.2 Em `my-order.controller.ts`, criar `GET /me/orders/:id/stream` com `@Sse` `async`: confere `findMyOrderById` (`NotFoundException([ORDER_NOT_FOUND])` quando `null`) e devolve `forOrder(orderId)`. Comentar que o stream é só aviso. Registrar `OrderLiveUpdates` em `orders.module.ts`. Verificar com o backend rodando:
  - `curl -i .../me/orders/<id>/stream` sem token → `401` com `Content-Type: application/json`;
  - com o token de outro usuário → `404` JSON com `ORDER_NOT_FOUND`;
  - com o token da dona → `200` com `Content-Type: text/event-stream`.

  Se o `@Sse` não permitir o `404` em JSON, trocar por `@Get` + `@Res()` (Decisão 7) e repetir a verificação.

## 7. Serviços simulados (subagente Backend)

- [x] 7.1 Criar `src/modules/orders/simulation/order-simulation.steps.ts` com `ORDER_SIMULATION_STEPS` (quatro passos: `consumerName`, `eventType`, `status`, `baseDelayMs`), com comentário por serviço. Verificar com `npx tsc --noEmit -p apps/backend`.
- [x] 7.2 Criar `src/modules/orders/simulation/order-simulation.consumers.ts` com `OrderSimulationConsumers` (`OnModuleInit`, Decisão 5):
  - `ORDER_SIMULATION_ENABLED` e `ORDER_SIMULATION_DELAY_FACTOR` (0 a 10, inválido = 1);
  - registro dos quatro consumidores com `delayMs = min(round(base * fator), 300_000)`;
  - handler com `payload.aggregateId` (ausente → `ORDER_NOT_FOUND`) e `new AdvanceOrderStatus(orderPrisma, domainEventPrisma, transactionManager)`;
  - logs `Pedido <número> → <status>` e `debug` quando já estava no status, com log único da configuração;
  - comentário da simplificação didática.

  Registrar em `orders.module.ts`. Verificar com `order-simulation.consumers.spec.ts`:
  - quatro registros com nomes, eventos e esperas da tabela;
  - fator `0.5`, `0` e inválido;
  - desligado não registra;
  - `handle` sem `aggregateId` → `ORDER_NOT_FOUND`;
  - `handle` válido chama o caso de uso com o `transactionManager` recebido (repositório falso).
- [x] 7.3 Rodar `npm run test --workspace=@jaja/backend` e `npm run lint --workspace=@jaja/backend`. Verificar que terminam sem erros, com os specs de mensageria existentes passando.

## 8. Integração e validação do backend (subagente Backend)

- [x] 8.1 Criar `apps/backend/test/order-lifecycle.e2e-spec.ts` (Decisão 10):
  - cabeçalho de pré-requisitos e `describe.runIf(process.env.MESSAGING_E2E === 'true')`;
  - `AppModule` com `ORDER_SIMULATION_DELAY_FACTOR=0` e `OUTBOX_POLL_INTERVAL_MS=200`;
  - pedido do cliente do seed criado pelo domínio numa transação;
  - `forOrder` assinado antes;
  - espera de até 20 s.

  Cenários:
  - `DELIVERED` com as quatro datas em ordem crescente;
  - cinco eventos `PUBLISHED` na ordem, com a correlação e a causa encadeadas;
  - quatro linhas em `processed_messages`, uma por consumidor;
  - cinco avisos sem payload.

  Limpar as linhas de `processed_messages`, `outbox_events` e o pedido. Verificar:
  - com Postgres e RabbitMQ no ar e **nenhum backend rodando**, `MESSAGING_E2E=true npm run test:e2e --workspace=@jaja/backend` passa, inclusive os e2e de mensageria;
  - sem a variável, os arquivos aparecem ignorados.

  Se houver backend do usuário rodando, registrar no relatório e rodar o arquivo do ciclo isolado quantas vezes forem precisas para distinguir instabilidade de erro.
- [x] 8.2 Em `src/modules/orders/test/order.integration.http`, acrescentar:
  - a releitura de `GET /me/orders/:id` com o status avançando;
  - a observação de `curl -N` para o stream;
  - `GET /me/orders/:id/stream` sem token (401) e com o pedido de outro usuário (404).

  Verificar executando as chamadas via `curl` contra um backend na porta livre.
- [x] 8.3 Rodar `npm run build --workspace=@jaja/backend`. Com um backend próprio (`ORDER_SIMULATION_DELAY_FACTOR=1`), confirmar um pedido com o cliente do seed pela API e acompanhar `curl -N -H "Authorization: Bearer <token>" .../me/orders/<id>/stream`. Verificar:
  - os quatro avisos de status em cerca de 20 s (o `order.placed` pode ser publicado antes de o stream abrir, porque o stream exige o pedido já gravado; a página relê o pedido ao abrir o stream, então nada se perde);
  - `GET /me/orders/:id` termina `DELIVERED` com as datas;
  - pela API do painel (`curl -u jaja:jaja http://localhost:15672/api/queues/%2F`), as quatro filas de consumidor com `.wait`/`.dead` e uma `jaja.live.*` com `exclusive: true` e `durable: false`;
  - parar e subir o RabbitMQ no meio de outro pedido: ele termina `DELIVERED` sem reiniciar o backend, e o RabbitMQ termina saudável.

  Registrar o id do pedido, os horários dos passos e as linhas do outbox com `causationId`/`correlationId`, e apagar os pedidos de teste ao final.

## 9. Stream e dados do pedido no frontend (subagente Frontend)

- [x] 9.1 Criar `apps/frontend/src/shared/util/event-stream.util.ts` com `openEventStream({ path, token, onEvent, onStatusChange, onError })` (Decisão 8):
  - `fetch` com `Accept: text/event-stream` e `Authorization`;
  - parser SSE (`event`, várias `data`, linha em branco, comentários, JSON inválido ignorado);
  - `ping` ignorado;
  - estados `connecting`/`live`/`reconnecting`/`closed`;
  - nova tentativa de 1 s a 10 s;
  - parada em `401`/`403`/`404` com `ApiError`;
  - fechamento por `AbortController`;
  - JSDoc sobre `EventSource` e token fora da URL.

  Verificar com `npx tsc --noEmit -p apps/frontend` e, com um backend rodando e um token obtido por `curl` no login da API, um script de verificação temporário no scratchpad (fora do repositório) que use a função e receba os avisos de um pedido.
- [x] 9.2 Em `apps/frontend/src/modules/orders/data/`:
  - `order.api.ts` com os cinco status, as quatro datas em `OrderDetail` e `myOrderStreamPath`;
  - criar `order-status.util.ts` com `ORDER_STATUS_LABEL`, `ORDER_STATUS_BADGE_VARIANT`, `ORDER_STEPS`, `orderStepState` e `isOrderFinished` (Decisão 9);
  - atualizar `data/index.ts`.

  Verificar com `npx tsc --noEmit -p apps/frontend`.
- [x] 9.3 Em `use-my-order.hook.ts`:
  - `reload()`;
  - stream quando o pedido está carregado e não entregue;
  - releitura a cada aviso e reconexão, com no máximo uma em andamento e uma pendente;
  - `live` (`connecting`, `live`, `reconnecting`, `closed`, `off`);
  - fechamento ao desmontar, trocar sessão ou id e na entrega;
  - um aviso de erro por queda;
  - JSDoc atualizado.

  Verificar com `npm run lint --workspace=@jaja/frontend`.

## 10. Acompanhamento ao vivo (subagente Frontend)

- [x] 10.1 Em `modules/orders/components/order-tracking.component.tsx`:
  - badge pelo status;
  - indicador "Ao vivo" / "Reconectando…" (oculto em `off`/`closed`), com `prefers-reduced-motion` desligando o pulso;
  - passos com `orderStepState`: concluído com `HH:MM:SS`, atual com "Em andamento…", pendente com "Aguardando";
  - `aria-live="polite"` na lista;
  - destaque breve no passo recém-concluído;
  - mensagem "Pedido entregue às HH:MM. Obrigado por comprar no já já!";
  - comentários atualizados, e continua sem mapa, entregador e ETA.

  Verificar com `npm run lint --workspace=@jaja/frontend`.
- [x] 10.2 Acrescentar `ORDER_STATUS_TRANSITION_INVALID` em `src/shared/i18n/messages.pt.ts` e `messages.en.ts` (ordem alfabética); atualizar `apps/frontend/DESIGN.md` ("Acompanhamento") e `modules/orders/index.ts`. Verificar com `grep -n "ORDER_STATUS_TRANSITION_INVALID" apps/frontend/src/shared/i18n/*.ts` e com a seção do `DESIGN.md`.
- [x] 10.3 Rodar `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend`. Verificar que terminam sem erros e que `/pedidos/<id>/acompanhar` sem sessão continua mostrando "Entre para acompanhar seu pedido." (verificável sem login, pelo servidor de desenvolvimento).

## 11. Conferência no navegador (conversa principal, com o usuário)

- [x] 11.1 **Conferido pelo usuário em 17/09/2026.** Com o backend (fator 1), o broker e o frontend no ar, o usuário entra com o cliente do seed e confirma um pedido. Verificar e registrar com capturas de tela:
  - o acompanhamento mostra "Ao vivo" e os passos avançam sozinhos até "Entregue" em cerca de 20 s, cada um com o horário, sem recarregar;
  - recarregar no meio mantém o passo e continua ao vivo;
  - no Network, a requisição `stream` sem token na URL e com `Authorization`;
  - parar o backend no meio mostra "Reconectando…" e, ao voltar, "Ao vivo" com o passo atualizado;
  - pedido entregue não abre stream;
  - em 375px, sem rolagem horizontal.
