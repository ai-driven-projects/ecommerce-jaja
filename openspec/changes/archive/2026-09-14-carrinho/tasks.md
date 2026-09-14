> **Execução:** três subagentes separados, com contexto limpo, **nessa ordem**:
> - **Negócio:** grupo 1;
> - **Backend:** grupos 2–4;
> - **Frontend:** grupos 5–8.
>
> Um grupo só começa depois de o anterior terminar com as validações passando.
>
> **Leitura prévia de cada subagente:**
> - todos: `.claude/skills/skills-standards.md`, o prompt `openspec/extras/prompts/13-carrinho.md`, o `design.md` desta change e as referências de código da sua camada listadas no Contexto do prompt;
> - Frontend, além disso: `apps/frontend/DESIGN.md` e `apps/frontend/src/modules/orders/pages/checkout.page.tsx`.
>
> **Leitura em CQRS** (Decisões 5 e 6 do `design.md`): as leituras do carrinho são interfaces no módulo, implementadas em SQL no adapter Prisma e chamadas direto pelo controller. Não criar `find-*.use-case.ts`, serviço de domínio para os totais nem teste unitário para as queries. Os casos de uso de comando devolvem `Result<void>`.
>
> Cada subagente encerra listando os arquivos criados/alterados e o resultado das validações.

## 1. Domínio `@jaja/orders` (subagente Negócio)

- [x] 1.1 Apagar `modules/orders/src/orders/**`, `modules/orders/test/orders/**` e `modules/orders/test/mock/in-memory-orders.repository.ts`, mantendo `getModuleName` e `test/index.test.ts`. Criar o agregado `cart` com a skill `module-aggregate --mode example`, apagando o use case e o teste gerados. Criar `src/cart/errors.ts` com `CartErrors` (os oito códigos do prompt), `CartErrorCode` e as constantes `CART_MAX_ITEMS = 50`, `CART_ITEM_MAX_QUANTITY = 99`, `DELIVERY_FEE_CENTS = 490` e `FREE_DELIVERY_THRESHOLD_CENTS = 7900`, com JSDoc. Criar `src/cart/index.ts` e trocar `./orders` por `./cart` em `src/index.ts`. Verificar que `find modules/orders -path '*/orders/*' -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/coverage/*'` não lista arquivos de `src/orders` nem de `test/orders`.
- [x] 1.2 Criar `src/cart/model/cart-item.vo.ts` (`CartItem`, skill `module-value-object`): `productId` com `Id.required` e `quantity` inteira de 1 a 99, com qualquer outro valor falhando com `CART_ITEM_QUANTITY_INVALID`; getters, `withQuantity`, `toProps` e `toDTO`. Verificar com `test/cart/cart-item.vo.test.ts`: `productId` ausente e malformado (`SharedErrors.ID_INVALID`), quantidades 0, 1, 99, 100, 1.5 e texto, e `withQuantity`.
- [x] 1.3 Criar `src/cart/model/cart.entity.ts` (`Cart`, skill `module-entity`):
  - `userId` obrigatório e `items` na ordem de inclusão;
  - invariantes: até 50 itens (`CART_ITEMS_LIMIT_EXCEEDED`) e sem `productId` repetido (`CART_ITEM_DUPLICATED`);
  - `create`/`tryCreate`, getters, `itemCount`, `quantityOf` e `toDTO`;
  - métodos puros `addItem`, `setItemQuantity`, `removeItem`, `clear` e `merge`, via `cloneWith` com `updatedAt`, com as regras do prompt.

  Verificar com `test/cart/cart.entity.test.ts`:
  - `userId` obrigatório, itens duplicados e 51 itens;
  - `addItem`: soma mantendo a posição, produto novo no fim e soma acima de 99 (`CART_ITEM_QUANTITY_EXCEEDED`);
  - `setItemQuantity`: mantém a posição e inclui produto ausente;
  - `removeItem` de produto ausente sem mudar `updatedAt`, e `clear`;
  - `merge`: teto de 99, ignora o que passa de 50 itens e ignora quantidade inválida;
  - `itemCount` e `quantityOf`.
