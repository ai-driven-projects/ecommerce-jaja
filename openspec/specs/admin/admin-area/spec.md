# Área Administrativa (Admin Area) Specification

## Purpose

Define o comportamento da área administrativa do frontend do Jaja: as rotas sob `/admin`, a tela de login administrativa, a sessão do usuário, a proteção por sessão e por flag de administrador, o dashboard inicial e a navegação, mantendo a vitrine pública.

## Requirements

### Requirement: Área administrativa sob /admin
Todas as telas administrativas SHALL viver sob a rota `/admin`: `/admin` (dashboard), `/admin/catalog`, `/admin/orders`, `/admin/customers` e `/admin/stores`. As rotas anteriores `/principal`, `/catalog`, `/orders`, `/customers`, `/stores`, `/auth` e `/auth/dashboard` MUST deixar de existir.

#### Scenario: Rota antiga
- **WHEN** alguém acessa `/principal` ou `/catalog`
- **THEN** o sistema responde com a página não encontrada

#### Scenario: Rota administrativa
- **WHEN** um administrador autenticado acessa `/admin/catalog`
- **THEN** a tela do catálogo é exibida dentro do shell administrativo

### Requirement: Tela de acesso administrativa
O sistema SHALL servir em `/admin/login` uma tela de acesso com as abas "Entrar" e "Criar conta", o wordmark "já já." e o rótulo "área administrativa", sem o shell administrativo. A aba "Entrar" tem os campos email e senha; a aba "Criar conta" tem nome, email, senha e confirmação de senha. Email inválido, nome sem sobrenome, senha fora da política de senha forte e confirmação diferente da senha MUST ser barrados no cliente antes de chamar a API. Erros retornados pela API MUST ser exibidos no formulário. Durante o envio o formulário MUST indicar carregamento sem spinner nem animação.

#### Scenario: Validação no cliente
- **WHEN** o usuário submete a aba "Entrar" com `email: "x@"` ou senha `"123"`, ou a aba "Criar conta" com confirmação diferente da senha
- **THEN** as mensagens de validação aparecem nos campos e nenhuma chamada à API é feita

#### Scenario: Credenciais inválidas
- **WHEN** o usuário submete email e senha que a API rejeita com `401`
- **THEN** o formulário exibe a mensagem de credenciais inválidas e permanece em `/admin/login`

### Requirement: Somente administradores entram
Após um login bem-sucedido, se o usuário retornado tiver `admin = false`, o sistema MUST exibir a mensagem "Acesso restrito a administradores" e permanecer em `/admin/login`, mantendo a sessão guardada (ela continua válida na loja). Se tiver `admin = true`, MUST guardar a sessão, exibir uma confirmação e navegar para `/admin`.

#### Scenario: Usuário comum tenta entrar
- **WHEN** um usuário com `admin = false` faz login em `/admin/login`
- **THEN** vê "Acesso restrito a administradores", continua em `/admin/login` e a sessão fica guardada, sem acesso à área administrativa

#### Scenario: Administrador entra
- **WHEN** um usuário com `admin = true` faz login em `/admin/login`
- **THEN** é levado para `/admin` com a sessão guardada

### Requirement: Registro pela área administrativa
A aba "Criar conta" de `/admin/login` SHALL registrar um usuário comum pela mesma API de registro (`admin = false`). Após o registro o sistema MUST autenticar o usuário recém-criado e, como ele não é administrador, MUST manter a sessão, exibir a mensagem "Conta criada, mas o acesso à área administrativa é restrito a administradores" e permanecer em `/admin/login`. Email já cadastrado MUST exibir "Este email já está cadastrado" no formulário.

#### Scenario: Conta criada pelo /admin
- **WHEN** um visitante cria uma conta válida na aba "Criar conta" de `/admin/login`
- **THEN** o usuário passa a existir com `admin = false`, a mensagem de acesso restrito é exibida, a sessão fica guardada (sem acesso à área administrativa) e a tela permanece em `/admin/login`

