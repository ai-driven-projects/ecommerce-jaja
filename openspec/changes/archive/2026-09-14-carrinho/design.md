## Context

A motivação e o escopo estão em `proposal.md`. O comportamento está nas specs desta change: `orders/cart`, `orders/storefront-cart`, `catalog/storefront`, `shared/design-system`, `orders/checkout-access` e `admin/admin-api-authorization`. O roteiro de implementação detalhado é o prompt `openspec/extras/prompts/13-carrinho.md`. Este é o estado atual relevante.

**Domínio (`modules/orders`)**
- Só existe o scaffold `orders`: entidade `Orders` sem atributos, `CreateOrders`, `OrdersDTO` com `id`, mock e teste de exemplo.
- Os padrões a seguir estão em outros pacotes:
  - `customers/customer`: agregado 1:1 com o usuário, que conhece só o `userId`, com `findByUserId`, `errors.ts` e mock que espelha as restrições do banco;
  - `catalog/product`: lista de VOs sem identidade (`ProductImage`), substituída inteira, com a constante de limite em `errors.ts`.
- `Entity.cloneWith` revalida por `tryCreate` e substitui arrays inteiros. `PositiveInteger` só tem mínimo.

**Backend**
- `OrdersModule` registra um controller de exemplo (`GET /orders`, público) e um `OrdersPrisma` vazio; `orders.model.prisma` não tem models.
- Não há guard global. As rotas `/me/*` usam `JwtGuard` + `@CurrentUser('id')` (`MyCustomerController`).
- A regra de visibilidade da loja é o fragmento `visibleProducts()` em `src/modules/catalog/storefront.sql.ts`, usado por `ProductPrisma` e `CategoryPrisma`. Ele usa os aliases `p`, `c1`, `c2`, `c3` e `b`.
- `ProductPrisma` grava a lista de imagens com `deleteMany` + `createMany`. `products` tem a coluna gerada `search_document`, com índice GIN.

**Frontend**
- **Carrinho atual:**
  - `modules/catalog/data/cart.context.tsx` é um store externo (`useSyncExternalStore`) sobre `localStorage['jaja.cart']`, com `{ slug: quantidade }`, que resolve os produtos por `findProduct` do mock;
  - `src/shared/util/cart.util.ts` calcula os totais;
  - `CartDrawer` fica em `src/shared/components/store`, e `modules/catalog/data/index.ts` reexporta o contexto.
- **Consumidores do carrinho:**
  - `StorefrontShell` (cabeçalho e gaveta);
  - `checkout.page.tsx` (itens, totais e `clear` na confirmação mock);
  - o detalhe do produto usa as constantes de entrega;
  - a vitrine não passa `onChangeQuantity` para as grades, e o "+" já é opcional em `ProductCard`/`ProductGrid`.
- **Sessão:** `useAuth()` lê o cookie de forma síncrona no cliente (no servidor, `null`). `useMyCustomer` já mostra o padrão de estado chaveado pelo token.
- **Pacotes de domínio:** o frontend não importa `@jaja/*` no código e espelha tipos e constantes da API.

**Specs e changes em andamento**
- `catalog/storefront` tem "Sacola vazia nesta entrega" e "Botão Adicionar sem efeito no carrinho", que esta change retira.
- `shared/design-system` ("Painel da sacola") descreve o visual antigo da gaveta.
- `cadastro-cliente` está aberta (faltam as conferências no navegador) e altera `orders/checkout-access` e "Endpoints não administrativos não mudam" de `admin/admin-api-authorization`. O delta dela nesse requisito ainda lista `/stores` como público, embora `cadastro-loja` (arquivada) já o tenha tornado administrativo.

## Goals / Non-Goals

**Goals:**
- Um carrinho da conta que a próxima funcionalidade (pedido) possa ler e esvaziar pelo servidor.
- Uma única regra de disponibilidade, preço e totais, aplicada igualmente ao visitante e à conta.
- Resposta imediata na interface (contador e quantidades) sem esconder que os valores ainda estão sendo confirmados.
- Leitura em CQRS leve: interface no módulo, SQL no adapter, controller fino.

**Non-Goals:**
- Congelar preço, reservar estoque ou avisar mudança de preço.
- Controle de concorrência otimista (versão) no carrinho.
- Atualização em tempo real entre dispositivos (websocket ou polling).
- Corrigir a divergência de `shared/design-system` com o código fora dos dois requisitos tocados.

## Decisions

### 1. Três etapas sequenciais com contexto limpo
Negócio → Backend → Frontend, cada uma em um subagente com contexto limpo, como pede o prompt. O backend consome o `dist` de `@jaja/orders`, e o frontend precisa da API do carrinho rodando para validar no navegador.

