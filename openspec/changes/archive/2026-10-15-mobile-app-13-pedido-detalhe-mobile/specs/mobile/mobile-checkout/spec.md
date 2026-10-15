## REMOVED Requirements

### Requirement: Página do pedido provisória
**Reason**: A rota do pedido deixa de mostrar a página provisória da etapa 12 e passa a mostrar o acompanhamento do pedido.
**Migration**: Ver os requisitos "Rota do pedido" e seguintes de `mobile/mobile-order-tracking`. A rota (`/cart/orders/<id>`, na pilha da aba Carrinho, com sessão obrigatória) e o voltar para a aba Carrinho continuam iguais. "Pedido #<número> recebido" segue no aviso do checkout ("Confirmar o pedido").