#### Scenario: Email repetido pelo /admin
- **WHEN** um visitante tenta criar conta com um email já cadastrado
- **THEN** o formulário exibe "Este email já está cadastrado" e nenhuma sessão é criada

### Requirement: Proteção da área administrativa
Toda rota sob `/admin`, exceto `/admin/login`, SHALL exigir sessão de administrador. Sem sessão o sistema MUST redirecionar para `/admin/login`. Com sessão de usuário não administrador o sistema MUST exibir "Acesso restrito a administradores" e redirecionar para `/admin/login` sem descartar a sessão, que continua válida na loja. Com sessão de administrador, inclusive uma criada pela loja (`/entrar` ou `/checkout`), o sistema MUST renderizar a rota normalmente. Enquanto decide, o sistema MUST NOT renderizar o conteúdo protegido nem uma tela de carregamento animada.

#### Scenario: Sem sessão
- **WHEN** um visitante sem sessão acessa `/admin/orders`
- **THEN** é redirecionado para `/admin/login` sem ver o conteúdo

#### Scenario: Sessão de não administrador
- **WHEN** existe uma sessão guardada de um usuário com `admin = false` e ele acessa `/admin`
- **THEN** vê "Acesso restrito a administradores", é redirecionado para `/admin/login` e a sessão continua guardada (a loja segue mostrando "olá, <primeiro nome>")

#### Scenario: Administrador logado pela loja
- **WHEN** um administrador que entrou pela loja em `/entrar` acessa `/admin`
- **THEN** vê o dashboard administrativo sem passar por `/admin/login`

### Requirement: Sessão persistida no navegador
A sessão (token e dados do usuário) SHALL ser guardada em um cookie do navegador por 7 dias e lida de forma síncrona na inicialização, de modo que recarregar uma rota administrativa com sessão válida MUST manter o usuário na mesma rota, sem passar por `/admin/login`. A ação "Sair" MUST apagar a sessão e levar para `/admin/login`.

#### Scenario: Reload com sessão
- **WHEN** um administrador autenticado recarrega `/admin/catalog`
- **THEN** continua em `/admin/catalog` e nunca é redirecionado para o login

#### Scenario: Sair
- **WHEN** o administrador escolhe "Sair" no menu do usuário
- **THEN** a sessão é apagada, ele vai para `/admin/login` e um novo acesso a `/admin` volta a redirecionar para o login

### Requirement: Dashboard administrativo inicial
A rota `/admin` SHALL exibir um dashboard com a saudação ao usuário logado pelo nome, quatro indicadores (pedidos hoje, faturamento do dia, ticket médio, produtos ativos) e um ranking de produtos mais vendidos, todos com dados locais de exemplo, sem chamadas à API, com valores monetários em fonte mono no formato `R$ 12,90`.

#### Scenario: Dashboard aberto
- **WHEN** o administrador "Ana Souza" acessa `/admin`
- **THEN** vê a saudação com "Ana", os quatro indicadores e o ranking, sem nenhuma requisição à API

### Requirement: Navegação e menu do usuário
O rail lateral SHALL listar Visão geral (`/admin`), Catálogo, Pedidos, Clientes e Lojas, sem o item "Autenticação". O item Visão geral MUST ser marcado como ativo apenas em `/admin` exato. O menu do usuário no cabeçalho MUST exibir nome, email e avatar (quando houver) do usuário logado e a ação "Sair", sem item de perfil.

#### Scenario: Item ativo do dashboard
- **WHEN** o administrador está em `/admin/catalog`
- **THEN** o item ativo é Catálogo e Visão geral não está marcado

#### Scenario: Menu do usuário
- **WHEN** o administrador "Ana Souza" (ana@exemplo.com) abre o menu do usuário
- **THEN** vê "Ana Souza", "ana@exemplo.com" e a ação "Sair", sem "Perfil"

