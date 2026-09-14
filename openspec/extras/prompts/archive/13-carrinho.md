# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Pacote de domínio: `modules/orders` (`@jaja/orders`). Hoje o pacote só tem o scaffold gerado sem spec: o agregado `orders` (no plural), com a entidade `Orders` sem atributos, `CreateOrders`, `OrdersDTO` só com `id`, um mock e um teste de exemplo. **Esse scaffold será substituído** pelo agregado `cart` descrito abaixo: apagar `modules/orders/src/orders/**`, `modules/orders/test/orders/**` e `modules/orders/test/mock/in-memory-orders.repository.ts`, mantendo `getModuleName` e `test/index.test.ts`. No backend, `orders.controller.ts` (endpoint de exemplo `GET /orders`) e `orders.prisma.ts` (vazio) também serão substituídos, e `apps/backend/prisma/models/orders.model.prisma` ainda não tem models. No frontend, `modules/orders` já tem o checkout (`pages/checkout.page.tsx`), o acompanhamento (`tracking.page.tsx`, mock) e o dashboard do admin (`orders-dashboard.component.tsx`, mock), que continuam. Shared: `@mentoria-360/shared` (submódulo em `packages/shared`). Skills em `.claude/skills/*`; padrão de nomes em `.claude/skills/skills-standards.md`.
- **Objetivo:** tornar real o carrinho da loja, deixando o fechamento do pedido para a próxima funcionalidade. Situação atual:
  - `apps/frontend/src/modules/catalog/data/cart.context.tsx` guarda `{ slug: quantidade }` no `localStorage` (`jaja.cart`) com um store externo lido por `useSyncExternalStore`, e resolve os itens com `findProduct` dos 26 produtos fictícios de `storefront.mock.ts`;
  - os totais vêm de `calculateCartTotals` (`src/shared/util/cart.util.ts`): entrega de R$ 4,90 abaixo de R$ 79,00 e grátis a partir disso ou com o carrinho vazio;
  - a gaveta é `CartDrawer` (`src/shared/components/store/cart-drawer.component.tsx`), e o checkout lê `useCart` (itens, totais e `clear` no "Confirmar pedido", que é mock);
  - desde o prompt 12 a vitrine e o detalhe usam o catálogo real, mas os cards **não** exibem o "+", e o botão "Adicionar" do detalhe só mostra o aviso "Carrinho chega já já.".
- **Decisão de arquitetura: carrinho no servidor por usuário, carrinho do visitante no navegador e mescla ao entrar.**
  - **Visitante (sem sessão):** o carrinho continua no `localStorage`, agora com `productId` e quantidade. As linhas (nome, foto, preço atual, disponibilidade) e os totais vêm de um endpoint público de prévia calculado pelo backend.
  - **Com sessão:** o carrinho é o agregado `cart` do `@jaja/orders`, um por **usuário** (e não por cliente: quem ainda não preencheu os dados de entrega também tem carrinho), acessado por `/me/cart`. Ao entrar ou criar conta, os itens do visitante são **mesclados** no carrinho da conta e apagados do navegador. Ao sair, a loja volta ao carrinho do visitante (vazio depois da mescla), e o carrinho da conta continua salvo para o próximo acesso.
  - **Limites do domínio:** o pacote conhece só `userId` e `productId` e não importa `@jaja/auth` nem `@jaja/catalog`; os vínculos com `users` e `products` ficam no Prisma, como em `customers`.
  - **Preço:** o carrinho **não guarda preço**. Linhas e totais usam sempre o preço atual do catálogo. Congelar o preço é papel do pedido, na próxima funcionalidade.
  - **Disponibilidade:** um produto está disponível quando é visível na loja (mesma regra de `openspec/specs/catalog/storefront-api/spec.md`). Um item que deixou de estar disponível continua no carrinho, marcado como indisponível, fora dos totais e bloqueando "Finalizar pedido" até ser removido.
- Spec desta funcionalidade: change `openspec/changes/carrinho`, gerada a partir deste prompt. Em caso de dúvida sobre comportamento, valem as specs e o `design.md` da change.
- **Leitura em CQRS (vale para as três partes):** consultas não seguem o caminho dos comandos.
  - Cada consulta é uma **interface `*Query`** no módulo (em `provider/`, com os DTOs em `dto/`). O adapter Prisma a implementa como atributo público tipado, e o controller a **chama direto**, sem caso de uso e sem entidade.
  - A leitura do carrinho (linhas com nome, foto, preço atual e disponibilidade; `itemCount`, subtotal, frete e total) é calculada **no SQL**, com as constantes de frete do domínio passadas como parâmetros. O adapter só mapeia as linhas para DTO. Não criar `find-*.use-case.ts`, serviço de domínio para os totais nem teste unitário para as queries: o comportamento delas é coberto pelo `.http`.
  - Os comandos (incluir, alterar quantidade, remover, esvaziar, mesclar) passam pela entidade, pelo repositório e pelos casos de uso. Eles podem depender de uma query para verificar a disponibilidade dos produtos (`FindAvailableProductIdsQuery`), que é uma dependência do comando e não um caso de uso de leitura. Os casos de uso devolvem `Result<void>`: a resposta HTTP é sempre a leitura `CartDetailDTO`, feita pelo controller logo depois do comando.
