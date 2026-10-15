# Produto do App Mobile (Mobile Product) Specification

## Purpose

Define a página de detalhe do produto no app mobile do cliente Jajá: conteúdo, galeria, descrição, relacionados da categoria, ação principal, estados e navegação a partir do produto.

## Requirements

### Requirement: Conteúdo do produto
A página do produto SHALL mostrar, nesta ordem, abaixo da galeria: os selos "Em destaque" (produto em destaque) e `−N%` (com desconto), quando se aplicam; a marca, quando há; o nome; a unidade, seguida de "· Cód. <sku>" quando há código; o preço, com o preço "De:" riscado quando há; a trilha de categorias da raiz até a do produto; "Sobre o produto"; e a ficha com "Marca", "Categoria" (os nomes da trilha unidos por " / "), "Código" e "Unidade", omitindo as linhas sem valor. Dados que a API não envia (estoque, tempo de entrega, ficha técnica) MUST NOT ser exibidos.

#### Scenario: Produto em destaque com desconto
- **WHEN** o produto tem `isFeatured: true`, `discountPercent: 30`, preço 3490 e preço anterior 4990 centavos, marca "Master" e `sku: "123456"`
- **THEN** a página mostra "Em destaque", `−30%`, "Master", "· Cód. 123456", `R$ 34,90` com `R$ 49,90` riscado e a ficha com "Marca · Master"

#### Scenario: Produto sem marca nem código
- **WHEN** o produto tem `brand: null` e `sku: null`
- **THEN** não aparecem marca, "Cód." nem as linhas "Marca" e "Código" da ficha, e a ficha mostra "Categoria" e "Unidade"

### Requirement: Galeria de fotos
A galeria SHALL mostrar as imagens na ordem da API, a principal primeiro, numa área quadrada com a foto grande inteira. Com mais de uma imagem, MUST ser possível deslizar entre elas, MUST aparecer o contador "<atual>/<total>" e uma faixa de miniaturas rolável com a ativa destacada, e tocar numa miniatura MUST trocar a imagem exibida. Com uma imagem, MUST NOT haver contador nem miniaturas. Sem imagens, a área MUST mostrar o emoji e o tom de reserva da categoria raiz do produto.

#### Scenario: Várias imagens
- **WHEN** o produto tem 3 imagens e a pessoa toca na terceira miniatura
- **THEN** a terceira foto passa a ser a exibida, a terceira miniatura fica destacada e o contador mostra "3/3"

#### Scenario: Deslizar
- **WHEN** o produto tem 3 imagens e a pessoa desliza a foto principal para a esquerda
- **THEN** o contador passa de "1/3" a "2/3" e a segunda miniatura fica destacada

#### Scenario: Sem imagens
- **WHEN** o produto da raiz `cartuchos-toners` não tem imagens
- **THEN** a galeria mostra 🖨️ sobre o tom azul, sem contador nem miniaturas

### Requirement: Descrição recolhível
"Sobre o produto" SHALL mostrar a descrição com as quebras de linha preservadas. Descrição com mais de 600 caracteres MUST começar recolhida em 8 linhas com o botão "Ler mais", que a expande e passa a "Ler menos". Sem descrição, a seção MUST NOT aparecer.

#### Scenario: Descrição longa
- **WHEN** a descrição tem 700 caracteres e a pessoa toca em "Ler mais"
- **THEN** o texto aparece inteiro e o botão passa a "Ler menos"

#### Scenario: Sem descrição
- **WHEN** o produto tem `description: null`
- **THEN** "Sobre o produto" não aparece

### Requirement: Mais da categoria
Depois do produto carregado, a página SHALL pedir os produtos da categoria do produto (a última da trilha) em destaque e mostrar a seção "Mais de <categoria>" com até 4 deles, sem o próprio produto. A seção MUST NOT aparecer enquanto carrega, quando não há outros produtos ou quando o pedido falha. Tocar num deles MUST abrir o detalhe dele na pilha da mesma aba.

#### Scenario: Relacionados da categoria
- **WHEN** o produto da categoria "Toners HP" está aberto e a API devolve 5 produtos dessa categoria, incluindo ele
- **THEN** a requisição é feita com `category=toners-hp`, `sort=featured` e `pageSize=5`, e a seção "Mais de Toners HP" mostra os outros 4

