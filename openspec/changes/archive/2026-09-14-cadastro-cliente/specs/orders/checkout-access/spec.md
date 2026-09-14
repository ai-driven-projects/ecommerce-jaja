## MODIFIED Requirements

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

## ADDED Requirements

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
- **WHEN** um cliente com cadastro sai pelo cabeçalho em `/checkout` e entra com uma conta sem cadastro de cliente
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
