## ADDED Requirements

### Requirement: Rota do produto no carrinho
A rota do produto na pilha da aba Carrinho SHALL ser `/cart/product/<slug>`, com a barra de abas visível e a aba Carrinho selecionada, e MUST abrir a página do produto daquele slug; voltar MUST retornar à aba Carrinho. Um produto aberto a partir desse produto MUST entrar na mesma pilha.

#### Scenario: Produto a partir do carrinho
- **WHEN** na aba Carrinho a pessoa toca no nome de um produto e depois em voltar
- **THEN** a página do produto aparece com a aba Carrinho selecionada e, depois do toque, a aba Carrinho volta a ser exibida
