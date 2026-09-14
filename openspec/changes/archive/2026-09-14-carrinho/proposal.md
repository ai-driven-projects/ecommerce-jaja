## Why

A loja já mostra o catálogo real, mas não deixa montar um pedido com ele. O carrinho continua usando os 26 produtos fictícios do frontend, guardados só no navegador, os cards da vitrine não têm o "+" e o botão "Adicionar" do detalhe só exibe "Carrinho chega já já.". A próxima funcionalidade (fechar o pedido) precisa de um carrinho confiável, ligado à conta, com preço atual e disponibilidade calculados pelo servidor. Esta change entrega esse carrinho e deixa o checkout real para a entrega seguinte.

## What Changes

- **Modelo de negócio:**
  - **com sessão:** o carrinho é **da conta**, um por usuário (inclusive de quem ainda não tem cadastro de cliente), e fica salvo no servidor entre acessos e dispositivos;
  - **sem sessão:** o visitante continua com o carrinho no navegador. Ao entrar ou criar conta, os itens do visitante são **mesclados** no carrinho da conta e apagados do navegador. Ao sair, a loja volta ao carrinho do visitante (vazio);
  - **preço:** o carrinho não guarda preço. Linhas e totais usam sempre o preço atual do catálogo;
  - **disponibilidade:** produto que deixou de ser visível na loja fica no carrinho como **indisponível**, fora dos totais, e impede finalizar o pedido até ser removido;
  - **limites:** até 50 produtos diferentes e 99 unidades por produto; entrega de R$ 4,90 abaixo de R$ 79,00 e grátis a partir disso.
- **Domínio (`@jaja/orders`):**
  - o scaffold `orders` (entidade `Orders` sem atributos, `CreateOrders`, DTO, mock e teste de exemplo) é substituído pelo agregado `cart`: a entidade `Cart` (`userId` único e imutável, itens na ordem de inclusão), o VO `CartItem`, `CartRepository` com `findByUserId` e os DTOs de carrinho, linha e detalhe;
  - as queries `FindAvailableProductIdsQuery`, `FindCartByUserIdQuery` e `PreviewCartQuery`;
  - os casos de uso `AddCartItem`, `SetCartItemQuantity`, `RemoveCartItem`, `ClearCart` e `MergeCart`, testados com jest e mocks in-memory.
- **Backend (`@jaja/backend`):**
  - models `Cart` e `CartItem` (tabelas `carts` e `cart_items`, FK única para `users` e FK para `products`) e a migration `orders_cart`;
  - `CartPrisma`, com a leitura do carrinho (linhas, disponibilidade e totais) numa única consulta SQL. O fragmento de visibilidade da loja sai do catálogo para `src/db/visible-products.sql.ts`;
  - `GET /me/cart`, `POST /me/cart/items`, `PUT /me/cart/items/:productId`, `DELETE /me/cart/items/:productId`, `DELETE /me/cart` e `POST /me/cart/merge` para qualquer usuário autenticado, sempre respondendo com o carrinho atualizado;
  - `POST /cart/preview`, público, que calcula as linhas e os totais do carrinho do visitante;
  - testes de integração Rest Client.
  - **BREAKING**: o endpoint de exemplo `GET /orders`, hoje público, é removido.
- **Frontend (`@jaja/frontend`):**
  - o carrinho sai de `modules/catalog` e vai para `modules/orders/data`, com dois modos (visitante e conta) e a mescla ao entrar;
  - gaveta com foto, link para o produto, remover, linha indisponível, carregamento e totais da API;
  - o "+" volta aos cards das grades da loja quando o bairro é atendido, e "Adicionar" no detalhe inclui a quantidade escolhida no carrinho;
  - o resumo do `/checkout` usa o carrinho da conta; "Confirmar pedido" continua simulado, mas passa a esvaziar o carrinho;
  - mensagens pt/en dos códigos `CART_*` e atualização do `DESIGN.md`.
  - **BREAKING**: o carrinho salvo no navegador com os produtos fictícios (`jaja.cart`) é descartado; o visitante recomeça com o carrinho vazio.
- **Fora do escopo:**
  - agregado de pedido, `POST /orders`, `customerId`, preço congelado e pagamento;
  - as regras de pedido anunciadas por `cadastro-cliente` (exigir cadastro de cliente e bloquear cliente inativo na API);
  - estoque e reserva, aviso de mudança de preço, cupons, "salvar para depois" e expiração de carrinhos;
  - frete por bairro ou distância;
  - carrinhos no admin;
  - atualização em tempo real do carrinho da conta entre dispositivos;
  - seed de carrinhos.