### Requirement: Vitrine permanece pública
As rotas da loja (`/`, `/p/<identificador>` e `/entrar`) MUST continuar acessíveis sem sessão e MUST NOT redirecionar para nenhuma tela de login. O acesso do cliente (entrar ou criar conta) é opcional e fica disponível pelo controle "entrar" do cabeçalho da loja, definido em `auth/storefront-access`; a área administrativa MUST NOT ser oferecida a partir da vitrine.

#### Scenario: Vitrine sem login
- **WHEN** um visitante sem sessão acessa `/`
- **THEN** a vitrine é exibida normalmente, sem redirecionamento, com o controle "entrar" no cabeçalho e sem link para `/admin`

### Requirement: Submenu do módulo ativo agrupado em seções
Quando o módulo ativo da sidebar administrativa tiver mais de um sub-item no total, somando todas as suas seções, o sistema SHALL exibir os sub-itens logo abaixo do item principal ativo, agrupados por seção e na ordem definida para o módulo. Uma seção com rótulo MUST exibir o rótulo como cabeçalho não clicável acima dos seus sub-itens. Uma seção sem rótulo MUST exibir só os sub-itens. Uma seção sem sub-itens MUST ser omitida, inclusive o seu rótulo. Quando o módulo ativo tiver um ou nenhum sub-item, o sistema MUST NOT exibir sub-itens nem rótulos de seção. Os itens principais, os contadores e a marcação de item ativo MUST continuar como antes.

#### Scenario: Seções com e sem rótulo
- **WHEN** o módulo ativo tem uma seção sem rótulo com "Visão geral" e uma seção "Cadastros" com "Marcas", e o administrador está em uma rota desse módulo
- **THEN** a sidebar mostra, sob o item principal ativo, "Visão geral", depois o cabeçalho "Cadastros" e, abaixo dele, "Marcas"

#### Scenario: Seção vazia omitida
- **WHEN** o módulo ativo tem duas seções com itens e uma terceira seção rotulada sem itens
- **THEN** a sidebar mostra só as duas seções com itens, e o rótulo da seção vazia não aparece

#### Scenario: Um único sub-item
- **WHEN** o módulo ativo tem apenas um sub-item no total
- **THEN** a sidebar mostra só os itens principais, sem sub-itens nem rótulos de seção

### Requirement: Seções do módulo Catálogo
O módulo "Produtos & estoque" (`/admin/catalog`) SHALL ter duas seções, nesta ordem: uma seção sem rótulo com o sub-item "Visão geral" (`/admin/catalog`), marcado como ativo só na rota `/admin/catalog` exata; e a seção "Cadastros", sem sub-itens nesta entrega, onde os cadastros do catálogo passam a ser listados. Enquanto "Visão geral" for o único sub-item, o menu do Catálogo MUST ficar igual ao anterior, sem sub-itens nem o rótulo "Cadastros". Os demais módulos MUST continuar sem sub-itens.

#### Scenario: Catálogo sem cadastros
- **WHEN** o administrador `usuario@formacao.dev` acessa `/admin/catalog`
- **THEN** o item "Produtos & estoque" fica ativo, sem sub-itens e sem o rótulo "Cadastros", como antes desta entrega

#### Scenario: Catálogo com um cadastro
- **WHEN** a seção "Cadastros" tem um sub-item com prefixo `/admin/catalog/<cadastro>` e o administrador acessa `/admin/catalog`
- **THEN** sob "Produtos & estoque" aparecem "Visão geral" ativo, o rótulo "Cadastros" e o sub-item do cadastro, não ativo

#### Scenario: Visão geral só na rota exata
- **WHEN** a seção "Cadastros" tem um sub-item com prefixo `/admin/catalog/<cadastro>` e o administrador acessa uma rota sob esse prefixo
- **THEN** o sub-item do cadastro fica ativo e "Visão geral" não fica marcado

#### Scenario: Demais módulos inalterados
- **WHEN** o administrador acessa `/admin`, `/admin/orders`, `/admin/couriers`, `/admin/customers` ou `/admin/stores`
- **THEN** a sidebar mostra só os itens principais, com o item do módulo marcado como ativo, como antes desta entrega
