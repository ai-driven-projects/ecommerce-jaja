## MODIFIED Requirements

### Requirement: Listagem paginada de produtos
A rota `/admin/catalog/products` SHALL exibir o cabeçalho da página com o botão "Novo produto" e uma tabela com uma linha por produto contendo:
- miniatura da imagem principal, ou um placeholder quando não houver imagem;
- nome, com o badge "Destaque" ao lado quando o produto estiver em destaque;
- sku e marca;
- categoria pelo caminho completo;
- preço no formato `R$ 12,90`, com o preço "De:" riscado ao lado quando houver;
- status "Ativo"/"Inativo";
- as ações editar e excluir.

O rodapé MUST exibir os controles de paginação e o total no formato "<total> produtos". Sem resultados, a tela MUST exibir um estado vazio no lugar da tabela. A tela MUST ser acessível apenas a administradores, como toda a área `/admin`.

#### Scenario: Lista com os produtos do seed
- **WHEN** um administrador acessa `/admin/catalog/products` com os 1.076 produtos do seed
- **THEN** vê a primeira página com 20 produtos ordenados por nome, o total "1076 produtos" e a paginação com 54 páginas

#### Scenario: Preço "De:"
- **WHEN** um produto tem `priceCents: 1290` e `listPriceCents: 1590`
- **THEN** a linha exibe `R$ 12,90` e `R$ 15,90` riscado

#### Scenario: Produto em destaque
- **WHEN** a página exibe um produto com `isFeatured: true`
- **THEN** a linha mostra o badge "Destaque" ao lado do nome, e as linhas dos demais produtos não mostram

### Requirement: Formulário de produto em seções
As rotas `/admin/catalog/products/new` e `/admin/catalog/products/<id>` SHALL exibir o formulário em página (não em modal), organizado nas seções:
- **Identificação:** nome, slug e sku;
- **Classificação:** marca, com a opção "Sem marca" e o mesmo seletor com busca na API e "Carregar mais" da listagem; e categoria, rotulada pelo caminho completo;
- **Descrição**;
- **Preço:** preço, preço "De:" e unidade;
- **Imagens**;
- **Publicação:** a caixa "Destaque na vitrine", com o texto de apoio "Aparece em “Em destaque” na página inicial da loja", na criação e na edição; e ativo/inativo, apenas na edição.

Comportamentos:
- **Slug:** preenchido automaticamente a partir do nome enquanto o administrador não o editar manualmente.
- **Preços:** digitados em reais com duas casas decimais e enviados à API em centavos.
- **Criação:** a unidade vem preenchida com "unidade" e "Destaque na vitrine" vem desmarcado.
- **Edição:** o formulário MUST carregar os valores atuais do produto, com os preços convertidos para reais e o destaque atual.

#### Scenario: Slug automático
- **WHEN** o administrador digita o nome "Caderno Universitário 10 Matérias" em um produto novo sem ter editado o slug
- **THEN** o campo slug exibe `caderno-universitario-10-materias`

#### Scenario: Preço em reais
- **WHEN** o administrador informa preço `12,90` e salva
- **THEN** a API recebe `priceCents: 1290`

#### Scenario: Edição
- **WHEN** o administrador abre `/admin/catalog/products/<id>` de um produto com `priceCents: 390` e `isFeatured: true`
- **THEN** o campo preço exibe `3,90`, e a seção Publicação está visível com "Destaque na vitrine" marcado e o controle de ativo/inativo

#### Scenario: Criação em destaque
- **WHEN** o administrador cria um produto marcando "Destaque na vitrine"
- **THEN** a seção Publicação não exibe o controle de ativo/inativo, e a API recebe `isFeatured: true`