### 2. Carrinho da conta no servidor, visitante no navegador e mescla ao entrar
- **Com sessão:** o carrinho é do usuário, fica no banco e é acessado por `/me/cart`.
- **Sem sessão:** o visitante guarda `[{ productId, quantity }]` no `localStorage`, e as linhas e os totais vêm de `POST /cart/preview`.
- **Ao surgir um token:** os itens do visitante são enviados para `POST /me/cart/merge` e só apagados do navegador depois do sucesso.
- **Dono do carrinho:** o usuário, e não o cliente, porque quem ainda não salvou os dados de entrega também precisa de carrinho. O pedido, depois, relaciona o cliente do usuário.

Alternativas descartadas:
- **Carrinho só no navegador, com prévia pelo servidor:** mais simples, mas o carrinho não acompanha a conta entre dispositivos, e o pedido teria de receber os itens do cliente em vez de lê-los do servidor.
- **Carrinho no servidor também para visitantes, com token anônimo:** evita a mescla, mas cria carrinhos órfãos que exigem limpeza e um identificador anônimo a proteger.
- **Carrinho vinculado ao cliente:** obrigaria a salvar CPF e endereço antes de adicionar o primeiro produto.

### 3. Agregado `cart` no pacote `@jaja/orders`
O carrinho é a etapa anterior ao pedido e compartilha com ele a regra de entrega. Por isso fica no mesmo pacote, substituindo o scaffold `orders`, que não tem regra nem spec. O domínio conhece só `userId` e `productId`; os vínculos com `users` e `products` são FKs no Prisma, como em `customers`.

Alternativas descartadas:
- **Módulo novo `cart`:** separaria do pedido uma regra (entrega) que os dois usam.
- **Agregado no `catalog`:** misturaria compra e catálogo e obrigaria o pedido a depender do catálogo.

### 4. Sem preço no carrinho; disponibilidade calculada na leitura
- **O que é gravado:** só produto, quantidade e posição.
- **O que a leitura calcula:** preço atual, preço "De:" e disponibilidade, a cada consulta.
- **Produto que deixou de ser visível:** vira linha indisponível, fora do subtotal e bloqueando "Finalizar pedido". Ele não é removido sozinho, para o cliente entender por que o item sumiu da conta.
- **Exclusão de produtos:** não é bloqueada por carrinhos. A FK de `cart_items.product_id` é `Restrict`, mas produtos só são excluídos logicamente.

Alternativas descartadas:
- **Guardar o preço no item:** obrigaria a decidir entre preço antigo e novo e a exibir avisos. Congelar o preço é papel do pedido.
- **Remover automaticamente itens indisponíveis:** o cliente perderia itens sem explicação, e o produto pode voltar a ficar ativo.

### 5. Leitura em CQRS: um construtor de SQL para a conta e para a prévia
- **Contratos:** `FindCartByUserIdQuery` e `PreviewCartQuery` são interfaces em `provider/` que devolvem `CartDetailDTO`, implementadas como atributos públicos de `CartPrisma`.
- **SQL compartilhado:** as duas usam o mesmo construtor, que recebe a origem dos itens como CTE `items(product_id, quantity, position)`. Para a conta, a origem é `cart_items` do carrinho não excluído do usuário; para a prévia, `unnest(ids, quantidades) WITH ORDINALITY`.
- **Uma consulta:** o SQL faz o `JOIN` com `products` (inclusive inativos e excluídos), resolve a raiz da categoria até o avô, a miniatura principal por `LEFT JOIN LATERAL` e `is_available` por `EXISTS` sobre `visibleProducts()`. Na mesma consulta agrega as linhas em `json_agg` ordenado e calcula `item_count`, subtotal, entrega, total, quanto falta para a entrega grátis e `has_unavailable_items`.
- **Constantes:** `DELIVERY_FEE_CENTS` e `FREE_DELIVERY_THRESHOLD_CENTS` vêm de `@jaja/orders` como parâmetros.
- **Adapter:** só mapeia a linha única. Por serem interfaces sem lógica, as queries não têm teste unitário; o comportamento é coberto pelo `.http`.

Alternativas descartadas:
- **Caso de uso de leitura ou serviço de domínio para os totais:** repetiria no TypeScript um cálculo que o SQL faz junto com a disponibilidade, e duas implementações da mesma regra divergiriam.
- **Totais calculados no frontend, como hoje:** o visitante e a conta poderiam mostrar valores diferentes dos que o pedido vai cobrar.
- **Duas consultas distintas para conta e prévia:** duplicaria a regra de linhas e totais.

