# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Pacote de domínio: `modules/orders` (`@jaja/orders`). Backend: `apps/backend` (NestJS 12, ESM com imports relativos terminando em `.js`, Vitest). Frontend: `apps/frontend` (Next.js 16, React 19, React Compiler). CLI: `apps/cli` (`node:test`). Shared: `@mentoria-360/shared` (submódulo em `packages/shared`). Skills em `.claude/skills/*`; padrão de nomes em `.claude/skills/skills-standards.md`.
- **Pré-requisitos: prompts 14 a 17 já implementados.** O que já existe:
  - o pedido anda sozinho de `PLACED` até `DELIVERED` pelos serviços simulados (`apps/backend/src/modules/orders/simulation/`), com um evento por passo (`order.placed`, `order.payment-approved`, `order.picking-started`, `order.out-for-delivery`, `order.delivered`);
  - todos os eventos de um pedido compartilham o `correlationId` do `order.placed`, e o `causationId` aponta para o evento anterior;
  - o outbox (`outbox_events`) guarda status, tentativas e publicação de cada evento, e `processed_messages` guarda quando cada consumidor processou cada mensagem;
  - o `LiveEventFeed` recebe, por instância, cópia de todos os eventos publicados, e `OrderLiveUpdates.forOrder` alimenta o stream SSE do cliente (`GET /me/orders/:id/stream`);
  - o frontend tem `openEventStream` (`src/shared/util/event-stream.util.ts`), que abre SSE com `fetch` e cabeçalho `Authorization`, e `order-status.util.ts` com rótulos, variantes e passos do pedido.
- **Objetivo:** dar à operação uma visão **ao vivo** dos pedidos reais, para demonstrar a arquitetura orientada a eventos com duas janelas lado a lado: numa janela anônima, o administrador em `/admin/orders`; na janela normal, o cliente comprando na loja. Ao confirmar a compra:
  - o pedido aparece na lista do admin sem recarregar;
  - ao clicar na linha, abre o **painel do pedido**, que mostra, enquanto acontece, os passos do pedido (visão de negócio) e a linha do tempo dos eventos (visão técnica): cada evento com hora, ids, causa e correlação, situação no outbox e os consumidores que o processaram ou ainda estão esperando.
- **Sem pedidos de exemplo:**
  - hoje o admin mostra pedidos **fixos no frontend** (`apps/frontend/src/modules/admin/data/dashboard.mock.ts`: `ONGOING_ORDERS`, o contador `ONGOING_ORDERS_COUNT = 23` do menu e os indicadores do dashboard), e não existem pedidos de seed no banco;
  - esta funcionalidade remove todos os dados de exemplo **de pedidos**: lista, contador do menu, indicadores e "Pedidos em andamento" passam a vir da API;
  - os pedidos criados nas validações dos prompts anteriores são apagados, e a lista começa vazia, só com os pedidos feitos pelo sistema;
  - o comando `db:clear-orders` do CLI permite zerar os pedidos antes de cada demonstração.
- **Propósito didático:** o painel é a "janela" para o fluxo orientado a eventos. Ele mostra:
  - o evento gravado no outbox e depois publicado;
  - o consumidor esperando na fila `.wait` e processando;
  - o novo evento causado por ele, com a mesma correlação.

  Tudo isso é lido das tabelas que a própria infraestrutura já grava. O painel **não** consulta o RabbitMQ.
- **Decisões de arquitetura:**
  - **Leituras em CQRS:**
    - lista, resumo e detalhe administrativos são queries do módulo (`FindOrdersQuery`, `FindOrdersSummaryQuery`, `FindOrderByIdQuery`), implementadas no `OrderPrisma` e chamadas direto pelo controller, sem caso de uso e sem teste unitário (cobertas pelo `.http`);
    - a linha do tempo de eventos é leitura da **infraestrutura** de mensageria (`outbox_events` + `processed_messages` + consumidores registrados), e por isso fica em `apps/backend/src/messaging/monitoring/`, fora de `modules/*`: o domínio continua sem conhecer o outbox.
  - **Um único stream administrativo:**
    - `GET /orders/stream` (só administradores) avisa sobre qualquer pedido;
    - o layout do admin abre **uma** conexão, num contexto React, e a lista, o contador do menu, o dashboard e o painel do pedido se inscrevem nele, filtrando pelo que interessa;
    - o aviso é só um sinal: cada tela relê a API REST, que é a fonte da verdade, com no máximo uma leitura em andamento e uma pendente.
  - **Estado do consumidor derivado do banco:**
    - "processado" quando existe a linha em `processed_messages`;
    - "aguardando" quando o evento já foi publicado e ainda não há linha, com a hora prevista `publishedAt + delayMs` do consumidor registrado;
    - "evento pendente" quando o evento ainda não saiu do outbox;
    - falhas e descartes continuam visíveis no painel do RabbitMQ e em `jaja broker:queues`.
  - **"Hoje"** é o dia no fuso da operação, `America/Sao_Paulo` (constante `OPERATION_TIME_ZONE` no backend), calculado no SQL.
  - **Número do pedido:** continua sendo os 8 primeiros caracteres do id em maiúsculas. A busca aceita esse número ou parte do nome do cliente.
