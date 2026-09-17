# Design System Specification

## Purpose

Define o visual único do frontend do Jaja: tokens, tipografia, regras globais e o comportamento visual dos componentes compartilhados de UI, do logo, do shell administrativo e dos componentes reutilizáveis da loja, conforme o design "já já." (modernista e flat, sem decoração).
## Requirements
### Requirement: Tokens visuais únicos
O frontend SHALL usar um único conjunto de tokens visuais em toda a aplicação: papel `#ffffff` como fundo, superfície `#eae9e9` para áreas de imagem e campos, tinta `#201e1d` para texto e divisores, vermelho `#ec3013` como cor de destaque, cinza `#55524f` para texto secundário, `#d5d3cf` para linhas internas de tabela, `#B0ADA4` para estados de carregamento e `#b3260f` para texto pequeno em vermelho. Os tokens semânticos já consumidos pelos componentes (fundo, primeiro plano, primária, borda, anel de foco, destrutivo) MUST resolver para esses valores. O sistema MUST NOT oferecer tema escuro: a aplicação tem o mesmo visual independentemente da preferência de esquema de cores do navegador.

#### Scenario: Preferência de tema escuro no navegador
- **WHEN** o navegador informa preferência por esquema escuro
- **THEN** a aplicação continua renderizada em papel `#ffffff` com texto em tinta `#201e1d`

#### Scenario: Botão primário
- **WHEN** um botão primário é renderizado
- **THEN** ele tem fundo tinta, texto papel, cantos retos e o label alinhado à esquerda

### Requirement: Tipografia do design
Todo texto de interface SHALL usar Archivo (pesos 400, 600 e 800). Títulos de display (nome de produto em destaque, estado vazio da vitrine) SHALL usar Bricolage Grotesque. Números, preços, tempos e contadores SHALL usar IBM Plex Mono com algarismos tabulares. Preços MUST ser exibidos no formato `R$ 12,90` (prefixo, espaço, vírgula decimal, duas casas). Todo texto MUST ser alinhado à esquerda, inclusive dentro de botões largos.

#### Scenario: Preço formatado
- **WHEN** um valor de 1290 centavos é exibido como preço
- **THEN** o texto renderizado é `R$ 12,90` em fonte mono com algarismos tabulares

#### Scenario: Preço abaixo de um real
- **WHEN** um valor de 50 centavos é exibido como preço
- **THEN** o texto renderizado é `R$ 0,50`

### Requirement: Geometria flat
Nenhum elemento da interface SHALL ter cantos arredondados, sombras, gradientes ou desfoque de fundo. Divisores entre seções principais MUST ser linhas de 2px na cor tinta; linhas internas de tabela MUST ser de 1px em `#d5d3cf`. Painéis sobrepostos (diálogos, menus, painéis laterais) MUST ter borda de 2px e fundo escurecido semitransparente em tinta a 35%.

#### Scenario: Card compartilhado
- **WHEN** um card compartilhado é renderizado
- **THEN** ele tem borda de 2px em tinta, cantos retos e nenhuma sombra

#### Scenario: Tabela compartilhada
- **WHEN** uma tabela compartilhada com três linhas é renderizada
- **THEN** há régua de 2px acima do cabeçalho e abaixo da última linha e réguas de 1px `#d5d3cf` entre as linhas

#### Scenario: Diálogo aberto
- **WHEN** um diálogo compartilhado é aberto
- **THEN** o painel aparece com borda de 2px, sem sombra, sobre um fundo escurecido, e sem animação de entrada

### Requirement: Nada anima ao carregar
A interface MUST NOT executar animações de entrada ao carregar uma página ou montar um componente. Transições SHALL existir apenas em hover e mudanças de estado, com duração máxima de 120ms. Estados de carregamento SHALL exibir a estrutura da página com réguas e textos em `#B0ADA4`, sem shimmer, pulsação ou spinner.

#### Scenario: Página carregada
- **WHEN** qualquer página é aberta
- **THEN** nenhum elemento sofre fade, deslizamento ou escala de entrada

