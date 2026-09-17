> **Execução:** quatro subagentes separados, cada um com contexto limpo, **nessa ordem**:
> - **Negócio:** grupo 1;
> - **Backend:** grupos 2–4;
> - **CLI:** grupo 5;
> - **Frontend:** grupos 6–9.
>
> Um grupo só começa depois de o anterior terminar com as validações passando. O grupo 10 é da conversa principal, com o usuário.
>
> **Antes de começar:** conferir que o prompt 17 está implementado (`apps/backend/src/modules/orders/simulation/`, `order-live-updates.ts`, `apps/backend/src/messaging/live/live-event-feed.ts`, `apps/frontend/src/shared/util/event-stream.util.ts` e `apps/frontend/src/modules/orders/data/order-status.util.ts`). Se não estiver, parar e reportar.
>
> **Leitura prévia de cada subagente:**
> - todos: `.claude/skills/skills-standards.md`, o prompt `openspec/extras/prompts/18-monitor-pedidos.md`, o `design.md` e as specs desta change, e as referências de código da sua camada listadas no Contexto do prompt;
> - Frontend, além disso: `apps/frontend/DESIGN.md`.
>
> O princípio de leitura em CQRS do prompt prevalece sobre o workflow da skill `module-query-cqrs`.
>
> **Restrições:**
> - não alterar `packages/shared`;
> - não fazer commit nem operações git que mudem o working tree, e não tocar em alterações de outras frentes;
> - não matar backends nem frontends que já estejam rodando: usar outra porta se a ocupada for do usuário;
> - deixar o seed como estava e apagar os pedidos de teste criados (até o grupo 10);
> - não digitar senhas em formulários do navegador: tokens de teste são obtidos por `curl` na API de login.
>
> Cada subagente encerra listando os arquivos criados/alterados e o resultado das validações.

## 1. DTOs e queries administrativas (subagente Negócio)

- [x] 1.1 Em `modules/orders/src/order/dto/order.dto.ts` (skill `module-dto`), criar os DTOs do prompt:
  - `OrderListItemDTO`, `OrderStatusFilter`, `OrderFiltersDTO` e `OrderPageDTO`;
  - `OrderAdminDetailDTO` (`OrderDetailDTO` + `customer` + `updatedAt`);
  - `OrdersSummaryDTO`.

  Cada um com comentários sobre a origem e a regra de cada campo. Verificar com `npx tsc --noEmit -p modules/orders`.
- [x] 1.2 Criar em `modules/orders/src/order/provider/` as interfaces `find-orders.query.ts` (`FindOrdersQuery`), `find-orders-summary.query.ts` (`FindOrdersSummaryQuery`) e `find-order-by-id.query.ts` (`FindOrderByIdQuery`), com o comportamento no JSDoc (ordenação, filtros, busca, fuso da operação, `null` para inexistente ou malformado). Exportar nos `index.ts`. Verificar com `npm test --workspace=@jaja/orders` e `npm run build --workspace=@jaja/orders` sem erros.

## 2. Queries do pedido e linha do tempo (subagente Backend)

- [x] 2.1 Em `apps/backend/src/modules/orders/order.prisma.ts` (skill `backend-prisma-data`), implementar `findOrders`, `findOrdersSummary` e `findOrderById` com `$queryRaw`/`Prisma.sql`, conforme as Decisões 2–4:
  - `statusChangedAt` com `COALESCE`;
  - `itemCount` pela soma;
  - busca por número (prefixo hexadecimal) `OR` nome (`folded`, termos com `AND`);
  - "hoje" com `OPERATION_TIME_ZONE = 'America/Sao_Paulo'` a partir de colunas UTC;
  - `latestInProgress` com até 6;
  - id malformado sem ir ao banco.

  Verificar com `npx tsc --noEmit -p apps/backend` e com o `.http` da tarefa 4.2.
- [x] 2.2 Criar `apps/backend/src/messaging/monitoring/event-timeline.types.ts`, `event-timeline.builder.ts` (`buildEventTimeline`, função pura) e `event-timeline.prisma.ts` (`EventTimelinePrisma.findByAggregate`), conforme a Decisão 5, com o comentário de que é leitura de monitoramento sem broker. Registrar no `MessagingModule` (providers e exports) e exportar em `index.ts`. Verificar com `event-timeline.builder.spec.ts`:
  - ordem por `occurredAt` e `id`;
  - `causationId`/`correlationId` do `metadata` (ausentes → `null`);
  - consumidor `processed`, `waiting` com `expectedAt = publishedAt + delayMs` e `event-pending`;
  - consumidor sem `delayMs` → `expectedAt` `null`;
  - consumidor não registrado com marca → `registered: false`;
  - evento sem consumidores;
  - consumidores na ordem de registro.
