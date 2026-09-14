## ADDED Requirements

### Requirement: Imagem do produto
A área de imagem de um produto nos componentes da loja (card, galeria e demais pontos que exibem o produto) SHALL mostrar a foto do produto por inteiro, sem cortes, sobre fundo claro, com texto alternativo igual ao nome do produto. A imagem MUST ser a miniatura nos cards e a imagem grande na galeria do detalhe.

A ilustração da categoria (emoji sobre o tom pastel da categoria raiz) MUST ser usada quando:
- o produto não tiver imagem; ou
- a foto não carregar.

Categoria raiz desconhecida MUST usar a ilustração padrão.

#### Scenario: Produto com foto
- **WHEN** um card exibe um produto com imagem principal
- **THEN** a área de imagem mostra a miniatura do produto inteira, com texto alternativo igual ao nome

#### Scenario: Foto indisponível
- **WHEN** a foto de um produto da categoria raiz "Coffee Break" não carrega
- **THEN** a área de imagem passa a mostrar o emoji ☕ sobre o tom pastel da categoria

#### Scenario: Categoria sem ilustração própria
- **WHEN** um produto sem imagem pertence a uma categoria raiz sem ilustração cadastrada
- **THEN** a área de imagem mostra a ilustração padrão 🛒

### Requirement: Busca no cabeçalho da loja
O cabeçalho da loja SHALL exibir o campo de busca de produtos em formato de pílula, com ícone de lupa, rótulo acessível "Buscar produtos" e o texto de apoio "Buscar papel A4, toner, café…". O envio, com Enter ou pelo botão da lupa, MUST notificar o termo digitado para a página que contém o cabeçalho.

O campo MUST:
- iniciar com o termo informado pela página;
- oferecer um botão para limpar o texto quando houver texto.

#### Scenario: Campo visível
- **WHEN** a vitrine é exibida
- **THEN** o campo de busca aparece no cabeçalho da loja com o texto de apoio "Buscar papel A4, toner, café…"

#### Scenario: Envio do termo
- **WHEN** o visitante digita "caderno" no campo e pressiona Enter
- **THEN** o cabeçalho notifica o termo "caderno" para a página, que exibe a busca por "caderno"

#### Scenario: Termo inicial
- **WHEN** a página informa o termo "toner" ao cabeçalho
- **THEN** o campo exibe "toner" e o botão de limpar

## MODIFIED Requirements

### Requirement: Grade e card de produto
A grade de produtos SHALL ter 2 colunas fluidas em telas estreitas e, a partir de 640px, colunas automáticas com largura mínima de 180px (220px na seção de ofertas), com espaçamento de 14px.

Cada card SHALL ser branco, com borda fina, e exibir:
- **Área de imagem** (ver "Imagem do produto"), com um único selo no canto, nesta prioridade:
  1. o desconto `−N%`, quando o produto tem preço "De:";
  2. "Destaque", quando o produto está em destaque;
  3. o tempo de entrega, quando conhecido.
- **Nome:** peso 700, limitado a 3 linhas, com o nome completo disponível como título.
- **Unidade:** em cinza.
- **Preço:** com o preço "De:" riscado, quando houver.
- **Botão de adicionar ao carrinho:** só quando a página fornecer essa ação.

A área de imagem e o nome MUST levar ao detalhe do produto. Em hover, o card MUST subir levemente e ganhar sombra.

#### Scenario: Grade no desktop
- **WHEN** a grade é exibida em uma janela de 1280px de largura
- **THEN** os cards ocupam colunas automáticas de no mínimo 180px, separadas por 14px, preenchendo a largura disponível

#### Scenario: Grade no mobile
- **WHEN** a grade é exibida em uma janela de 375px de largura
- **THEN** há 2 colunas de cards

#### Scenario: Hover no card
- **WHEN** o ponteiro está sobre um card
- **THEN** o card sobe levemente e ganha sombra

#### Scenario: Selo de desconto
- **WHEN** um card exibe um produto em destaque com `priceCents: 1290` e `listPriceCents: 1590`
- **THEN** o selo mostra `−19%`, e não "Destaque" nem o tempo de entrega, e o preço mostra `R$ 12,90` com `R$ 15,90` riscado

#### Scenario: Nome longo
- **WHEN** um card exibe um produto com nome de 214 caracteres
- **THEN** o nome aparece em no máximo 3 linhas, e o nome completo fica disponível como título do link

#### Scenario: Sem ação de carrinho
- **WHEN** a página não fornece a ação de adicionar ao carrinho
- **THEN** o card não exibe o botão "+"

## REMOVED Requirements

### Requirement: Imagem por categoria
**Reason**: A loja passa a exibir as fotos reais dos produtos do catálogo, e a ilustração por categoria vira apenas reserva. As categorias fictícias (`papelaria`, `impressão`…) deixam de existir na vitrine.
**Migration**: Ver o requisito "Imagem do produto": a foto é a imagem padrão, e a ilustração da categoria raiz é usada só sem foto ou quando a foto falha.

### Requirement: Campo de busca de produtos
**Reason**: O campo de busca deixa de ser só reservado na barra de filtros, sem efeito, e passa a buscar de fato a partir do cabeçalho da loja.
**Migration**: Ver o requisito "Busca no cabeçalho da loja" e o requisito "Busca de produtos pelo cabeçalho" de `catalog/storefront`.