### 6. Comandos com entidade; disponibilidade como dependência do comando
- **Casos de uso:** `AddCartItem`, `SetCartItemQuantity`, `RemoveCartItem`, `ClearCart` e `MergeCart` carregam o carrinho por `findByUserId`, aplicam os métodos puros de `Cart` (`addItem`, `setItemQuantity`, `removeItem`, `clear`, `merge`) e persistem.
- **Disponibilidade:** os que incluem produtos consultam `FindAvailableProductIdsQuery`, uma interface do módulo implementada em SQL com `visibleProducts()`. É uma dependência do comando, não um caso de uso de leitura.
- **Retorno:** os casos de uso devolvem `Result<void>`, e o controller responde com `findCartByUserId`, de modo que toda resposta tem o mesmo formato calculado pela mesma consulta.
- **Limites:** `CART_MAX_ITEMS = 50` e `CART_ITEM_MAX_QUANTITY = 99` ficam em `cart/errors.ts`, como `PRODUCT_MAX_IMAGES`, junto com as constantes de entrega.

Alternativas descartadas:
- **Casos de uso devolvendo `CartDTO`:** o DTO da entidade não tem nome, preço nem totais, e o controller precisaria da consulta mesmo assim.
- **Validar a disponibilidade no controller:** a regra "produto indisponível só pode ser removido" ficaria fora do domínio e dos testes unitários.
- **O domínio consultar o catálogo por `@jaja/catalog`:** acoplaria os pacotes, contrariando o padrão de `customers` com `auth`.

### 7. Fragmento de visibilidade em `src/db`
`storefront.sql.ts` passa a ser `src/db/visible-products.sql.ts`, importado pelo catálogo e pelo carrinho, pelo mesmo motivo que moveu `text-search.sql.ts`: um módulo do backend não importa arquivos de outro. A regra continua única.

Alternativas descartadas:
- **Importar de `../catalog/storefront.sql.js`:** acopla os módulos Nest pelo sistema de arquivos.
- **Copiar o fragmento:** duas regras de visibilidade podem divergir.

### 8. Contrato HTTP do carrinho
- `GET /me/cart` devolve o carrinho vazio quando o usuário não tem um, sem `404`, porque "sem carrinho" e "carrinho vazio" são o mesmo estado para a loja.
- `POST /me/cart/items` **soma**, para o "Adicionar" do detalhe. `PUT /me/cart/items/:productId` **define** a quantidade e inclui se faltar, para os steppers. Assim cliques repetidos no stepper são idempotentes.
- `DELETE` é idempotente: remover item ausente ou esvaziar carrinho vazio responde `200`.
- **Prévia do visitante:** `POST /cart/preview` é público e usa corpo, porque até 50 uuids com quantidades não cabem bem na query string.
- **Itens do navegador:** a prévia e a mescla aceitam itens gerados pelo navegador. A normalização em `cart-http.ts` descarta entradas malformadas, soma repetidos, limita as quantidades e corta em 50 produtos, **nunca respondendo `400`**, para um `localStorage` antigo ou adulterado não travar a loja.
- **Erros:** `CART_PRODUCT_NOT_FOUND`/`CART_USER_NOT_FOUND` → `404`; `CART_ALREADY_EXISTS` → `409`; os demais → `400`.

Alternativas descartadas:
- **`PUT /me/cart` substituindo a lista inteira:** perde a semântica de soma, e duas abas se sobrescreveriam com mais facilidade.
- **Prévia por `GET` com query string:** limite de tamanho da URL e itens expostos em logs.

### 9. Itens em tabela filha substituída inteira
- **Tabelas:** `carts` (1:1 com `users`, `user_id` único, soft delete) e `cart_items` (`cart_id`, `product_id`, `quantity`, `position`, com `@@unique([cartId, productId])` e `@@unique([cartId, position])`).
- **Gravação:** `update` roda numa transação que atualiza o carrinho e troca os itens com `deleteMany` + `createMany`, com `position` = índice, seguindo `ProductPrisma`.
- **Erros do banco:** a corrida de dois primeiros itens simultâneos cai em `carts_user_id_key` → `CART_ALREADY_EXISTS`. A FK de produto violada vira `CART_PRODUCT_NOT_FOUND`, e a de usuário, `CART_USER_NOT_FOUND`.

Alternativas descartadas:
- **Coluna JSON com os itens:** perde a FK para `products` e o `JOIN` direto na leitura.
- **Upsert por item:** mais escritas pequenas, mas duplica no adapter a regra de posição que a entidade já resolve.