- [x] 1.4 Criar `src/cart/provider/cart.repository.ts` (`CartRepository extends CrudRepository<Cart>` com `findByUserId`, skill `module-repository`) e os DTOs em `src/cart/dto/cart.dto.ts` (`CartItemDTO`, `CartDTO`, `CartItemInputDTO`, `CartLineDTO` e `CartDetailDTO`, skill `module-dto`), com os campos da spec `orders/cart`. Verificar com `npx tsc --noEmit -p modules/orders`.
- [x] 1.5 Criar as interfaces `FindAvailableProductIdsQuery` (`find-available-product-ids.query.ts`), `FindCartByUserIdQuery` (`find-cart-by-user-id.query.ts`) e `PreviewCartQuery` (`preview-cart.query.ts`) em `src/cart/provider/`, com a skill `module-query-cqrs` só para contrato e DTOs. O JSDoc de cada uma traz a regra de disponibilidade, a ordem das linhas e o carrinho vazio. Verificar com `npx tsc --noEmit -p modules/orders` e com `find modules/orders/src -name "find-*.use-case.ts"` vazio.
- [x] 1.6 Criar os mocks `test/mock/in-memory-cart.repository.ts` e `test/mock/in-memory-find-available-product-ids.query.ts`:
  - repositório: `userId` único também para excluídos (`CART_ALREADY_EXISTS`); `create` com id existente, `update` e `delete` de inexistente ou excluído falham com `CART_NOT_FOUND`; buscas ignoram excluídos;
  - query: ids disponíveis configuráveis e contador de chamadas.

  Verificar que os mocks são usados pelos testes da tarefa 1.7 sem erro de tipo.
- [x] 1.7 Criar os casos de uso `add-cart-item`, `set-cart-item-quantity`, `remove-cart-item`, `clear-cart` e `merge-cart` em `src/cart/use-case/` (skill `module-use-case`, `UseCase<Input, void>`), com os fluxos do prompt. Verificar com um arquivo `test/cart/<nome>.use-case.test.ts` por caso de uso:
  - **add:** cria o carrinho no primeiro item; soma no mesmo produto; indisponível falha com `CART_PRODUCT_NOT_FOUND` sem criar carrinho; quantidade inválida falha sem consultar a disponibilidade (contador 0); soma acima de 99; 51º produto;
  - **set:** inclui produto ausente; mantém a posição; indisponível já no carrinho falha;
  - **remove:** sem carrinho; produto ausente; remove produto indisponível;
  - **clear:** sem carrinho não persiste; com itens esvazia;
  - **merge:** sem carrinho cria; com carrinho soma com teto; ignora indisponíveis e inválidos; soma repetidos; lista vazia ou só com itens descartados não cria carrinho; uma única consulta de disponibilidade;
  - em todos, `userId` malformado falha com `SharedErrors.ID_INVALID`.
- [x] 1.8 Exportar tudo nos `index.ts` de `model`, `provider`, `dto`, `use-case` e do agregado. Verificar:
  - `npm test --workspace=@jaja/orders` passa;
  - `npm run build --workspace=@jaja/orders` gera `dist/index.d.ts` exportando `Cart`, `CartItem`, `CartErrors`, `CART_ITEM_MAX_QUANTITY`, `DELIVERY_FEE_CENTS`, `FindCartByUserIdQuery`, `PreviewCartQuery`, `FindAvailableProductIdsQuery`, `AddCartItem` e `MergeCart`.

## 2. Backend: banco e visibilidade (subagente Backend)

