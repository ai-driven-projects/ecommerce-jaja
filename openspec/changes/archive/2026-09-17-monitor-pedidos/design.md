## Context

A motivação e o escopo estão em `proposal.md`. O comportamento está nas specs `orders/order-admin` e `orders/order-monitor` (novas) e nos deltas de `admin/admin-api-authorization` e `admin/admin-area`. O roteiro detalhado é o prompt `openspec/extras/prompts/18-monitor-pedidos.md`. Este é o estado atual relevante, conferido depois da implementação do prompt 17.

**Backend**
- `OrderPrisma` já tem `findOrderCustomerByUserId` e `findMyOrderById` como atributos públicos tipados (leitura CQRS direto para DTO), e `update` grava só status, datas e `updatedAt`.
- `orders` tem `placed_at` e as datas dos passos como `TIMESTAMP(3)` **sem fuso**, gravados em UTC, com os índices `(status, placed_at)` e `(customer_id, placed_at)`.
- `CustomerPrisma` e `text-search.sql.ts` (`folded`, `toPrefixTsQuery`) são o padrão de busca sem `unaccent`. `CustomerController` é o padrão de controller administrativo (`@AdminOnly()`, página com `page`/`pageSize` e teto de 100).
- `OrderLiveUpdates.forOrder(orderId)` filtra `LiveEventFeed.events$` por `payload.aggregateType`/`aggregateId` e junta um `ping` a cada 20 s, que termina quando o feed termina. O tipo `OrderStreamNotice` já existe.
- `MyOrderController` usa `@Sse` `async` com o `JwtGuard` da classe. Conferido no prompt 17: `401`/`404` saem em JSON antes do stream abrir.
- Mensageria:
  - `outbox_events` (`id`, `type`, `aggregate_type`, `aggregate_id`, `payload`, `metadata` com `causationId`/`correlationId`, `status`, `attempts`, `available_at`, `published_at`, `last_error`, `occurred_at`);
  - `processed_messages` (`consumer`, `message_id`, `message_type`, `processed_at`);
  - `EventConsumerRegistry.list()` devolve os consumidores **desta instância** (`name`, `eventType`, `delayMs`). O `MessagingModule` exporta o registro, `DomainEventPrisma`, `LiveEventFeed` e `MESSAGE_PUBLISHER`.

**Frontend**
- `openEventStream({ path, token, onEvent, onStatusChange, onError })`:
  - estados `connecting`/`live`/`reconnecting`/`closed`;
  - reconexão de 1 s a 10 s;
  - parada em `401`/`403`/`404`;
  - `createEventStreamParser` exportado.
- `useMyOrder`:
  - abre o stream do pedido do cliente e relê a cada aviso e a cada `live`, com uma leitura em andamento e uma pendente;
  - expõe `live` (`MyOrderLiveStatus`).

  O indicador "Ao vivo" é uma função **privada** de `order-tracking.component.tsx`.
- `order-status.util.ts`: `ORDER_STATUS_LABEL`, `ORDER_STATUS_BADGE_VARIANT`, `ORDER_STEPS` (com `dateKey`), `orderStepState` e `isOrderFinished`. `order.util.ts`: `formatOrderNumber`, `formatOrderTime` e `formatOrderTimeWithSeconds`.
- Admin:
  - `layout.tsx` passa `ONGOING_ORDERS_COUNT` (23, fixo) como badge;
  - `/admin/orders` renderiza `OrdersDashboardComponent` com `ONGOING_ORDERS` (colunas de entregador e ETA);
  - `AdminDashboardComponent` usa `DASHBOARD_KPIS`, `ONGOING_ORDERS`, `HOURLY_BARS`, `LOW_STOCK_PRODUCTS` e `COURIERS_ONLINE`;
  - `modules/admin/components/order-status.component.tsx` tem `OrderStatusBadge`/`CourierCell` com status de exemplo.
- A spec `admin/admin-area` está desatualizada em relação ao código: ela cita faturamento, produtos ativos e ranking, que não existem. O delta corrige isso.
- Lista administrativa com URL: `use-customers.hook.ts` + `list-query.util.ts` + `PaginationControls`.
- Mensagens: `ORDER_NOT_FOUND` existe; `ADMIN_REQUIRED` é traduzido pela chave existente do auth.