- **Referências de código** (o código é a fonte da verdade do **padrão**; este prompt é a fonte da verdade das **regras**):
  - domínio: `modules/orders/src/order/**` (DTOs, queries em `provider/`, `errors.ts` com `ORDER_STATUSES`) e `modules/customers/src/customer/provider/find-customers.query.ts` + DTOs de página (lista paginada com filtros);
  - backend:
    - `apps/backend/src/modules/customers/customer.controller.ts` e `customer.prisma.ts` (`@AdminOnly()`, paginação, busca e leitura em SQL);
    - `apps/backend/src/modules/orders/` (`order.prisma.ts`, `my-order.controller.ts` com `@Sse`, `order-live-updates.ts`, `simulation/order-simulation.steps.ts`, `orders.module.ts`, `test/order.integration.http`);
    - `apps/backend/src/messaging/` (`consumer/event-consumer.registry.ts`, `outbox/outbox.prisma.ts`, `live/live-event-feed.ts`, `messaging.module.ts`);
    - `apps/backend/src/db/text-search.sql.ts`;
  - frontend:
    - lista administrativa com URL: `modules/customers/data/use-customers.hook.ts`, `modules/customers/pages/customers.page.tsx`, `modules/customers/components/customer-list.component.tsx`, `src/app/admin/(shell)/customers/**` e `src/shared/util/list-query.util.ts`;
    - admin atual: `src/app/admin/(shell)/layout.tsx`, `src/app/admin/(shell)/orders/page.tsx`, `modules/orders/pages/dashboard.page.tsx`, `modules/orders/components/orders-dashboard.component.tsx`, `modules/admin/components/admin-dashboard.component.tsx`, `modules/admin/components/order-status.component.tsx`, `modules/admin/data/dashboard.mock.ts`, `src/shared/navigation/app-modules.ts` (`getAppModuleItemsWithBadges`) e `orders-routes.ts`;
    - pedido ao vivo do cliente: `modules/orders/data/use-my-order.hook.ts`, `order-status.util.ts`, `order.api.ts` e `order-tracking.component.tsx`;
    - componentes: `src/shared/components/ui/*` (`PageSectionHeader`, `TableCard`, `Table`, `PaginationControls`, `MetricCard`, `EmptyListState`, `Badge`) e `src/shared/hooks/use-client-clock.hook.ts`;
  - CLI: `apps/cli/src/commands/db/db.commands.ts` (`dbReset` com `confirm`), `db/lib.ts` (`prisma`, `requireBackend`), `broker/lib.ts` (`readBrokerCredentials`, `readBrokerPorts`, `summarizeQueues`), `broker/broker.commands.ts` (`broker:queues`) e `apps/cli/README.md`.
- Backend é ESM: imports relativos com sufixo `.js`. `@jaja/orders` é consumido via `dist`: rodar `npm run build --workspace=@jaja/orders` antes de usá-lo no backend. O frontend **não importa** os pacotes `@jaja/*`: tipos da API são espelhados em `data/*.api.ts`. Sessão do admin por `useAuth()`; rotas do admin protegidas por `AdminGuard`.
- Spec desta funcionalidade: change `openspec/changes/monitor-pedidos`, gerada a partir deste prompt. Em caso de dúvida sobre comportamento, valem as specs e o `design.md` da change.
- **Fora do escopo desta funcionalidade:**
  - ações do administrador sobre o pedido (cancelar, reprocessar, avançar à mão) e reprocessamento de mensagens descartadas;
  - leitura de filas, contagens ou mensagens do RabbitMQ pelo painel;
  - entregadores, lojas no pedido, ETA, mapa, "Tempo médio por hora" e metas de entrega;
  - dados de exemplo que não são de pedidos: entregadores online, página `/admin/couriers` e "Estoque baixo" continuam como estão;
  - exportação, relatórios e filtros por data;
  - alterações em `packages/shared`.