- [x] 2.3 Em `apps/backend/src/modules/orders/order-live-updates.ts`, acrescentar `forAll()` (Decisão 6), reaproveitando o `ping` e o término do `forOrder`. Verificar com os casos novos em `order-live-updates.spec.ts`:
  - avisos de pedidos diferentes;
  - outros agregados ignorados;
  - sem payload;
  - `ping`;
  - término com o feed.

  Os casos existentes continuam passando.

## 3. Controller administrativo (subagente Backend)

- [x] 3.1 Criar `apps/backend/src/modules/orders/order-admin-http.ts` com `toOrderFilters(query)` e `throwOrderAdminFailure` (se não couber reaproveitar `throwOrderFailure`). Verificar com `order-admin-http.spec.ts`:
  - padrões 1/20;
  - teto 100;
  - `page` 0, texto e decimal viram padrão;
  - cada status e `IN_PROGRESS` aceitos;
  - `XYZ` ignorado;
  - `search` aparado, e vazio ignorado.
- [x] 3.2 Criar `apps/backend/src/modules/orders/order-admin.controller.ts` (`OrderAdminController`, `@Controller('orders')`, `@AdminOnly()`), com a skill `backend-controller`:
  - rotas fixas antes de `:id`: `GET /orders`, `/orders/summary`, `/orders/stream` (`@Sse`, `forAll`), `/orders/:id` (`404 [ORDER_NOT_FOUND]`) e `/orders/:id/events` (confere o pedido, depois `findByAggregate('Order', id)`);
  - comentário sobre o stream ser só aviso;
  - registrar em `orders.module.ts`.

  Verificar contra um backend próprio numa porta livre:
  - `curl -i .../orders/stream` sem token → `401` JSON;
  - com o token da cliente do seed → `403` JSON com `ADMIN_REQUIRED`;
  - com o token do admin (`usuario@formacao.dev`) → `200 text/event-stream`;
  - `GET /orders/summary` não cai em `:id`.
- [x] 3.3 Rodar `npm run test --workspace=@jaja/backend` e `npm run lint --workspace=@jaja/backend`. Verificar que terminam sem erros, com os specs existentes passando.

## 4. Integração e validação do backend (subagente Backend)

- [x] 4.1 Rodar `npm run build --workspace=@jaja/backend`. Verificar sem erros.
- [x] 4.2 Criar `apps/backend/src/modules/orders/test/order-admin.integration.http` com os pré-requisitos, os logins e os cenários do prompt:
  - acesso (401/403);
  - fluxo;
  - lista;
  - filtros (`IN_PROGRESS`, `DELIVERED`, número em minúsculas, nome, `XYZ`);
  - paginação;
  - detalhe (com `customer.email` e datas; malformado e inexistente 404);
  - eventos (logo depois: `order.placed` com `payment.approve-order` `waiting` e `expectedAt`; depois da entrega: cinco eventos, quatro `processed`, correlação e causa encadeadas);
  - resumo antes e depois.

  Executar as chamadas por `curl` contra um backend próprio (fator 1), acompanhando `curl -N` em `/orders/stream` com o token do admin. Verificar:
  - todos os cenários respondem como descrito;
  - o stream recebe os avisos do pedido;
  - `order.integration.http` e `customer.integration.http` continuam passando.

  Registrar o id do pedido e as respostas principais. Apagar os pedidos de teste ao final (marcas, eventos e pedido).

## 5. Comando `db:clear-orders` (subagente CLI)

- [x] 5.1 Em `apps/cli/src/commands/db/lib.ts`, criar `clearOrdersSql()`, `parseClearOrdersOutput(stdout)` e `queuesToPurge(names)` (Decisão 11). Verificar com `db/lib.test.ts` (`node:test`):
  - a SQL é uma única instrução com as CTEs na ordem marcas → eventos → pedidos e o `SELECT` das três contagens, filtrando `aggregate_type = 'Order'`;
  - o parser lê `3|15|12` como `{ orders: 3, events: 15, marks: 12 }` e falha em saída inesperada;
  - `queuesToPurge` mantém `jaja.payment.approve-order`, `.wait`, `.dead` e `jaja.events.all`, e exclui `jaja.live.host.1.abc` e filas sem prefixo `jaja.`.