**CLI**
- `db/lib.ts` tem `compose(ctx, args)`, `readDatabaseTarget(ctx)` (usuário e banco do `DATABASE_URL`) e `prisma(ctx, args)`. `ctx.exec` aceita `input`, e `dbReset` mostra o padrão de `confirm`.
- `broker/lib.ts` tem `readBackendEnv`, `readBrokerPorts`, `readBrokerCredentials`, `basicAuthHeader` e `managementQueuesUrl`; `broker:queues` já consulta a API do painel sem expor a senha.

## Goals / Non-Goals

**Goals:**
- Dar ao administrador a mesma visão ao vivo do cliente, mais a visão técnica do fluxo de eventos, só com leituras (nenhuma ação altera pedidos).
- Reaproveitar o que o prompt 17 construiu (feed, stream, `openEventStream`, utilitários de status) sem duplicar lógica.
- Tirar do admin todo dado de exemplo de pedido, sem mexer no que não é pedido.
- Ter um jeito repetível de começar a demonstração do zero.

**Non-Goals:**
- Paginação ou filtro da linha do tempo (um pedido tem 5 eventos).
- Mostrar tentativas com falha e descartes do consumo: eles vivem no broker, e o painel não o consulta.
- Um stream por pedido no admin: o stream administrativo é único e filtrado no navegador.
- Mudar o comportamento do acompanhamento do cliente (só o indicador vira componente compartilhado).

## Decisions

### 1. Quatro etapas sequenciais com contexto limpo
Negócio → Backend → CLI → Frontend, cada uma em um subagente.
- O backend depende do build de `@jaja/orders`.
- O CLI depende das tabelas e dos nomes de filas.
- O frontend depende da API, do stream e do `db:clear-orders` para a limpeza final.

A conferência com duas janelas exige login com senha e fica para a conversa principal: nenhum subagente digita senhas no navegador.

### 2. Leituras administrativas como queries CQRS do módulo, em SQL
`FindOrdersQuery`, `FindOrdersSummaryQuery` e `FindOrderByIdQuery` são interfaces em `modules/orders/src/order/provider/`, implementadas como atributos do `OrderPrisma` com `$queryRaw`, chamadas direto pelo controller e cobertas pelo `.http`, como em clientes. Os cálculos ficam no SQL:
- `itemCount` pela soma de `order_items.quantity`;
- `statusChangedAt = COALESCE(delivered_at, out_for_delivery_at, picking_started_at, payment_approved_at, placed_at)`;
- as agregações do resumo usam `FILTER`.

Alternativa descartada: **casos de uso de leitura** (`find-*`). Não há regra que não caiba em SQL, e o padrão do projeto os evita.

### 3. Busca: número por prefixo, nome por termos sem acento
O número do pedido são os 8 primeiros caracteres do id sem hífens:
- a busca compara `replace(orders.id::text, '-', '')` com `LIKE lower(<texto sem hífens nem espaços>) || '%'` quando o texto só tem caracteres hexadecimais;
- sempre compara o nome com os termos: cada termo do `toPrefixTsQuery`/texto contido em `folded(users.name)`, com `AND` entre termos;
- as duas condições são unidas por `OR`.

Alternativa descartada: **documento tsvector com o número**. O id não se divide bem em palavras, e o prefixo com `LIKE` numa página pequena é suficiente.

### 4. "Hoje" no fuso da operação, calculado no SQL
Constante `OPERATION_TIME_ZONE = 'America/Sao_Paulo'`. Como as colunas são `timestamp` sem fuso em UTC:
- dia local de uma coluna: `((col AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date`;
- hoje: `(now() AT TIME ZONE 'America/Sao_Paulo')::date`.

Alternativa descartada: **calcular início e fim do dia no Node e passar como parâmetros**. Funciona, mas mistura relógios do processo e do banco; no SQL a regra fica num lugar só. O fuso fica fixo nesta versão, sem variável de ambiente.

