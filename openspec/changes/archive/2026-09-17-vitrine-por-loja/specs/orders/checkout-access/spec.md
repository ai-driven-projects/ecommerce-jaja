## MODIFIED Requirements

### Requirement: Estado autenticado do checkout
Com sessão, `/checkout` SHALL exibir:
- o título "Finalizar pedido";
- o link "← Voltar para a loja", que leva a `/` preservando os parâmetros `loja` e `categoria` da URL atual;
- o passo 1 "Endereço de entrega", com os dados de entrega do cliente;
- o passo 2 "Pagamento", simulado: o badge "Simulado" e o texto "Não pedimos nenhum dado de pagamento: nesta versão ele é simulado e aprovado automaticamente depois que você confirma o pedido.";
- o "Resumo do pedido", com o botão "Confirmar pedido".

O passo "Pagamento" MUST NOT oferecer seletor de forma de pagamento nem campos de cartão. Nenhum dado de pagamento é pedido ao cliente.

Um cliente que já tem sessão ao abrir `/checkout` MUST ver esse estado diretamente, sem o formulário de entrar ou criar conta e sem redirecionamento. Um reload MUST manter o estado autenticado.

#### Scenario: Cliente com sessão abre o checkout
- **WHEN** a cliente "Ana Souza" (ana@exemplo.com) com sessão acessa `/checkout?loja=loja-rio-branco&categoria=papelaria`
- **THEN** vê "Finalizar pedido", os passos "Endereço de entrega" e "Pagamento", o "Resumo do pedido" e o link "← Voltar para a loja" apontando para `/?loja=loja-rio-branco&categoria=papelaria`

#### Scenario: Pagamento simulado
- **WHEN** a cliente autenticada olha o passo "Pagamento" em `/checkout`
- **THEN** vê o badge "Simulado" e o texto sobre pagamento simulado e aprovado automaticamente, sem opções de Pix, cartão ou faturamento e sem campos de cartão

#### Scenario: Reload mantém a sessão
- **WHEN** a cliente autenticada recarrega `/checkout`
- **THEN** continua vendo o estado autenticado, sem passar pelo formulário de entrar ou criar conta

### Requirement: Dados de entrega do cliente no checkout
No passo "Endereço de entrega", com sessão, o checkout SHALL usar o cadastro de cliente do usuário autenticado. Enquanto o cadastro é consultado, o passo MUST exibir uma estrutura de carregamento, sem mostrar o formulário nem o resumo.

**Sem cadastro de cliente**, o passo MUST exibir:
- o texto "Precisamos destes dados uma vez só: ficam salvos para os próximos pedidos.";
- o formulário com CPF, telefone, CEP, logradouro, número, complemento, bairro, cidade e UF, com a cidade e a UF pré-preenchidas com as da loja escolhida na vitrine, quando conhecidas, e os demais campos vazios;
- o botão "Salvar dados de entrega".

**Com cadastro**, o passo MUST exibir o resumo com o endereço (logradouro, número, complemento quando houver, bairro, cidade/UF e CEP), o telefone e o botão "Alterar". "Alterar" abre o mesmo formulário com os dados atuais e o botão "Cancelar", que volta ao resumo sem salvar.

Envio do formulário:
- os campos MUST ser validados no navegador com as mesmas regras do cadastro de cliente antes do envio;
- salvar MUST criar ou alterar o cadastro do usuário autenticado, exibir o toaster "Dados de entrega salvos" e mostrar o resumo atualizado, sem sair de `/checkout`;
- erros da API MUST aparecer no campo correspondente (CPF, telefone, CEP ou UF), e os demais em um toaster.

O checkout MUST NOT exibir aviso de cobertura: não há verificação de área de entrega nesta entrega, nem por bairro nem por raio. O passo MUST NOT apagar nem alterar o ponto do endereço do cliente (`customers/customer-registration`). Abaixo dos dados de entrega, os campos "Quem recebe" (pré-preenchido com o nome do usuário) e "Instruções para o entregador" MUST continuar disponíveis e MUST NOT ser salvos no cadastro de cliente. Ao sair e entrar com outra conta, o passo MUST refletir o cadastro dessa outra conta.

#### Scenario: Primeiro pedido sem cadastro de cliente
- **WHEN** a visitante "Ana Souza" cria conta em `/checkout?loja=loja-paulista&categoria=todas`
- **THEN** o passo "Endereço de entrega" mostra o formulário com cidade "São Paulo" e UF "SP" já preenchidas, bairro vazio, e o botão "Salvar dados de entrega"

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
