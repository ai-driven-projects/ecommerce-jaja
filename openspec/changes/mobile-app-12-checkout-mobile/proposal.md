## Why

O app já monta o carrinho da conta (etapas 9 e 10) e guarda os dados de entrega (etapa 11), mas "Finalizar pedido" continua desabilitado: o cliente não consegue fechar o pedido pelo celular. Esta é a etapa 12 de 15 do loop `mobile-app`: levar para o app o checkout da vitrine web (spec `orders/checkout-access`, `checkout.page.tsx`, `order.api.ts`), sobre o contrato de `MyOrderController` (`POST /me/orders`) e as regras de `orders/order-placement`.

## What Changes

- "Finalizar pedido · <total>" da aba Carrinho passa a abrir o checkout. Ele fica desabilitado enquanto há mudança não confirmada ou linha indisponível, como no web.
- Nova tela "Finalizar pedido", na pilha da aba Carrinho e com sessão obrigatória. Sem sessão, ela leva a "Entrar" e volta depois. A tela tem:
  - o passo "Endereço de entrega", com o resumo do cadastro de cliente e "Alterar", ou, sem cadastro, o convite para preencher;
  - "Quem recebe" (pré-preenchido com o nome da conta) e "Instruções para o entregador";
  - o passo "Pagamento" simulado, sem nenhum dado de pagamento;
  - o "Resumo do pedido", com o carrinho da conta recarregado ao abrir;
  - "Confirmar pedido · <total>" com as condições do web.
- "Alterar" e o convite abrem a tela "Dados de entrega" da etapa 11 na pilha do checkout. Salvar ali volta ao checkout, que relê o cadastro.
- Novo domínio `order`, só com o que o fechamento usa: `POST /me/orders` com `recipientName` e `deliveryInstructions`, e as recusas `ORDER_*`/`TEXT_*` traduzidas para as mensagens do web.
- Sucesso: o carrinho é relido (o servidor já o esvaziou), aparece "Pedido #<número> recebido" com "Pagamento simulado em andamento.", e o app vai para a rota do pedido. Lá fica uma página provisória até a etapa 13. Erro: a mensagem aparece, o resumo é relido e, quando a recusa é do cadastro, os dados de entrega também.
- Testes do DTO, do repositório, do ViewModel, da tela, do carrinho e das rotas.

## Capabilities

### New Capabilities
- `mobile/mobile-checkout`: fechamento do pedido no app: acesso com sessão, dados de entrega exigidos, quem recebe e instruções, pagamento simulado, resumo, confirmação, recusas e navegação ao pedido.

### Modified Capabilities
- `mobile/mobile-cart`: "Finalizar pedido" deixa de ficar sempre desabilitado e abre o checkout.
- `mobile/mobile-customer`: a tela "Dados de entrega" também abre a partir do checkout e, ali, volta a ele depois de salvar.
- `mobile/mobile-navigation`: a guarda de sessão deixa de dizer que nenhuma rota exige sessão.

## Impact

- **Código:** só `apps/mobile/**`: `lib/modules/order/`, `lib/infra/{api,order,di}/`, `lib/app/router/`, `lib/ui/modules/{order,cart,customer}/`, `CLAUDE.md` e `test/**`.
- **Dependências:** nenhuma nova.
- **API:** `POST /me/orders` (novo no app), e `GET /me/cart`, `DELETE /me/cart/items/:id` e `GET`/`PUT /me/customer`, já usados. O Bearer vem do interceptor da etapa 8. O plano cita `POST /me/cart/orders`, que não existe. Vale o controller (ver design).
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
