## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Cabeçalho da loja
**Reason**: O cabeçalho descrevia um seletor de bairro e o tempo estimado por bairro, ambos baseados em dados simulados no frontend. A navegação da vitrine passa a ser por loja (`catalog/storefront`), e o tempo de entrega sai até existir cálculo real.
**Migration**: Substituída por "Cabeçalho da loja com seletor de lojas". O seletor de bairro dá lugar ao de lojas ativas, e o texto "chega em X min" deixa de existir.
