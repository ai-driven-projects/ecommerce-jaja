## Why

O checkout já mostra o carrinho real da conta e os dados de entrega do cliente, mas "Confirmar pedido" ainda é simulado: só esvazia o carrinho e leva a um acompanhamento com dados fictícios (`tracking.mock.ts`). Com a infraestrutura de mensageria pronta (outbox + RabbitMQ, change `infra-mensageria`), o pedido pode nascer de verdade: gravado no banco junto com o evento `order.placed` e publicado no broker, pronto para os consumidores de pagamento, separação e entrega das próximas entregas. Esta change também cumpre as regras prometidas antes: pedido referencia o cliente, exige cadastro ativo e congela o preço.

## What Changes

- **Modelo de negócio:**
  - **pedido do cliente:** o pedido pertence ao **cliente** (não ao usuário). Sem cadastro de cliente ou com cadastro inativo, não há pedido;
  - **origem:** o pedido é montado **no servidor** a partir do carrinho da conta. O corpo da requisição só traz "quem recebe" e as instruções para o entregador; itens, preços, cliente, status e totais enviados pelo navegador são ignorados;
  - **cópias congeladas:** nome, unidade, miniatura, preço unitário e quantidade de cada item, o endereço de entrega do cliente e quem recebe são copiados na confirmação e não mudam quando o catálogo ou o cadastro mudam;
  - **totais:** subtotal, entrega (R$ 4,90 abaixo de R$ 79,00; grátis a partir disso) e total seguem a regra do carrinho;
  - **uma transação:** o pedido, o carrinho esvaziado e o evento `order.placed` são gravados juntos; se qualquer gravação falhar, nada fica gravado;
  - **status inicial:** `PLACED` ("Pedido recebido"). Nenhum outro status existe nesta entrega;
  - **pagamento simulado:** o cliente não informa forma de pagamento nem dados de cartão; o pedido não guarda forma de pagamento.
- **Domínio (`@jaja/orders`):**
  - novo agregado `order`: `Order` (`AggregateRoot`) com `Order.place`, que gera o `OrderPlacedEvent`, e reidratação sem eventos; VOs `OrderItem` e `OrderDeliveryAddress`; `OrderRepository`; `errors.ts` com `OrderErrors`, `ORDER_STATUSES` e os limites de quem recebe e das instruções;
  - evento `order.placed` (`aggregateType: 'Order'`) com cliente, itens, totais e data do pedido no payload;
  - queries `FindOrderCustomerByUserIdQuery` e `FindMyOrderByIdQuery`;
  - caso de uso `PlaceOrder`, transacional, que grava pedido, carrinho e evento pela porta `DomainEventRepository`;
  - mocks in-memory (repositório, eventos, transação e queries) e testes jest.
- **Backend (`@jaja/backend`):**
  - models `Order` e `OrderItem` (tabelas `orders` e `order_items`, FK para `customers` e `products`) e a migration `orders_order`;
  - `OrderPrisma` (repositório e queries) e `order-http.ts` (corpo e mapeamento de erros);
  - `POST /me/orders` (201, pedido criado) e `GET /me/orders/:id` (404 para pedido inexistente ou de outro usuário), para qualquer usuário autenticado;
  - `OrdersModule` passa a importar `MessagingModule` para usar o outbox;
  - testes de integração Rest Client e conferência do evento no outbox e na fila `jaja.events.all`.
- **Frontend (`@jaja/frontend`):**
  - checkout: passo "Pagamento" vira aviso de pagamento simulado, sem seletor nem campos de cartão; "Quem recebe" e "Instruções para o entregador" passam a ser enviados; "Confirmar pedido" cria o pedido na API e leva ao acompanhamento do pedido criado;
  - acompanhamento `/pedidos/:id/acompanhar` com o pedido real: sessão exigida, pedido não encontrado, itens, totais, endereço, quem recebe e passos com só "Pedido recebido" concluído;
  - `order.api.ts`, `order.util.ts` e `use-my-order.hook.ts`; mensagens pt/en dos códigos `ORDER_*`; atualização do `DESIGN.md`.
  - **BREAKING**: `data/tracking.mock.ts` é removido. O mapa, o entregador, a janela de chegada e a loja fixa saem do acompanhamento, e URLs de acompanhamento antigas (números fictícios como `/pedidos/4211/acompanhar`) passam a mostrar "Pedido não encontrado.".