- [x] 5.2 Em `apps/cli/src/commands/db/db.commands.ts`, criar `db:clear-orders` ("Limpar pedidos", keywords `pedidos`, `orders`, `limpar` e `demo`), registrado no menu `db`:
  - `confirm` com o texto do prompt, assumido com `--yes`;
  - dry-run listando a SQL e as filas, sem executar;
  - execução por `compose(ctx, ['exec', '-T', 'postgres', 'psql', '-U', <user>, '-d', <db>, '-At', '-v', 'ON_ERROR_STOP=1'])` com a SQL como `input`, e erro claro se falhar;
  - lista das filas pela API do painel (reaproveitando `readBackendEnv`, `readBrokerPorts`, `readBrokerCredentials`, `basicAuthHeader` e `managementQueuesUrl`) e `DELETE /api/queues/%2F/<fila>/contents` para cada uma de `queuesToPurge`;
  - broker fora do ar → `warn`, sem erro;
  - resumo "`N` pedido(s), `M` evento(s) e `K` marca(s) apagados · `Q` fila(s) esvaziada(s)";
  - nenhuma saída com a senha.

  Verificar com `npm test --workspace=@jaja/cli` (inclusive `index.test.ts`) e `npm run build --workspace=@jaja/cli`.
- [x] 5.3 Atualizar `apps/cli/README.md` com `db:clear-orders` e a recomendação de rodar com o backend parado ou sem pedidos em andamento. Verificar com `grep -n "db:clear-orders" apps/cli/README.md`.
- [x] 5.4 Validar em headless:
  1. `npm run cli -- db:clear-orders --dry-run` só lista e não muda `SELECT count(*) FROM orders`;
  2. com um pedido de teste criado pela API (backend próprio, fator 0) e o broker no ar, `npm run cli -- db:clear-orders --yes` informa as contagens, e depois `orders`, `order_items`, os eventos `Order` e as marcas desses eventos ficam em 0, com `customers`, `products`, `carts` e `users` com as mesmas contagens de antes;
  3. as filas de pedidos e `jaja.events.all` com 0 mensagens pela API do painel, e a `jaja.live.*` intacta;
  4. com o broker parado, o comando termina com aviso e apaga os dados; subir o broker de novo e deixá-lo saudável.

  Registrar as saídas sem a senha.

## 6. Dados e stream administrativo no frontend (subagente Frontend)

- [x] 6.1 Criar `apps/frontend/src/modules/orders/data/admin-order.api.ts`:
  - tipos `OrderListItem`, `OrderStatusFilter`, `OrderPage`, `OrderAdminDetail`, `OrdersSummary`, `EventTimelineEntry` e `EventTimelineConsumer`;
  - funções `listOrders`, `getOrdersSummary`, `getOrder` (`null` no 404 `ORDER_NOT_FOUND`) e `getOrderEvents`;
  - `ORDERS_STREAM_PATH`.

  Verificar com `npx tsc --noEmit -p apps/frontend`.
- [x] 6.2 Criar `orders-live.context.tsx` (`OrdersLiveProvider`, `useOrdersLive`) e `use-live-refetch.hook.ts` (`useLiveRefetch`), conforme as Decisões 6 e 7: uma conexão por aba, `subscribe`, aviso de reconexão e coalescência. Verificar com `npm run lint --workspace=@jaja/frontend` e com um script temporário no scratchpad que use `openEventStream` contra `/orders/stream` com o token do admin e receba os avisos de um pedido de teste.
- [x] 6.3 Criar `use-orders.hook.ts` (URL: `page`, `status`, `search` com ~300 ms; ids novos), `use-orders-summary.hook.ts` e `use-admin-order.hook.ts` (pedido e eventos em paralelo; `notFound`; ids de eventos novos), todos relidos ao vivo. Atualizar `data/index.ts`. Verificar com `npm run lint --workspace=@jaja/frontend`.

## 7. Componentes, lista e painel (subagente Frontend)

