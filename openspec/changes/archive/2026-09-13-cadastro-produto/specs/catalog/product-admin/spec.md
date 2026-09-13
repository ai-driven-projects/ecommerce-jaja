## Purpose

Define as telas administrativas de produto do Jaja: a listagem paginada com busca e filtros refletidos na URL, o formulário de criação e edição com preço em reais e imagens ordenáveis, o tratamento de erros, o retorno à lista e o acesso pelo menu do Catálogo.

## ADDED Requirements

### Requirement: Item "Produtos" no menu do Catálogo
O módulo "Catálogo de Produtos" no menu lateral SHALL exibir o sub-item "Produtos" logo após "Categorias", sem rótulo de seção, levando a `/admin/catalog/products`. O item MUST ficar ativo em `/admin/catalog/products` e em qualquer rota abaixo dela, sendo o único item destacado do menu.

#### Scenario: Item ativo no formulário
- **WHEN** o administrador está em `/admin/catalog/products/new`
- **THEN** o menu exibe "Visão geral", "Marcas", "Categorias" e "Produtos" sob "Catálogo de Produtos", sem o rótulo "Cadastros", com apenas "Produtos" destacado e o item principal só expandido

### Requirement: Listagem paginada de produtos
A rota `/admin/catalog/products` SHALL exibir o cabeçalho da página com o botão "Novo produto" e uma tabela com uma linha por produto contendo: miniatura da imagem principal (ou um placeholder quando não houver imagem), nome, sku, marca, categoria pelo caminho completo, preço no formato `R$ 12,90` (com o preço "De:" riscado ao lado quando houver), status "Ativo"/"Inativo" e as ações editar e excluir. O rodapé MUST exibir os controles de paginação e o total no formato "<total> produtos". Sem resultados, a tela MUST exibir um estado vazio no lugar da tabela. A tela MUST ser acessível apenas a administradores, como toda a área `/admin`.

#### Scenario: Lista com os produtos do seed
- **WHEN** um administrador acessa `/admin/catalog/products` com os 1.076 produtos do seed
- **THEN** vê a primeira página com 20 produtos ordenados por nome, o total "1076 produtos" e a paginação com 54 páginas

#### Scenario: Preço "De:"
- **WHEN** um produto tem `priceCents: 1290` e `listPriceCents: 1590`
- **THEN** a linha exibe `R$ 12,90` e `R$ 15,90` riscado

### Requirement: Busca e filtros refletidos na URL
A listagem SHALL oferecer um campo de busca, um seletor de marca, um seletor de categoria (opções rotuladas pelo caminho completo) e um seletor de status (todos, ativos, inativos). O seletor de marca MUST buscar as marcas na API conforme o administrador digita, carregar 20 marcas por vez e oferecer "Carregar mais" no fim da lista enquanto houver mais marcas; a marca selecionada MUST aparecer com o nome mesmo quando não estiver entre as carregadas. A página atual e os filtros aplicados MUST ficar na query string (`page`, `search`, `brandId`, `categoryId`, `isActive`), de modo que recarregar ou compartilhar a URL MUST reproduzir a mesma listagem. Alterar qualquer filtro MUST voltar para a página 1. Filtros vazios MUST NOT aparecer na URL.

#### Scenario: Filtro por marca
- **WHEN** o administrador escolhe a marca "Faber-Castell" no seletor
- **THEN** a URL passa a conter `brandId=<id>` sem `page` além da primeira, e a tabela exibe só produtos dessa marca com o total filtrado

#### Scenario: Buscar e carregar mais marcas no seletor
- **WHEN** o administrador abre o seletor de marca, vê as 20 primeiras marcas e escolhe "Carregar mais", ou digita "faber"
- **THEN** a lista passa a exibir as 20 marcas seguintes abaixo das primeiras, ou só as marcas cujo nome, slug ou descrição tem uma palavra começando por "faber"

#### Scenario: Recarregar com filtros
- **WHEN** o administrador recarrega `/admin/catalog/products?categoryId=<id>&page=2`
- **THEN** vê a página 2 dos produtos daquela categoria (incluindo subcategorias) com o seletor de categoria já preenchido