### 5. Linha do tempo como leitura da infraestrutura (`messaging/monitoring`)
`EventTimelinePrisma.findByAggregate(aggregateType, aggregateId)`:
1. lê os eventos do agregado em `outbox_events`, ordenados por `occurred_at`, `id`;
2. lê as marcas de `processed_messages` desses ids;
3. junta com `EventConsumerRegistry.list()` numa função pura `buildEventTimeline(events, marks, consumers)`.

`state` e `expectedAt` são derivados:
- marca presente → `processed`;
- evento `PENDING` → `event-pending`;
- senão → `waiting`, com `expectedAt = publishedAt + delayMs`.

Consumidores com marca, mas não registrados, entram com `registered: false`. Isso acontece com a simulação desligada nesta instância, ou quando outra instância processou.

Fica fora de `modules/*` porque o domínio não conhece o outbox (decisão dos prompts 14 e 16). O controller do pedido confere o pedido com `findOrderById` antes, para responder `404` como o resto da API.

Alternativas descartadas:
- **Tabela de auditoria de eventos consumidos com falhas:** exigiria mudar o runner e gravar fora da transação que é desfeita. Falhas continuam visíveis no broker e em `broker:queues`.
- **Consultar a API do RabbitMQ:** acopla o painel ao broker e expõe credenciais do painel ao backend.

### 6. Stream administrativo único (`forAll`) e contexto React no layout
`OrderLiveUpdates.forAll()` é `forOrder` sem o filtro de `aggregateId`, extraído para compartilhar o `ping` e o término com o feed. `GET /orders/stream` usa `@Sse` com `@AdminOnly()` na classe.

No navegador, `OrdersLiveProvider` (no `layout.tsx` do admin) abre **uma** conexão por aba e distribui os avisos por `subscribe(listener)`, com um aviso sintético `{ reconnected: true }` quando volta a `live` depois de `reconnecting`. Lista, contador, dashboard e painel se inscrevem.

Alternativas descartadas:
- **Um stream por componente:** duas ou três conexões longas por aba, e o limite de 6 conexões por origem no HTTP/1.1 aparece rápido com várias abas.
- **`GET /orders/:id/stream` para o painel:** mais uma conexão; o filtro por `orderId` no navegador é trivial.

### 7. Releitura coalescida (`useLiveRefetch`)
Cada tela passa `load()` e, opcionalmente, `orderId`. O hook:
- ignora avisos de outros pedidos;
- mantém no máximo uma leitura em andamento e uma pendente;
- relê na reconexão.

É o mesmo algoritmo do `useMyOrder`, extraído para `modules/orders/data`. O `useMyOrder` pode passar a usá-lo se couber sem mudar comportamento; se não couber, fica como está.

Para destacar novidades, os hooks guardam os ids vistos na primeira carga e expõem os que chegaram depois (linhas novas, eventos novos), sem animação com `prefers-reduced-motion`.

### 8. Contagem regressiva e tempos relativos no cliente
"há `X`", "Entregue em `Y`" e a contagem até `expectedAt` usam um relógio de 1 s só enquanto o painel está aberto e só depois da hidratação (padrão de `useClientMinute`, com uma variante por segundo). Diferenças de relógio entre navegador e servidor podem adiantar ou atrasar a contagem em poucos segundos. Por isso, depois de `expectedAt`, o texto vira "processando…", sem número negativo.

### 9. `LiveIndicator` e `OrderStatusBadge` compartilhados
O indicador privado do acompanhamento é extraído para `modules/orders/components/live-indicator.component.tsx`, com o estado `closed` como "Desconectado" no admin. O acompanhamento continua escondendo o indicador em `off`/`closed`, por uma prop. `OrderStatusBadge` usa `ORDER_STATUS_LABEL`/`ORDER_STATUS_BADGE_VARIANT`. O componente de exemplo do admin é removido.

### 10. Dados de exemplo: remover só o que é pedido
Saem de `dashboard.mock.ts` KPIs, status, pedidos, contador e barras por hora, e sai o cartão "Tempo médio por hora" (não há dado real que o sustente com poucos pedidos). Entregadores online e estoque baixo continuam, com `COURIERS_ONLINE` e `LOW_STOCK_PRODUCTS`. A conferência final usa `grep` para garantir que nenhum nome removido ainda é importado.