# Negócio

- DTOs em `modules/orders/src/order/dto/order.dto.ts` (skill: module-dto):
  - `OrderListItemDTO`: `id`, `status`, `customerName`, `deliveryNeighborhood`, `deliveryCity`, `itemCount`, `totalCents`, `placedAt` e `statusChangedAt` (a data do passo mais recente, ou `placedAt`);
  - `OrderStatusFilter` = `OrderStatus | 'IN_PROGRESS'` (`IN_PROGRESS` = qualquer status diferente de `DELIVERED`);
  - `OrderFiltersDTO` (`page`, `pageSize`, `status?`, `search?`) e `OrderPageDTO` (`items`, `total`, `page`, `pageSize`, `totalPages`), no mesmo formato da página de clientes;
  - `OrderAdminDetailDTO`: `OrderDetailDTO` + `customer` (`id`, `name`, `email`, `phone`) + `updatedAt`;
  - `OrdersSummaryDTO`:
    - `placedToday`, `inProgress` e `deliveredToday`;
    - `revenueTodayCents` (soma de `totalCents` dos pedidos de hoje);
    - `averageTicketTodayCents` (`null` sem pedidos hoje);
    - `averageDeliveryMinutesToday` (média de `deliveredAt - placedAt` dos entregues hoje, com uma casa decimal; `null` sem entregas hoje);
    - `latestInProgress` (até 6 `OrderListItemDTO` em andamento, do mais recente para o mais antigo).
- Interfaces de query em `provider/`, com o comportamento no JSDoc (skill: module-query-cqrs, só contrato e DTOs):
  - `find-orders.query.ts`: `FindOrdersQuery.execute(filters: OrderFiltersDTO): Promise<Result<OrderPageDTO>>`:
    - pedidos não excluídos, do mais recente para o mais antigo (`placedAt` desc, `id`);
    - `status` filtra por status ou `IN_PROGRESS`;
    - `search` compara, sem diferenciar maiúsculas nem acentos, o começo do id sem hífens (o número do pedido) e parte do nome do cliente;
  - `find-orders-summary.query.ts`: `FindOrdersSummaryQuery.execute(): Promise<Result<OrdersSummaryDTO>>`, com "hoje" no fuso da operação;
  - `find-order-by-id.query.ts`: `FindOrderByIdQuery.execute(orderId: string): Promise<Result<OrderAdminDetailDTO | null>>`: `null` para pedido inexistente, excluído ou id malformado.
- Exportar os novos DTOs e queries nos `index.ts`. Rodar `npm test --workspace=@jaja/orders` e `npm run build --workspace=@jaja/orders`.

# Backend

- **Banco:** nenhuma migration nova. Os índices `orders(status, placed_at)` e `orders(customer_id, placed_at)` já cobrem a lista.

- **Queries do pedido** em `apps/backend/src/modules/orders/order.prisma.ts`, como atributos públicos tipados, mapeando direto para DTO com `$queryRaw`/`Prisma.sql` (skill: backend-prisma-data):
  - `findOrders: FindOrdersQuery`:
    - `orders` com join em `customers` e `users` (nome);
    - `itemCount` pela soma das quantidades de `order_items`;
    - `statusChangedAt = COALESCE(delivered_at, out_for_delivery_at, picking_started_at, payment_approved_at, placed_at)`;
    - filtro de status e busca como no contrato, reaproveitando `text-search.sql.ts` quando couber, e contagem total para a paginação;
  - `findOrdersSummary: FindOrdersSummaryQuery`: uma consulta com agregações filtradas pelo dia de hoje em `OPERATION_TIME_ZONE = 'America/Sao_Paulo'` (`placed_at` e `delivered_at` são gravados em UTC), mais a lista `latestInProgress`;
  - `findOrderById: FindOrderByIdQuery`: o pedido com itens (por `position`), as datas dos passos, o cliente (`customers.id`, `users.name`, `users.email`, `customers.phone`) e `updatedAt`; id que não é uuid não vai ao banco.