- **Referências de código** (o código é a fonte da verdade do **padrão**; este prompt é a fonte da verdade das **regras**):
  - domínio: `modules/customers/src/customer/**` (agregado 1:1 com o usuário, `errors.ts`, repositório com `findByUserId`, mock e testes em `modules/customers/test/**`); `modules/catalog/src/product/model/product.entity.ts` e `product-image.vo.ts` (lista de VOs sem identidade própria, substituída inteira, com limite de itens, constantes de limite em `product/errors.ts` e validação com `Result.combine`), com os testes em `modules/catalog/test/product/**`;
  - backend:
    - `apps/backend/src/modules/customers/`: `customer.prisma.ts` (mapeamento de `P2002`/`P2003` por constraint), `my-customer.controller.ts` (rota `/me/*` com `JwtGuard` e `@CurrentUser('id')`), `customer-http.ts`, `customers.module.ts` e `test/customer.integration.http`;
    - `apps/backend/src/modules/catalog/`: `product.prisma.ts` (gravação das imagens junto do produto com `deleteMany` + `createMany`, `$queryRaw` com `Prisma.sql`, `isUuid`), `storefront.sql.ts` (fragmento `visibleProducts`), `storefront.controller.ts` (rota pública sem guard, normalização dos parâmetros) e `test/storefront.integration.http`;
  - frontend:
    - o carrinho atual: `modules/catalog/data/cart.context.tsx`, `src/shared/util/cart.util.ts` e os componentes de loja em `src/shared/components/store/` (`cart-drawer`, `product-card`, `product-grid`, `quantity-stepper`, `store.types.ts`);
    - onde o carrinho é usado: `modules/catalog/components/` (`storefront-shell`, `storefront-product-grid`, `product-detail`) e `modules/orders/pages/checkout.page.tsx`;
    - padrões a seguir: `modules/customers/data/use-my-customer.hook.ts` (estado chaveado pelo token da sessão), `modules/customers/data/customer.api.ts` e `modules/catalog/data/storefront.api.ts` (tipos da API espelhados no frontend).
- Backend é ESM (`"type": "module"`): imports relativos com sufixo `.js`; testes com Vitest. `@jaja/orders` é consumido via `dist`: rodar `npm run build --workspace=@jaja/orders` antes de usá-lo no backend. **Não há guard global**: uma rota sem `@AdminOnly()` e sem `@UseGuards(JwtGuard)` já é pública. Endpoints do próprio usuário usam `@UseGuards(JwtGuard)` (`apps/backend/src/shared/auth/jwt.guard.ts`) e `@CurrentUser('id')`. `PrismaService` (`apps/backend/src/db/prisma.service.ts`) implementa `TransactionManager` e exporta `PrismaTransactionContext`. VOs do shared: `Id` (`Id.required` para obrigatórios), `PositiveInteger` (só aceita mínimo; o máximo da quantidade é regra do módulo), `Flag`, `Order`. `Entity.cloneWith(overrides)` revalida por `tryCreate` e substitui arrays inteiros. Casos de uso implementam `UseCase<Input, Output>`. Os testes do pacote usam jest.
- Frontend em Next.js 16 com React 19 e React Compiler. O frontend **não importa** os pacotes `@jaja/*` no código: tipos e constantes da API são espelhados em `data/*.api.ts`/`*.util.ts`, como `STOREFRONT_PRODUCT_SORTS` em `storefront.api.ts`.
  - **Sessão:** vem de `useAuth()` (`session.token`, `user`, `isAuthenticated`, `signOut`), num cookie lido de forma síncrona no cliente; no servidor a sessão é `null`, por isso o cabeçalho usa `useHydrated`. `AuthProvider` fica no layout raiz, por fora do `StorefrontShell` de `src/app/(public)/layout.tsx`.
  - **API e mensagens:** `apiRequest`/`ApiError`/`toErrorMessage` de `src/shared/util/api-client.util.ts` (o `token` é opcional); mensagens dos códigos em `src/shared/i18n/messages.pt.ts` e `messages.en.ts` (`getMessage`); toasts com `sonner`.
  - **Bairro:** continua simulado em `useStorefront()` (`served`, `etaMinutes`, `query`). Design em `apps/frontend/DESIGN.md`.
- **Changes em andamento:** `cadastro-cliente` ainda está em `openspec/changes/` (faltam as conferências no navegador 8.1 a 8.3). Ela altera `orders/checkout-access` ("Estado autenticado do checkout", "Dados de entrega do cliente no checkout" e "Confirmar pedido exige cadastro de cliente") e `admin/admin-api-authorization` ("Endpoints não administrativos não mudam"). Se ela ainda não tiver sido arquivada quando esta change for gerada, os deltas desta change partem do texto já alterado por ela.
- **Fora do escopo desta funcionalidade:**
  - checkout e pedido: agregado de pedido, `POST /orders`, `customerId`, preço congelado, pagamento e as regras prometidas no prompt 11 (vínculo do pedido com o cliente, exigir cadastro de cliente e bloquear cliente inativo), que ficam para o prompt que criar o agregado de pedido. O "Confirmar pedido" continua mock (`nextOrderId`), mas passa a esvaziar o carrinho da conta;
  - estoque e reserva de itens, aviso de "o preço mudou", cupons, "salvar para depois", expiração ou limpeza de carrinhos antigos;
  - frete por bairro ou distância (a regra de R$ 4,90 abaixo de R$ 79,00 continua fixa);
  - carrinhos no admin (carrinhos abandonados) e os dashboards mock;
  - atualização em tempo real do carrinho da conta entre dispositivos: ele é recarregado ao montar, ao trocar de sessão, ao abrir a gaveta e ao abrir o checkout;
  - seed de carrinhos: eles nascem do uso, e nenhuma task entra em `seedTasks`.

# Negócio

- Apagar o scaffold `orders` (ver Contexto) e criar o agregado `cart` (skill: module-aggregate). A skill exige `--mode crud|example`: usar `--mode example` e apagar o use case e o teste gerados, mantendo apenas `model/`, `provider/`, `dto/` e o mock in-memory (`modules/orders/test/mock/in-memory-cart.repository.ts`). Criar `modules/orders/src/cart/errors.ts` com:
  - `CartErrors` (objeto `as const`): `CART_NOT_FOUND`, `CART_ALREADY_EXISTS`, `CART_USER_NOT_FOUND`, `CART_PRODUCT_NOT_FOUND`, `CART_ITEM_QUANTITY_INVALID`, `CART_ITEM_QUANTITY_EXCEEDED`, `CART_ITEMS_LIMIT_EXCEEDED` e `CART_ITEM_DUPLICATED`, e o tipo `CartErrorCode`;
  - as constantes, documentadas com JSDoc, no mesmo lugar em que `PRODUCT_MAX_IMAGES` fica em `product/errors.ts`: `CART_MAX_ITEMS = 50` (produtos diferentes), `CART_ITEM_MAX_QUANTITY = 99` (unidades por produto), `DELIVERY_FEE_CENTS = 490` e `FREE_DELIVERY_THRESHOLD_CENTS = 7900`. A regra de frete será reutilizada pelo pedido na próxima funcionalidade.

  Criar `modules/orders/src/cart/index.ts` reexportando `dto`, `errors`, `model`, `provider` e `use-case`, e trocar `./orders` por `./cart` em `modules/orders/src/index.ts`.

