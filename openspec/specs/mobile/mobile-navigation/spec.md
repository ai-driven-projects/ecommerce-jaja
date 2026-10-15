# Navegação do App Mobile (Mobile Navigation) Specification

## Purpose

Define a abertura e a navegação do app mobile do cliente Jajá: os pontos de entrada por ambiente, o shell de quatro abas e o tratamento de rotas desconhecidas.
## Requirements
### Requirement: Pontos de entrada por ambiente
O app SHALL ter um ponto de entrada de desenvolvimento e outro de produção, sem flavors nativos, ambos resolvendo o endereço da API pelas regras de `API_URL` e preparando as dependências antes de abrir a primeira tela. Se o endereço não puder ser resolvido, o app MUST abrir uma tela de erro de configuração com a mensagem da falha, em vez de encerrar ou abrir as abas.

#### Scenario: Desenvolvimento sem endereço definido
- **WHEN** o app sobe no ambiente de desenvolvimento sem `API_URL`
- **THEN** o cliente HTTP aponta para `http://localhost:4000` e a primeira tela é a aba Início

#### Scenario: Produção sem endereço definido
- **WHEN** o app sobe no ambiente de produção sem `API_URL`
- **THEN** a tela mostra "Endereço da API não configurado." e nenhuma aba é exibida

### Requirement: Shell de abas
O app SHALL exibir uma barra de navegação inferior com quatro abas, nesta ordem: Início, Buscar, Carrinho e Conta, abrindo em Início. Tocar numa aba MUST mostrar a página dela e marcar a aba como selecionada com a cor da marca. Cada aba MUST manter o próprio conteúdo ao trocar de aba e voltar. Tocar na aba já selecionada MUST voltar à raiz dela.

#### Scenario: Abertura do app
- **WHEN** o app abre
- **THEN** a barra mostra Início, Buscar, Carrinho e Conta, com Início selecionada e a página de Início visível

#### Scenario: Troca de aba
- **WHEN** a pessoa toca em Carrinho
- **THEN** a página de Carrinho aparece, Carrinho fica selecionada, e a página de Início continua montada fora da tela

#### Scenario: Toque na aba selecionada
- **WHEN** a pessoa está num produto aberto pela Início e toca em Início
- **THEN** a página de Início aparece na raiz da aba

### Requirement: Rota desconhecida
Uma rota que não existe SHALL abrir uma página "Página não encontrada" com uma única ação, "Voltar ao início", que leva à aba Início.

#### Scenario: Endereço inexistente
- **WHEN** o app navega para `/nao-existe`
- **THEN** aparece "Página não encontrada" e, ao tocar em "Voltar ao início", a aba Início é exibida

### Requirement: Rotas do catálogo
A rota da aba Buscar SHALL aceitar os filtros de produtos como parâmetros de query, com a codificação única dos filtros (`category`, `brand`, `search`, `minPriceCents`, `maxPriceCents`, `onSale`, `featured`, `sort`, `page`, `pageSize`), e a página da aba MUST receber o filtro já decodificado; valores inválidos MUST ser ignorados sem erro, e `page`/`pageSize` da rota MUST ser ignorados pela listagem, que sempre começa da página 1. Chegar à rota com um filtro diferente do em vigor MUST aplicar o novo filtro; cada mudança de filtro feita na página MUST ser espelhada na rota da aba, sem `page` nem `pageSize`, para que voltar à aba mostre o mesmo filtro. A rota do produto SHALL ser `/home/product/<slug>` na pilha da aba Início e `/search/product/<slug>` na pilha da aba Buscar, ambas com a barra de abas visível, e MUST abrir a página do produto daquele slug; voltar MUST retornar à página de origem com o estado dela. Um produto aberto a partir de outro produto MUST entrar na pilha da mesma aba.

#### Scenario: Busca filtrada pela rota
- **WHEN** o app navega para `/search?category=escolar&sort=aleatorio`
- **THEN** a aba Buscar fica selecionada e a listagem é pedida com `category=escolar`, sem `sort`

#### Scenario: Filtro espelhado na rota
- **WHEN** na Buscar a pessoa marca "Só ofertas", vai para a Início e toca de novo na aba Buscar
- **THEN** a localização da aba é `/search?onSale=true` e a página mostra o mesmo filtro, sem nova requisição