- **Linha do tempo de eventos** em `apps/backend/src/messaging/monitoring/` (arquivos em inglês):
  - `event-timeline.types.ts`:
    - `EventTimelineEntry`: `id`, `type`, `occurredAt`, `payload`, `metadata`, `causationId` e `correlationId` (do `metadata`, ou `null`), `outbox` (`status`, `attempts`, `availableAt`, `publishedAt`, `lastError`) e `consumers: EventTimelineConsumer[]`;
    - `EventTimelineConsumer`: `name`, `delayMs` (`null` quando o consumidor não está registrado nesta instância), `registered`, `processedAt`, `expectedAt` (`publishedAt + delayMs`, ou `null`) e `state`: `'event-pending' | 'waiting' | 'processed'`;
  - `event-timeline.prisma.ts`: `EventTimelinePrisma` (`@Injectable()`), com `PrismaService` e `EventConsumerRegistry`:
    - `findByAggregate(aggregateType, aggregateId): Promise<Result<EventTimelineEntry[]>>`;
    - lê de `outbox_events` os eventos do agregado, ordenados por `occurred_at` e `id`, e as linhas de `processed_messages` desses ids;
    - para cada evento, `consumers` junta os consumidores registrados com `eventType` igual ao `type` (na ordem de registro) e os que já processaram mas não estão registrados (`registered: false`);
    - `state`: `processed` com `processedAt`; `event-pending` quando o evento ainda está `PENDING`; senão `waiting`;
    - `aggregateId` que não é uuid devolve lista vazia sem ir ao banco;
    - comentário: leitura de monitoramento das tabelas internas da mensageria, sem consultar o broker. Falhas e descartes do consumidor não aparecem aqui (estão na `.wait`/`.dead`);
  - registrar `EventTimelinePrisma` no `MessagingModule` (providers e exports) e exportar em `index.ts`;
  - teste `event-timeline.prisma.spec.ts`, com a montagem da linha do tempo extraída numa função pura `buildEventTimeline(rows, processedRows, consumers)` em `event-timeline.builder.ts`:
    - ordem dos eventos;
    - `causationId`/`correlationId` lidos do `metadata`;
    - consumidor processado, aguardando (com `expectedAt`) e com evento pendente;
    - consumidor não registrado que processou;
    - evento sem consumidores.

- **Atualizações ao vivo** em `order-live-updates.ts`: acrescentar `forAll(): Observable<MessageEvent>`, com todos os eventos `aggregateType === 'Order'` no mesmo formato de `forOrder` (`{ orderId, eventType, messageId, occurredAt }`, sem payload) e o mesmo sinal de vida. Acrescentar os casos ao `order-live-updates.spec.ts`.

- Criar `apps/backend/src/modules/orders/order-admin-http.ts`:
  - `toOrderFilters(query)`: `page`/`pageSize` inválidos voltam aos padrões (1 e 20, teto 100), `status` fora de `ORDER_STATUSES` + `IN_PROGRESS` é ignorado e `search` é aparado (vazio é ignorado);
  - teste `order-admin-http.spec.ts`.

- Criar `apps/backend/src/modules/orders/order-admin.controller.ts` (`OrderAdminController`, `@Controller('orders')`, `@AdminOnly()`; `401` sem token e `403 ADMIN_REQUIRED` para quem não é administrador) (skill: backend-controller). Declarar as rotas fixas **antes** de `:id`:
  - `GET /orders`: `findOrders`;
  - `GET /orders/summary`: `findOrdersSummary`;
  - `GET /orders/stream` (`@Sse`): `orderLiveUpdates.forAll()`;
  - `GET /orders/:id`: `findOrderById`, com `404 [ORDER_NOT_FOUND]` quando `null`;
  - `GET /orders/:id/events`: confere o pedido com `findOrderById` (`404` quando `null`) e devolve `eventTimelinePrisma.findByAggregate('Order', id)`;
  - comentar que o stream só avisa e que as telas relêem a API.

  Registrar o controller em `orders.module.ts` e conferir com `curl` que `/orders/stream` sem token responde `401` em JSON e, com token de usuário comum, `403`.

