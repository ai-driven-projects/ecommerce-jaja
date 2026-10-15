## Why

O checkout (etapa 12) cria o pedido e leva à rota `/cart/orders/:id`, mas lá só existe uma página provisória com o número: o cliente não vê o status, os itens, os totais nem o endereço do pedido. Esta é a etapa 13 de 15 do loop `mobile-app`: levar para o app o acompanhamento da vitrine web (`order-tracking.component.tsx`, `order-status.util.ts`, `order.util.ts`), lido por `GET /me/orders/:id` (`MyOrderController`), ainda sem atualização ao vivo.

## What Changes

- O domínio `order` ganha o pedido completo (`OrderDetailDTO`): status, itens, endereço copiado, quem recebe, instruções, totais em centavos e a data de cada passo, com DTO à mão e teste de parsing.
- As regras dos passos, de `modules/orders/src/order` e `order-status.util.ts`: a sequência PLACED → PAYMENT_APPROVED → PICKING → OUT_FOR_DELIVERY → DELIVERED, o passo concluído, o atual e o pendente, e o pedido entregue como final.
- Nova tela de acompanhamento na rota `/cart/orders/:id` (a mesma da etapa 12, na pilha da aba Carrinho, com sessão obrigatória). Ela substitui a página provisória e mostra:
  - o cabeçalho "Pedido #<número>", com o selo do status, "Feito hoje às HH:MM" (ou a data), o endereço em uma linha e "Quem recebe";
  - a linha do tempo "Status do pedido", com os rótulos do web, a hora de cada passo concluído, "Em andamento…" e "Aguardando", e o aviso de entregue;
  - os itens, os totais ("Entrega de bike" ou "Grátis", "Pagamento simulado") e as instruções, quando existem.
- Puxar a tela relê o pedido. Pedido inexistente ou de outra conta (`404`) mostra "Pedido não encontrado." com "Voltar para a loja". Outra falha mostra o banner com "Tentar de novo".
- Testes do DTO, das regras dos passos, dos formatadores, do repositório, do ViewModel, da tela e da rota.

## Capabilities

### New Capabilities
- `mobile/mobile-order-tracking`: acompanhamento do pedido no app: rota, leitura do pedido, cabeçalho, linha do tempo dos status, itens e totais, puxar para atualizar e os estados de pedido não encontrado e de falha.

### Modified Capabilities
- `mobile/mobile-checkout`: sai o requisito "Página do pedido provisória", que passa a ser o acompanhamento de `mobile/mobile-order-tracking`.

## Impact

- **Código:** só `apps/mobile/**`: `lib/modules/order/`, `lib/infra/{api,order,di}/`, `lib/app/router/app_router.dart`, `lib/ui/modules/order/`, `CLAUDE.md` e `test/**`. A `OrderPlacedPage` e o teste dela são removidos.
- **Dependências:** nenhuma nova. A hora usa `DateTime` local, sem `intl` de data.
- **API:** `GET /me/orders/:id` (novo no app). O Bearer vem do interceptor da etapa 8, e o `401` encerra a sessão como em toda rota.
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