#### Scenario: Esqueleto de formulário
- **WHEN** o esqueleto de formulário compartilhado é exibido
- **THEN** seus blocos aparecem em `#B0ADA4` estáticos, sem pulsação

### Requirement: Foco e destaque
Elementos focados por teclado SHALL exibir contorno de 2px em vermelho com afastamento de 2px. O vermelho SHALL ser usado com parcimônia: ponto do logo, filtro ativo, tempo de entrega, avisos e mensagens de erro. Texto pequeno em vermelho MUST usar o tom `#b3260f` para garantir contraste. Links MUST ficar vermelhos em hover.

#### Scenario: Navegação por Tab
- **WHEN** o usuário foca um botão com a tecla Tab
- **THEN** o botão exibe contorno vermelho de 2px afastado 2px da borda

#### Scenario: Mensagem de erro de formulário
- **WHEN** uma mensagem de erro de campo é exibida
- **THEN** o texto aparece em `#b3260f`

### Requirement: Logo wordmark
O logo da aplicação SHALL ser o texto "já já." em Archivo 800, minúsculas, com o ponto final em vermelho. O logo MUST NOT depender de arquivo de imagem. Onde só a marca for exibida (por exemplo, na sidebar recolhida), o sistema SHALL exibir uma forma reduzida do wordmark, nunca um espaço vazio.

#### Scenario: Logo completo
- **WHEN** o logo com texto é renderizado
- **THEN** exibe "já já" em tinta e o ponto final em vermelho, sem imagem

#### Scenario: Logo sem texto
- **WHEN** o logo é renderizado apenas como marca
- **THEN** exibe uma forma reduzida do wordmark e nenhuma requisição de imagem é feita

### Requirement: Campos de formulário e rótulos
Campos de texto compartilhados SHALL ter fundo superfície, borda inferior de 2px em tinta e cantos retos. Rótulos SHALL ser exibidos em caixa alta, 11px, espaçamento de letras 0.08em e cor `#55524f`. Abas compartilhadas SHALL ser texto sublinhado; a aba ativa MUST ter sublinhado de 2px vermelho e peso 600.

#### Scenario: Campo de texto
- **WHEN** um campo de texto compartilhado é renderizado
- **THEN** tem fundo `#eae9e9`, borda inferior de 2px em tinta e nenhuma borda arredondada

#### Scenario: Aba ativa
- **WHEN** uma aba está selecionada
- **THEN** ela exibe sublinhado de 2px vermelho e as demais exibem sublinhado fino em tinta

### Requirement: Filtros de categoria
Os filtros de categoria reutilizáveis SHALL ser botões de texto sublinhado, dispostos em linha com quebra à esquerda da barra, com borda inferior de 2px; o campo de busca, quando presente, fica à direita. O filtro ativo MUST ter sublinhado de 2px vermelho e peso 600; os demais MUST ter sublinhado de 1px em tinta e ficar vermelhos em hover.

#### Scenario: Filtro ativo
- **WHEN** a categoria "papelaria" está ativa
- **THEN** "papelaria" aparece com sublinhado vermelho de 2px e as outras categorias com sublinhado fino em tinta

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
- **Botão de adicionar ao carrinho:** só quando a página fornecer essa ação. Com o produto fora do carrinho, é o "+" redondo laranja em contorno; com o produto no carrinho, vira o controle de quantidade (−, número, +) com a quantidade atual. Quando a página informar uma quantidade máxima, o "+" do controle MUST ficar indisponível ao atingi-la.

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

#### Scenario: Produto no carrinho
- **WHEN** a página fornece a ação de carrinho e informa quantidade 2 para o produto do card
- **THEN** o card exibe o controle de quantidade com 2 no lugar do "+"

#### Scenario: Quantidade máxima
- **WHEN** a página informa quantidade máxima 99 e o produto do card está com quantidade 99
- **THEN** o "+" do controle de quantidade fica indisponível

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