- Criar `apps/backend/src/modules/orders/test/order-admin.integration.http` (Rest Client, estilo de `customer.integration.http`):
  - cabeçalho com os pré-requisitos (backend, Postgres e RabbitMQ no ar e seeds aplicados);
  - login do administrador (`usuario@formacao.dev`) e do cliente do seed (`ana.pereira.carvalho@jaja.dev`, senha `#Senha123`).

  Cenários:
  - **acesso:** `GET /orders`, `/orders/summary`, `/orders/:id` e `/orders/:id/events` sem token (401) e com o token do cliente (403);
  - **fluxo:** o cliente confirma um pedido (`POST /me/orders`, com carrinho montado como em `order.integration.http`);
  - **lista:** `GET /orders` mostra o pedido primeiro, com `customerName`, bairro, `itemCount` e `totalCents`;
  - **filtros:** `status=IN_PROGRESS` inclui o pedido em andamento; `status=DELIVERED` depois da entrega; `search` com o número (8 caracteres, em minúsculas) e com parte do nome do cliente; `status=XYZ` é ignorado;
  - **paginação:** `pageSize=1&page=2`;
  - **detalhe:** `GET /orders/:id` com `customer.email` e as datas dos passos; id malformado e inexistente (404);
  - **eventos:** `GET /orders/:id/events` logo depois da confirmação (só `order.placed`, com `payment.approve-order` em `waiting` e `expectedAt`) e depois da entrega (cinco eventos, quatro consumidores `processed`, a mesma `correlationId` e cada `causationId` apontando para o anterior);
  - **resumo:** `GET /orders/summary` antes e depois (`placedToday`, `inProgress` e `deliveredToday` mudam).

  Subir o backend (`npm run dev --workspace=@jaja/backend`; se a porta 4000 estiver ocupada, usar outra) e validar as chamadas. Acompanhar também `curl -N -H "Authorization: Bearer <token do admin>" .../orders/stream` durante o fluxo: chegam os cinco avisos do pedido.
- Validação: `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` sem erros; `order.integration.http` e `customer.integration.http` continuam passando.

# CLI

- Em `apps/cli/src/commands/db/`, criar o comando `db:clear-orders` ("Limpar pedidos"), no menu `db`, com keywords `pedidos`, `orders`, `limpar` e `demo`:
  - pede confirmação ("Isso apaga TODOS os pedidos, os eventos deles e as mensagens nas filas. Continuar?"), assumida com `--yes`;
  - em dry-run, só lista o que faria;
  - apaga, numa única transação SQL executada com `npx prisma db execute --stdin` (via `prisma` de `db/lib.ts`):
    1. de `processed_messages`, as linhas cujo `message_id` é de um evento com `aggregate_type = 'Order'`;
    2. de `outbox_events`, os eventos com `aggregate_type = 'Order'`;
    3. de `orders`, todos os pedidos (os itens saem em cascata);
  - depois, com o RabbitMQ no ar, esvazia pela API do painel (`DELETE /api/queues/%2F/<fila>/contents`, credenciais de `readBrokerCredentials`, nunca exibidas) as filas que começam com `jaja.`, exceto as `jaja.live.*`: as dos consumidores, suas `.wait` e `.dead` e a fila de inspeção. Assim, nenhuma mensagem antiga chega a um pedido apagado. Broker fora do ar → aviso, sem erro (os pedidos já foram apagados);
  - mostra quantos pedidos e eventos foram apagados e quantas filas foram esvaziadas;
  - a SQL e a escolha das filas ficam em funções puras de `db/lib.ts` (`clearOrdersSql()`, `queuesToPurge(names)`), com testes em `db/lib.test.ts`: a SQL tem as três remoções na ordem, dentro de `BEGIN`/`COMMIT`, e as filas `jaja.live.*` e as sem prefixo `jaja.` ficam de fora;
  - recomendar no README rodar o comando com o backend parado ou sem pedidos em andamento.
- Atualizar `apps/cli/README.md` com `db:clear-orders`.
- Validação: `npm test --workspace=@jaja/cli` e `npm run build --workspace=@jaja/cli` sem erros; `npm run cli -- db:clear-orders --dry-run` só lista, sem apagar.

# Frontend

- **Stream administrativo** em `apps/frontend/src/modules/orders/data/`:
  - `admin-order.api.ts`: tipos espelhando os DTOs e as funções sobre `apiRequest`:
    - tipos: `OrderListItem`, `OrderStatusFilter`, `OrderPage`, `OrderAdminDetail`, `OrdersSummary`, `EventTimelineEntry`, `EventTimelineConsumer` (datas em ISO);
    - funções: `listOrders(token, filters)`, `getOrdersSummary(token)`, `getOrder(token, id)` (`null` no 404 `ORDER_NOT_FOUND`), `getOrderEvents(token, id)`;
    - `ORDERS_STREAM_PATH = '/orders/stream'`;
  - `orders-live.context.tsx`: `OrdersLiveProvider` e `useOrdersLive()`:
    - com sessão de administrador, abre **uma** conexão `openEventStream(ORDERS_STREAM_PATH)`;
    - expõe `status` (`connecting`, `live`, `reconnecting`, `closed`) e `subscribe(listener): () => void`, que recebe `{ orderId, eventType, messageId, occurredAt }` de cada aviso e também um aviso sintético `{ reconnected: true }` quando o stream volta a `live` depois de `reconnecting`;
    - fecha ao sair da sessão;
  - `use-live-refetch.hook.ts`: `useLiveRefetch(load, { orderId? })` relê com `load()` a cada aviso (só do `orderId`, quando informado) e a cada reconexão, com no máximo uma leitura em andamento e uma pendente;
  - `use-orders.hook.ts`: lista com o estado na URL (`page`, `status`, `search`), no padrão de `use-customers.hook.ts` (busca com ~300 ms de espera, voltando à primeira página), relida ao vivo com `useLiveRefetch`. Expõe os ids que apareceram depois da primeira carga, para destacar as linhas novas;
  - `use-orders-summary.hook.ts`: `getOrdersSummary` relido ao vivo;
  - `use-admin-order.hook.ts`: `getOrder` + `getOrderEvents` em paralelo, relidos ao vivo com o `orderId`, expondo `order`, `events`, `loading`, `notFound` e os ids de eventos novos desde a primeira carga;
  - atualizar `data/index.ts`.

