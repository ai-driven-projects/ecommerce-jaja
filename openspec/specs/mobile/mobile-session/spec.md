# Sessão do App Mobile (Mobile Session) Specification

## Purpose

Define a sessão do cliente no app mobile da Jajá: entrar e criar conta por e-mail e senha, a sessão guardada no aparelho e restaurada na abertura, sair e a aba Conta.

## Requirements

### Requirement: Entrar com e-mail e senha
A tela "Entrar" SHALL pedir e-mail e senha e, antes de chamar a API, aplicar as validações de e-mail e de senha forte, mostrando a mensagem de cada campo inválido abaixo dele e não enviando nada. Com os campos válidos, o app MUST enviar `POST /auth/login` com o e-mail e a senha e, no sucesso, guardar a sessão, exibir "Bem-vindo, <primeiro nome>" e levar ao destino. Credenciais recusadas MUST mostrar no formulário "E-mail ou senha inválidos.", sem dizer qual dos dois errou; outras falhas MUST mostrar a mensagem da falha (rede, servidor) ou "Não foi possível entrar. Tente novamente.". Enquanto a requisição corre, o botão MUST mostrar "Entrando…" e não aceitar novo toque.

#### Scenario: Login válido
- **WHEN** a pessoa entra com `ana@exemplo.com` e `#Senha123` e a API responde `200` com o token e o usuário "Ana Souza"
- **THEN** a sessão fica guardada, aparece "Bem-vindo, Ana" e o app vai para o destino

#### Scenario: Credenciais recusadas
- **WHEN** a API responde `401` com `INVALID_CREDENTIALS`
- **THEN** o formulário mostra "E-mail ou senha inválidos." e nenhuma sessão é criada

#### Scenario: Campos inválidos
- **WHEN** a pessoa toca em "Entrar" com o e-mail `ana@` e a senha `123`
- **THEN** aparecem "E-mail inválido." e a mensagem de senha forte, e nenhuma requisição sai

### Requirement: Criar conta
A tela "Criar conta" SHALL pedir nome, e-mail, senha e confirmação, aplicando antes da API as validações de nome com sobrenome (até 50 caracteres no campo), e-mail e senha forte, e a confirmação igual à senha ("As senhas não conferem."). Com os dados válidos, o app MUST enviar `POST /auth/register` só com nome, e-mail e senha e, aceito o registro, entrar em seguida com as mesmas credenciais, exibir "Conta criada. Bem-vindo, <primeiro nome>" e levar ao destino. E-mail já cadastrado (`409` com `EMAIL_ALREADY_EXISTS`) MUST mostrar "Este e-mail já está cadastrado." sem criar sessão; outra recusa MUST mostrar "Não foi possível criar a conta. Tente novamente.". Se o registro for aceito e o login seguinte falhar, o formulário MUST mostrar a falha do login, sem sessão.

#### Scenario: Conta criada
- **WHEN** a pessoa cria conta como "Ana Souza", `ana@exemplo.com`, `#Senha123` e confirmação igual
- **THEN** o app envia o registro e depois o login, guarda a sessão, mostra "Conta criada. Bem-vindo, Ana" e vai para o destino

#### Scenario: E-mail já cadastrado
- **WHEN** o registro responde `409` com `EMAIL_ALREADY_EXISTS`
- **THEN** o formulário mostra "Este e-mail já está cadastrado.", nenhum login é tentado e não há sessão

#### Scenario: Confirmação diferente
- **WHEN** a senha é `#Senha123` e a confirmação é `#Senha124`
- **THEN** a confirmação mostra "As senhas não conferem." e nenhuma requisição sai

### Requirement: Telas de acesso
"Entrar" e "Criar conta" SHALL abrir em tela cheia, sem a barra de abas, com um botão de fechar que volta à tela anterior (ou à aba Início, se não houver). Cada tela MUST ter uma ação principal ("Entrar" ou "Criar conta") e um link para a outra ("Criar conta" / "Já tenho conta") que mantém o destino.

#### Scenario: Troca de tela mantendo o destino
- **WHEN** a pessoa abre "Entrar" com destino na aba Conta e toca em "Criar conta"
- **THEN** a tela "Criar conta" aparece e, depois de criar a conta, a aba Conta é exibida

### Requirement: Sessão guardada e restaurada
A sessão (token e usuário) SHALL ser guardada no armazenamento seguro do aparelho e lida ao abrir o app, quando a sessão começa desconhecida. Sem sessão guardada, o app MUST ficar sem sessão sem nenhuma requisição. Com sessão guardada, o app MUST conferir o token com `GET /auth/me`: `200` deixa a sessão ativa com o usuário devolvido; `401` apaga a sessão guardada e deixa o app sem sessão; falha de rede ou do servidor mantém a sessão ativa com o usuário guardado. Conteúdo guardado ilegível MUST ser apagado e tratado como ausente.

#### Scenario: Abertura sem sessão
- **WHEN** o app abre sem sessão guardada
- **THEN** a sessão fica ausente e nenhuma requisição de sessão sai

#### Scenario: Token vencido
- **WHEN** o app abre com sessão guardada e `GET /auth/me` responde `401`
- **THEN** a sessão guardada é apagada e o app fica sem sessão

#### Scenario: Sem rede na abertura
- **WHEN** o app abre com sessão guardada e o servidor não responde
- **THEN** a sessão fica ativa com o usuário guardado

### Requirement: Sair
"Sair" SHALL apagar a sessão guardada, deixar o app sem sessão, exibir "Até já já." e manter a pessoa na mesma aba.

#### Scenario: Sair pela aba Conta
- **WHEN** a cliente "Ana Souza" com sessão toca em "Sair" na aba Conta
- **THEN** a sessão é apagada, aparece "Até já já." e a aba Conta mostra o convite para entrar

### Requirement: Aba Conta
A aba Conta SHALL mostrar, sem sessão, o título "Entre ou crie sua conta.", o texto "Uma conta para todo o escritório pedir o que falta e acompanhar a bike chegando.", as vantagens "Entrega de bike em minutos", "Endereço e andar salvos" e "Histórico de pedidos do escritório", a ação principal "Entrar" e a secundária "Criar conta", ambas com destino na própria aba. Com sessão, MUST mostrar "Olá, <primeiro nome>", o nome completo, o e-mail (ou "Administrador" para administradores) e "Sair". A aba MUST trocar de estado sozinha quando a sessão começa ou termina.

#### Scenario: Conta sem sessão
- **WHEN** uma pessoa sem sessão abre a aba Conta e toca em "Entrar"
- **THEN** a aba mostra o convite e a tela "Entrar" abre com destino na aba Conta

#### Scenario: Conta com sessão
- **WHEN** a cliente "Ana Souza" (`ana@exemplo.com`, não administradora) abre a aba Conta
- **THEN** a aba mostra "Olá, Ana", "Ana Souza", "ana@exemplo.com" e "Sair"
