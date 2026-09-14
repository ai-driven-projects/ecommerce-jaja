## Purpose

Define o carrinho de compras na API do Jaja: o carrinho da conta de cada usuário (itens, limites, incluir, alterar, remover, esvaziar e mesclar), a disponibilidade dos produtos, o preço atual, os totais com a regra de entrega e a prévia pública do carrinho do visitante.

## ADDED Requirements

### Requirement: Um carrinho por usuário
Cada usuário SHALL ter no máximo um carrinho, vinculado à sua conta e criado na primeira vez em que um item entra nele (por inclusão ou por mescla). Qualquer usuário autenticado, administrador ou não, com ou sem cadastro de cliente, MUST poder usar o próprio carrinho pelos endpoints `/me/cart`. O dono do carrinho MUST ser sempre o usuário do token: nenhum identificador de usuário ou de carrinho vindo do corpo ou da URL MUST ser aceito. Sem token válido, esses endpoints MUST responder `401`. O carrinho MUST continuar salvo entre sessões do mesmo usuário.

#### Scenario: Sem token
- **WHEN** um cliente chama `GET /me/cart` sem o cabeçalho `Authorization`
- **THEN** o sistema responde `401`

#### Scenario: Usuário sem carrinho
- **WHEN** um usuário recém-criado chama `GET /me/cart`
- **THEN** o sistema responde `200` com `lines` vazia, `itemCount: 0`, `subtotalCents: 0`, `deliveryFeeCents: 0`, `totalCents: 0` e `hasUnavailableItems: false`

#### Scenario: Carrinho salvo entre sessões
- **WHEN** um usuário inclui um produto no carrinho, entra de novo com outro token e chama `GET /me/cart`
- **THEN** o produto continua no carrinho com a mesma quantidade

#### Scenario: Carrinhos isolados
- **WHEN** o usuário A inclui um produto e o usuário B chama `GET /me/cart`
- **THEN** o carrinho de B não contém o produto incluído por A

### Requirement: Itens e limites do carrinho
Um item do carrinho SHALL ser um produto com uma quantidade. Cada produto MUST aparecer uma única vez, e as linhas MUST seguir a ordem em que cada produto entrou no carrinho. A quantidade MUST ser um inteiro de 1 a 99; outro valor MUST ser rejeitado com `400` e o código `CART_ITEM_QUANTITY_INVALID`. O carrinho MUST aceitar no máximo 50 produtos diferentes; incluir o 51º MUST ser rejeitado com `400` e o código `CART_ITEMS_LIMIT_EXCEEDED`. O carrinho MUST NOT guardar o preço dos produtos. Uma operação rejeitada MUST NOT alterar o carrinho.

#### Scenario: Quantidade inválida
- **WHEN** o usuário tenta incluir um produto com `quantity` igual a `0`, `100`, `1.5` ou `"abc"`
- **THEN** o sistema responde `400` com `CART_ITEM_QUANTITY_INVALID` e o carrinho continua igual

#### Scenario: Limite de produtos diferentes
- **WHEN** o usuário com 50 produtos diferentes no carrinho tenta incluir um 51º
- **THEN** o sistema responde `400` com `CART_ITEMS_LIMIT_EXCEEDED` e o carrinho continua com os 50 produtos

#### Scenario: Ordem das linhas
- **WHEN** o usuário inclui os produtos A, B e C, nessa ordem, e depois altera a quantidade de A
- **THEN** `GET /me/cart` devolve as linhas na ordem A, B e C

### Requirement: Incluir produto no carrinho
`POST /me/cart/items`, com `productId` e `quantity` (padrão 1), SHALL incluir a quantidade do produto no carrinho do usuário:
- produto que ainda não está no carrinho MUST entrar no fim da lista;
- produto que já está no carrinho MUST ter a quantidade somada, mantendo a posição;
- uma soma acima de 99 MUST ser rejeitada com `400` e o código `CART_ITEM_QUANTITY_EXCEEDED`.

O produto MUST estar disponível na loja; produto inexistente ou não disponível MUST ser rejeitado com `404` e o código `CART_PRODUCT_NOT_FOUND`. `productId` malformado MUST ser rejeitado com `400` e o código de identificador inválido. Em caso de sucesso, o sistema MUST responder `200` com o carrinho atualizado.

#### Scenario: Primeiro produto
- **WHEN** um usuário sem carrinho chama `POST /me/cart/items` com um produto disponível e `quantity: 2`
- **THEN** o sistema responde `200` com uma linha desse produto com `quantity: 2` e `itemCount: 2`

#### Scenario: Mesmo produto de novo
- **WHEN** o usuário com o produto A em quantidade 2 inclui A com `quantity: 3`
- **THEN** a linha de A passa a ter `quantity: 5`, na mesma posição

#### Scenario: Quantidade padrão
- **WHEN** o usuário chama `POST /me/cart/items` só com o `productId` de um produto disponível
- **THEN** o produto entra no carrinho com `quantity: 1`

#### Scenario: Soma acima do limite
- **WHEN** o usuário com o produto A em quantidade 1 inclui A com `quantity: 99`
- **THEN** o sistema responde `400` com `CART_ITEM_QUANTITY_EXCEEDED` e A continua com quantidade 1