- **Componentes do pedido** em `apps/frontend/src/modules/orders/components/`:
  - `order-status-badge.component.tsx`: `OrderStatusBadge({ status })` com `ORDER_STATUS_LABEL` e `ORDER_STATUS_BADGE_VARIANT` (do prompt 17);
  - `live-indicator.component.tsx`: `LiveIndicator({ status })`:
    - "Ao vivo" com bolinha verde pulsando em `live`;
    - "Reconectando…" em cinza em `connecting`/`reconnecting`;
    - "Desconectado" em `closed`;
    - `prefers-reduced-motion` desliga o pulso.

    O acompanhamento do cliente passa a usar o mesmo componente;
  - **lista** (`orders-dashboard.component.tsx`, reescrito):
    - `PageSectionHeader` "Pedidos" com o subtítulo "`N` pedido(s) · `M` em andamento" e o `LiveIndicator` nas ações;
    - chips de status: Todos, Em andamento, Pedido recebido, Pagamento aprovado, Separando na loja, A caminho, Entregue;
    - busca "Buscar por número ou cliente";
    - tabela em `TableCard` com as colunas:
      - Pedido (`#` + número, em negrito);
      - Cliente;
      - Destino (bairro · cidade · `N` itens);
      - Status (`OrderStatusBadge`);
      - Atualizado (`HH:MM:SS` de `statusChangedAt`);
      - Total;
    - linhas:
      - a linha inteira leva ao painel `/admin/orders/<id>`: link no número, clique na linha e acessível por teclado;
      - linha nova aparece com um destaque breve em `bg-brand-soft`, e a mudança de status destaca a célula de status;
    - `PaginationControls`;
    - estado vazio sem filtros: "Nenhum pedido ainda." com "Os pedidos feitos na loja aparecem aqui na hora, sem recarregar.";
    - estado vazio com filtros: "Nenhum pedido encontrado." com o link "Limpar filtros";
    - carregamento com linhas `bg-surface`;
  - **painel do pedido** (`order-monitor.component.tsx`, com `order-monitor.page.tsx` em `pages/` e a rota `src/app/admin/(shell)/orders/[id]/page.tsx`):
    - cabeçalho:
      - link "← Pedidos" de volta para a lista (preservando a query);
      - título "Pedido #`número`" com `OrderStatusBadge` e `LiveIndicator`;
      - subtítulo "Feito às HH:MM:SS · há `X`" (tempo decorrido atualizado a cada segundo, só depois da hidratação) e, quando entregue, "Entregue em `Y`" (duração de `placedAt` a `deliveredAt`, ex.: "21 s" ou "3 min 12 s");
    - grade de duas colunas no desktop (uma no mobile). Coluna da esquerda:
      - **"Progresso"**:
        - os cinco passos com `orderStepState`, cada um concluído com `HH:MM:SS` e a duração desde o passo anterior ("+3,2 s");
        - o passo atual com "Em andamento…" pulsando;
        - pendentes com "Aguardando";
      - **"Cliente e entrega"**: nome, e-mail, telefone formatado, endereço copiado, quem recebe e instruções;
      - **"Itens"**: miniatura, nome, quantidade e total da linha; subtotal, entrega e total;
    - coluna da direita, mais larga, **"Eventos"**:
      - no topo, a `correlationId` abreviada (8 caracteres, com o id completo no `title`) e a quantidade de eventos;
      - uma linha do tempo vertical em ordem cronológica. Cada evento é um cartão com:
        - o `type` em fonte mono;
        - a hora `HH:MM:SS.mmm`;
        - o `messageId` abreviado;
        - "causado por `abcd1234`", com link âncora para o cartão do evento anterior, quando houver;
        - a situação no outbox: "Publicado às HH:MM:SS.mmm", ou "Pendente", com tentativas e o último erro quando houver;
        - a lista de consumidores:
          - `processed`: nome em mono + "Processado às HH:MM:SS" em verde;
          - `waiting`: "Aguardando · espera de 3 s", com a contagem regressiva até `expectedAt` e depois "processando…", em âmbar pulsando;
          - `event-pending`: "Aguardando publicação";
          - `registered: false`: a marca "não registrado nesta instância";
        - um `<details>` "Payload e metadata" com o JSON formatado;
      - evento novo entra com destaque breve;
      - com `prefers-reduced-motion`, sem animações;
      - nota discreta no rodapé do cartão: "Atualizado pelos eventos que chegam do RabbitMQ. Falhas e descartes: painel do RabbitMQ ou `jaja broker:queues`.";
    - pedido inexistente: "Pedido não encontrado." com o link "Voltar para os pedidos";
    - `generateMetadata` da rota: título `Pedido #<número> — Operação`;
  - remover `modules/admin/components/order-status.component.tsx` (`OrderStatusBadge` e `CourierCell` com status de exemplo) e os usos.