- Criar o objeto de valor `model/cart-item.vo.ts` (`CartItem`, VO composto como `ProductImage`) (skill: module-value-object):
  - `productId` — obrigatório (`Id.required`);
  - `quantity` — inteiro de 1 a `CART_ITEM_MAX_QUANTITY`; qualquer outro valor (0, 100, 1.5, texto, ausente) falha com `CART_ITEM_QUANTITY_INVALID`.

  Expor getters, `withQuantity(quantity): Result<CartItem>`, `toProps()` e `toDTO()`. Um item não tem identidade própria: a lista é sempre gravada inteira.

- Criar a entidade `Cart` em `model/cart.entity.ts` (`CartProps extends EntityProps`) com os atributos:
  - `id` — identificador único (`Id`)
  - `userId` — usuário dono do carrinho (obrigatório, `Id.required`); único (um carrinho por usuário); não muda depois da criação
  - `items` — lista de `CartItem` na ordem de inclusão (padrão `[]`)

  Invariantes da entidade:
  - no máximo `CART_MAX_ITEMS` itens → `CART_ITEMS_LIMIT_EXCEEDED`;
  - um `productId` aparece uma única vez → `CART_ITEM_DUPLICATED`.

  Validar com `Result.combine`, expor `create`/`tryCreate`, getters, `itemCount` (soma das quantidades), `quantityOf(productId)` (0 quando ausente) e `toDTO()`. Métodos de comportamento, todos puros, devolvendo `Result<Cart>` por `cloneWith` com `updatedAt: new Date()`: (skill: module-entity)
  - `addItem(productId, quantity)`: produto já no carrinho soma a quantidade, mantendo a posição, e a soma acima de `CART_ITEM_MAX_QUANTITY` falha com `CART_ITEM_QUANTITY_EXCEEDED`; produto novo entra no fim da lista. Quantidade inválida → `CART_ITEM_QUANTITY_INVALID`;
  - `setItemQuantity(productId, quantity)`: substitui a quantidade mantendo a posição ou, se o produto não estiver no carrinho, inclui no fim;
  - `removeItem(productId)`: remove o item; produto ausente devolve o próprio carrinho, sem mudar `updatedAt`;
  - `clear()`: esvazia a lista;
  - `merge(items)`, para a mescla do carrinho do visitante:
    - percorre os itens na ordem recebida;
    - produto já no carrinho soma a quantidade, limitada a `CART_ITEM_MAX_QUANTITY`;
    - produto novo entra no fim enquanto houver espaço, e o que passar de `CART_MAX_ITEMS` é ignorado;
    - itens com quantidade inválida são ignorados;
    - nunca falha por causa dos itens.

- Criar a interface `cart.repository` em `provider/` estendendo `CrudRepository<Cart>` e adicionando `findByUserId(userId: string): Promise<Result<Cart | null>>` (ok com `null` quando o usuário não tem carrinho). `findById` segue o contrato do shared e falha com `CART_NOT_FOUND`. `delete` faz soft delete, mas nenhum caso de uso o utiliza (existe só pelo contrato). Registros com `deletedAt` preenchido nunca são retornados. (skill: module-repository)

- Criar os DTOs em `dto/cart.dto.ts` (skill: module-dto):
  - `CartItemDTO` (`productId`, `quantity`) e `CartDTO` (`id`, `userId`, `items: CartItemDTO[]`, `createdAt`, `updatedAt`), devolvido por `toDTO()`;
  - `CartItemInputDTO` (`productId`, `quantity`), usado pela prévia e pela mescla;
  - `CartLineDTO` (`productId`, `slug`, `name`, `unit`, `rootCategorySlug`, `thumbUrl` (miniatura da imagem principal ou `null`), `priceCents` e `listPriceCents` (preços atuais), `quantity`, `isAvailable`, `lineTotalCents` = `priceCents * quantity`, ou `null` quando indisponível);
  - `CartDetailDTO` (`lines: CartLineDTO[]` na ordem de inclusão, `itemCount` (soma das quantidades de todas as linhas, inclusive indisponíveis), `subtotalCents` (só das linhas disponíveis), `deliveryFeeCents` (0 quando o subtotal é 0 ou ≥ `FREE_DELIVERY_THRESHOLD_CENTS`, senão `DELIVERY_FEE_CENTS`), `totalCents`, `freeDeliveryThresholdCents`, `missingForFreeDeliveryCents` (0 quando o frete é grátis) e `hasUnavailableItems`).

- Criar as interfaces de query em `provider/`, documentando o comportamento no JSDoc de cada uma (skill: module-query-cqrs, só contrato e DTOs):
  - `find-available-product-ids.query.ts` — `FindAvailableProductIdsQuery`, `execute(productIds: string[]): Promise<Result<string[]>>`: devolve os ids, sem repetição, dos produtos **visíveis na loja** (não excluídos, ativos, com a categoria e todas as ancestrais ativas e não excluídas). Ids malformados ou inexistentes ficam de fora, sem falha. Usada pelos casos de uso.
  - `find-cart-by-user-id.query.ts` — `FindCartByUserIdQuery`, `execute(userId: string): Promise<Result<CartDetailDTO>>`: o carrinho do usuário. Sem carrinho (ou com `userId` malformado), devolve o carrinho vazio (`lines: []`, totais 0), nunca `null`. Todo item vira linha, inclusive os de produto excluído ou inativo (com `isAvailable: false`).
  - `preview-cart.query.ts` — `PreviewCartQuery`, `execute(items: CartItemInputDTO[]): Promise<Result<CartDetailDTO>>`: a mesma projeção para o carrinho do visitante, a partir dos itens recebidos, já normalizados pelo chamador. Mantém a ordem da entrada, e `productId` sem produto na tabela é omitido.