## Capabilities

### New Capabilities

- `orders/cart`: carrinho da conta e prévia do carrinho do visitante na API: um carrinho por usuário, itens e limites, incluir, alterar quantidade, remover, esvaziar e mesclar, disponibilidade dos produtos, preço atual, linhas indisponíveis, totais com a regra de entrega, os endpoints `/me/cart` e `POST /cart/preview`.
- `orders/storefront-cart`: o carrinho na loja: carrinho do visitante no navegador, mescla ao entrar ou criar conta, comportamento ao sair, contador do cabeçalho, gaveta, "+" nos cards da vitrine e "Adicionar" no detalhe do produto.

### Modified Capabilities

- `catalog/storefront`:
  - saem "Sacola vazia nesta entrega" e "Botão Adicionar sem efeito no carrinho", substituídos por `orders/storefront-cart`;
  - "Fechar pedido leva ao checkout" passa a descrever o botão "Finalizar pedido", que preserva todos os parâmetros da vitrine e fica indisponível sem itens ou com itens indisponíveis.
- `shared/design-system`: "Painel da sacola" passa a descrever a gaveta "Seu carrinho" atual (foto, link, remover, linha indisponível, carregamento, totais e frete), e "Grade e card de produto" passa a limitar a quantidade do stepper.
- `orders/checkout-access`: o resumo do pedido passa a mostrar o carrinho da conta, confirmar exige carrinho carregado, com itens e sem itens indisponíveis, e confirmar esvazia o carrinho.
- `admin/admin-api-authorization`: `/orders` sai da lista de endpoints acessíveis sem token (scaffold removido); `/me/cart` exige apenas token válido de qualquer usuário, e `POST /cart/preview` é público.

## Impact

- `modules/orders`: remoção de `src/orders`, `test/orders` e `test/mock/in-memory-orders.repository.ts`; novos `src/cart/{model,provider,dto,use-case,errors.ts,index.ts}`, `test/cart/**` e os mocks `test/mock/in-memory-cart.repository.ts` e `test/mock/in-memory-find-available-product-ids.query.ts`. O backend depende de `npm run build --workspace=@jaja/orders`.
- `apps/backend`:
  - banco: `prisma/models/orders.model.prisma`, as relações inversas em `auth.model.prisma` (`User`) e `catalog.model.prisma` (`Product`) e a migration `orders_cart`;
  - módulo: `src/modules/orders/{cart.prisma.ts,cart-http.ts,my-cart.controller.ts,cart.controller.ts,orders.module.ts,index.ts,test/cart.integration.http}`, com remoção de `orders.controller.ts` e `orders.prisma.ts`;
  - visibilidade: `src/db/visible-products.sql.ts` (movido de `src/modules/catalog/storefront.sql.ts`) e os imports em `product.prisma.ts` e `category.prisma.ts`;
  - API nova: `/me/cart` (6 rotas) e `POST /cart/preview`; API removida: `GET /orders`.
- `apps/frontend`:
  - carrinho: `src/modules/orders/data/{cart.api.ts,cart.util.ts,guest-cart-storage.util.ts,cart.context.tsx,index.ts}`, com remoção de `src/modules/catalog/data/cart.context.tsx` e `src/shared/util/cart.util.ts`;
  - componentes compartilhados: `src/shared/components/store/{store.types.ts,cart-drawer.component.tsx,quantity-stepper.component.tsx,product-grid.component.tsx}`;
  - loja: `src/modules/catalog/components/{storefront-shell,storefront-product-grid,product-detail}.component.tsx`, `src/modules/catalog/data/{index.ts,storefront.mock.ts,use-storefront.hook.ts}` e `src/modules/orders/{pages/checkout.page.tsx,index.ts}`;
  - `src/shared/i18n/messages.{pt,en}.ts` e `DESIGN.md`.
- Navegador: nova chave `jaja.guest-cart` no `localStorage`; `jaja.cart` é removida na primeira leitura.
- Sem novas dependências externas.
- Coordenação com `cadastro-cliente`, ainda aberta: ela altera `orders/checkout-access` e o mesmo requisito de `admin/admin-api-authorization`. Esta change só **adiciona** requisito em `orders/checkout-access` e, em `admin/admin-api-authorization`, parte do texto já alterado por ela.