- [x] 2.1 Em `apps/backend/prisma/models/orders.model.prisma`, criar os models `Cart` (`carts`) e `CartItem` (`cart_items`) com as colunas, FKs, uniques e índices da Decisão 9 do `design.md` e o comentário pedido no prompt (skill `backend-prisma-data`). Adicionar `cart Cart?` em `User` (`auth.model.prisma`) e `cartItems CartItem[]` em `Product` (`catalog.model.prisma`). Rodar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name orders_cart --create-only` e verificar:
  - o SQL gerado só cria `carts`, `cart_items`, as constraints `carts_user_id_key`, `cart_items_cart_id_product_id_key`, `cart_items_cart_id_position_key`, as FKs e o índice de `product_id`, sem tocar em `products.search_document`;
  - aplicado com `prisma:migrate:dev`, rodar o comando de novo não propõe outra migration;
  - `npm run prisma:generate --workspace=@jaja/backend` conclui.
- [x] 2.2 Mover `apps/backend/src/modules/catalog/storefront.sql.ts` para `apps/backend/src/db/visible-products.sql.ts`, mantendo `visibleProducts` e o comentário, e ajustar os imports em `product.prisma.ts` e `category.prisma.ts` (Decisão 7). Verificar:
  - `grep -rn "storefront.sql" apps/backend/src` retorna vazio;
  - `npm run build --workspace=@jaja/backend` passa;
  - na tarefa 4.1, `storefront.integration.http` continua respondendo como antes.

## 3. Backend: adapter e API do carrinho (subagente Backend)

- [x] 3.1 Apagar `apps/backend/src/modules/orders/orders.controller.ts` e `orders.prisma.ts`. Criar `cart.prisma.ts` (`CartPrisma implements CartRepository`) com os métodos do repositório no padrão de `customer.prisma.ts`:
  - `create` com os itens aninhados;
  - `update` em transação com `deleteMany` + `createMany` e `position` = índice;
  - `findByUserId` e `findById`, filtrando `deletedAt: null` e sem ir ao banco com id que não é uuid;
  - soft delete;
  - `P2002` por constraint (`carts_user_id_key` → `CART_ALREADY_EXISTS`, `carts_pkey` → `CART_NOT_FOUND`) e `P2003` por FK (usuário → `CART_USER_NOT_FOUND`, produto → `CART_PRODUCT_NOT_FOUND`).

  Verificar que o backend compila e, na tarefa 4.1, que inclusão, alteração e remoção persistem na ordem certa.
- [x] 3.2 Em `CartPrisma`, implementar as queries como atributos públicos tipados, em SQL cru (Decisão 5):
  - `findAvailableProductIds`, com `visibleProducts()` e `ANY(uuid[])`;
  - `findCartByUserId` e `previewCart`, sobre **um único construtor de SQL** com a CTE `items(product_id, quantity, position)`: `cart_items` do carrinho não excluído do usuário ou `unnest(...) WITH ORDINALITY`;
  - numa única consulta: `JOIN products` (inclusive inativos e excluídos), raiz da categoria até o avô, miniatura por `LEFT JOIN LATERAL`, `is_available` por `EXISTS` sobre `visibleProducts()` sem conflito de aliases, `json_agg` ordenado por `position`, e `item_count`, subtotal, entrega, total, `missing_for_free_delivery_cents` e `has_unavailable_items` calculados com `DELIVERY_FEE_CENTS` e `FREE_DELIVERY_THRESHOLD_CENTS` de `@jaja/orders`;
  - listas vazias e `userId` que não é uuid devolvem o carrinho vazio sem ir ao banco.

  Verificar com `grep -n "reduce\|filter(" apps/backend/src/modules/orders/cart.prisma.ts` sem soma ou filtro de regra no mapeamento, e na tarefa 4.1 com os cenários de totais e indisponibilidade.
- [x] 3.3 Criar `apps/backend/src/modules/orders/cart-http.ts` com:
  - os corpos `AddCartItemBody`, `SetCartItemQuantityBody` e `CartItemsBody`;
  - `toGuestItems`: descarta malformados, soma repetidos, limita a 99, corta em 50 e aceita `items` ausente ou que não seja lista;
  - `throwFailure`: `CART_PRODUCT_NOT_FOUND`/`CART_USER_NOT_FOUND` → 404, `CART_ALREADY_EXISTS` → 409 e demais → 400, sem códigos repetidos.

  Verificar que `npm run lint --workspace=@jaja/backend` passa e, na tarefa 4.1, os cenários de normalização da prévia e da mescla.
- [x] 3.4 Criar `my-cart.controller.ts` (`MyCartController`, `@Controller('me/cart')`, `@UseGuards(JwtGuard)`) com as rotas `GET /`, `POST /items` (quantidade padrão 1, `@HttpCode(200)`), `PUT /items/:productId`, `DELETE /items/:productId`, `DELETE /` e `POST /merge` (`@HttpCode(200)`). Cada comando instancia o caso de uso com `CartPrisma` e responde com `findCartByUserId`, e o `userId` vem sempre de `@CurrentUser('id')` (skill `backend-controller`). Criar `cart.controller.ts` (`CartController`, `@Controller('cart')`, sem guard) com `POST /preview` (`@HttpCode(200)`, `toGuestItems` + `previewCart`). Registrar os dois controllers e `CartPrisma` (`providers` e `exports`) em `orders.module.ts` e ajustar `index.ts`. Verificar:
  - `npm run build --workspace=@jaja/backend` passa;
  - com o backend no ar, `curl -s -o /dev/null -w "%{http_code}" localhost:4000/me/cart` responde `401`, `curl -s -X POST localhost:4000/cart/preview -H 'Content-Type: application/json' -d '{"items":[]}'` responde `200` com o carrinho vazio e `GET /orders` responde `404`.

## 4. Backend: integração e validação (subagente Backend)

- [x] 4.1 Criar `apps/backend/src/modules/orders/test/cart.integration.http` no estilo de `customer.integration.http`, com os pré-requisitos, as variáveis, o usuário novo com email de timestamp, os ids obtidos por requisições nomeadas (produtos disponíveis de preço baixo e ≥ R$ 79,00 e o produto inativo `10n0595`) e todos os cenários do prompt: acesso, usuário novo, inclusão e quantidade, erros, frete, indisponibilidade (desativar e **reativar** o produto B), remoção idempotente, mescla, prévia do visitante, esvaziar e administrador. Subir o backend (`npm run dev --workspace=@jaja/backend`) e executar todas as requisições. Verificar:
  - cada resposta tem o status e os campos esperados pela spec `orders/cart`;
  - no fim, o produto B está ativo (`GET /storefront/products/<slug-de-B>` responde `200`);
  - `storefront.integration.http` continua com as mesmas respostas.
- [x] 4.2 Rodar `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` e verificar que passam sem erros.

## 5. Frontend: dados do carrinho (subagente Frontend)

- [x] 5.1 Adicionar as mensagens dos oito códigos `CART_*` (com os textos do prompt) em `src/shared/i18n/messages.pt.ts` e `messages.en.ts`, na ordem alfabética. Verificar que `getMessage('CART_ITEM_QUANTITY_EXCEEDED')` devolve "Limite de 99 unidades por produto." e que `npm run lint --workspace=@jaja/frontend` passa.
- [x] 5.2 Criar `src/modules/orders/data/cart.api.ts` (tipos `CartLine`, `CartDetail`, `CartItemInput` e as funções `getMyCart`, `addMyCartItem`, `setMyCartItemQuantity`, `removeMyCartItem`, `clearMyCart`, `mergeMyCart` e `previewCart`, esta sem token e sem chamar a API com lista vazia) e `cart.util.ts` (constantes espelhadas de `@jaja/orders`, `emptyCartDetail()` e as funções puras `addGuestItem`, `setGuestItemQuantity` e `removeGuestItem`, que devolvem `{ items }` ou `{ error }`). Verificar com `npx tsc --noEmit -p apps/frontend` e, na tarefa 8.1, o limite de 99 e de 50 no visitante.
- [x] 5.3 Criar `src/modules/orders/data/guest-cart-storage.util.ts`: store externo sobre `localStorage['jaja.guest-cart']` que valida na leitura, remove `jaja.cart`, sincroniza as abas pelo evento `storage`, cai para memória sem `localStorage` e tem snapshot vazio no servidor. Exporta `subscribe`, `getGuestItemsSnapshot`, `getGuestItemsServerSnapshot`, `commitGuestItems` e `clearGuestItems`. Verificar na tarefa 8.1: recarga, segunda aba e remoção de `jaja.cart`.
- [x] 5.4 Criar `src/modules/orders/data/cart.context.tsx` (`CartProvider` e `useCart`) com os modos visitante e conta da Decisão 10:
  - visitante: prévia com espera de ~250 ms, respostas antigas descartadas e ids inexistentes retirados do store;
  - conta: chaveada pelo token, mescla ou leitura ao surgir o token, fila de comandos com atualização otimista e `refresh()` em erro;
  - `open` recarrega o carrinho da conta;
  - expõe tudo o que o prompt lista.

  Atualizar `data/index.ts`. Verificar com `npx tsc --noEmit -p apps/frontend` e, nas tarefas 8.1 e 8.2, os fluxos de visitante e de mescla.
- [x] 5.5 Apagar `src/modules/catalog/data/cart.context.tsx` (e a reexportação em `modules/catalog/data/index.ts`) e `src/shared/util/cart.util.ts`. Remover `findProduct` de `storefront.mock.ts`, mantendo o que os dashboards usam, e atualizar o comentário de `use-storefront.hook.ts`. Verificar que `grep -rn "findProduct\|shared/util/cart.util\|catalog/data/cart.context" apps/frontend/src` retorna vazio.

## 6. Frontend: componentes de loja compartilhados (subagente Frontend)

- [x] 6.1 Em `src/shared/components/store/store.types.ts`, adicionar `id` a `StoreProduct`, redefinir `CartItem` (linha exibida) e `CartTotals` (com `itemCount`) e remover `BagItem`. Em `quantity-stepper.component.tsx`, adicionar `max?` a `QuantityStepper` e `AddToCartControl`; em `product-card`/`product-grid`, repassar `max` e usar `product.id` como `key`. Verificar com `npx tsc --noEmit -p apps/frontend` e, na tarefa 8.1, o "+" indisponível em 99.
- [x] 6.2 Reescrever `cart-drawer.component.tsx` com as props `loading`, `busy`, `hasUnavailableItems`, `getHref` e `onRemove` e o comportamento de `shared/design-system` ("Painel da sacola"):
  - linhas com foto, link, unidade e preço unitário, stepper com `max`, total e lixeira;
  - linha indisponível;
  - blocos de carregamento;
  - rodapé com valores atenuados e `aria-busy`, aviso de indisponíveis e botão bloqueado.

  Verificar que `npm run lint --workspace=@jaja/frontend` passa e, na tarefa 8.3, os estados na gaveta.

## 7. Frontend: loja e checkout (subagente Frontend)

- [x] 7.1 Em `storefront-shell.component.tsx`, usar `CartProvider`/`useCart` de `@/modules/orders/data/cart.context` e ligar o `CartDrawer` e o contador do cabeçalho ao carrinho, com `getHref` por `productRoute(slug, storefront.query)`. Verificar, na tarefa 8.1, que o contador muda na hora e que o link da linha leva ao produto com os parâmetros da vitrine.
- [x] 7.2 Em `storefront-product-grid.component.tsx`, incluir `id` em `toStoreProduct` e passar `getQuantity`, `max` 99 e, só com `storefront.served`, `onChangeQuantity` por `cart.setQuantity`. Verificar, na tarefa 8.1, o "+" na página inicial, na listagem e em "Mais de <categoria>", e a ausência dele com `bairro=Papicu`.
- [x] 7.3 Em `product-detail.component.tsx`:
  - "Adicionar" chama `cart.add`, com "Adicionando…", o toast "Adicionado ao carrinho" com a ação "Ver carrinho", a quantidade de volta a 1 e o toast de erro traduzido;
  - "Você já tem N no carrinho.";
  - stepper com `max` 99;
  - constantes de entrega de `@/modules/orders/data/cart.util`;
  - sem "Carrinho chega já já.".

  Verificar que `grep -n "Carrinho chega já já" -r apps/frontend/src` retorna vazio e, na tarefa 8.1, o fluxo no detalhe.
- [x] 7.4 Em `checkout.page.tsx`:
  - `useCart` de `../data/cart.context` e `cart.refresh()` ao montar o `CheckoutForm`;
  - resumo com foto, "× quantidade", total da linha, linha indisponível com "Remover" e blocos de carregamento;
  - `canConfirm` com `!cart.loading`, `!cart.isSyncing`, `cart.count > 0` e `!cart.hasUnavailableItems`;
  - o texto "Remova os itens indisponíveis para confirmar o pedido.";
  - confirmação mock aguardando `cart.clear()` e ficando em `/checkout` se falhar.

  Verificar que `npm run lint --workspace=@jaja/frontend` passa e, na tarefa 8.3, o checkout.
- [x] 7.5 Atualizar `apps/frontend/DESIGN.md` (gaveta, persistência e mescla, "+" nos cards, "Adicionar" no detalhe e resumo do checkout) e `src/modules/orders/index.ts`. Verificar que `grep -n "ainda sem carrinho\|jaja.cart\`" apps/frontend/DESIGN.md` não encontra o texto antigo, e que `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` passam.

## 8. Verificação integrada no navegador (subagente Frontend)

- [x] 8.1 Com o banco semeado, backend e frontend no ar e o painel do navegador visível, verificar sem sessão os cenários de `orders/storefront-cart` e `shared/design-system`:
  - "+" em card da página inicial vira o stepper e o contador muda;
  - gaveta com foto, preço atual, entrega de R$ 4,90 e "Faltam R$ X para a entrega grátis.", e "Grátis" a partir de R$ 79,00;
  - recarga mantendo o carrinho, segunda aba sincronizada e `jaja.cart` removida;
  - stepper parando em 99;
  - no detalhe, "Adicionar" com quantidade 3 (toast com "Ver carrinho", que abre a gaveta), "Você já tem 3 no carrinho." e o botão indisponível com `bairro=Papicu`;
  - em 375px, a gaveta na largura da tela e os steppers cabendo na grade de 2 colunas.
- [x] 8.2 Verificar a mescla (a mescla ao entrar pelo `/checkout` foi conferida entrando numa conta existente, que usa o mesmo caminho de mescla da criação de conta):
  - numa conta com itens no carrinho (colocados antes nesta verificação), sair, montar um carrinho de visitante com um produto em comum e outro novo, e entrar: quantidades somadas com teto de 99, `localStorage['jaja.guest-cart']` vazio e gaveta com os itens juntos;
  - "sair" zera o contador, e entrar de novo traz o carrinho da conta;
  - criar conta em `/checkout` com itens de visitante leva os itens ao resumo.
- [x] 8.3 Verificar indisponibilidade e checkout:
  - com o carrinho da conta, desativar no admin um produto que está nele, abrir a gaveta e ver "Indisponível", o aviso e "Finalizar pedido" bloqueado;
  - no `/checkout`, "Confirmar pedido" bloqueado com o texto sobre itens indisponíveis;
  - remover o item libera a confirmação, que esvazia o carrinho (contador 0 ao voltar para a loja);
  - reativar o produto no fim.
- [x] 8.4 Verificar que não houve regressão ("sair" em `/checkout` não pôde ser exercido: o cabeçalho compacto do checkout não tem "Sair" desde o commit `fa20034`, sem mudança nesta change):
  - vitrine com busca, filtros e paginação;
  - `/admin/catalog/products` e `/admin/customers` listando;
  - dados de entrega do checkout salvando e mostrando o resumo;
  - "sair" em `/checkout` voltando ao formulário de entrar/criar conta.

> **Ao arquivar esta change:** conferir em `openspec/specs/admin/admin-api-authorization/spec.md` que "Endpoints não administrativos não mudam" mantém as partes de lojas, clientes e carrinho, se `cadastro-cliente` for arquivada depois desta (Decisão 11 do `design.md`). Ajustar à mão o `## Purpose` de `openspec/specs/catalog/storefront/spec.md`, que ainda menciona "como a sacola se comporta nesta entrega", e o de `openspec/specs/orders/checkout-access/spec.md`, que exclui do escopo o resumo do pedido; deltas não alteram o Purpose.
