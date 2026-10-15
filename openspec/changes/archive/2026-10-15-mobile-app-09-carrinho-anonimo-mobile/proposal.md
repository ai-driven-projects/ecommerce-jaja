## Why

O app já mostra o catálogo inteiro e o produto (etapas 4 a 7) e já tem sessão (etapa 8), mas a aba Carrinho ainda é provisória e o "Adicionar ao carrinho" do detalhe nasce desabilitado: o cliente não consegue montar a compra. Esta é a etapa 9 de 15 do loop `mobile-app`: o carrinho do visitante da vitrine web (`guest-cart-storage.util.ts`, `cart.util.ts`, a parte "visitante" de `cart.context.tsx`, a gaveta `cart-drawer.component.tsx` e o "Adicionar" de `product-detail.component.tsx`, spec `orders/storefront-cart`) precisa existir no app, guardado no aparelho e precificado pela API, com as regras de `modules/orders/src/cart`.

## What Changes

- Domínio `cart`: item guardado (produto e quantidade), linha e carrinho precificados (em centavos), as regras do visitante (99 unidades por produto, 50 produtos, quantidade inválida) e as constantes de entrega (taxa de R$ 4,90, grátis a partir de R$ 79,00), copiadas de `modules/orders/src/cart/errors.ts`.
- Infraestrutura: o carrinho do visitante guardado no `shared_preferences` (mesma chave e formato do web, normalizado na leitura), `POST /cart/preview` com DTO escrito à mão, e um repositório global do carrinho que aplica as regras na hora, pede a prévia depois de 250 ms sem mudança, descarta respostas antigas e tira do aparelho os produtos que a API não devolve mais.
- Aba Carrinho real: linhas com foto, nome (abre o produto), unidade, preço, quantidade com "−"/"+", total da linha e remoção; linha indisponível; subtotal, entrega ("Grátis" ou o valor), "Faltam <valor> para a entrega grátis.", total e "Finalizar pedido · <total>" visível e desabilitado até o checkout; skeleton, banner com "Tentar de novo" e vazio com uma ação.
- Badge com a quantidade de itens na aba Carrinho, atualizado na hora.
- Detalhe do produto: quantidade de 1 a 99, "Adicionar · <total>" ligado ao carrinho, aviso "Adicionado ao carrinho" com "Ver carrinho", "Você já tem N no carrinho." e o cartão de entrega grátis.
- Testes do armazenamento, das regras, do DTO, do repositório (inclusive itens que somem ou mudam de preço), dos ViewModels e das telas.

## Capabilities

### New Capabilities
- `mobile/mobile-cart`: carrinho do visitante no app — guarda local, regras, prévia de preços, aba Carrinho e badge.

### Modified Capabilities
- `mobile/mobile-product`: a ação principal passa a adicionar ao carrinho com quantidade; entra o cartão de entrega.
- `mobile/mobile-navigation`: acrescenta a rota do produto na pilha da aba Carrinho.

## Impact

- **Código:** só `apps/mobile/**`: `lib/modules/cart/`, `lib/infra/{api,cart,storage,di}/`, `lib/ui/modules/cart/`, `lib/ui/modules/catalog/{pages,view_models}/`, `lib/ui/shared/widgets/`, `lib/app/`, `CLAUDE.md` e `test/**`.
- **Dependências:** nenhuma nova (`shared_preferences` já está no projeto).
- **API:** `POST /cart/preview` (público, sem token), sem parâmetro novo.
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