- **Fora do escopo:**
  - consumidores de eventos, pagamento aprovado, status além de `PLACED`, linha do tempo em tempo real e notificações;
  - forma de pagamento, cartão, Pix, estorno e cancelamento;
  - "Meus pedidos" e pedidos no admin (`/admin/orders` e o dashboard continuam mock);
  - loja no pedido, cobertura real, ETA real e entregador. A regra "não excluir loja com pedidos" continua pendente;
  - número sequencial do pedido (a tela usa os 8 primeiros caracteres do id) e chave de idempotência;
  - seed de pedidos.

## Capabilities

### New Capabilities

- `orders/order-placement`: pedido do cliente a partir do carrinho da conta na API. Cobre:
  - cadastro de cliente obrigatório e ativo, carrinho com itens e sem indisponíveis;
  - cópia dos itens com preço congelado, do endereço e de quem recebe; limites de quem recebe e das instruções;
  - totais e entrega;
  - carrinho esvaziado e evento `order.placed` (com o payload) gravados na mesma transação do pedido e publicados pelo outbox;
  - status inicial `PLACED` e pagamento simulado sem dados do cliente;
  - os endpoints `POST /me/orders` e `GET /me/orders/:id`, com isolamento entre usuários.
- `orders/order-tracking`: a página `/pedidos/:id/acompanhar` com o pedido real. Cobre:
  - exigência de sessão e pedido não encontrado (inclusive de outro usuário);
  - cabeçalho com número, data, endereço e quem recebe;
  - passos do pedido com só o primeiro concluído;
  - itens, totais com "Pagamento simulado" e instruções;
  - título da aba e ausência de mapa e entregador.

### Modified Capabilities

- `orders/checkout-access`:
  - "Estado autenticado do checkout": o passo 2 "Pagamento" passa a ser simulado, sem forma de pagamento nem campos;
  - "Resumo do pedido com o carrinho da conta": confirmar cria o pedido na API (o servidor esvazia o carrinho) e leva ao acompanhamento do pedido criado; em erro, exibe a mensagem, recarrega o resumo e continua em `/checkout`;
  - "Confirmar pedido exige cadastro de cliente": a API também exige cadastro ativo.
- `admin/admin-api-authorization`: "Endpoints não administrativos não mudam" passa a incluir `/me/orders`, que exige apenas token válido de qualquer usuário.

## Impact

- `modules/orders`:
  - novos `src/order/{model,provider,dto,event,use-case,errors.ts,index.ts}`, `test/order/**` e os mocks `test/mock/{in-memory-order.repository,in-memory-domain-event.repository,fake-transaction.manager,in-memory-find-order-customer-by-user-id.query,in-memory-find-cart-by-user-id.query}.ts`;
  - `src/index.ts` exporta `./order`;
  - o backend depende de `npm run build --workspace=@jaja/orders`.
- `apps/backend`:
  - banco: `prisma/models/orders.model.prisma` (models `Order` e `OrderItem`), as relações inversas em `customers.model.prisma` (`Customer`) e `catalog.model.prisma` (`Product`) e a migration `orders_order` (aditiva);
  - módulo: `src/modules/orders/{order.prisma.ts,order-http.ts,my-order.controller.ts,orders.module.ts,index.ts,test/order.integration.http}`;
  - API nova: `POST /me/orders` e `GET /me/orders/:id`. Cada pedido gera uma linha `order.placed` em `outbox_events` e uma mensagem no exchange `jaja.events`.
- `apps/frontend`:
  - dados: `src/modules/orders/data/{order.api.ts,order.util.ts,use-my-order.hook.ts,index.ts}`, com remoção de `tracking.mock.ts`;
  - telas: `src/modules/orders/{pages/checkout.page.tsx,components/order-tracking.component.tsx,pages/tracking.page.tsx,index.ts}` e `src/app/(public)/pedidos/[id]/acompanhar/page.tsx`;
  - cadastro de cliente: `src/modules/customers/data/use-my-customer.hook.ts` ganha `refresh()`, para o checkout recarregar os dados de entrega depois de um erro de cliente;
  - `src/shared/i18n/messages.{pt,en}.ts` e `DESIGN.md`.
- Sem novas dependências externas e sem alterações em `packages/shared`.
- Dependência de `infra-mensageria`: a parte de backend (outbox, relay e adapter RabbitMQ) já está implementada; a change continua aberta (conferências manuais e CLI). Esta change não altera as specs `messaging/*`, então as duas podem ser arquivadas em qualquer ordem.