- Criar os casos de uso em `modules/orders/src/cart/use-case`. Todos recebem por parâmetro o repositório `cart`, e os que incluem produtos também recebem `FindAvailableProductIdsQuery`. Todos implementam `UseCase<Input, void>`, e `userId` ausente ou malformado falha com o erro do `Id`. (skill: module-use-case)
  1. `add-cart-item.use-case` (`AddCartItem`, entrada `{ userId, productId, quantity }`):
     - valida `productId` e `quantity` com o VO antes de qualquer consulta;
     - verifica que o produto está disponível → `CART_PRODUCT_NOT_FOUND`;
     - busca o carrinho com `findByUserId`: sem carrinho, cria um com `Id.createUUID()` e o item e persiste com `create`; com carrinho, aplica `addItem` e persiste com `update`.
  2. `set-cart-item-quantity.use-case` (`SetCartItemQuantity`, entrada `{ userId, productId, quantity }`): mesmas verificações e o mesmo fluxo, com `setItemQuantity`. A disponibilidade vale **também para um item que já está no carrinho**: produto indisponível só pode ser removido.
  3. `remove-cart-item.use-case` (`RemoveCartItem`, entrada `{ userId, productId }`): `productId` malformado → erro do `Id`; sem carrinho ou sem o item, termina ok sem persistir. Não verifica disponibilidade.
  4. `clear-cart.use-case` (`ClearCart`, entrada `{ userId }`): sem carrinho, termina ok sem persistir; com carrinho vazio, também não persiste; com itens, aplica `clear` e persiste com `update`.
  5. `merge-cart.use-case` (`MergeCart`, entrada `{ userId, items: CartItemInputDTO[] }`):
     1. descarta os itens com `productId` ou `quantity` inválidos, sem falhar;
     2. soma as quantidades de um `productId` repetido;
     3. consulta a disponibilidade de todos os produtos **numa única chamada** e descarta os indisponíveis;
     4. sem itens restantes, termina ok sem criar carrinho;
     5. sem carrinho, cria um e aplica `merge`; com carrinho, aplica `merge` e persiste.

- Ajustar o mock `test/mock/in-memory-cart.repository.ts` para espelhar as restrições do banco:
  - `userId` único também para registros excluídos (`create` com `userId` já usado falha com `CART_ALREADY_EXISTS`);
  - `create` com id já existente falha com `CART_NOT_FOUND`;
  - `update` e `delete` de registro inexistente ou excluído falham com `CART_NOT_FOUND`;
  - buscas ignoram registros excluídos.

  Criar `test/mock/in-memory-find-available-product-ids.query.ts`, com o conjunto de ids disponíveis configurável no teste e um contador de chamadas.

- Criar testes unitários (jest, em `modules/orders/test/cart/`) para:
  - o VO (`cart-item.vo.test.ts`): `productId` ausente e malformado, quantidade 0, 1, 99, 100, 1.5 e texto, e `withQuantity`;
  - a entidade (`cart.entity.test.ts`):
    - `userId` obrigatório, itens duplicados e 51 itens;
    - `addItem`: soma mantendo a posição, produto novo no fim e soma acima de 99;
    - `setItemQuantity`: mantém a posição e inclui produto ausente;
    - `removeItem` de produto ausente sem mudar `updatedAt`, e `clear`;
    - `merge`: soma com teto de 99, ignora o que passa de 50 itens e ignora quantidade inválida;
    - `itemCount` e `quantityOf`;
  - os casos de uso, um arquivo `<nome>.use-case.test.ts` por caso de uso, com os mocks in-memory:
    - add: cria o carrinho no primeiro item; soma no mesmo produto; produto indisponível falha sem criar carrinho; quantidade inválida falha sem consultar a disponibilidade; soma acima de 99; 51º produto;
    - set: inclui produto ausente; altera mantendo a posição; produto indisponível que já está no carrinho falha;
    - remove: sem carrinho; produto ausente; remove produto indisponível;
    - clear: sem carrinho; com itens;
    - merge: sem carrinho cria; com carrinho soma com teto; ignora indisponíveis e inválidos; soma repetidos; lista vazia ou só com itens descartados não cria carrinho; uma única consulta de disponibilidade.

  Rodar `npm test --workspace=@jaja/orders` e `npm run build --workspace=@jaja/orders`.

> Os passos dos casos de uso podem gerar erros e parar o processo.

# Backend

- Mapear o agregado em `apps/backend/prisma/models/orders.model.prisma` (skill: backend-prisma-data):
  - model `Cart`, tabela `carts` (`@@map`): `id String @id @db.Uuid`, `userId String @unique @map("user_id") @db.Uuid` com relação obrigatória para `User` (`onDelete: Restrict`), `createdAt @default(now())`, `updatedAt @updatedAt`, `deletedAt` opcional e `items CartItem[]`;
  - model `CartItem`, tabela `cart_items`: `id String @id @default(uuid()) @db.Uuid`, `cartId` com FK para `Cart` (`onDelete: Cascade`), `productId` com FK para `Product` (`onDelete: Restrict`), `quantity Int`, `position Int`, `@@unique([cartId, productId])`, `@@unique([cartId, position])` e `@@index([productId])`; colunas em snake_case via `@map`;
  - relações inversas: `cart Cart?` no model `User` (`auth.model.prisma`) e `cartItems CartItem[]` no model `Product` (`catalog.model.prisma`);
  - comentar acima dos models: o carrinho é 1:1 com o usuário (`userId` continua reservado para registros excluídos); os itens não têm identidade no domínio e são substituídos inteiros a cada gravação, com `position` normalizado para 0..n-1 (ordem de inclusão); nenhum preço é guardado; e um produto excluído (soft delete) mantém a FK e aparece como linha indisponível. A exclusão lógica de produtos **não** é bloqueada por carrinhos.
