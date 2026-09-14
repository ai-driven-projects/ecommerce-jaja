# Acesso ao Checkout (Checkout Access) Specification

## Purpose

Define como a rota pública `/checkout` da loja identifica o cliente e prepara o fechamento do pedido: o que exibe sem sessão e com sessão, a permanência na rota após entrar ou criar conta, o retorno à vitrine com bairro e categoria preservados, o passo de dados de entrega, que usa e salva o cadastro de cliente do usuário, e o resumo do pedido montado a partir do carrinho da conta. O pagamento e a criação do pedido em si não fazem parte desta capacidade.

## Requirements

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
Com sessão, `/checkout` SHALL exibir:
- o título "Finalizar pedido";
- o link "← Voltar para a loja", que leva a `/` preservando os parâmetros `bairro` e `categoria` da URL atual;
- o passo 1 "Endereço de entrega", com os dados de entrega do cliente;
- o passo 2 "Pagamento";
- o "Resumo do pedido", com o botão "Confirmar pedido".

Um cliente que já tem sessão ao abrir `/checkout` MUST ver esse estado diretamente, sem o formulário de entrar ou criar conta e sem redirecionamento. Um reload MUST manter o estado autenticado.

#### Scenario: Cliente com sessão abre o checkout
- **WHEN** a cliente "Ana Souza" (ana@exemplo.com) com sessão acessa `/checkout?bairro=Meireles&categoria=papelaria`
- **THEN** vê "Finalizar pedido", os passos "Endereço de entrega" e "Pagamento", o "Resumo do pedido" e o link "← Voltar para a loja" apontando para `/?bairro=Meireles&categoria=papelaria`

#### Scenario: Reload mantém a sessão
- **WHEN** a cliente autenticada recarrega `/checkout`
- **THEN** continua vendo o estado autenticado, sem passar pelo formulário de entrar ou criar conta

### Requirement: Sair pelo cabeçalho devolve o checkout ao formulário
A ação "sair" SHALL ficar no menu da conta do cabeçalho da loja; o cabeçalho compacto de `/checkout` MUST NOT oferecê-la. Depois de sair, `/checkout` MUST exibir o título "Para fechar o pedido, entre ou crie sua conta." e o formulário, sem redirecionar, e MUST NOT exibir dados de entrega nem o resumo da conta anterior.

#### Scenario: Sair e voltar ao checkout
- **WHEN** a cliente autenticada usa "Sair" no menu da conta do cabeçalho da loja e abre `/checkout?bairro=Aldeota&categoria=todas`
- **THEN** "Até já já." é exibido e `/checkout` mostra o formulário com as abas "Entrar" e "Criar conta", sem os dados de entrega da conta anterior

#### Scenario: Cabeçalho compacto do checkout
- **WHEN** a cliente autenticada está em `/checkout`
- **THEN** o cabeçalho mostra o logo e "Checkout seguro", sem a ação "sair"

### Requirement: Resumo do pedido com o carrinho da conta
Com sessão, o "Resumo do pedido" de `/checkout` SHALL exibir o carrinho da conta do usuário autenticado, recarregado ao abrir a página:
- cada linha MUST mostrar a foto do produto (ou a ilustração da categoria), o nome, "× <quantidade>" e o total da linha;
- uma linha indisponível MUST mostrar "Indisponível" e a ação "Remover";
- o subtotal, a entrega e o total MUST ser os calculados pela API.

Enquanto o carrinho é carregado, inclusive durante a mescla do carrinho do visitante logo depois de entrar ou criar conta na própria página, o resumo MUST exibir uma estrutura de carregamento.

"Confirmar pedido" MUST ficar desabilitado enquanto o carrinho carrega ou tem uma mudança não confirmada, quando o carrinho está vazio e quando tem itens indisponíveis, sem afastar as demais condições para confirmar. Com itens indisponíveis, o texto "Remova os itens indisponíveis para confirmar o pedido." MUST aparecer abaixo do botão.

A confirmação continua simulada, mas MUST esvaziar o carrinho da conta antes de levar ao acompanhamento do pedido. Se esvaziar o carrinho falhar, a página MUST exibir a mensagem de erro e continuar em `/checkout`.

#### Scenario: Carrinho do visitante após criar conta
- **WHEN** um visitante com dois produtos no carrinho cria conta em `/checkout`
- **THEN** o resumo exibe a estrutura de carregamento e, em seguida, os dois produtos com foto, quantidade, total da linha e os totais da API

#### Scenario: Item indisponível bloqueia a confirmação
- **WHEN** o carrinho da conta tem um produto que foi desativado no admin e o cliente abre `/checkout`
- **THEN** a linha mostra "Indisponível", "Confirmar pedido" fica desabilitado e o texto "Remova os itens indisponíveis para confirmar o pedido." aparece

#### Scenario: Remover o item indisponível
- **WHEN** nesse resumo o cliente clica em "Remover" na linha indisponível
- **THEN** a linha some, os totais são atualizados e o texto sobre itens indisponíveis deixa de aparecer

#### Scenario: Confirmar esvazia o carrinho
- **WHEN** o cliente confirma o pedido com todas as condições atendidas
- **THEN** o carrinho da conta fica vazio, o cliente é levado ao acompanhamento do pedido e, ao voltar para a loja, o contador do carrinho mostra 0