#### Scenario: Produto na pilha de Início
- **WHEN** o app navega para `/home/product/caneta-x` e a pessoa toca em voltar
- **THEN** a página do produto `caneta-x` aparece com a barra de abas visível e o produto é pedido pelo slug; depois do toque, a aba Início volta a ser exibida

#### Scenario: Produto na pilha da Buscar
- **WHEN** na Buscar a pessoa toca num produto e depois em voltar
- **THEN** a página do produto aparece com a aba Buscar selecionada e, depois do toque, a listagem volta com os mesmos itens, sem nova requisição

### Requirement: Abertura com a sessão desconhecida
Enquanto a sessão ainda não foi lida, o app SHALL mostrar uma tela de abertura com a marca e um indicador de carregamento, sem a barra de abas, guardando o endereço pedido. Assim que a sessão for conhecida, o app MUST seguir para o endereço guardado (ou para a aba Início) aplicando a guarda de sessão.

#### Scenario: Abertura com sessão guardada
- **WHEN** o app abre e a conferência da sessão ainda não respondeu
- **THEN** a tela de abertura aparece sem a barra de abas e, quando a sessão é confirmada, a aba Início é exibida

### Requirement: Guarda de sessão
O app SHALL ter uma lista de rotas que exigem sessão; sem sessão, abrir uma delas MUST levar a "Entrar" com o destino em `from` (caminho e query da rota pedida). Exigem sessão os dados de entrega, o checkout e a página do pedido, e o que fica abaixo de cada uma delas. Com sessão, abrir "Entrar" ou "Criar conta" MUST levar direto ao destino de `from`, o que também conclui o acesso depois de entrar ou criar conta. Só destinos relativos iniciados por `/` (não por `//`) e fora das telas de abertura e de acesso MUST ser aceitos; qualquer outro valor, ou a falta dele, MUST levar à aba Início. Quando a sessão termina numa rota que exige sessão, o app MUST levar a "Entrar" com essa rota como destino.

#### Scenario: Já autenticado
- **WHEN** com sessão ativa o app navega para `/login?from=/search?category=escolar`
- **THEN** a aba Buscar é exibida com `category=escolar`, sem a tela "Entrar"

#### Scenario: Destino externo ignorado
- **WHEN** a pessoa abre `/login?from=https://exemplo.com` e entra com sucesso
- **THEN** a aba Início é exibida

#### Scenario: Rota protegida sem sessão
- **WHEN** sem sessão, o app abre o checkout
- **THEN** a tela "Entrar" aparece com `from` apontando para o checkout

### Requirement: Rota do produto no carrinho
A rota do produto na pilha da aba Carrinho SHALL ser `/cart/product/<slug>`, com a barra de abas visível e a aba Carrinho selecionada, e MUST abrir a página do produto daquele slug; voltar MUST retornar à aba Carrinho. Um produto aberto a partir desse produto MUST entrar na mesma pilha.

#### Scenario: Produto a partir do carrinho
- **WHEN** na aba Carrinho a pessoa toca no nome de um produto e depois em voltar
- **THEN** a página do produto aparece com a aba Carrinho selecionada e, depois do toque, a aba Carrinho volta a ser exibida

### Requirement: Todas as rotas abrem a sua página
Cada rota declarada no app SHALL abrir a página dela, com as dependências resolvidas pela injeção do app: as raízes das quatro abas, o produto nas pilhas de Início, Buscar e Carrinho, o checkout e os dados de entrega abertos por ele, o pedido, os dados de entrega da Conta, "Entrar", "Criar conta" e a abertura. Cada rota que exige sessão MUST levar a "Entrar" com o destino quando não há sessão, e MUST abrir a página quando há.

#### Scenario: Rota com sessão sem sessão
- **WHEN** o app navega, sem sessão, para cada rota que exige sessão (dados de entrega, checkout, dados de entrega do checkout e pedido)
- **THEN** em cada caso aparece "Entrar" e o destino original fica guardado para depois do acesso

#### Scenario: Rota aberta diretamente
- **WHEN** o app navega, com sessão, para cada caminho declarado
- **THEN** a página esperada daquele caminho aparece, com a aba certa selecionada quando o caminho fica dentro de uma aba