- Executar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name orders_cart` e conferir que a migration só cria as tabelas e os índices do carrinho, sem mexer em `products.search_document`. Depois, `npm run prisma:generate --workspace=@jaja/backend`.
- Mover `apps/backend/src/modules/catalog/storefront.sql.ts` para `apps/backend/src/db/visible-products.sql.ts`, mantendo `visibleProducts` e o comentário, e ajustar os imports de `product.prisma.ts` e `category.prisma.ts`. O carrinho usa a mesma regra de visibilidade, e um módulo do backend não importa arquivos de outro (mesmo motivo da mudança de `text-search.sql.ts` no prompt 11).
- Apagar `orders.controller.ts` e `orders.prisma.ts` e criar `apps/backend/src/modules/orders/cart.prisma.ts` (`CartPrisma`, `@Injectable()`, `implements CartRepository`):
  - métodos do repositório no padrão de `customer.prisma.ts`: `Result.tryAsync`, `toDomain`/`fromDomain` e o client da transação quando receber `tx`; todas as buscas filtram `deletedAt: null`; id que não é uuid não vai ao banco. `create` grava o carrinho e os itens na mesma operação. `update` roda numa transação que atualiza o carrinho e substitui os itens com `deleteMany` + `createMany` (`position` = índice), seguindo `ProductPrisma`;
  - `P2002` mapeado por constraint (`UNIQUE_VIOLATIONS`): `carts_user_id_key` → `CART_ALREADY_EXISTS` (dois primeiros itens simultâneos do mesmo usuário) e `carts_pkey` → `CART_NOT_FOUND`. `P2003` mapeado pela FK violada: a de `user_id` → `CART_USER_NOT_FOUND`, a de `product_id` → `CART_PRODUCT_NOT_FOUND` (produto removido entre a verificação e a gravação);
  - queries implementadas na mesma classe como atributos públicos tipados (`findAvailableProductIds: FindAvailableProductIdsQuery`, `findCartByUserId: FindCartByUserIdQuery`, `previewCart: PreviewCartQuery`), em SQL cru (`$queryRaw` com `Prisma.sql`), mapeando direto para DTO:
    - `findAvailableProductIds`: descarta ids que não são uuid e repetidos (lista vazia não vai ao banco) e seleciona `p.id` com o fragmento `visibleProducts()` e `p.id = ANY(<ids>::uuid[])`;
    - `findCartByUserId` e `previewCart` compartilham um único construtor de SQL que recebe a origem dos itens como CTE `items(product_id, quantity, position)`: para a conta, `cart_items` do carrinho não excluído do usuário (`userId` que não é uuid devolve o carrinho vazio sem ir ao banco); para a prévia, `unnest(<ids>::uuid[], <quantidades>::int[]) WITH ORDINALITY` (lista vazia devolve o carrinho vazio sem ir ao banco). A partir dela, **uma única consulta** faz:
      - junta `products` (inclusive excluídos e inativos; `product_id` sem produto some no `JOIN`);
      - resolve a categoria raiz com joins até o avô (`coalesce` dos slugs) e a imagem principal (`order = 0`) com `LEFT JOIN LATERAL`;
      - calcula `is_available` com uma subconsulta `EXISTS` sobre `visibleProducts()`, sem conflito com os aliases do fragmento (`p`, `c1`, `c2`, `c3`, `b`);
      - agrega as linhas em `json_agg(... ORDER BY position)` e calcula `item_count`, `subtotal_cents` (só disponíveis), `delivery_fee_cents`, `total_cents`, `missing_for_free_delivery_cents` e `has_unavailable_items` no próprio SQL, com `DELIVERY_FEE_CENTS` e `FREE_DELIVERY_THRESHOLD_CENTS` importados de `@jaja/orders` como parâmetros.

    O adapter só converte a linha única para `CartDetailDTO`, sem filtro, soma ou regra.
- Criar `apps/backend/src/modules/orders/cart-http.ts`, compartilhado pelos dois controllers:
  - os corpos tipados `AddCartItemBody` (`productId`, `quantity?`), `SetCartItemQuantityBody` (`quantity`) e `CartItemsBody` (`items`);
  - `toGuestItems(body)`, que normaliza os itens vindos do navegador sem nunca falhar: `items` que não é array vira `[]`; descarta entradas sem `productId` uuid ou sem `quantity` inteira ≥ 1; soma `productId` repetido; limita cada quantidade a `CART_ITEM_MAX_QUANTITY`; mantém os primeiros `CART_MAX_ITEMS` produtos;
  - `throwFailure(errors)`, sem códigos repetidos: `CART_PRODUCT_NOT_FOUND` e `CART_USER_NOT_FOUND` → `NotFoundException`; `CART_ALREADY_EXISTS` → `ConflictException`; demais falhas → `BadRequestException` com os códigos.
- Criar dois controllers e registrá-los, com `CartPrisma` em `providers` e `exports`, em `apps/backend/src/modules/orders/orders.module.ts`, ajustando `index.ts` (skill: backend-controller):
  - `my-cart.controller.ts` (`MyCartController`, `@Controller('me/cart')`, `@UseGuards(JwtGuard)` na classe; qualquer usuário autenticado, administrador ou não; `401` sem token). O `userId` vem sempre de `@CurrentUser('id')`. Cada comando instancia o caso de uso com `CartPrisma` (repositório e query de disponibilidade) e, em caso de sucesso, responde `200` com `findCartByUserId`:
    - `GET /me/cart` — `findCartByUserId` direto; carrinho vazio quando o usuário ainda não tem um;
    - `POST /me/cart/items` — `AddCartItem`; `quantity` ausente vale 1 (`@HttpCode(200)`, porque devolve o carrinho);
    - `PUT /me/cart/items/:productId` — `SetCartItemQuantity`;
    - `DELETE /me/cart/items/:productId` — `RemoveCartItem`;
    - `DELETE /me/cart` — `ClearCart`;
    - `POST /me/cart/merge` — `MergeCart` com os itens de `toGuestItems` (`@HttpCode(200)`).
  - `cart.controller.ts` (`CartController`, `@Controller('cart')`, **sem guard**; um `Authorization`, válido ou não, é ignorado):
    - `POST /cart/preview` — `@HttpCode(200)`; normaliza com `toGuestItems` e chama `previewCart` direto. Só lê dados e nunca responde `400` por itens malformados.
- Criar `apps/backend/src/modules/orders/test/cart.integration.http` (Rest Client, estilo de `customer.integration.http`):
  - cabeçalho com os pré-requisitos: backend rodando e seeds `auth` e `catalog` aplicados;
  - variáveis `@baseUrl`, `@adminEmail = usuario@formacao.dev` e `@seedPassword = #Senha123`;
  - um usuário novo criado por `POST /auth/register` com email de sufixo de timestamp, seguido de login, para o arquivo poder ser executado de novo;
  - ids de produtos obtidos por requisições nomeadas: `GET /storefront/products` para produtos disponíveis (um de preço baixo e outro de preço ≥ R$ 79,00, com `sort`) e `GET /products?search=10n0595&isActive=false` com token de administrador para o produto inativo do seed.

  Cenários:
  - **acesso:** `GET /me/cart` sem token (401); `POST /cart/preview` sem token (200);
  - **usuário novo:** `GET /me/cart` com `lines: []` e totais 0;
  - **inclusão e quantidade:**
    - `POST /me/cart/items` com o produto A e `quantity: 2` (200, `itemCount: 2`, `deliveryFeeCents: 490`, `missingForFreeDeliveryCents` calculado);
    - de novo o A com `quantity: 3` (soma 5); o produto B sem `quantity` (vale 1);
    - `PUT` do A com `quantity: 1`, mantendo a posição; `PUT` de um produto C fora do carrinho, que entra no fim;
  - **erros:**
    - `quantity` 0, 100, 1.5 e `"abc"` (400 `CART_ITEM_QUANTITY_INVALID`);
    - `POST` do A com `quantity: 99` quando já tem 1 (400 `CART_ITEM_QUANTITY_EXCEEDED`);
    - `productId` malformado (400 com o código do `Id`);
    - uuid inexistente e o produto inativo do seed (404 `CART_PRODUCT_NOT_FOUND`);
  - **frete:** um produto que leva o subtotal a ≥ R$ 79,00 (`deliveryFeeCents: 0`, `missingForFreeDeliveryCents: 0`);
  - **indisponibilidade:**
    - com token de administrador, `PUT /products/:id` desativando o produto B;
    - `GET /me/cart` com a linha B em `isAvailable: false`, `lineTotalCents: null` e `hasUnavailableItems: true`, fora do subtotal;
    - `PUT` do B (404 `CART_PRODUCT_NOT_FOUND`), depois `DELETE /me/cart/items/:productId` do B (200);
    - **reativar o produto B**, deixando o seed como estava;
  - **remoção idempotente:** `DELETE` de um item que não está no carrinho (200, carrinho igual);
  - **mescla:** `POST /me/cart/merge` com o A (soma limitada a 99), um produto novo, o produto inativo, um uuid inexistente, um id malformado e uma quantidade 0 (200: só os válidos e disponíveis entram);
  - **prévia do visitante:** `POST /cart/preview` sem token com itens repetidos (somados), quantidade 150 (limitada a 99), id malformado (ignorado), uuid inexistente (omitido) e o produto inativo (linha com `isAvailable: false`);
  - **esvaziar:** `DELETE /me/cart` (200, vazio) duas vezes;
  - **administrador:** `GET /me/cart` com o token de `@adminEmail` (200, o carrinho do próprio administrador).

  O limite de 50 produtos fica coberto pelos testes unitários. Subir o backend (`npm run dev --workspace=@jaja/backend`, porta 4000) e validar as chamadas.
