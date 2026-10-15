## ADDED Requirements

### Requirement: Fontes da marca empacotadas
O app SHALL usar Manrope para todo o texto de interface e Bricolage Grotesque para títulos de destaque, a partir de arquivos de fonte empacotados no próprio app, cada um acompanhado da sua licença OFL. O app MUST NOT baixar fontes em tempo de execução.

#### Scenario: Fontes declaradas e presentes
- **WHEN** o pacote do app é inspecionado
- **THEN** as famílias "Manrope" e "Bricolage Grotesque" estão declaradas, os arquivos de fonte a que apontam existem e não estão vazios, e há um arquivo de licença OFL para cada família

#### Scenario: Texto comum na fonte da marca
- **WHEN** qualquer texto de corpo é exibido com o tema do app
- **THEN** ele usa a família Manrope

### Requirement: Tema único da marca
O app SHALL ter um único tema claro, Material 3, com os valores da vitrine web: fundo papel `#FAF8F5`, cartões `#FFFFFF`, texto tinta `#1E1812` e laranja `#FF6B00` como única cor de ação. O app MUST NOT oferecer tema escuro: o visual é o mesmo com o aparelho em modo escuro.

#### Scenario: Aparelho em modo escuro
- **WHEN** o aparelho informa preferência por esquema escuro
- **THEN** o app continua com fundo `#FAF8F5` e texto `#1E1812`

#### Scenario: Cor primária
- **WHEN** o tema do app é consultado
- **THEN** a cor primária é `#FF6B00` e o texto sobre ela é branco

### Requirement: Tokens da marca
O tema SHALL expor, para as telas e componentes, os tokens da marca com os mesmos valores da vitrine web: cores de superfície (papel, cartão, superfície, superfície forte, linha), de texto (tinta, tinta suave, cinza, placeholder), da marca (laranja, forte, link, claro, suave, pálido), de estados (sucesso, aviso e perigo com seus fundos suaves), dos blocos escuros, dos tons pastéis das áreas de imagem, as sombras (cartão, marca, flutuante, selo) e os raios (6, 8, 10, 12, 14, 18, 20, 24 e pílula). Cor que o web obtém por mistura MUST entrar já resolvida.

#### Scenario: Valores copiados do web
- **WHEN** os tokens do tema são comparados com os do web
- **THEN** cada cor tem o mesmo valor hexadecimal (ex.: linha `#EFE9E2`, sucesso `#0E9F5D`, perigo `#C93A31`, tom pêssego `#FFF1E6`) e cada raio o mesmo valor em pixels

### Requirement: Escala tipográfica
O tema SHALL definir a escala de texto do app a partir dos tamanhos e pesos da vitrine web: títulos de página e de seção e títulos de destaque em Bricolage Grotesque 800 com espaçamento de letras negativo; corpo em Manrope 400; rótulos e nomes em Manrope 600/700; botões, preços e selos em Manrope 800. Números de preço MUST usar algarismos tabulares.

#### Scenario: Título de seção
- **WHEN** um título de seção é exibido com o estilo do tema
- **THEN** ele usa Bricolage Grotesque com peso 800 e espaçamento de letras negativo

### Requirement: Preço formatado
Todo preço SHALL ser exibido a partir do valor em centavos no formato da vitrine web: `R$`, um espaço comum, os reais com ponto de milhar e duas casas decimais após a vírgula. Quando houver preço anterior maior que o atual, o anterior MUST aparecer riscado em `#B8AFA4` antes do atual, e o atual em laranja; preço anterior ausente, igual ou menor que o atual MUST ser ignorado.

#### Scenario: Valores formatados
- **WHEN** os valores de 1290, 50 e 129090 centavos são exibidos como preço
- **THEN** os textos são `R$ 12,90`, `R$ 0,50` e `R$ 1.290,90`

#### Scenario: Preço em oferta
- **WHEN** um preço de 1290 centavos é exibido com preço anterior de 1590 centavos
- **THEN** `R$ 15,90` aparece riscado e `R$ 12,90` aparece em laranja

#### Scenario: Preço anterior que não é maior
- **WHEN** um preço de 1290 centavos é exibido com preço anterior de 1290 centavos
- **THEN** só `R$ 12,90` aparece, sem texto riscado

### Requirement: Botão em pílula
O app SHALL ter um botão base em pílula com as variantes primária (laranja com texto branco e a sombra da marca), secundária (superfície creme com borda de linha), contorno (branco com borda de linha), fantasma e perigo (vermelho com texto branco), em tamanhos de 36, 40, 48 e 52 de altura. Sem ação, o botão MUST ficar indisponível, atenuado e sem responder ao toque.

#### Scenario: Botão primário
- **WHEN** um botão primário "Finalizar pedido" é exibido
- **THEN** ele tem fundo `#FF6B00`, texto branco em peso 800 e cantos em pílula