- **Admin sem pedidos de exemplo:**
  - `src/app/admin/(shell)/layout.tsx`:
    - envolve o shell com `OrdersLiveProvider`;
    - o contador de "Pedidos" no menu vem de `useOrdersSummary().summary.inProgress`, oculto quando é 0 ou enquanto carrega;
  - `modules/admin/components/admin-dashboard.component.tsx`:
    - os quatro indicadores vêm do resumo:
      - "Pedidos hoje" (`placedToday`, com "`deliveredToday` entregues" abaixo);
      - "Em andamento" (`inProgress`);
      - "Ticket médio hoje" (`averageTicketTodayCents`, ou "—");
      - "Tempo até a entrega" (`averageDeliveryMinutesToday` em "`X` min", "`Y` s" abaixo de 1 min, ou "—");
    - "Pedidos em andamento" mostra `latestInProgress` com as colunas Pedido, Cliente, Destino, Status e Atualizado:
      - linhas levam ao painel, e "Ver todos" leva à lista;
      - vazio: "Nenhum pedido em andamento agora.";
      - `LiveIndicator` no título;
    - remover o cartão "Tempo médio por hora" ("Pedidos em andamento" ocupa a largura toda);
    - entregadores online e "Estoque baixo" continuam como estão;
    - "Operação normal" fica como está;
  - `modules/admin/data/dashboard.mock.ts`: remover tudo o que é de pedido:
    - `DashboardKpi`, `DeltaTone` (se ficar sem uso), `OrderStatus`, `OngoingOrder` e `HourlyBar`;
    - `ORDERS_TODAY`, `REVENUE_TODAY_CENTS`, `AVERAGE_DELIVERY_MINUTES`, `ON_TIME_RATE`, `DELIVERY_TARGET_MINUTES`, `DASHBOARD_KPIS`, `ORDER_STATUS_LABEL`, `ONGOING_ORDERS`, `ONGOING_ORDERS_COUNT` e `HOURLY_BARS`;

    Mantém só o que o dashboard ainda usa (estoque baixo e entregadores). Atualizar o comentário do arquivo e `data/index.ts`, e conferir com `grep` que não sobra import dos nomes removidos;
  - `src/app/admin/(shell)/orders/page.tsx` e `modules/orders/pages/dashboard.page.tsx` continuam como ponto de entrada da lista (com `Suspense` para o `useSearchParams`, como em clientes).
- **Mensagens:** conferir que `ORDER_NOT_FOUND` e `ADMIN_REQUIRED` já existem em `messages.pt.ts`/`messages.en.ts`; acrescentar o que faltar, na ordem alfabética.
- **Design:** atualizar `apps/frontend/DESIGN.md` ("Área administrativa"):
  - indicadores e "Pedidos em andamento" reais, sem "Tempo médio por hora";
  - lista de pedidos ao vivo;
  - painel do pedido com "Progresso", "Cliente e entrega", "Itens" e "Eventos";
  - `LiveIndicator`.
- Atualizar `apps/frontend/src/modules/orders/index.ts` com o que for novo e público.

