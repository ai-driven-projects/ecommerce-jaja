# Cadastro de Categorias (Category Management) Specification

## Purpose

Define as regras de negócio e o contrato HTTP das categorias do catálogo do Jaja: a hierarquia de até três níveis (departamento → grupo → subgrupo), a unicidade global do slug, a leitura paginada (lista plana com busca, árvore por departamento e filhas diretas), a proteção administrativa dos endpoints e a carga inicial a partir dos dados raspados da Kalunga.

## Requirements

### Requirement: Categoria com produtos não pode ser excluída
`DELETE /categories/:id` MUST responder `409` com o código `CATEGORY_HAS_PRODUCTS`, sem excluir a categoria, quando existir ao menos um produto não excluído associado diretamente a ela. A verificação de filhas vem antes: uma categoria com filhas MUST continuar respondendo `CATEGORY_HAS_CHILDREN`, tenha ou não produtos. Produtos já excluídos MUST NOT impedir a exclusão.

#### Scenario: Categoria folha com produtos
- **WHEN** um administrador chama `DELETE /categories/<id>` de uma categoria sem filhas e com produtos cadastrados
- **THEN** o sistema responde `409` com `CATEGORY_HAS_PRODUCTS` e a categoria continua existindo

#### Scenario: Categoria com filhas e produtos
- **WHEN** um administrador tenta excluir uma categoria que tem filhas e produtos
- **THEN** o sistema responde `409` com `CATEGORY_HAS_CHILDREN`

#### Scenario: Categoria cujos produtos foram excluídos
- **WHEN** todos os produtos de uma categoria folha foram excluídos e um administrador exclui a categoria
- **THEN** o sistema responde `204`