### Requirement: Painel da sacola
O painel reutilizável do carrinho SHALL abrir fixo à direita, com largura de 400px ou a largura da tela se menor, cabeçalho com o título "Seu carrinho" e um botão de fechar com o rótulo acessível "Fechar carrinho". Ao abrir, o foco MUST ir para o painel; ao fechar, o foco MUST voltar ao elemento que o abriu. O painel MUST fechar com a tecla Escape e com clique no fundo escurecido. Quando o tempo de entrega é conhecido, o painel MUST exibir a faixa verde "Saindo de bike · chega em ~X min".

**Linhas:**
- cada linha MUST exibir a foto do produto (ou a ilustração da categoria), o nome em até 2 linhas como link, a unidade e o preço unitário em cinza, o controle de quantidade pequeno (0 remove; o "+" fica indisponível na quantidade máxima), o total da linha e um botão de remover com o rótulo acessível "Remover <nome> do carrinho";
- uma linha indisponível MUST exibir o conteúdo atenuado, o selo "Indisponível" e o botão "Remover", sem controle de quantidade e sem total;
- sem itens, o painel MUST exibir o emoji 🛒 com "Seu carrinho está vazio." e "Adicione itens para o escritório!";
- na primeira carga, o painel MUST exibir blocos estáticos no lugar das linhas, sem animação.

**Rodapé:**
- MUST exibir o subtotal, "Entrega de bike" com "Grátis" em verde ou o valor da entrega, "Faltam <valor> para a entrega grátis." quando a entrega é cobrada, o total e o botão primário "Finalizar pedido · <total>";
- com itens indisponíveis, MUST exibir "Remova os itens indisponíveis para continuar.";
- enquanto os valores são atualizados, eles MUST aparecer atenuados e marcados como ocupados;
- o botão MUST ficar indisponível sem itens, com itens indisponíveis ou enquanto os valores são atualizados.

#### Scenario: Sacola vazia
- **WHEN** o painel abre sem itens
- **THEN** exibe "Seu carrinho está vazio." e "Adicione itens para o escritório!", e o botão "Finalizar pedido" está indisponível

#### Scenario: Fechar com Escape
- **WHEN** o painel está aberto e o visitante pressiona Escape
- **THEN** o painel fecha e o foco volta ao botão do carrinho

#### Scenario: Fechar clicando no fundo
- **WHEN** o painel está aberto e o visitante clica no fundo escurecido
- **THEN** o painel fecha

#### Scenario: Sacola com itens
- **WHEN** o painel abre com um item de 1290 centavos e quantidade 2, subtotal de 2580, entrega de 490 e total de 3070
- **THEN** exibe o item com total `R$ 25,80`, o subtotal `R$ 25,80`, a entrega `R$ 4,90`, "Faltam R$ 53,20 para a entrega grátis." e o botão "Finalizar pedido · R$ 30,70"

#### Scenario: Item indisponível
- **WHEN** o painel abre com uma linha indisponível
- **THEN** a linha exibe "Indisponível" e "Remover", sem controle de quantidade, o rodapé exibe "Remova os itens indisponíveis para continuar." e o botão "Finalizar pedido" está indisponível

#### Scenario: Valores em atualização
- **WHEN** a página informa que o carrinho está sendo atualizado
- **THEN** o subtotal, a entrega e o total aparecem atenuados e o botão "Finalizar pedido" está indisponível

### Requirement: Shell administrativo flat
A área administrativa SHALL manter a navegação lateral recolhível, o menu lateral em folha no mobile e o menu do usuário no cabeçalho, mas com fundo papel, sidebar e cabeçalho separados por divisores de 2px em tinta, sem fundo escuro, gradientes, desfoque, sombras ou cantos arredondados. O item de navegação ativo MUST ser marcado com borda esquerda de 2px vermelha. O avatar do usuário MUST ser quadrado com borda de 2px. O menu do usuário MUST exibir o nome, o email e o avatar (quando houver) do usuário logado e a ação "Sair".

#### Scenario: Área privada aberta
- **WHEN** um administrador autenticado acessa `/admin`
- **THEN** a sidebar e o cabeçalho aparecem em papel, separados do conteúdo por linhas de 2px em tinta, sem gradiente

