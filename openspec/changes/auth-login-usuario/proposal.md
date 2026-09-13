## Why

A loja já deixa o cliente entrar ou criar conta pelo cabeçalho (`/entrar`, funcionalidade 03), mas o botão "Fechar pedido" da sacola ainda não faz nada: `onCheckout` é um `noop` no `StorefrontShell`. O momento em que o login realmente importa para o e-commerce é o fechamento do pedido. Esta entrega cria a rota pública `/checkout`, que pede login ou cadastro a quem não tem sessão e mostra um placeholder a quem tem, e liga a sacola a ela. O checkout real (endereço, pagamento, pedido) fica para depois; aqui o objetivo é fechar o fluxo "sacola → identificar o cliente" reaproveitando tudo que a 03 entregou.

## What Changes

- **Nova rota pública `/checkout`** dentro do shell da loja, no módulo frontend `orders`. Sem sessão: título "Para fechar o pedido, entre ou crie sua conta." e o formulário com abas "Entrar"/"Criar conta" já existente; ao entrar ou criar conta, confirmação com o primeiro nome e o cliente **permanece** em `/checkout`, agora autenticado. Com sessão: placeholder "Checkout chega já já." com nome e email do cliente e o link "voltar para a vitrine" preservando `bairro` e `categoria`.
- **Sacola ligada ao checkout**: "Fechar pedido" fecha a sacola e navega para `/checkout` preservando a query da vitrine. Nova constante de rota `CHECKOUT_ROUTE`.
- **Backend**: nenhum endpoint novo e nenhum cenário novo no arquivo Rest Client. O fluxo "registro seguido de login com as mesmas credenciais" já é coberto pelos passos 1 e 8 de `auth.integration.http`; a entrega apenas reexecuta os dois com o backend no ar.
- **Domínio `@jaja/auth`**: sem alterações.
- Nada muda em `/entrar`, no cabeçalho, no `AdminGuard` nem em `/admin/*`.

**Premissa registrada** (o prompt não a resolve): o `BagSheet` só renderiza "Fechar pedido" quando há itens, e o carrinho ainda não existe, então a sacola é sempre vazia nesta entrega. O componente compartilhado **não** é alterado; a ligação `onCheckout` é feita e verificada por código e build, e a página `/checkout` é validada por URL direta. Se o botão deve aparecer também na sacola vazia, isso é uma mudança de spec da vitrine e deve ser decidida à parte.

## Capabilities

### New Capabilities

- `orders/checkout-access`: como a rota pública `/checkout` identifica o cliente antes do fechamento do pedido: o que exibe sem e com sessão, permanência na rota após login/cadastro, retorno à vitrine com a query preservada.

### Modified Capabilities

- `catalog/storefront`: requisito **adicionado** "Fechar pedido leva ao checkout" (o botão da sacola navega para `/checkout` preservando `bairro` e `categoria`). O requisito existente "Sacola vazia nesta entrega" não muda.

## Impact

- `apps/frontend/src/modules/orders/`: novo `pages/checkout.page.tsx` (`CheckoutPage`) e export em `index.ts`.
- `apps/frontend/src/app/(public)/checkout/page.tsx`: wrapper de rota.
- `apps/frontend/src/shared/navigation/storefront-routes.ts`: `CHECKOUT_ROUTE`.
- `apps/frontend/src/modules/catalog/components/storefront-shell.component.tsx`: `onCheckout` real no `ConnectedHeader`.
- `apps/frontend/src/modules/auth/pages/storefront-login.page.tsx`: apenas exportar a função de mensagem de boas-vindas já existente para reaproveitar o texto (sem mudança de comportamento).
- Backend, banco, seed, `@jaja/auth`, `packages/shared` e `.claude/skills`: sem alteração.