- Validação: `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` sem erros; `storefront.integration.http` continua passando depois da mudança de `visible-products.sql.ts`.

# Frontend

- Adicionar as mensagens de `CART_NOT_FOUND`, `CART_ALREADY_EXISTS`, `CART_USER_NOT_FOUND`, `CART_PRODUCT_NOT_FOUND` ("Produto indisponível."), `CART_ITEM_QUANTITY_INVALID` ("Quantidade inválida."), `CART_ITEM_QUANTITY_EXCEEDED` ("Limite de 99 unidades por produto."), `CART_ITEMS_LIMIT_EXCEEDED` ("O carrinho aceita até 50 produtos diferentes.") e `CART_ITEM_DUPLICATED` em `src/shared/i18n/messages.pt.ts` e `messages.en.ts`, na ordem alfabética das chaves.

- **Dados do carrinho** em `apps/frontend/src/modules/orders/data/` (flat; atualizar `data/index.ts`). O carrinho passa do módulo `catalog` para o `orders`: apagar `modules/catalog/data/cart.context.tsx` e `src/shared/util/cart.util.ts`.
  - `cart.api.ts` — tipos `CartLine`, `CartDetail` e `CartItemInput`, espelhando os DTOs; funções `getMyCart(token)`, `addMyCartItem(token, productId, quantity)`, `setMyCartItemQuantity(token, productId, quantity)`, `removeMyCartItem(token, productId)`, `clearMyCart(token)`, `mergeMyCart(token, items)` e `previewCart(items)` (sem token; lista vazia devolve o carrinho vazio sem chamar a API), todas sobre `apiRequest`, com `productId` em `encodeURIComponent`.
  - `cart.util.ts`:
    - `CART_ITEM_MAX_QUANTITY`, `CART_MAX_ITEMS`, `DELIVERY_FEE_CENTS` e `FREE_DELIVERY_THRESHOLD_CENTS`, com comentário de que espelham `@jaja/orders`;
    - `emptyCartDetail()`;
    - funções puras sobre a lista do visitante (`CartItemInput[]`), `addGuestItem`, `setGuestItemQuantity` (0 remove) e `removeGuestItem`, que devolvem `{ items }` ou `{ error: <código> }` com as mesmas regras da entidade (`CART_ITEM_QUANTITY_EXCEEDED`, `CART_ITEMS_LIMIT_EXCEEDED`, `CART_ITEM_QUANTITY_INVALID`).
  - `guest-cart-storage.util.ts` — o store externo do visitante, no mesmo formato de hoje (módulo + `useSyncExternalStore`, servidor e hidratação veem a lista vazia):
    - chave `jaja.guest-cart` com `[{ productId, quantity }]` na ordem de inclusão;
    - a leitura descarta entradas inválidas e aplica os limites, e a chave antiga `jaja.cart` (slugs do mock) é removida;
    - o evento `storage` sincroniza as abas;
    - sem `localStorage`, a lista continua em memória;
    - exporta `subscribe`, `getGuestItemsSnapshot`, `getGuestItemsServerSnapshot`, `commitGuestItems` e `clearGuestItems`.
  - `cart.context.tsx` — `CartProvider` e `useCart()`, com dois modos decididos por `useAuth().session`. **Visitante (sem sessão):**
    - os itens vêm do store do visitante;
    - o `CartDetail` vem de `previewCart`, pedido ~250 ms depois da última mudança dos itens, descartando respostas de chaves antigas e mantendo o detalhe anterior enquanto recarrega;
    - depois de uma resposta bem-sucedida, os `productId` que não voltaram (produto inexistente) são retirados do store;
    - erro da prévia vira `toast.error(toErrorMessage(error))`, mantendo os itens.

    **Conta (com sessão):** o estado é chaveado pelo token, como em `useMyCustomer`.
    - Ao surgir um token (entrar, criar conta ou abrir a loja já logado), se o visitante tiver itens, chama `mergeMyCart` e só apaga o store do visitante depois do sucesso. Sem itens do visitante, chama `getMyCart`.
    - Falha na mescla vira `toast.error`: os itens do visitante ficam guardados para uma nova tentativa na próxima montagem, e o carrinho da conta é carregado mesmo assim.
    - Os comandos rodam **em fila, um de cada vez**. A quantidade exibida muda na hora (atualização otimista), e o estado final é o `CartDetail` da última resposta.
    - Erro num comando vira `toast.error(toErrorMessage(error))` seguido de `refresh()`.
    - Sair (token `null`) volta ao modo visitante.

    Comum aos dois modos:
    - **expõe:** `detail`, `lines`, `count` (`itemCount`; no visitante, a soma local enquanto a primeira prévia não chega), `loading` (primeira carga, inclusive a mescla), `isSyncing` (há comando ou prévia pendente), `hasUnavailableItems`, `getQuantity(productId)`, `add(productId, quantity): Promise<boolean>`, `setQuantity(productId, quantity)` (0 remove), `remove(productId)`, `clear(): Promise<boolean>`, `refresh()`, `isOpen`, `open` e `close`;
    - **frescor:** `open` recarrega o carrinho da conta;
    - **erros de limite:** no visitante, as regras de `cart.util.ts` impedem a mudança e exibem `toast.error(getMessage(código))`.
  - Em `modules/catalog/data/storefront.mock.ts`, remover `findProduct` (fica sem uso) e manter o que os dashboards ainda usam (`PRODUCTS`, `CATEGORY_OPTIONS`, `categoryLabel`, `COURIERS_ONLINE`, `ZONES`, `ETA_BY_NEIGHBORHOOD`, `UNSERVED_NEIGHBORHOODS`, `storeOf`). Atualizar o comentário de `use-storefront.hook.ts` que aponta para o carrinho.