- [x] 7.1 Extrair `LiveIndicator` de `order-tracking.component.tsx` para `modules/orders/components/live-indicator.component.tsx` ("Desconectado" em `closed`, com prop para ocultar em `off`/`closed`) e criar `order-status-badge.component.tsx`. O acompanhamento passa a usar o componente sem mudar o comportamento. Verificar com `npm run lint --workspace=@jaja/frontend` e confirmando que `/pedidos/<id>/acompanhar` sem sessão continua igual.
- [x] 7.2 Reescrever `modules/orders/components/orders-dashboard.component.tsx` como a lista ao vivo do prompt:
  - cabeçalho com contagens e `LiveIndicator`;
  - chips e busca;
  - tabela com as seis colunas;
  - linha inteira clicável e acessível por teclado;
  - destaques;
  - paginação;
  - estados vazio, sem resultado e carregando.

  Manter `Suspense` na página. Verificar com `npm run lint --workspace=@jaja/frontend`.
- [x] 7.3 Criar `modules/orders/components/order-monitor.component.tsx`, `modules/orders/pages/order-monitor.page.tsx` e `src/app/admin/(shell)/orders/[id]/page.tsx` (com `generateMetadata` "Pedido #`número` — Operação"), com o cabeçalho, "Progresso", "Cliente e entrega", "Itens", "Eventos" e a nota do prompt (Decisão 8 para os relógios). Verificar com `npm run lint --workspace=@jaja/frontend`.

## 8. Admin sem pedidos de exemplo (subagente Frontend)

- [x] 8.1 Em `src/app/admin/(shell)/layout.tsx`, envolver com `OrdersLiveProvider` e usar `inProgress` do resumo como badge de "Pedidos" (oculto em 0 ou carregando). Em `modules/admin/components/admin-dashboard.component.tsx`:
  - indicadores reais;
  - "Pedidos em andamento" com `latestInProgress`, linhas para o painel, estado vazio e `LiveIndicator`;
  - remover "Tempo médio por hora";
  - manter entregadores e estoque baixo.

  Verificar com `npm run lint --workspace=@jaja/frontend`.
- [x] 8.2 Remover de `modules/admin/data/dashboard.mock.ts` tudo o que é de pedido (lista do prompt), atualizar `data/index.ts` e apagar `modules/admin/components/order-status.component.tsx`. Verificar com `grep -rn "ONGOING_ORDERS\|DASHBOARD_KPIS\|HOURLY_BARS\|ORDERS_TODAY\|DELIVERY_TARGET_MINUTES\|order-status.component\|CourierCell" apps/frontend/src`, que não encontra nada.

## 9. Documentação e validação do frontend (subagente Frontend)

- [x] 9.1 Conferir as mensagens `ORDER_NOT_FOUND` e a de administrador obrigatório em `messages.pt.ts`/`messages.en.ts` (acrescentar o que faltar), atualizar `apps/frontend/DESIGN.md` ("Área administrativa") e `modules/orders/index.ts`. Verificar com a seção do `DESIGN.md` e `grep` nas mensagens.
- [x] 9.2 Rodar `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend`. Verificar que terminam sem erros e que `/admin/orders` e `/admin/orders/<id>` sem sessão redirecionam para `/admin/login` (sem login, pelo servidor de desenvolvimento já rodando).
- [x] 9.3 **Limpeza final:** rodar `npm run cli -- db:clear-orders --yes`. Verificar:
  - `SELECT count(*) FROM orders` = 0;
  - nenhum evento `Order` no outbox;
  - as filas de pedidos vazias.

## 10. Conferência com duas janelas (conversa principal, com o usuário)

- [x] 10.1 **Conferido pelo usuário em 17/09/2026.** Com o backend reiniciado (fator 1), o broker e o frontend no ar, o admin (`usuario@formacao.dev`) numa janela anônima em `/admin/orders` e a cliente (`ana.pereira.carvalho@jaja.dev`) na loja em outra sessão, o usuário faz os logins e a cliente confirma um pedido. Verificar e registrar com capturas de tela:
  - a lista começa vazia e com "Ao vivo";
  - a linha do pedido aparece sem recarregar, com destaque, e o contador do menu vira 1;
  - o painel mostra os eventos chegando com consumidores "Aguardando" (contagem regressiva) → "Processado", causa e correlação, os passos com horários e durações e "Entregue em ~20 s", ao mesmo tempo que o acompanhamento da cliente;
  - o dashboard `/admin` com os indicadores de hoje, e o pedido saindo de "Pedidos em andamento" ao ser entregue;
  - parar o backend mostra "Reconectando…" e, ao voltar, "Ao vivo" com os dados atualizados;
  - filtros e busca na URL sobrevivem ao recarregar;
  - em 375px, sem rolagem horizontal da página.

  Ao final, rodar `db:clear-orders --yes` se o usuário quiser deixar a lista vazia de novo.
