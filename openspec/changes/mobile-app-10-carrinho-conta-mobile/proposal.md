## Why

Depois da etapa 9 o app tem o carrinho do visitante, mas ele continua sendo usado **mesmo com sessão**: o cliente que entra não vê o carrinho da conta montado no web, e o que ele montou no aparelho antes de entrar não chega ao servidor, onde o checkout (etapa 12) vai buscá-lo. Esta é a etapa 10 de 15 do loop `mobile-app`: a parte "conta" de `cart.context.tsx` e `cart.api.ts` da vitrine web (spec `orders/storefront-cart`, requisito "Carrinho da conta e mescla ao entrar") precisa existir no app, sobre o contrato de `MyCartController` (`/me/cart`).

## What Changes

- Com sessão, o carrinho passa a ser o da conta: `GET /me/cart` na entrada, `POST /me/cart/items`, `PUT`/`DELETE /me/cart/items/:productId` e `DELETE /me/cart`, todos devolvendo o carrinho inteiro. As quantidades mudam na hora e os comandos rodam um de cada vez, como no web.
- Ao entrar (login, cadastro ou app aberto já com sessão), os itens do visitante vão por `POST /me/cart/merge`. O carrinho local só é apagado depois de a mescla dar certo. Se ela falhar, aparece um aviso com "Tentar de novo", o app mostra o carrinho da conta e os itens locais ficam guardados para uma nova tentativa.
- Ao sair (ou quando a sessão expira), o app volta ao carrinho do visitante, que está vazio depois de uma mescla bem-sucedida. O carrinho da conta continua no servidor para o próximo acesso.
- Um repositório único implementa o contrato `CartRepository` e escolhe a fonte pelo estado da sessão. Telas, badge e detalhe do produto não mudam de contrato.
- As recusas do backend no carrinho viram mensagens: limite por produto, limite de produtos, quantidade inválida e "Produto indisponível.".
- Testes do cliente `/me/cart`, das quantidades aplicadas na hora, da troca de fonte, da mescla, da falha na mescla e das mensagens.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `mobile/mobile-cart`: entram o carrinho da conta, a mescla ao entrar, a volta ao visitante ao sair e as mensagens das recusas do backend.

## Impact

- **Código:** só `apps/mobile/**`: `lib/modules/cart/`, `lib/infra/{api,cart,di}/`, `lib/app/bootstrap.dart`, `lib/ui/modules/cart/`, `CLAUDE.md` e `test/**`.
- **Dependências:** nenhuma nova.
- **API:** `GET`/`DELETE /me/cart`, `POST /me/cart/items`, `PUT`/`DELETE /me/cart/items/:productId` e `POST /me/cart/merge`, com Bearer pelo interceptor da etapa 8, sem parâmetro novo.
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