### 11. `db:clear-orders` com uma única instrução SQL e contagens
A limpeza roda por `docker compose exec -T postgres psql -U <user> -d <db> -At -v ON_ERROR_STOP=1`, com o usuário e o banco de `readDatabaseTarget`. O CLI passa uma **única** instrução com CTEs que apagam e devolvem as contagens:

```sql
WITH order_events AS (SELECT id FROM outbox_events WHERE aggregate_type = 'Order'),
     deleted_marks AS (DELETE FROM processed_messages WHERE message_id IN (SELECT id FROM order_events) RETURNING 1),
     deleted_events AS (DELETE FROM outbox_events WHERE id IN (SELECT id FROM order_events) RETURNING 1),
     deleted_orders AS (DELETE FROM orders RETURNING 1)
SELECT (SELECT count(*) FROM deleted_orders), (SELECT count(*) FROM deleted_events), (SELECT count(*) FROM deleted_marks);
```

Uma instrução é atômica no Postgres, e os itens saem pela FK em cascata. Depois, pela API do painel, o CLI esvazia com `DELETE /api/queues/%2F/<fila>/contents` as filas escolhidas por `queuesToPurge(names)`: prefixo `jaja.`, exceto `jaja.live.*`.

Divergência do prompt, que sugeria `npx prisma db execute --stdin` com `BEGIN`/`COMMIT`: o `prisma db execute` não devolve contagens, e a spec pede que o comando informe quantos pedidos e eventos apagou. `clearOrdersSql()` e `parseClearOrdersOutput(stdout)` são puras e testadas.

Alternativa descartada: **endpoint administrativo de limpeza** no backend. Uma operação destrutiva de ambiente de desenvolvimento não deve existir na API.

## Risks / Trade-offs

- **[Consumidores não registrados na instância que responde (ex.: simulação desligada nela, ou várias instâncias com configurações diferentes)]** → a linha do tempo mostra só quem processou, com `registered: false`, e o texto do painel explica. Em desenvolvimento há uma instância.
- **["Aguardando" não distingue espera de nova tentativa ou descarte]** → a nota do painel aponta para o painel do RabbitMQ e `broker:queues`. Depois de `expectedAt`, o texto vira "processando…" em vez de contar negativo.
- **[Aviso perdido deixa o admin um passo atrás]** → mesma mitigação do cliente: releitura a cada aviso seguinte e a cada reconexão.
- **[Resumo recalculado a cada aviso (várias consultas agregadas por pedido)]** → volume didático pequeno, com índices existentes e releitura coalescida. Se crescer, o contador pode vir de uma consulta mais leve.
- **[`db:clear-orders` com o backend rodando: um consumidor no meio da transação pode gravar evento de pedido já apagado]** → o README recomenda rodar com o backend parado ou sem pedidos em andamento. As mensagens restantes caem em `ORDER_NOT_FOUND` e vão para `.dead`, que o próprio comando esvazia se rodado de novo.
- **[`db:clear-orders` depende do Postgres do Docker Compose (psql no container)]** → é o ambiente do projeto (`jaja-postgres`). Sem o serviço, o comando termina com erro claro, sem apagar nada.
- **[Busca por número com texto hexadecimal curto casa muitos pedidos]** → aceitável: a página é paginada e ordenada, e o nome também entra no `OR`.
- **[Fuso fixo `America/Sao_Paulo`]** → documentado na constante e na spec. Operação em outro fuso fica para depois.
- **[Primeira carga do painel com duas requisições (pedido + eventos)]** → em paralelo, com um só estado de carregamento.

## Migration Plan

1. Nenhuma migration. Implantar backend e frontend juntos: o frontend novo depende de `/orders*`.
2. Rodar `jaja db:clear-orders --yes` (com o backend parado ou sem pedidos em andamento) para começar a demonstração do zero.
3. Abrir o admin numa janela anônima e a loja em outra sessão.

**Rollback:** reverter o código (o admin volta aos dados de exemplo). Não há esquema a desfazer. Pedidos apagados por `db:clear-orders` não voltam: eram dados de demonstração.
