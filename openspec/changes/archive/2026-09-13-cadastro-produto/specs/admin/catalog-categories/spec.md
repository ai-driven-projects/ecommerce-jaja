## ADDED Requirements

### Requirement: Exclusão de categoria com produtos bloqueada na árvore
Quando a API recusar a exclusão de uma categoria com `409` e o código `CATEGORY_HAS_PRODUCTS`, a tela de categorias MUST exibir um toast de erro com a mensagem "Categoria possui produtos cadastrados" e manter a categoria na árvore, sem exibir toast de sucesso.

#### Scenario: Exclusão bloqueada na tela
- **WHEN** o administrador confirma a exclusão de uma categoria folha com produtos em `/admin/catalog/categories`
- **THEN** vê o toast de erro "Categoria possui produtos cadastrados" e a categoria permanece na árvore