#### Scenario: Produto inativo
- **WHEN** o usuário tenta incluir o produto `cartucho-lexmark-dual-pack-1un-17-1un-27-10n0595-lexmark-cx-1-un`, inativo no seed
- **THEN** o sistema responde `404` com `CART_PRODUCT_NOT_FOUND` e o carrinho continua igual

#### Scenario: Produto inexistente
- **WHEN** o usuário tenta incluir um `productId` em formato válido que não corresponde a nenhum produto
- **THEN** o sistema responde `404` com `CART_PRODUCT_NOT_FOUND`

### Requirement: Alterar a quantidade de um produto
`PUT /me/cart/items/:productId`, com `quantity`, SHALL definir a quantidade do produto no carrinho do usuário:
- produto que já está no carrinho MUST manter a posição;
- produto que ainda não está no carrinho MUST entrar no fim da lista.

As mesmas validações de quantidade, limite de produtos e formato do identificador de "Incluir produto no carrinho" MUST valer. O produto MUST estar disponível na loja **também quando já está no carrinho**: um produto indisponível só pode ser removido, e a tentativa de alterar MUST responder `404` com `CART_PRODUCT_NOT_FOUND`. Em caso de sucesso, o sistema MUST responder `200` com o carrinho atualizado.

#### Scenario: Alterar mantendo a posição
- **WHEN** o usuário com os produtos A (quantidade 5) e B chama `PUT /me/cart/items/<A>` com `quantity: 1`
- **THEN** A passa a ter quantidade 1 e continua antes de B

#### Scenario: Produto fora do carrinho
- **WHEN** o usuário com os produtos A e B chama `PUT /me/cart/items/<C>` com `quantity: 2` para um produto disponível
- **THEN** C entra no fim do carrinho com quantidade 2

#### Scenario: Produto que ficou indisponível
- **WHEN** o produto B, que está no carrinho, é desativado no admin e o usuário chama `PUT /me/cart/items/<B>` com `quantity: 3`
- **THEN** o sistema responde `404` com `CART_PRODUCT_NOT_FOUND` e a quantidade de B não muda

### Requirement: Remover produto e esvaziar o carrinho
`DELETE /me/cart/items/:productId` SHALL remover o produto do carrinho do usuário, esteja ele disponível ou não. Remover um produto que não está no carrinho MUST responder `200` com o carrinho sem mudança. `DELETE /me/cart` SHALL remover todos os itens; com o carrinho já vazio, ou sem carrinho, MUST responder `200` com o carrinho vazio. As duas operações MUST responder `200` com o carrinho atualizado.

#### Scenario: Remover produto indisponível
- **WHEN** o produto B do carrinho foi desativado e o usuário chama `DELETE /me/cart/items/<B>`
- **THEN** o sistema responde `200` sem a linha de B e com `hasUnavailableItems: false`

#### Scenario: Remover produto ausente
- **WHEN** o usuário chama `DELETE /me/cart/items/<id>` para um produto que não está no carrinho
- **THEN** o sistema responde `200` com o mesmo carrinho

#### Scenario: Esvaziar duas vezes
- **WHEN** o usuário chama `DELETE /me/cart` duas vezes seguidas
- **THEN** as duas chamadas respondem `200` com o carrinho vazio

### Requirement: Mesclar o carrinho do visitante
`POST /me/cart/merge`, com `items` (lista de `productId` e `quantity`), SHALL juntar ao carrinho do usuário os itens montados enquanto ele navegava sem sessão:
- entradas com `productId` malformado, com quantidade que não seja inteira e maior ou igual a 1, ou de produto inexistente ou indisponível MUST ser ignoradas;
- quantidades do mesmo produto na lista MUST ser somadas, e cada quantidade MUST ser limitada a 99;
- produto que já está no carrinho da conta MUST ter a quantidade somada, limitada a 99, mantendo a posição;
- produtos novos MUST entrar no fim, na ordem recebida, enquanto o carrinho tiver menos de 50 produtos; os demais MUST ser ignorados.

A mescla MUST NOT falhar por causa dos itens: `items` ausente ou que não seja uma lista vale como lista vazia. Sem itens aproveitáveis, o carrinho da conta MUST ficar como está. Em caso de sucesso, o sistema MUST responder `200` com o carrinho atualizado.

#### Scenario: Mescla com carrinho existente
- **WHEN** o usuário com o produto A em quantidade 2 mescla `[{ A, 98 }, { B, 1 }]`
- **THEN** o carrinho passa a ter A com quantidade 99, na posição original, e B no fim com quantidade 1

#### Scenario: Itens ignorados
- **WHEN** o usuário mescla uma lista com um produto disponível, o produto inativo do seed, um uuid inexistente, um id malformado e uma entrada com quantidade `0`
- **THEN** o sistema responde `200` e só o produto disponível entra no carrinho

#### Scenario: Lista vazia
- **WHEN** um usuário sem carrinho chama `POST /me/cart/merge` com `items: []`
- **THEN** o sistema responde `200` com o carrinho vazio