- Validação: `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` sem erros. Com o backend e o broker no ar, `ORDER_SIMULATION_DELAY_FACTOR=1`, conferir no navegador **com duas sessões separadas** (uma aba anônima ou outro perfil para o admin):
  - admin (`usuario@formacao.dev`) em `/admin/orders`, com "Ao vivo" e a lista vazia depois de `db:clear-orders`;
  - cliente (`ana.pereira.carvalho@jaja.dev`) confirma um pedido na loja: a linha aparece no admin **sem recarregar**, com destaque, e o contador do menu vira 1;
  - clicar na linha abre o painel:
    - `order.placed` publicado, com `payment.approve-order` aguardando e contando a espera;
    - em cerca de 20 s, os cinco eventos aparecem um a um, cada consumidor passa a "Processado", e cada evento mostra "causado por" o anterior e a mesma correlação;
    - os passos concluem com horários e durações, e o pedido termina "Entregue em ~20 s";
    - ao mesmo tempo, o acompanhamento do cliente avança igual;
  - o dashboard `/admin` mostra os indicadores de hoje e o pedido em andamento, que some ao ser entregue;
  - parar o backend: o admin mostra "Reconectando…" e, ao subir de novo, volta a "Ao vivo" com os dados atualizados;
  - filtros e busca da lista mantêm o estado na URL (recarregar reproduz);
  - usuário comum logado não entra no admin (`AdminGuard`), e a API responde 403;
  - mobile (375px): lista e painel sem rolagem horizontal da página (a tabela rola dentro do cartão).
- **Limpeza final:** depois das validações, rodar `npm run cli -- db:clear-orders --yes` e conferir `/admin/orders` vazio, com o contador do menu oculto e os indicadores zerados, e `SELECT count(*) FROM orders` = 0. Isso remove também os pedidos criados nas validações dos prompts anteriores.

- **Specs da change:**
  - nova capability `orders/order-admin`:
    - API administrativa de pedidos (`GET /orders`, `/orders/summary`, `/orders/:id`, `/orders/stream`), com filtros, busca, paginação, resumo do dia no fuso da operação e o stream de avisos sem dados do pedido;
    - lista ao vivo em `/admin/orders`;
    - contador do menu e dashboard com dados reais;
    - comando `db:clear-orders`;
  - nova capability `orders/order-monitor`:
    - `GET /orders/:id/events` com a linha do tempo (eventos do outbox, causa, correlação, situação de publicação e estado de cada consumidor derivado de `processed_messages` e dos consumidores registrados);
    - painel `/admin/orders/:id` com progresso, cliente, itens e eventos atualizados ao vivo;
  - em `admin/admin-api-authorization`: alterar "Endpoints não administrativos não mudam", tirando "O endpoint de exemplo `GET /orders` deixa de existir" e citando que `/orders` passa a ser administrativo, enquanto `/me/orders` continua exigindo só token válido;
  - em `admin/admin-area`: alterar "Dashboard administrativo inicial". Os indicadores (pedidos hoje, em andamento, ticket médio hoje, tempo até a entrega) e "Pedidos em andamento" passam a vir da API e se atualizam ao vivo; entregadores online e estoque baixo continuam como dados de exemplo. O texto passa a descrever o dashboard real: o "faturamento do dia", os "produtos ativos" e o "ranking de produtos mais vendidos" citados hoje na spec não existem no código e saem do requisito, e o "Tempo médio por hora" é removido.

> Obs: IMPORTANTE!!! Executar as quatro partes (Negócio, Backend, CLI e Frontend) em subagentes separados, cada um com contexto limpo, de forma sequencial:
> - o Backend depende do build de `@jaja/orders`;
> - o CLI depende dos nomes das filas e tabelas;
> - o Frontend depende da API, do stream e do `db:clear-orders`.
>
> Antes de começar, conferir que o prompt 17 está implementado (`simulation/`, `OrderLiveUpdates`, `LiveEventFeed`, `openEventStream` e `order-status.util.ts`); se não estiver, parar e reportar.
>
> Cada subagente deve ler `.claude/skills/skills-standards.md` e, antes de criar seus arquivos, as referências de código da sua camada listadas no Contexto. O princípio de leitura em CQRS do Contexto prevalece sobre o workflow da skill `module-query-cqrs`. Também:
> - o do backend não mata backends já rodando (usa outra porta se a 4000 estiver ocupada) e deixa o seed como estava;
> - o do frontend lê também `apps/frontend/DESIGN.md` e executa a **Limpeza final**;
> - nenhum subagente altera `packages/shared`;
> - a conferência com duas janelas (admin e cliente ao mesmo tempo) é repetida na conversa principal, com o usuário.
>
> Uma parte só começa depois de a anterior terminar com as validações passando, e cada subagente encerra listando os arquivos criados ou alterados e o resultado das validações.
