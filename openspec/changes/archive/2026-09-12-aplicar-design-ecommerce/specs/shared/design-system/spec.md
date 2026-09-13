## Purpose

Define o visual único do frontend do Jaja: tokens, tipografia, regras globais e o comportamento visual dos componentes compartilhados de UI, do logo, do shell administrativo e dos componentes reutilizáveis da loja, conforme o design "já já." (modernista e flat, sem decoração).

## ADDED Requirements

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

### Requirement: Cabeçalho da loja
O cabeçalho reutilizável da loja SHALL exibir, da esquerda para a direita: o logo, um seletor de bairro sublinhado (sem borda além da inferior de 2px), o tempo estimado de entrega no formato "chega em X min" em mono com o número em vermelho, e o botão da sacola com ícone de sacola e contador numérico em mono com borda de 2px. O cabeçalho MUST ter borda inferior de 2px. Quando o tempo de entrega não estiver disponível, o texto de ETA MUST ser omitido.

#### Scenario: Bairro atendido
- **WHEN** o cabeçalho recebe bairro "Aldeota", ETA 18 minutos e 0 itens na sacola
- **THEN** exibe o seletor com "Aldeota", o texto "chega em 18 min" com "18 min" em vermelho e o contador "0"

#### Scenario: Bairro sem ETA
- **WHEN** o cabeçalho recebe um bairro sem tempo de entrega
- **THEN** o texto "chega em" não é exibido

#### Scenario: Troca de bairro
- **WHEN** o visitante escolhe outro bairro no seletor
- **THEN** o cabeçalho notifica o bairro escolhido para a página que o contém

### Requirement: Filtros de categoria
Os filtros de categoria reutilizáveis SHALL ser botões de texto sublinhado, dispostos em linha com quebra à esquerda da barra, com borda inferior de 2px; o campo de busca, quando presente, fica à direita. O filtro ativo MUST ter sublinhado de 2px vermelho e peso 600; os demais MUST ter sublinhado de 1px em tinta e ficar vermelhos em hover.

#### Scenario: Filtro ativo
- **WHEN** a categoria "papelaria" está ativa
- **THEN** "papelaria" aparece com sublinhado vermelho de 2px e as outras categorias com sublinhado fino em tinta

### Requirement: Grade e card de produto
A grade de produtos SHALL ser exibida sobre papel: o espaço não ocupado por cards MUST ser papel, nunca tinta. A partir de 900px os cards MUST ter largura fixa de 220px, centralizados na largura disponível, com espaçamento de 32px entre eles e margem de 32px da borda; abaixo de 900px a grade SHALL ter 2 colunas fluidas com espaçamento de 16px. A grade MUST ter borda inferior de 2px. Cada card SHALL ter borda de 2px em tinta e exibir: área de imagem em superfície com proporção 4:3 contendo o desenho monocromático da categoria, a categoria em caixa alta 11px, o nome em peso 600 e o preço em mono. Em hover o card MUST inverter papel e superfície, sem sombra ou escala.

#### Scenario: Grade no desktop
- **WHEN** a grade é exibida em uma janela de 1280px de largura com 5 produtos
- **THEN** há 5 cards de 220px em uma linha centralizada, separados por 32px, e o espaço restante nas laterais é papel

#### Scenario: Grade no mobile
- **WHEN** a grade é exibida em uma janela de 375px de largura
- **THEN** há 2 colunas com espaçamento de 16px

#### Scenario: Hover no card
- **WHEN** o ponteiro está sobre um card
- **THEN** o fundo do card passa a superfície e a área de imagem passa a papel, sem sombra

### Requirement: Campo de busca de produtos
A barra de filtros da vitrine SHALL reservar, à direita dos filtros de categoria, um campo de busca de produtos com ícone de lupa e o texto de apoio "Buscar produtos", discreto: sem fundo e apenas com borda inferior de 2px em tinta (vermelha em foco). Nesta entrega a busca MUST NOT filtrar produtos: digitar e enviar o campo não altera a grade nem a URL.