#### Scenario: Sem outros produtos
- **WHEN** a categoria só tem o próprio produto
- **THEN** a seção não aparece

### Requirement: Ação principal da página
A página SHALL ter uma única ação principal, fixa no rodapé e visível enquanto o produto está carregado: o controle de quantidade (de 1 a 99, começando em 1) e o botão "Adicionar · <total>", com o total do preço pela quantidade escolhida. Tocar no botão MUST incluir a quantidade escolhida no carrinho, somando à que já estiver nele; enquanto a inclusão não termina, o botão MUST mostrar "Adicionando…" e ficar indisponível. No sucesso, MUST aparecer o aviso "Adicionado ao carrinho" com "<quantidade> un · <total>" e a ação "Ver carrinho", que abre a aba Carrinho, e a quantidade escolhida MUST voltar a 1. Na falha (limite do carrinho), MUST aparecer a mensagem da regra e o carrinho MUST NOT mudar. Com o produto no carrinho, o rodapé MUST mostrar "Você já tem <quantidade> no carrinho.".

#### Scenario: Ação visível sem carrinho
- **WHEN** o produto de R$ 12,90 está carregado e não está no carrinho
- **THEN** o rodapé mostra a quantidade 1 e "Adicionar · R$ 12,90" habilitado, sem "Você já tem"

#### Scenario: Adicionar três unidades
- **WHEN** a pessoa escolhe quantidade 3 num produto de R$ 12,90 e toca em "Adicionar · R$ 38,70"
- **THEN** aparece "Adicionado ao carrinho" com "3 un · R$ 38,70", o badge do Carrinho aumenta em 3, a quantidade volta a 1 e aparece "Você já tem 3 no carrinho."

#### Scenario: Limite excedido
- **WHEN** o produto já está no carrinho com 98 e a pessoa tenta adicionar 3
- **THEN** aparece "Limite de 99 unidades por produto." e o produto continua com 98

### Requirement: Estados da página do produto
Enquanto o produto carrega, a página SHALL mostrar um skeleton da galeria e do texto. Se a leitura falhar, MUST mostrar o banner "Não foi possível carregar o produto." com a mensagem da falha e "Tentar de novo", que pede o produto de novo. Se o produto não existir (`404`), MUST mostrar o estado vazio "Produto não encontrado" com "Ele pode ter saído do catálogo." e a única ação "Voltar ao catálogo", que abre a aba Buscar sem filtros. Em todos os estados a página MUST ter o botão de voltar.

#### Scenario: Produto inexistente
- **WHEN** a página abre com o slug `nao-existe` e a API responde `404` com `PRODUCT_NOT_FOUND`
- **THEN** aparece "Produto não encontrado" e, ao tocar em "Voltar ao catálogo", a aba Buscar é exibida sem filtros

#### Scenario: Falha e nova tentativa
- **WHEN** a API responde `500` e a pessoa toca em "Tentar de novo"
- **THEN** a página mostra "Não foi possível carregar o produto." e o produto é pedido de novo

### Requirement: Navegação a partir do produto
Tocar numa categoria da trilha SHALL abrir a aba Buscar filtrada por essa categoria; tocar na marca SHALL abrir a aba Buscar filtrada por essa marca.

#### Scenario: Categoria da trilha
- **WHEN** a pessoa toca em "Cartuchos & Toners" na trilha
- **THEN** a aba Buscar é exibida com o filtro `category=cartuchos-toners`

#### Scenario: Marca
- **WHEN** a pessoa toca na marca "HP" (slug `hp`)
- **THEN** a aba Buscar é exibida com o filtro `brand=hp`

### Requirement: Cartão de entrega no produto
Abaixo do preço, a página SHALL mostrar o cartão "Entrega grátis acima de R$ 79,00" com "Abaixo disso, taxa fixa de R$ 4,90", com os valores das regras do carrinho.

#### Scenario: Cartão de entrega
- **WHEN** o produto está carregado
- **THEN** a página mostra "Entrega grátis acima de R$ 79,00" e "Abaixo disso, taxa fixa de R$ 4,90"