#### Scenario: Item de navegação ativo
- **WHEN** a rota atual corresponde a um item da sidebar
- **THEN** esse item exibe borda esquerda de 2px vermelha e os demais não

#### Scenario: Sidebar recolhida
- **WHEN** o usuário recolhe a sidebar no desktop
- **THEN** ela continua recolhível e expansível como antes, exibindo só ícones e o logo reduzido

#### Scenario: Menu do usuário logado
- **WHEN** o administrador abre o menu do usuário no cabeçalho
- **THEN** vê seu nome, email e avatar quadrado com borda de 2px, e a ação "Sair"

### Requirement: Rodapé da loja
Toda página pública da loja SHALL terminar com um rodapé de loja, separado do conteúdo por régua de 2px em tinta, contendo: o logo grande com uma linha de contexto sobre o serviço; o endereço da loja em São Paulo e o horário; telefone (em mono) e e-mail de contato; links "Política de privacidade" e "Termos de uso" (reservados, sem página nesta entrega); e a linha de copyright em mono. Em telas largas as colunas MUST ser centralizadas em até 1100px; o rodapé MUST ficar no fim da tela quando o conteúdo for curto.

#### Scenario: Rodapé na vitrine
- **WHEN** o visitante rola até o fim de `/`
- **THEN** vê o rodapé com o logo "já já.", o endereço em São Paulo, o telefone, os links institucionais e o copyright, separado do conteúdo por régua de 2px

### Requirement: Documento de design no frontend
O frontend SHALL conter o documento de design (`DESIGN.md`) com os tokens, tipografia e regras acima, e as instruções do agente do frontend MUST apontar para ele como regra para toda tela e componente compartilhado.

#### Scenario: Consulta do documento
- **WHEN** um desenvolvedor abre as instruções do agente do frontend
- **THEN** encontra a referência ao `DESIGN.md` e a instrução de que toda tela e componente compartilhado o segue

### Requirement: Cabeçalho da loja com seletor de lojas
O cabeçalho reutilizável da loja SHALL exibir, da esquerda para a direita: o logo, o seletor de lojas, o campo de busca, o controle de conta e o botão da sacola com ícone de sacola e contador numérico em mono com borda de 2px. O cabeçalho MUST ter borda inferior de 2px.

O seletor de lojas MUST exibir a loja em vigor (nome e, quando disponível, a cidade/UF dela) e abrir a lista das lojas ativas, com a loja em vigor marcada como escolhida e as demais disponíveis para troca; escolher uma loja MUST notificar a escolha para a página que contém o cabeçalho. Com uma única loja ativa, o seletor MUST exibir a loja sem oferecer troca. O rótulo acessível do seletor MUST falar de loja.

O cabeçalho MUST NOT exibir tempo estimado de entrega nem qualquer texto de cobertura: não há cálculo real de tempo nem verificação de área nesta versão.

O controle de conta MUST ser: com nome de usuário informado, o menu da conta descrito em `auth/storefront-access`; sem nome e com destino de login informado, o botão "Entrar"; sem nenhum dos dois, nada.

#### Scenario: Loja escolhida
- **WHEN** o cabeçalho recebe as lojas ativas, a "Loja Paulista" como escolhida e 0 itens na sacola
- **THEN** exibe o seletor com "Loja Paulista", sem nenhum texto de tempo de entrega, e o contador "0"

#### Scenario: Troca de loja
- **WHEN** o visitante escolhe outra loja no seletor
- **THEN** o cabeçalho notifica a loja escolhida para a página que o contém

#### Scenario: Uma única loja
- **WHEN** o cabeçalho recebe uma só loja ativa
- **THEN** exibe o nome dela sem oferecer troca

#### Scenario: Controle de conta
- **WHEN** o cabeçalho recebe o nome "Ana Souza" e uma ação de sair
- **THEN** exibe o controle de conta com "Ana" antes da sacola; sem nome e com destino de login, exibe apenas o botão "Entrar"

