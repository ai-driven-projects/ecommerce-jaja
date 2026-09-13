## MODIFIED Requirements

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

### Requirement: Cabeçalho da loja
O cabeçalho reutilizável da loja SHALL exibir, da esquerda para a direita: o logo, um seletor de bairro sublinhado (sem borda além da inferior de 2px), o tempo estimado de entrega no formato "chega em X min" em mono com o número em vermelho, o controle de conta e o botão da sacola com ícone de sacola e contador numérico em mono com borda de 2px. O controle de conta MUST ser: com nome de usuário informado, o texto "olá, <primeiro nome>" em tinta atenuada e o botão de texto "sair" com hover vermelho; sem nome e com destino de login informado, o link de texto "entrar" sublinhado; sem nenhum dos dois, nada. O cabeçalho MUST ter borda inferior de 2px. Quando o tempo de entrega não estiver disponível, o texto de ETA MUST ser omitido.

#### Scenario: Bairro atendido
- **WHEN** o cabeçalho recebe bairro "Aldeota", ETA 18 minutos e 0 itens na sacola
- **THEN** exibe o seletor com "Aldeota", o texto "chega em 18 min" com "18 min" em vermelho e o contador "0"

#### Scenario: Bairro sem ETA
- **WHEN** o cabeçalho recebe um bairro sem tempo de entrega
- **THEN** o texto "chega em" não é exibido

#### Scenario: Troca de bairro
- **WHEN** o visitante escolhe outro bairro no seletor
- **THEN** o cabeçalho notifica o bairro escolhido para a página que o contém

#### Scenario: Controle de conta
- **WHEN** o cabeçalho recebe o nome "Ana Souza" e uma ação de sair
- **THEN** exibe "olá, Ana" e o botão "sair" antes da sacola; sem nome e com destino de login, exibe apenas o link "entrar"