- **Componentes de loja compartilhados** (`src/shared/components/store/`, sem importar `modules/*`):
  - `store.types.ts`:
    - `StoreProduct` ganha `id`;
    - `CartItem` passa a ser a linha exibida (`productId`, `slug`, `name`, `unit`, `category` (slug da raiz), `imageUrl`, `priceCents`, `quantity`, `lineTotalCents: number | null`, `isAvailable`);
    - `CartTotals` passa a ter `itemCount`, `subtotalCents`, `deliveryFeeCents`, `totalCents` e `missingForFreeDeliveryCents`;
    - remover o alias obsoleto `BagItem`.
  - `QuantityStepper` e `AddToCartControl` ganham `max?`, que desabilita o "+" ao atingir o limite. `ProductGrid` usa `product.id` como `key`.
  - `CartDrawer`:
    - **novas props:** `loading`, `busy`, `hasUnavailableItems`, `getHref(item)` e `onRemove(productId)`;
    - **cada linha:** `ProductArt` com `imageUrl` (tamanho `sm`); o nome em até 2 linhas como link para o produto (fecha a gaveta); a unidade e o preço unitário em cinza; `QuantityStepper` pequeno (`min` 0 remove, `max` 99); o total da linha; um botão de ícone `Trash2` com `aria-label` "Remover <nome> do carrinho";
    - **linha indisponível:** conteúdo com opacidade reduzida, badge "Indisponível", sem stepper e sem total, com o botão "Remover";
    - **carregando:** na primeira carga, blocos `bg-surface` estáticos no lugar das linhas; o estado vazio atual é mantido;
    - **rodapé:** os valores vêm das props, com opacidade reduzida e `aria-busy` quando `busy`. Com itens indisponíveis, exibe o aviso "Remova os itens indisponíveis para continuar.". O botão "Finalizar pedido · R$ X" fica desabilitado sem itens, com itens indisponíveis ou quando `busy`.

- **Shell** (`storefront-shell.component.tsx`): importar `CartProvider`/`useCart` de `@/modules/orders/data/cart.context`. O `ConnectedHeader` passa ao `CartDrawer` as linhas mapeadas de `cart.lines` (`getHref` com `productRoute(slug, storefront.query)`), os totais de `cart.detail`, `loading`, `busy={cart.isSyncing}`, `hasUnavailableItems`, `onChangeQuantity={cart.setQuantity}` e `onRemove={cart.remove}`. O contador do cabeçalho usa `cart.count` (0 até hidratar). `handleCheckout` continua fechando a gaveta e indo para `/checkout?<query da vitrine>`.

- **Vitrine e grades** (`storefront-product-grid.component.tsx`): `toStoreProduct` inclui `id`. A grade passa `getQuantity` (`cart.getQuantity(product.id)`) e, **só quando `storefront.served`**, `onChangeQuantity` (`cart.setQuantity(product.id, quantity)`), com `max` 99. Assim os cards da página inicial, da listagem e de "Mais de <categoria>" exibem o "+", que vira o stepper quando o produto está no carrinho. Fora da área atendida, os cards continuam sem "+".

- **Detalhe do produto** (`product-detail.component.tsx`):
  - `QuantityStepper` com `max` 99. "Adicionar · R$ total" chama `cart.add(product.id, quantity)`, mostrando "Adicionando…" desabilitado enquanto espera;
  - sucesso: `toast.success("Adicionado ao carrinho", { description: "<quantidade> un · <total>", action: { label: "Ver carrinho", onClick: cart.open } })` e a quantidade volta a 1;
  - erro (limite, produto indisponível): toast de erro com a mensagem traduzida;
  - abaixo do botão, "Você já tem N no carrinho." quando `cart.getQuantity(product.id) > 0`;
  - o botão continua indisponível em bairro não atendido;
  - o cartão de entrega importa `DELIVERY_FEE_CENTS` e `FREE_DELIVERY_THRESHOLD_CENTS` de `@/modules/orders/data/cart.util`;
  - remover o aviso "Carrinho chega já já." e atualizar o JSDoc do componente.

