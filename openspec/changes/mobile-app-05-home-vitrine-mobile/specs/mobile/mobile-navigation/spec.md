## ADDED Requirements

### Requirement: Rotas do catálogo
A rota da aba Buscar SHALL aceitar os filtros de produtos como parâmetros de query, com a codificação única dos filtros (`category`, `brand`, `search`, `minPriceCents`, `maxPriceCents`, `onSale`, `featured`, `sort`, `page`, `pageSize`), e a página da aba MUST receber o filtro já decodificado; valores inválidos MUST ser ignorados sem erro. A rota do produto SHALL ser `/home/product/<slug>`, aberta na pilha da aba Início com a barra de abas visível, e voltar MUST retornar à Início. Enquanto a busca (etapa 6) e o detalhe (etapa 7) não existem, essas rotas MUST abrir páginas provisórias com os nomes "Buscar" e "Produto".

#### Scenario: Busca filtrada pela rota
- **WHEN** o app navega para `/search?category=escolar&sort=aleatorio`
- **THEN** a aba Buscar fica selecionada, a página recebe o filtro de categoria `escolar` sem ordem, e mostra "Buscar"

#### Scenario: Produto na pilha de Início
- **WHEN** o app navega para `/home/product/caneta-x` e a pessoa toca em voltar
- **THEN** a página "Produto" aparece com a barra de abas visível e, depois do toque, a aba Início volta a ser exibida
