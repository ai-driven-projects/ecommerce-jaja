## ADDED Requirements

### Requirement: Marca com produtos não pode ser excluída
`DELETE /brands/:id` MUST responder `409` com o código `BRAND_HAS_PRODUCTS`, sem excluir a marca, quando existir ao menos um produto não excluído associado a ela. Produtos já excluídos MUST NOT impedir a exclusão. A tela de marcas MUST exibir a falha como toast de erro com a mensagem "Marca possui produtos cadastrados" e manter a marca na lista.

#### Scenario: Marca com produtos
- **WHEN** um administrador chama `DELETE /brands/<id>` de uma marca com produtos cadastrados
- **THEN** o sistema responde `409` com `BRAND_HAS_PRODUCTS` e a marca continua existindo

#### Scenario: Marca cujos produtos foram excluídos
- **WHEN** todos os produtos de uma marca foram excluídos e um administrador exclui a marca
- **THEN** o sistema responde `204`

#### Scenario: Exclusão bloqueada na tela
- **WHEN** o administrador confirma a exclusão de uma marca com produtos em `/admin/catalog/brands`
- **THEN** vê o toast de erro "Marca possui produtos cadastrados" e a marca permanece na lista

## MODIFIED Requirements

### Requirement: Item Marcas no menu do Catálogo
O menu do módulo Catálogo SHALL exibir, sob "Catálogo de Produtos", o sub-item "Visão geral" e, sem rótulo de seção, o item "Marcas" que leva a `/admin/catalog/brands`. O item "Marcas" MUST ficar ativo em `/admin/catalog/brands` e em qualquer sub-rota dela; nesse caso ele MUST ser o único item destacado, com "Catálogo de Produtos" apenas expandido.

#### Scenario: Menu no formulário
- **WHEN** o administrador está em `/admin/catalog/brands/new`
- **THEN** o módulo aberto é "Catálogo de Produtos", o menu mostra "Visão geral" e "Marcas" sem o rótulo "Cadastros", e apenas "Marcas" está marcado como ativo