### Requirement: Dados de entrega do cliente no checkout
No passo "Endereço de entrega", com sessão, o checkout SHALL usar o cadastro de cliente do usuário autenticado. Enquanto o cadastro é consultado, o passo MUST exibir uma estrutura de carregamento, sem mostrar o formulário nem o resumo.

**Sem cadastro de cliente**, o passo MUST exibir:
- o texto "Precisamos destes dados uma vez só: ficam salvos para os próximos pedidos.";
- o formulário com CPF, telefone, CEP, logradouro, número, complemento, bairro, cidade e UF, pré-preenchido com o bairro do parâmetro `bairro`, a cidade "Fortaleza" e a UF "CE";
- o botão "Salvar dados de entrega".

**Com cadastro**, o passo MUST exibir o resumo com o endereço (logradouro, número, complemento quando houver, bairro, cidade/UF e CEP), o telefone e o botão "Alterar". "Alterar" abre o mesmo formulário com os dados atuais e o botão "Cancelar", que volta ao resumo sem salvar.

Envio do formulário:
- os campos MUST ser validados no navegador com as mesmas regras do cadastro de cliente antes do envio;
- salvar MUST criar ou alterar o cadastro do usuário autenticado, exibir o toaster "Dados de entrega salvos" e mostrar o resumo atualizado, sem sair de `/checkout`;
- erros da API MUST aparecer no campo correspondente (CPF, telefone, CEP ou UF), e os demais em um toaster.

O aviso de cobertura continua baseado no bairro da vitrine. Abaixo dos dados de entrega, os campos "Quem recebe" (pré-preenchido com o nome do usuário) e "Instruções para o entregador" MUST continuar disponíveis e MUST NOT ser salvos no cadastro de cliente. Ao sair e entrar com outra conta, o passo MUST refletir o cadastro dessa outra conta.

#### Scenario: Primeiro pedido sem cadastro de cliente
- **WHEN** a visitante "Ana Souza" cria conta em `/checkout?bairro=Aldeota&categoria=todas`
- **THEN** o passo "Endereço de entrega" mostra o formulário com bairro "Aldeota", cidade "Fortaleza" e UF "CE" já preenchidos, e o botão "Salvar dados de entrega"

#### Scenario: Salvar os dados de entrega
- **WHEN** a cliente sem cadastro preenche CPF, telefone e endereço válidos e clica em "Salvar dados de entrega"
- **THEN** vê o toaster "Dados de entrega salvos", o passo passa a mostrar o resumo com o endereço e o telefone salvos e a URL continua a mesma

#### Scenario: Cadastro existente
- **WHEN** um usuário que já tem cadastro de cliente abre `/checkout` ou recarrega a página depois de salvar
- **THEN** o passo mostra direto o resumo com os dados salvos, sem o formulário

#### Scenario: Alterar e cancelar
- **WHEN** o cliente clica em "Alterar", muda o número do endereço e clica em "Cancelar"
- **THEN** o resumo volta a ser exibido com o número anterior e nada é salvo

#### Scenario: CPF já cadastrado
- **WHEN** a cliente tenta salvar os dados de entrega com o CPF de outro cliente
- **THEN** a mensagem "Este CPF já está cadastrado." aparece no campo CPF e o formulário continua aberto

#### Scenario: Validação no navegador
- **WHEN** a cliente tenta salvar com CEP "6015-160" ou CPF com dígito verificador errado
- **THEN** as mensagens de validação aparecem nos campos e nenhuma chamada à API é feita

#### Scenario: Troca de conta
- **WHEN** um cliente com cadastro sai pelo menu da conta do cabeçalho da loja, volta a `/checkout` e entra com uma conta sem cadastro de cliente
- **THEN** o passo mostra o formulário de dados de entrega, e não o resumo da conta anterior

### Requirement: Confirmar pedido exige cadastro de cliente
O botão "Confirmar pedido" SHALL ficar desabilitado enquanto o usuário autenticado não tiver cadastro de cliente salvo ou enquanto o formulário de dados de entrega estiver aberto. Nesses casos, o texto "Preencha os dados de entrega para confirmar o pedido." MUST aparecer abaixo do botão. As demais condições para confirmar (sacola com itens e bairro da vitrine atendido) MUST continuar valendo.

#### Scenario: Sem cadastro de cliente
- **WHEN** um usuário sem cadastro de cliente, com itens na sacola e bairro atendido, está em `/checkout`
- **THEN** "Confirmar pedido" está desabilitado e o texto "Preencha os dados de entrega para confirmar o pedido." é exibido

#### Scenario: Com cadastro de cliente
- **WHEN** um usuário com cadastro de cliente salvo, com itens na sacola e bairro atendido, está em `/checkout` com o resumo dos dados de entrega exibido
- **THEN** "Confirmar pedido" está habilitado e o texto de dados de entrega pendentes não aparece

#### Scenario: Alteração em andamento
- **WHEN** o cliente com cadastro clica em "Alterar" nos dados de entrega
- **THEN** "Confirmar pedido" fica desabilitado até ele salvar ou cancelar a alteração
