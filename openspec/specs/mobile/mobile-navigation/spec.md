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
O app SHALL exibir uma barra de navegação inferior com quatro abas, nesta ordem: Início, Buscar, Carrinho e Conta, abrindo em Início. Tocar numa aba MUST mostrar a página dela e marcar a aba como selecionada com a cor da marca. Cada aba MUST manter o próprio conteúdo ao trocar de aba e voltar. Enquanto as funcionalidades não existem, cada aba mostra uma página provisória com o nome dela.

#### Scenario: Abertura do app
- **WHEN** o app abre
- **THEN** a barra mostra Início, Buscar, Carrinho e Conta, com Início selecionada e a página de Início visível

#### Scenario: Troca de aba
- **WHEN** a pessoa toca em Carrinho
- **THEN** a página de Carrinho aparece, Carrinho fica selecionada, e a página de Início continua montada fora da tela

### Requirement: Rota desconhecida
Uma rota que não existe SHALL abrir uma página "Página não encontrada" com uma única ação, "Voltar ao início", que leva à aba Início.

#### Scenario: Endereço inexistente
- **WHEN** o app navega para `/nao-existe`
- **THEN** aparece "Página não encontrada" e, ao tocar em "Voltar ao início", a aba Início é exibida

### Requirement: Rotas do catálogo
A rota da aba Buscar SHALL aceitar os filtros de produtos como parâmetros de query, com a codificação única dos filtros (`category`, `brand`, `search`, `minPriceCents`, `maxPriceCents`, `onSale`, `featured`, `sort`, `page`, `pageSize`), e a página da aba MUST receber o filtro já decodificado; valores inválidos MUST ser ignorados sem erro. A rota do produto SHALL ser `/home/product/<slug>`, aberta na pilha da aba Início com a barra de abas visível, e voltar MUST retornar à Início. Enquanto a busca (etapa 6) e o detalhe (etapa 7) não existem, essas rotas MUST abrir páginas provisórias com os nomes "Buscar" e "Produto".

#### Scenario: Busca filtrada pela rota
- **WHEN** o app navega para `/search?category=escolar&sort=aleatorio`
- **THEN** a aba Buscar fica selecionada, a página recebe o filtro de categoria `escolar` sem ordem, e mostra "Buscar"

#### Scenario: Produto na pilha de Início
- **WHEN** o app navega para `/home/product/caneta-x` e a pessoa toca em voltar
- **THEN** a página "Produto" aparece com a barra de abas visível e, depois do toque, a aba Início volta a ser exibida