#### Scenario: Campo visível
- **WHEN** a vitrine é exibida para um bairro atendido
- **THEN** o campo "Buscar produtos" aparece na barra de filtros, à direita das categorias

#### Scenario: Envio sem efeito
- **WHEN** o visitante digita "caderno" no campo e pressiona Enter
- **THEN** a grade e a URL permanecem iguais

### Requirement: Imagem por categoria
Cada categoria de produto SHALL ter um desenho SVG monocromático próprio (traço em tinta sobre superfície) para `papelaria`, `impressão`, `café e lanches`, `limpeza de escritório` e `tecnologia básica`. Categorias desconhecidas MUST usar o desenho de `tecnologia básica`. O SVG MUST ter rótulo acessível com o nome da categoria. Nenhuma foto ou marca MUST ser usada como imagem de produto.

#### Scenario: Categoria conhecida
- **WHEN** um produto da categoria "café e lanches" é exibido
- **THEN** a área de imagem mostra o desenho da xícara com rótulo acessível "café e lanches"

#### Scenario: Categoria desconhecida
- **WHEN** um produto de categoria "outros" é exibido
- **THEN** a área de imagem mostra o desenho padrão de tecnologia básica

### Requirement: Painel da sacola
O painel reutilizável da sacola SHALL abrir fixo à direita com largura de 420px ou a largura da tela se menor, borda esquerda de 2px, cabeçalho com o título "sacola" em caixa alta e um botão de fechar. Ao abrir, o foco MUST ir para o painel; ao fechar, o foco MUST voltar ao elemento que o abriu. O painel MUST fechar com a tecla Escape e com clique no fundo escurecido. Sem itens, o painel SHALL exibir "Sua sacola está vazia. Já já enche." e nenhum rodapé. Com itens, SHALL listar cada item com nome, controle de quantidade (−, número, +) com bordas de 2px e subtotal em mono, e um rodapé com total em mono, tempo de entrega e botão primário "Fechar pedido".

#### Scenario: Sacola vazia
- **WHEN** o painel abre sem itens
- **THEN** exibe "Sua sacola está vazia. Já já enche." e não exibe total nem botão "Fechar pedido"

#### Scenario: Fechar com Escape
- **WHEN** o painel está aberto e o visitante pressiona Escape
- **THEN** o painel fecha e o foco volta ao botão da sacola

#### Scenario: Fechar clicando no fundo
- **WHEN** o painel está aberto e o visitante clica no fundo escurecido
- **THEN** o painel fecha

#### Scenario: Sacola com itens
- **WHEN** o painel abre com um item de 1290 centavos e quantidade 2
- **THEN** exibe o item com subtotal `R$ 25,80` e o rodapé com total `R$ 25,80` e o botão "Fechar pedido"

### Requirement: Shell administrativo flat
A área privada SHALL manter a navegação lateral recolhível, o menu lateral em folha no mobile e o menu do usuário no cabeçalho, mas com fundo papel, sidebar e cabeçalho separados por divisores de 2px em tinta, sem fundo escuro, gradientes, desfoque, sombras ou cantos arredondados. O item de navegação ativo MUST ser marcado com borda esquerda de 2px vermelha. O avatar do usuário MUST ser quadrado com borda de 2px.

#### Scenario: Área privada aberta
- **WHEN** o usuário acessa `/principal`
- **THEN** a sidebar e o cabeçalho aparecem em papel, separados do conteúdo por linhas de 2px em tinta, sem gradiente

#### Scenario: Item de navegação ativo
- **WHEN** a rota atual corresponde a um item da sidebar
- **THEN** esse item exibe borda esquerda de 2px vermelha e os demais não

#### Scenario: Sidebar recolhida
- **WHEN** o usuário recolhe a sidebar no desktop
- **THEN** ela continua recolhível e expansível como antes, exibindo só ícones e o logo reduzido

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
