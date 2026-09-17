# Acesso pela Loja (Storefront Access) Specification

## Purpose

Define como o cliente entra ou cria conta a partir da loja sem que isso seja obrigatório: a rota pública `/entrar`, o retorno à página de origem e o controle de conta no cabeçalho da vitrine.

## Requirements

### Requirement: Rota pública de acesso na loja
O sistema SHALL servir em `/entrar`, dentro do shell da loja (cabeçalho, sacola e rodapé), uma página com o título "Entre ou crie sua conta." e o formulário com as abas "Entrar" (email e senha) e "Criar conta" (nome, email, senha e confirmação). A página MUST ser acessível sem sessão e MUST aplicar no cliente as mesmas validações do formulário administrativo (email válido, nome com sobrenome, senha forte, confirmação igual) antes de chamar a API. Erros da API MUST aparecer no formulário; email já cadastrado MUST exibir "Este email já está cadastrado".

#### Scenario: Página aberta sem sessão
- **WHEN** um visitante sem sessão acessa `/entrar`
- **THEN** vê o cabeçalho da loja, o título e as abas "Entrar" e "Criar conta", sem redirecionamento

#### Scenario: Email já cadastrado
- **WHEN** o visitante tenta criar conta com um email já existente
- **THEN** o formulário exibe "Este email já está cadastrado" e nenhuma sessão é criada

### Requirement: Retorno à página de origem
O link "entrar" do cabeçalho SHALL levar a `/entrar` com o parâmetro `voltar` contendo o caminho e a query da página atual. Após entrar ou criar conta, o sistema MUST exibir uma confirmação com o primeiro nome do cliente e voltar para o caminho de `voltar`; sem `voltar` MUST voltar para `/`. Só caminhos relativos iniciados por `/` MUST ser aceitos; qualquer outro valor MUST ser tratado como ausente. Um cliente que já tem sessão ao abrir `/entrar` MUST ser levado imediatamente ao destino de `voltar`.

#### Scenario: Login com retorno
- **WHEN** o visitante clica em "entrar" na vitrine em `/?bairro=Consolação&categoria=papelaria` e entra com credenciais válidas
- **THEN** vê a confirmação com seu primeiro nome e volta para `/?bairro=Consolação&categoria=papelaria` já autenticado

#### Scenario: Retorno externo ignorado
- **WHEN** o visitante abre `/entrar?voltar=https://exemplo.com` e entra
- **THEN** volta para `/`

#### Scenario: Já autenticado
- **WHEN** um cliente com sessão acessa `/entrar?voltar=/p/caderno`
- **THEN** é levado para `/p/caderno` sem ver o formulário

### Requirement: Criar conta pela loja autentica em seguida
Ao criar conta pela aba "Criar conta" de `/entrar`, o sistema SHALL registrar o usuário (sempre como usuário comum) e autenticá-lo com as mesmas credenciais na sequência, sem exigir um segundo passo. A confirmação MUST indicar que a conta foi criada.

#### Scenario: Conta criada na loja
- **WHEN** um visitante cria conta com dados válidos em `/entrar?voltar=/`
- **THEN** o usuário passa a existir com `admin = false`, a sessão fica guardada, a confirmação "Conta criada" com o primeiro nome é exibida e ele volta para `/` com o cabeçalho mostrando "olá, <primeiro nome>"

### Requirement: Controle de conta no cabeçalho da loja
O cabeçalho da loja SHALL exibir, entre o tempo de entrega e a sacola: sem sessão, o link "entrar"; com sessão, "olá, <primeiro nome>" e a ação "sair". "sair" MUST apagar a sessão, exibir a confirmação "Até já já." e manter o cliente na mesma página. O cabeçalho MUST NOT oferecer acesso à área administrativa.

#### Scenario: Sem sessão
- **WHEN** um visitante sem sessão vê a vitrine
- **THEN** o cabeçalho mostra "entrar" e não mostra "sair" nem nome

#### Scenario: Sair pela loja
- **WHEN** a cliente "Ana Souza" autenticada clica em "sair" em `/p/caderno`
- **THEN** a sessão é apagada, "Até já já." é exibido, a página continua em `/p/caderno` e o cabeçalho volta a mostrar "entrar"