#### Scenario: Botão sem ação
- **WHEN** um botão é exibido sem ação e é tocado
- **THEN** nada acontece e ele aparece atenuado

### Requirement: Campo de texto
O app SHALL ter um campo de texto base com rótulo acima, fundo branco, borda de 1.5 px em `#EFE9E2` e cantos arredondados. No foco a borda MUST ficar laranja; com erro, a borda e a mensagem abaixo do campo MUST ficar em `#C93A31`. O texto de exemplo MUST aparecer em `#B8AFA4`.

#### Scenario: Campo com erro
- **WHEN** o campo "E-mail" é exibido com o erro "Informe um e-mail válido."
- **THEN** a mensagem aparece abaixo do campo em `#C93A31` e a borda do campo fica na mesma cor

#### Scenario: Digitação
- **WHEN** o usuário digita no campo
- **THEN** o texto digitado é entregue a quem usa o campo

### Requirement: Chip de filtro
O app SHALL ter um chip base em pílula, com emoji opcional antes do rótulo e contagem opcional depois. O chip inativo MUST ser branco com borda de linha e texto tinta; o ativo MUST ter fundo `#FFF1E6`, borda e texto laranja. O estado ativo MUST ser anunciado a leitores de tela.

#### Scenario: Chip ativo
- **WHEN** o chip "Coffee Break" é exibido como ativo
- **THEN** ele tem fundo `#FFF1E6`, borda e texto `#FF6B00` e é anunciado como selecionado

#### Scenario: Toque no chip
- **WHEN** o usuário toca num chip inativo
- **THEN** a ação de seleção do chip é chamada

### Requirement: Card de produto
O app SHALL ter um card de produto base: branco, com borda de linha e raio 18, contendo a área de imagem, o nome em até 3 linhas, a unidade em cinza e o preço (com o preço anterior quando houver). A área de imagem MUST mostrar a foto inteira sobre branco quando há endereço de foto e, quando não há foto ou ela não carrega, o emoji de reserva sobre o tom pastel informado (padrão 🛒 sobre o verde-claro). A área de imagem MUST ter um único selo, nesta prioridade: `−N%` quando há desconto, senão "Destaque" quando o produto está em destaque. O card MUST mostrar uma ação ao lado do preço só quando ela for fornecida, e o toque no card MUST chamar a ação de abrir o produto. O nome completo MUST ficar disponível a leitores de tela.

#### Scenario: Selo de desconto vence o destaque
- **WHEN** um card exibe um produto em destaque com desconto de 19%, preço de 1290 e preço anterior de 1590 centavos
- **THEN** o selo mostra `−19%` e não "Destaque", e o preço mostra `R$ 12,90` com `R$ 15,90` riscado

#### Scenario: Produto sem foto
- **WHEN** um card exibe um produto sem foto e sem emoji de reserva
- **THEN** a área de imagem mostra 🛒 sobre o tom verde-claro

#### Scenario: Sem ação de carrinho
- **WHEN** o card é exibido sem ação ao lado do preço
- **THEN** nenhum controle aparece ao lado do preço

### Requirement: Skeleton estático
O app SHALL ter um bloco de carregamento (skeleton) na cor de superfície `#F6F1EA`, com os mesmos raios do conteúdo que substitui. O skeleton MUST NOT animar: sem brilho, pulsação nem indicador giratório. Ele MUST ser anunciado a leitores de tela como carregamento.

#### Scenario: Bloco carregando
- **WHEN** um skeleton é exibido por alguns segundos
- **THEN** ele permanece estático na cor `#F6F1EA`, sem nenhuma animação

### Requirement: Banner de erro
O app SHALL ter um banner de erro padrão para blocos que dependem de dados remotos, com um título, a mensagem da falha recebida e o botão "Tentar de novo". Tocar em "Tentar de novo" MUST chamar a ação de nova tentativa uma vez por toque.

#### Scenario: Falha ao carregar
- **WHEN** o banner é exibido para uma falha de rede com a mensagem "Sem conexão com a internet."
- **THEN** ele mostra o título, a mensagem "Sem conexão com a internet." e o botão "Tentar de novo"

#### Scenario: Nova tentativa
- **WHEN** o usuário toca em "Tentar de novo"
- **THEN** a ação de nova tentativa é chamada exatamente uma vez

### Requirement: Estado vazio com ação
O app SHALL ter um estado vazio padrão com um emoji grande, um título em Bricolage Grotesque, uma explicação curta e exatamente uma ação, um botão com rótulo próprio.

#### Scenario: Lista vazia
- **WHEN** o estado vazio é exibido com o título "Nada por aqui. Já já." e a ação "Ver catálogo"
- **THEN** aparecem o emoji, o título, a explicação e um único botão "Ver catálogo", que chama a ação ao ser tocado
