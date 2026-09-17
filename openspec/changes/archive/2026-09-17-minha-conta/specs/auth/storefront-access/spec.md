## MODIFIED Requirements

### Requirement: Controle de conta no cabeçalho da loja
O cabeçalho da loja SHALL exibir, entre o tempo de entrega e a sacola, o controle de conta:
- sem sessão, o botão "Entrar", que leva a `/entrar` conforme "Retorno à página de origem";
- com sessão, um botão com o primeiro nome do usuário que abre o menu da conta.

O menu da conta MUST exibir, nesta ordem:
- o nome completo do usuário e, abaixo, "Administrador" para administradores ou o email do usuário para os demais;
- "Minha conta", para qualquer usuário logado, que leva a `/minha-conta` com a query atual da vitrine (loja, categoria e demais parâmetros), para a loja escolhida seguir para a página;
- "Área administrativa", só para usuários com `admin = true`, que leva à área administrativa;
- "Sair".

"Sair" MUST apagar a sessão, exibir a confirmação "Até já já." e manter o cliente na mesma página.

#### Scenario: Sem sessão
- **WHEN** um visitante sem sessão vê a vitrine
- **THEN** o cabeçalho mostra "Entrar" e não mostra nome nem o menu da conta

#### Scenario: Menu de usuário comum
- **WHEN** a cliente "Ana Souza" (ana@exemplo.com, `admin = false`) autenticada abre o menu da conta na vitrine
- **THEN** o menu mostra "Ana Souza", "ana@exemplo.com", "Minha conta" e "Sair", e não mostra "Área administrativa" nem "Conta do escritório"

#### Scenario: Menu de administrador
- **WHEN** `admin@jaja.dev` autenticado abre o menu da conta na vitrine
- **THEN** o menu mostra o nome, "Administrador", "Minha conta", "Área administrativa" e "Sair", nessa ordem

#### Scenario: Minha conta leva a query da vitrine
- **WHEN** um usuário autenticado em `/?loja=loja-paulista&categoria=papelaria` escolhe "Minha conta" no menu
- **THEN** vai para `/minha-conta?loja=loja-paulista&categoria=papelaria`

#### Scenario: Sair pela loja
- **WHEN** a cliente "Ana Souza" autenticada escolhe "Sair" em `/p/caderno`
- **THEN** a sessão é apagada, "Até já já." é exibido, a página continua em `/p/caderno` e o cabeçalho volta a mostrar "Entrar"
