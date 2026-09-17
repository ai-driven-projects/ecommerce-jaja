## Why

O pedido do Jaja já anda sozinho até "Entregue", com eventos reais passando pelo RabbitMQ, e o cliente acompanha cada passo ao vivo (prompt 17). A operação, porém, não enxerga nada disso. A área administrativa mostra pedidos **fixos no frontend** (`dashboard.mock.ts`: a lista `#4211…`, o contador "23" do menu e os indicadores do dashboard), e não há como ver o fluxo orientado a eventos funcionando. Para demonstrar a arquitetura, o administrador precisa de três coisas:
- ver os pedidos reais chegando;
- abrir um pedido e acompanhar, ao vivo, os passos de negócio e a linha do tempo técnica dos eventos (outbox, publicação, consumidores esperando e processando, causa e correlação);
- começar cada demonstração com a lista vazia.

## What Changes

- **API administrativa de pedidos (`@jaja/orders` + `@jaja/backend`), só para administradores:**
  - `GET /orders`: lista paginada, do mais recente para o mais antigo, com filtro por status (ou "em andamento") e busca por número do pedido ou nome do cliente;
  - `GET /orders/summary`: resumo do dia no fuso `America/Sao_Paulo` (pedidos hoje, em andamento, entregues hoje, faturamento, ticket médio, tempo médio até a entrega) e os últimos pedidos em andamento;
  - `GET /orders/:id`: detalhe com cliente (nome, e-mail, telefone), itens, totais e datas dos passos;
  - `GET /orders/:id/events`: linha do tempo dos eventos do pedido, lida das tabelas internas de mensageria (`outbox_events`, `processed_messages`) e dos consumidores registrados. Cada evento traz causa, correlação, situação no outbox e o estado de cada consumidor (processado, aguardando com a hora prevista, ou evento pendente);
  - `GET /orders/stream` (SSE): avisos de qualquer pedido, sem dados do pedido, com sinal de vida.
- **Área administrativa (`@jaja/frontend`):**
  - `/admin/orders`: lista real, com filtros e busca na URL, paginação e atualização ao vivo (linha nova aparece sem recarregar, com destaque);
  - `/admin/orders/:id`: painel do pedido ao vivo, com "Progresso" (passos, horários e duração entre passos), "Cliente e entrega", "Itens" e "Eventos" (a linha do tempo técnica, com contagem regressiva dos consumidores aguardando);
  - uma única conexão SSE por aba do admin, compartilhada por lista, contador do menu, dashboard e painel;
  - contador "Pedidos" no menu com os pedidos em andamento reais;
  - dashboard `/admin` com indicadores reais (pedidos hoje, em andamento, ticket médio hoje, tempo até a entrega) e "Pedidos em andamento" real; sai o cartão "Tempo médio por hora";
  - **BREAKING (visual):** saem os pedidos de exemplo, o contador fixo e os indicadores de exemplo (`dashboard.mock.ts` perde tudo o que é de pedido, e `modules/admin/components/order-status.component.tsx` é removido). Entregadores online e "Estoque baixo" continuam como dados de exemplo;
  - o indicador "Ao vivo" do acompanhamento do cliente vira componente compartilhado (`LiveIndicator`), sem mudar o comportamento.
- **CLI (`@jaja/cli`):** novo `db:clear-orders`, que apaga todos os pedidos, os eventos do outbox deles e as marcas de processamento, e esvazia as filas de pedidos e de inspeção no RabbitMQ, com confirmação e dry-run. Roda no fim da validação, deixando a lista vazia (inclusive sem os 2 pedidos de validações anteriores).
- **Testes:**
  - backend: construção da linha do tempo, filtros HTTP e `forAll`;
  - CLI: SQL e escolha das filas;
  - `.http` da API administrativa.
- Fora do escopo:
  - ações sobre o pedido (cancelar, reprocessar, avançar à mão);
  - leitura do RabbitMQ pelo painel;
  - entregadores, lojas, ETA e mapa;
  - relatórios e filtros por data;
  - alterações em `packages/shared`.

## Capabilities

### New Capabilities

- `orders/order-admin`:
  - API administrativa de lista, resumo, detalhe e stream de pedidos;
  - lista ao vivo em `/admin/orders`;
  - contador de pedidos em andamento no menu;
  - comando `db:clear-orders`.
- `orders/order-monitor`:
  - linha do tempo de eventos do pedido (`GET /orders/:id/events`), com causa, correlação, situação no outbox e estado de cada consumidor;
  - painel `/admin/orders/:id` com progresso, cliente, itens e eventos atualizados ao vivo.

### Modified Capabilities

- `admin/admin-api-authorization`: "Endpoints não administrativos não mudam" deixa de dizer que `GET /orders` não existe e passa a citar `/orders` como administrativo.
- `admin/admin-area`: "Dashboard administrativo inicial" passa a descrever o dashboard real, com indicadores e pedidos em andamento vindos da API e atualizados ao vivo, e dados de exemplo só para entregadores e estoque baixo.

## Impact

- `modules/orders`:
  - `src/order/dto/order.dto.ts`: `OrderListItemDTO`, `OrderStatusFilter`, `OrderFiltersDTO`, `OrderPageDTO`, `OrderAdminDetailDTO` e `OrdersSummaryDTO`;
  - novas queries em `src/order/provider/`: `FindOrdersQuery`, `FindOrdersSummaryQuery` e `FindOrderByIdQuery`;
  - `index.ts`.
- `apps/backend`:
  - pedidos:
    - `src/modules/orders/order.prisma.ts` (três queries em SQL);
    - `order-live-updates.ts` (`forAll`);
    - novos `order-admin-http.ts` e `order-admin.controller.ts`;
    - `orders.module.ts`;
    - novo `test/order-admin.integration.http`;
  - mensageria: novos `src/messaging/monitoring/*` (`EventTimelinePrisma` e `buildEventTimeline`); `messaging.module.ts` e `index.ts`;
  - testes `*.spec.ts`;
  - sem migration: os índices `orders(status, placed_at)` e `orders(customer_id, placed_at)` já existem.
- `apps/cli`: `src/commands/db/db.commands.ts`, `db/lib.ts`, `db/lib.test.ts` e `README.md`.
- `apps/frontend`:
  - novos em `modules/orders`:
    - `data/admin-order.api.ts`, `orders-live.context.tsx`, `use-live-refetch.hook.ts`, `use-orders.hook.ts`, `use-orders-summary.hook.ts` e `use-admin-order.hook.ts`;
    - `components/order-status-badge.component.tsx`, `live-indicator.component.tsx` e `order-monitor.component.tsx`;
    - `pages/order-monitor.page.tsx`;
    - rota `src/app/admin/(shell)/orders/[id]/page.tsx`;
  - alterados:
    - `modules/orders/components/orders-dashboard.component.tsx` e `order-tracking.component.tsx`;
    - `modules/admin/components/admin-dashboard.component.tsx` e `modules/admin/data/dashboard.mock.ts` (e `data/index.ts`);
    - `src/app/admin/(shell)/layout.tsx`;
    - `DESIGN.md`;
  - removido: `modules/admin/components/order-status.component.tsx`.
- Banco local: `db:clear-orders` apaga dados de pedidos (irreversível), só quando rodado.
- Sem mudanças nas rotas `/me/*`, no checkout, no acompanhamento do cliente (além do componente extraído), em `packages/shared` ou no esquema do banco.
