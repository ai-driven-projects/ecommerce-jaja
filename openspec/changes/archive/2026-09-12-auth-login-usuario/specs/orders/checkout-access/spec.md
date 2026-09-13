## Purpose

Define como a rota pública `/checkout` da loja identifica o cliente antes do fechamento do pedido: o que exibe sem sessão e com sessão, a permanência na rota após entrar ou criar conta e o retorno à vitrine com bairro e categoria preservados. O fechamento do pedido em si (endereço, pagamento, criação do pedido) não faz parte desta capacidade.

## ADDED Requirements

### Requirement: Checkout pede identificação sem bloquear a rota
O sistema SHALL servir `/checkout` como rota pública dentro do shell da loja (cabeçalho, sacola e rodapé). Sem sessão, a página MUST exibir o título "Para fechar o pedido, entre ou crie sua conta." e o formulário com as abas "Entrar" (email e senha) e "Criar conta" (nome, email, senha e confirmação), com as mesmas validações e mensagens de erro da rota `/entrar`. A rota MUST NOT redirecionar visitantes sem sessão para outra página.

#### Scenario: Visitante sem sessão
- **WHEN** um visitante sem sessão acessa `/checkout?bairro=Aldeota&categoria=papelaria`
- **THEN** permanece em `/checkout`, vê o cabeçalho da loja com "Aldeota", o título "Para fechar o pedido, entre ou crie sua conta." e as abas "Entrar" e "Criar conta"

#### Scenario: Erros de validação no checkout
- **WHEN** o visitante tenta criar conta em `/checkout` com senha fraca, confirmação diferente da senha ou um email já cadastrado
- **THEN** o formulário exibe a mesma mensagem que exibiria em `/entrar` e nenhuma sessão é criada

### Requirement: Entrar ou criar conta no checkout mantém o cliente na rota
Ao entrar ou criar conta a partir de `/checkout`, o sistema SHALL guardar a sessão, exibir a confirmação com o primeiro nome do cliente ("Bem-vindo, <primeiro nome>" ao entrar; "Conta criada. Bem-vindo, <primeiro nome>" ao criar conta) e MUST manter a URL em `/checkout` com a mesma query, trocando o conteúdo para o estado autenticado sem navegar. Criar conta MUST registrar um usuário comum e autenticá-lo na sequência, sem segundo passo.

#### Scenario: Criar conta no checkout
- **WHEN** a visitante "Ana Souza" cria conta com dados válidos em `/checkout?bairro=Aldeota&categoria=todas`
- **THEN** a confirmação "Conta criada. Bem-vindo, Ana" é exibida, a URL continua `/checkout?bairro=Aldeota&categoria=todas`, o conteúdo passa ao estado autenticado e o cabeçalho mostra "olá, Ana"

#### Scenario: Entrar no checkout
- **WHEN** um cliente já cadastrado entra pela aba "Entrar" em `/checkout`
- **THEN** a confirmação "Bem-vindo, <primeiro nome>" é exibida e a URL continua `/checkout`, agora no estado autenticado

### Requirement: Estado autenticado do checkout
Com sessão, `/checkout` SHALL exibir o título "Checkout chega já já.", o nome e o email do cliente autenticado e um link "voltar para a vitrine" que leva a `/` preservando os parâmetros `bairro` e `categoria` da URL atual. Um cliente que já tem sessão ao abrir `/checkout` MUST ver esse estado diretamente, sem formulário e sem redirecionamento. Um reload MUST manter o estado autenticado.

#### Scenario: Cliente com sessão abre o checkout
- **WHEN** a cliente "Ana Souza" (ana@exemplo.com) com sessão acessa `/checkout?bairro=Meireles&categoria=papelaria`
- **THEN** vê "Checkout chega já já.", "Ana Souza", "ana@exemplo.com" e o link "voltar para a vitrine" apontando para `/?bairro=Meireles&categoria=papelaria`

#### Scenario: Reload mantém a sessão
- **WHEN** a cliente autenticada recarrega `/checkout`
- **THEN** continua vendo o estado autenticado, sem passar pelo formulário

### Requirement: Sair pelo cabeçalho devolve o checkout ao formulário
Se o cliente usar "sair" no cabeçalho enquanto está em `/checkout`, o sistema SHALL manter a URL e voltar a exibir o título "Para fechar o pedido, entre ou crie sua conta." e o formulário, sem navegar.

#### Scenario: Sair no checkout
- **WHEN** a cliente autenticada clica em "sair" em `/checkout?bairro=Aldeota&categoria=todas`
- **THEN** "Até já já." é exibido, a URL continua a mesma e a página mostra novamente o formulário com as abas "Entrar" e "Criar conta"
