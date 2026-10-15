## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Todas as rotas abrem a sua página
Cada rota declarada no app SHALL abrir a página dela, com as dependências resolvidas pela injeção do app: as raízes das quatro abas, o produto nas pilhas de Início, Buscar e Carrinho, o checkout e os dados de entrega abertos por ele, o pedido, os dados de entrega da Conta, "Entrar", "Criar conta" e a abertura. Cada rota que exige sessão MUST levar a "Entrar" com o destino quando não há sessão, e MUST abrir a página quando há.

#### Scenario: Rota com sessão sem sessão
- **WHEN** o app navega, sem sessão, para cada rota que exige sessão (dados de entrega, checkout, dados de entrega do checkout e pedido)
- **THEN** em cada caso aparece "Entrar" e o destino original fica guardado para depois do acesso

#### Scenario: Rota aberta diretamente
- **WHEN** o app navega, com sessão, para cada caminho declarado
- **THEN** a página esperada daquele caminho aparece, com a aba certa selecionada quando o caminho fica dentro de uma aba