### Requirement: Disponibilidade e preço atual
Um produto SHALL estar disponível no carrinho quando for visível na loja, segundo a regra de `catalog/storefront-api`. Cada linha do carrinho MUST trazer os dados atuais do catálogo: slug, nome, unidade, slug da categoria raiz, miniatura da imagem principal (ou `null`), preço e preço "De:" (ou `null`). Uma mudança de preço no catálogo MUST aparecer no carrinho na leitura seguinte. Um item cujo produto deixou de estar disponível (inativo, excluído ou com a categoria ou uma ancestral inativa) MUST continuar no carrinho como linha indisponível, com `isAvailable: false` e `lineTotalCents: null`. O carrinho MUST NOT impedir que um produto seja desativado ou excluído no admin.

#### Scenario: Preço alterado no admin
- **WHEN** um produto está no carrinho com preço R$ 12,90 e o administrador altera o preço para R$ 10,90
- **THEN** `GET /me/cart` devolve a linha com `priceCents: 1090` e os totais recalculados

#### Scenario: Produto desativado
- **WHEN** o administrador desativa um produto que está no carrinho
- **THEN** `GET /me/cart` devolve a linha com `isAvailable: false`, `lineTotalCents: null` e `hasUnavailableItems: true`, e o valor dela fica fora do subtotal

#### Scenario: Produto reativado
- **WHEN** o administrador reativa esse produto
- **THEN** a linha volta a ter `isAvailable: true` e entra de novo no subtotal

### Requirement: Totais do carrinho e entrega
Toda resposta de carrinho SHALL trazer, em centavos:
- `itemCount`: a soma das quantidades de todas as linhas, inclusive as indisponíveis;
- `subtotalCents`: a soma de preço × quantidade das linhas disponíveis;
- `deliveryFeeCents`: `490` quando o subtotal é maior que 0 e menor que `7900`, e `0` quando o subtotal é 0 ou maior ou igual a `7900`;
- `totalCents`: subtotal mais entrega;
- `freeDeliveryThresholdCents`: `7900`;
- `missingForFreeDeliveryCents`: `7900` menos o subtotal quando a entrega é cobrada, e `0` caso contrário;
- `hasUnavailableItems`: se alguma linha está indisponível.

Cada linha disponível MUST trazer `lineTotalCents` igual a preço × quantidade.

#### Scenario: Abaixo da entrega grátis
- **WHEN** o carrinho tem só um produto de R$ 12,90 com quantidade 2
- **THEN** a resposta traz `lineTotalCents: 2580`, `subtotalCents: 2580`, `deliveryFeeCents: 490`, `totalCents: 3070` e `missingForFreeDeliveryCents: 5320`

#### Scenario: Entrega grátis
- **WHEN** o subtotal das linhas disponíveis chega a R$ 79,00 ou mais
- **THEN** a resposta traz `deliveryFeeCents: 0`, `missingForFreeDeliveryCents: 0` e `totalCents` igual ao subtotal

#### Scenario: Só itens indisponíveis
- **WHEN** todas as linhas do carrinho estão indisponíveis
- **THEN** a resposta traz `subtotalCents: 0`, `deliveryFeeCents: 0`, `totalCents: 0`, `itemCount` com a soma das quantidades e `hasUnavailableItems: true`

### Requirement: Prévia do carrinho do visitante
`POST /cart/preview` SHALL ser acessível sem token e calcular, a partir de `items` (lista de `productId` e `quantity`), as linhas e os totais de um carrinho que ainda não pertence a nenhuma conta, no mesmo formato e com as mesmas regras de disponibilidade, preço e totais do carrinho da conta. A presença de um cabeçalho `Authorization`, válido ou não, MUST NOT alterar a resposta. O endpoint MUST apenas ler dados, sem criar nem alterar carrinhos. Antes do cálculo, a lista MUST ser normalizada:
- entradas com `productId` malformado ou quantidade que não seja inteira e maior ou igual a 1 são ignoradas;
- quantidades do mesmo produto são somadas, e cada quantidade é limitada a 99;
- só os primeiros 50 produtos são considerados.

Produto inexistente MUST ser omitido; produto existente e indisponível MUST aparecer como linha indisponível. As linhas MUST seguir a ordem recebida. O endpoint MUST responder `200` e MUST NOT responder `400` por causa dos itens.

#### Scenario: Prévia sem token
- **WHEN** um visitante chama `POST /cart/preview` sem token com um produto disponível e `quantity: 2`
- **THEN** o sistema responde `200` com a linha do produto, o preço atual e os totais

#### Scenario: Normalização dos itens
- **WHEN** a lista enviada tem o mesmo produto duas vezes (quantidades 1 e 2), um produto com quantidade 150, um id malformado, um uuid inexistente e o produto inativo do seed
- **THEN** a resposta traz o produto repetido com quantidade 3, o outro com quantidade 99, a linha do produto inativo com `isAvailable: false` e nenhuma linha para o id malformado nem para o uuid inexistente

#### Scenario: Lista vazia
- **WHEN** um visitante chama `POST /cart/preview` com `items: []`
- **THEN** o sistema responde `200` com o carrinho vazio e os totais zerados