### Requirement: Formulário de produto em seções
As rotas `/admin/catalog/products/new` e `/admin/catalog/products/<id>` SHALL exibir, em página (não em modal), o formulário organizado nas seções: **Identificação** (nome, slug, sku), **Classificação** (marca, com a opção "Sem marca" e o mesmo seletor com busca na API e "Carregar mais" da listagem, e categoria, rotulada pelo caminho completo), **Descrição**, **Preço** (preço, preço "De:" e unidade), **Imagens** e **Publicação** (ativo/inativo, apenas na edição). O slug MUST ser preenchido automaticamente a partir do nome enquanto o administrador não o editar manualmente. Os preços MUST ser digitados em reais com duas casas decimais e enviados à API em centavos. A unidade MUST vir preenchida com "unidade" na criação. Na edição, o formulário MUST carregar os valores atuais do produto, com os preços convertidos para reais.

#### Scenario: Slug automático
- **WHEN** o administrador digita o nome "Caderno Universitário 10 Matérias" em um produto novo sem ter editado o slug
- **THEN** o campo slug exibe `caderno-universitario-10-materias`

#### Scenario: Preço em reais
- **WHEN** o administrador informa preço `12,90` e salva
- **THEN** a API recebe `priceCents: 1290`

#### Scenario: Edição
- **WHEN** o administrador abre `/admin/catalog/products/<id>` de um produto com `priceCents: 390`
- **THEN** o campo preço exibe `3,90` e a seção Publicação está visível

### Requirement: Imagens ordenáveis no formulário
A seção Imagens SHALL listar as imagens do produto, cada uma com os campos URL da miniatura e URL da imagem grande e uma pré-visualização da miniatura, com ações de mover para cima, mover para baixo e remover, além do botão "Adicionar imagem". A primeira imagem da lista MUST ser identificada como a principal. Ao salvar, a ordem da lista MUST ser a ordem enviada à API. O botão "Adicionar imagem" MUST ficar indisponível quando houver 10 imagens.

#### Scenario: Reordenar imagens
- **WHEN** o administrador move a segunda imagem para o topo e salva
- **THEN** o produto é gravado com essa imagem como principal e a antiga primeira imagem como segunda

#### Scenario: Limite de imagens
- **WHEN** o formulário já tem 10 imagens
- **THEN** o botão "Adicionar imagem" fica indisponível

### Requirement: Validação no cliente
O formulário MUST barrar o envio, exibindo as mensagens nos campos e sem chamar a API, quando: o nome tiver menos de 3 ou mais de 255 caracteres; o slug for inválido; a categoria não for escolhida; o preço não for maior que zero; o preço "De:" informado não for maior que o preço; a descrição passar de 5000 caracteres; alguma URL de imagem for inválida; ou houver mais de 10 imagens.

#### Scenario: Preço "De:" menor
- **WHEN** o administrador informa preço `10,00` e preço "De:" `9,00` e tenta salvar
- **THEN** o campo preço "De:" exibe a mensagem de erro e nenhuma requisição é feita

### Requirement: Erros da API no formulário
Quando a API rejeitar o envio, o formulário SHALL exibir a mensagem traduzida no campo correspondente ao código: `PRODUCT_SLUG_ALREADY_EXISTS` no slug, `PRODUCT_SKU_ALREADY_EXISTS` no sku, `BRAND_NOT_FOUND` na marca e `CATEGORY_NOT_FOUND` na categoria. Os demais erros MUST ser exibidos como mensagem de erro geral, mantendo os dados digitados. Ao abrir a edição de um produto inexistente, a tela MUST exibir a mensagem de produto não encontrado.

#### Scenario: SKU duplicado
- **WHEN** o administrador salva um produto com um sku já usado e a API responde `409` com `PRODUCT_SKU_ALREADY_EXISTS`
- **THEN** o campo sku exibe a mensagem de sku já cadastrado e o formulário mantém os valores

### Requirement: Sucesso e retorno à lista
Após criar, editar ou excluir um produto com sucesso, o sistema SHALL exibir um toast de sucesso e mostrar a lista atualizada. Criação e edição MUST voltar para `/admin/catalog/products` preservando a query string (página e filtros) que estava na lista quando o formulário foi aberto; o botão de cancelar MUST fazer o mesmo retorno. A exclusão MUST pedir confirmação em diálogo e, confirmada, permanecer na mesma página e filtros; se a página ficar vazia e não for a primeira, MUST ir para a página anterior.

#### Scenario: Edição a partir de uma página filtrada
- **WHEN** o administrador está em `/admin/catalog/products?brandId=<id>&page=3`, abre a edição de um produto e salva
- **THEN** vê um toast de sucesso e volta para `/admin/catalog/products?brandId=<id>&page=3` com os dados atualizados

#### Scenario: Excluir o último item da página
- **WHEN** o administrador confirma a exclusão do único produto exibido na página 5
- **THEN** vê um toast de sucesso e a lista passa para a página 4