### 10. Frontend: um provider, dois modos, fila de comandos
- **Estrutura:** `CartProvider` (movido para `modules/orders/data/cart.context.tsx`) escolhe o modo por `useAuth().session`.
- **Visitante:** o store externo passa a usar a chave `jaja.guest-cart` (lista na ordem de inclusão, validada na leitura, sincronizada entre abas pelo evento `storage`) e remove a antiga `jaja.cart`. As regras de limite ficam em funções puras de `cart.util.ts`, espelhando o domínio. A prévia é pedida ~250 ms depois da última mudança, e respostas de chaves antigas são descartadas.
- **Conta:** o estado é chaveado pelo token, como em `useMyCustomer`. A mescla (ou a primeira leitura) roda ao surgir um token. Os comandos entram numa fila e rodam um de cada vez, com atualização otimista da quantidade; o estado final é o último `CartDetail`, e um erro faz `refresh()`. A gaveta e o checkout chamam `refresh()` ao abrir.
- **Interface:** `count` e as quantidades mudam na hora. Valores monetários sempre vêm da API e aparecem atenuados com `aria-busy` enquanto `isSyncing`, com "Finalizar pedido" e "Confirmar pedido" bloqueados nesse intervalo.
- **Componentes:** os componentes de `src/shared/components/store` continuam sem importar módulos: recebem as linhas (`CartItem`), os totais e callbacks. `QuantityStepper` ganha `max`.

Alternativas descartadas:
- **Mandar cada clique direto, sem fila:** respostas fora de ordem poderiam deixar a quantidade errada na tela.
- **Debounce dos comandos da conta:** atrasaria a gravação e poderia perder o último clique ao navegar.
- **Importar os limites de `@jaja/orders` no Next:** o frontend ainda não consome o `dist` dos pacotes. Espelhar as constantes segue o padrão de `storefront.api.ts`.

### 11. Specs coordenadas com `cadastro-cliente`
- **`orders/checkout-access`:** esta change só **adiciona** o requisito "Resumo do pedido com o carrinho da conta", sem modificar "Confirmar pedido exige cadastro de cliente", que só existe no delta de `cadastro-cliente`. Assim as duas changes podem ser arquivadas em qualquer ordem.
- **`admin/admin-api-authorization`:** o delta de "Endpoints não administrativos não mudam" parte da spec principal atual (lojas administrativas) e acrescenta o que `cadastro-cliente` define (clientes) e o que esta change define (carrinho, remoção de `GET /orders`). Quem for arquivada por último deve conferir que o texto final mantém as três partes.

## Risks / Trade-offs

- **[Duas abas ou dispositivos gravam o carrinho da conta ao mesmo tempo, e a última gravação vence]** → a fila serializa os comandos na mesma aba; entre abas e dispositivos o risco é aceito sem versão, e a gaveta e o checkout recarregam o carrinho ao abrir.
- **[A mescla dá certo, mas a resposta se perde, e os itens do visitante são mesclados de novo na próxima montagem, somando quantidades]** → raro e limitado a 99 por produto; o cliente vê e ajusta as quantidades na gaveta.
- **[Token expirado nas chamadas `/me/cart` responde `401`]** → vira mensagem de erro como nas demais telas da loja; tratar sessão expirada fica fora desta change.
- **[Limites e regra de entrega espelhados no frontend divergirem do domínio]** → comentário apontando `@jaja/orders` nas constantes, e os valores monetários exibidos sempre vêm da API; o espelho só decide limites do visitante e os textos do detalhe.
- **[`POST /cart/preview` público ser usado para consultar preços em massa]** → só lê dados já públicos na vitrine e é limitado a 50 produtos por chamada.
- **[`prisma migrate dev` tentar alterar a coluna gerada `search_document`]** → conferir que a migration `orders_cart` só cria as tabelas do carrinho; se aparecer diferença nessa coluna, remover o trecho da migration antes de aplicar.
- **[Carrinhos antigos (`jaja.cart`) com produtos fictícios]** → descartados na primeira leitura; perda aceitável, porque nunca continham produtos reais.
- **[Produto desativado no `.http` durante o teste deixar o seed alterado]** → o próprio `.http` reativa o produto, e a tarefa de validação confere o estado final.

## Migration Plan

1. Aplicar a migration `orders_cart`, que é aditiva: cria `carts` e `cart_items`, com FKs e índices, sem mudar dados existentes.
2. Publicar backend e frontend juntos: a loja nova depende de `/me/cart` e `/cart/preview`, e o endpoint `GET /orders` sai sem consumidores no frontend.
3. No navegador, a primeira leitura do novo store remove `jaja.cart`; nada é migrado.

**Rollback:** reverter o código e remover as tabelas com `DROP TABLE cart_items, carts;` (o Prisma não gera migration de descida) e a migration correspondente. Os carrinhos gravados são perdidos, e o frontend antigo volta a usar `jaja.cart`, vazio.