- **Checkout** (`modules/orders/pages/checkout.page.tsx`, estado autenticado):
  - importar `useCart` de `../data/cart.context` e chamar `cart.refresh()` ao montar o `CheckoutForm`;
  - **resumo:** as linhas usam `ProductArt` com `imageUrl`, o nome em até 2 linhas, "× quantidade" e o total da linha. Linhas indisponíveis mostram "Indisponível" e o botão "Remover". Os totais vêm de `cart.detail`, e a primeira carga (inclusive a mescla logo depois de entrar pelo `AuthForm`) exibe blocos `bg-surface` estáticos no resumo;
  - **`canConfirm`:** além das condições atuais, exige `!cart.loading`, `!cart.isSyncing`, `cart.count > 0` e `!cart.hasUnavailableItems`. Com itens indisponíveis, exibe abaixo do botão "Remova os itens indisponíveis para confirmar o pedido.";
  - **"Confirmar pedido"** continua mock (`nextOrderId`), mas espera `cart.clear()` (`DELETE /me/cart`). Se a limpeza falhar, exibe o erro e continua em `/checkout`.

- **Design:** atualizar `apps/frontend/DESIGN.md` na mesma mudança:
  - **gaveta:** linhas com foto e link, lixeira, stepper com limite de 99, linha indisponível e aviso, carregamento em blocos creme, valores com opacidade enquanto sincroniza e "Finalizar pedido" bloqueado;
  - **persistência:** carrinho do visitante no `localStorage` (`jaja.guest-cart`) e carrinho da conta no servidor, com a mescla ao entrar;
  - **cards:** o "+" aparece nas grades da loja quando o bairro é atendido;
  - **detalhe:** "Adicionar" real, com o toast "Ver carrinho" e "Você já tem N no carrinho.";
  - **checkout:** resumo com fotos e itens indisponíveis.
- Atualizar `apps/frontend/src/modules/orders/index.ts` com o que for novo e público.

- **Specs da change:**
  - nova capability `orders/cart`: carrinho da conta (um por usuário, itens na ordem de inclusão, limites de 50 produtos e 99 unidades), regras de incluir, alterar quantidade, remover, esvaziar e mesclar, disponibilidade, preço atual sem congelamento, linhas indisponíveis, totais e frete, e os endpoints `/me/cart*` e `POST /cart/preview`;
  - nova capability `orders/storefront-cart`: o carrinho na loja (visitante no navegador, mescla ao entrar ou criar conta, sair, contador do cabeçalho, gaveta, "+" nos cards e "Adicionar" no detalhe);
  - em `catalog/storefront`:
    - remover "Sacola vazia nesta entrega" e "Botão Adicionar sem efeito no carrinho" (REMOVED, apontando para `orders/storefront-cart`);
    - alterar "Fechar pedido leva ao checkout": botão "Finalizar pedido", preservando todos os parâmetros da vitrine, indisponível sem itens ou com itens indisponíveis;
  - em `shared/design-system`: alterar "Painel da sacola" (hoje descreve o visual antigo; passa a descrever a gaveta "Seu carrinho" atual) e "Grade e card de produto" (o "+" vira stepper e respeita o limite);
  - em `orders/checkout-access`: alterar "Confirmar pedido exige cadastro de cliente" (também exige carrinho da conta carregado, com itens e sem itens indisponíveis) e adicionar o resumo do pedido a partir do carrinho da conta (linhas reais, totais da API e o carrinho esvaziado ao confirmar);
  - em `admin/admin-api-authorization`: alterar "Endpoints não administrativos não mudam", tirando `/orders` (scaffold removido) e acrescentando que `/me/cart` exige apenas token válido, de qualquer usuário, e que `POST /cart/preview` é público.

- Validação: `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` sem erros. Conferir no navegador:
  - **visitante:**
    - "+" num card da página inicial vira o stepper, e o contador do cabeçalho muda;
    - a gaveta mostra a foto, o preço atual e o frete de R$ 4,90 com "Faltam R$ X para a entrega grátis", e chegar a R$ 79,00 deixa a entrega "Grátis";
    - recarregar mantém o carrinho, e uma segunda aba recebe as mudanças;
    - o stepper para no 99;
  - **detalhe:** "Adicionar" com quantidade 3 (toast com "Ver carrinho", que abre a gaveta), "Você já tem N no carrinho." e o botão indisponível num bairro não atendido;
  - **mescla:**
    - com itens de visitante, entrar numa conta que já tem itens no carrinho (colocados antes, nesta mesma conferência, porque não há seed de carrinhos) soma os itens (limitados a 99), limpa o `localStorage` e mantém a gaveta com os itens juntos;
    - "sair" zera o contador;
    - entrar de novo traz o carrinho da conta;
    - criar conta no próprio `/checkout` com itens de visitante leva os itens para o resumo;
  - **indisponível:** com o carrinho da conta aberto, desativar no admin um produto que está nele, abrir a gaveta e ver "Indisponível" com "Finalizar pedido" bloqueado; remover o item e reativar o produto;
  - **checkout:** resumo com fotos e totais da API, "Confirmar pedido" bloqueado com item indisponível, e confirmar esvazia o carrinho (contador 0 na volta à loja);
  - **mobile (375px):** a gaveta ocupa a largura da tela, e os steppers dos cards cabem na grade de 2 colunas;
  - e que a vitrine (busca, filtros, paginação), os cadastros do admin e os dados de entrega do checkout continuam funcionando.

> Obs: IMPORTANTE!!! Executar as três partes (Negócio, Backend e Frontend) em subagentes separados com contexto limpo em cada um deles, de forma sequencial (o Backend depende do build de `@jaja/orders`; o Frontend depende da API do carrinho rodando). Cada subagente deve ler `.claude/skills/skills-standards.md` e, antes de criar seus arquivos, as referências de código da sua camada listadas no Contexto. O princípio de leitura em CQRS do Contexto prevalece sobre o workflow da skill `module-query-cqrs`. O do backend deve deixar o seed como estava (produto desativado no `.http` volta a ficar ativo). O do frontend deve ler também `apps/frontend/DESIGN.md` e `modules/orders/pages/checkout.page.tsx`. Uma parte só começa depois de a anterior terminar com as validações passando, e cada subagente encerra listando os arquivos criados/alterados e o resultado das validações.
