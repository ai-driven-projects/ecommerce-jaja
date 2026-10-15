## MODIFIED Requirements

### Requirement: Rotas do catálogo
A rota da aba Buscar SHALL aceitar os filtros de produtos como parâmetros de query, com a codificação única dos filtros (`category`, `brand`, `search`, `minPriceCents`, `maxPriceCents`, `onSale`, `featured`, `sort`, `page`, `pageSize`), e a página da aba MUST receber o filtro já decodificado; valores inválidos MUST ser ignorados sem erro, e `page`/`pageSize` da rota MUST ser ignorados pela listagem, que sempre começa da página 1. Chegar à rota com um filtro diferente do em vigor MUST aplicar o novo filtro; cada mudança de filtro feita na página MUST ser espelhada na rota da aba, sem `page` nem `pageSize`, para que voltar à aba mostre o mesmo filtro. A rota do produto SHALL ser `/home/product/<slug>` na pilha da aba Início e `/search/product/<slug>` na pilha da aba Buscar, ambas com a barra de abas visível, e MUST abrir a página do produto daquele slug; voltar MUST retornar à página de origem com o estado dela. Um produto aberto a partir de outro produto MUST entrar na pilha da mesma aba.

#### Scenario: Busca filtrada pela rota
- **WHEN** o app navega para `/search?category=escolar&sort=aleatorio`
- **THEN** a aba Buscar fica selecionada e a listagem é pedida com `category=escolar`, sem `sort`

#### Scenario: Filtro espelhado na rota
- **WHEN** na Buscar a pessoa marca "Só ofertas", vai para a Início e toca de novo na aba Buscar
- **THEN** a localização da aba é `/search?onSale=true` e a página mostra o mesmo filtro, sem nova requisição

#### Scenario: Produto na pilha de Início
- **WHEN** o app navega para `/home/product/caneta-x` e a pessoa toca em voltar
- **THEN** a página do produto `caneta-x` aparece com a barra de abas visível e o produto é pedido pelo slug; depois do toque, a aba Início volta a ser exibida

#### Scenario: Produto na pilha da Buscar
- **WHEN** na Buscar a pessoa toca num produto e depois em voltar
- **THEN** a página do produto aparece com a aba Buscar selecionada e, depois do toque, a listagem volta com os mesmos itens, sem nova requisição
