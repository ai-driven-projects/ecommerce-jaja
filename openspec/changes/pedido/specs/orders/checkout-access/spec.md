## MODIFIED Requirements

### Requirement: Estado autenticado do checkout
Com sessão, `/checkout` SHALL exibir:
- o título "Finalizar pedido";
- o link "← Voltar para a loja", que leva a `/` preservando os parâmetros `bairro` e `categoria` da URL atual;
- o passo 1 "Endereço de entrega", com os dados de entrega do cliente;
- o passo 2 "Pagamento", simulado: o badge "Simulado" e o texto "Não pedimos nenhum dado de pagamento: nesta versão ele é simulado e aprovado automaticamente depois que você confirma o pedido.";
- o "Resumo do pedido", com o botão "Confirmar pedido".

O passo "Pagamento" MUST NOT oferecer seletor de forma de pagamento nem campos de cartão. Nenhum dado de pagamento é pedido ao cliente.

Um cliente que já tem sessão ao abrir `/checkout` MUST ver esse estado diretamente, sem o formulário de entrar ou criar conta e sem redirecionamento. Um reload MUST manter o estado autenticado.

#### Scenario: Cliente com sessão abre o checkout
- **WHEN** a cliente "Ana Souza" (ana@exemplo.com) com sessão acessa `/checkout?bairro=Meireles&categoria=papelaria`
- **THEN** vê "Finalizar pedido", os passos "Endereço de entrega" e "Pagamento", o "Resumo do pedido" e o link "← Voltar para a loja" apontando para `/?bairro=Meireles&categoria=papelaria`

#### Scenario: Pagamento simulado
- **WHEN** a cliente autenticada olha o passo "Pagamento" em `/checkout`
- **THEN** vê o badge "Simulado" e o texto sobre pagamento simulado e aprovado automaticamente, sem opções de Pix, cartão ou faturamento e sem campos de cartão

#### Scenario: Reload mantém a sessão
- **WHEN** a cliente autenticada recarrega `/checkout`
- **THEN** continua vendo o estado autenticado, sem passar pelo formulário de entrar ou criar conta

### Requirement: Resumo do pedido com o carrinho da conta
Com sessão, o "Resumo do pedido" de `/checkout` SHALL exibir o carrinho da conta do usuário autenticado, recarregado ao abrir a página:
- cada linha MUST mostrar a foto do produto (ou a ilustração da categoria), o nome, "× <quantidade>" e o total da linha;
- uma linha indisponível MUST mostrar "Indisponível" e a ação "Remover";
- o subtotal, a entrega e o total MUST ser os calculados pela API.

Enquanto o carrinho é carregado, inclusive durante a mescla do carrinho do visitante logo depois de entrar ou criar conta na própria página, o resumo MUST exibir uma estrutura de carregamento.

"Confirmar pedido" MUST ficar desabilitado enquanto o carrinho carrega ou tem uma mudança não confirmada, quando o carrinho está vazio e quando tem itens indisponíveis, sem afastar as demais condições para confirmar. Com itens indisponíveis, o texto "Remova os itens indisponíveis para confirmar o pedido." MUST aparecer abaixo do botão.

"Confirmar pedido" MUST criar o pedido na API conforme `orders/order-placement`:
- a requisição envia "Quem recebe" (até 100 caracteres) e "Instruções para o entregador" (até 200 caracteres);
- enquanto aguarda, o botão MUST exibir "Confirmando…" e MUST NOT permitir um segundo envio.

Em caso de sucesso, a página MUST:
- recarregar o carrinho da conta, já esvaziado pelo servidor;
- exibir o toaster "Pedido #<número> recebido", com a descrição "Pagamento simulado em andamento.", em que o número são os 8 primeiros caracteres do id em maiúsculas;
- levar ao acompanhamento do pedido criado.

Em caso de erro, a página MUST:
- exibir a mensagem do código em um toaster;
- recarregar o resumo do carrinho e, quando o erro for do cadastro de cliente, os dados de entrega;
- continuar em `/checkout`.

A página MUST NOT esvaziar o carrinho por conta própria.

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
- **WHEN** o cliente preenche "Instruções para o entregador" e confirma o pedido com todas as condições atendidas
- **THEN** o botão mostra "Confirmando…", o pedido é criado na API (que esvazia o carrinho da conta), o toaster "Pedido #<número> recebido" aparece com "Pagamento simulado em andamento.", o cliente é levado a `/pedidos/<id do pedido criado>/acompanhar` e, ao voltar para a loja, o contador do carrinho mostra 0

#### Scenario: Produto desativado antes de confirmar
- **WHEN** com o `/checkout` aberto e o resumo carregado, um administrador desativa um produto do carrinho e o cliente clica em "Confirmar pedido"
- **THEN** o toaster exibe "Remova os itens indisponíveis para confirmar o pedido.", o resumo recarrega com a linha "Indisponível", a página continua em `/checkout` e nenhum pedido é criado

### Requirement: Confirmar pedido exige cadastro de cliente
O botão "Confirmar pedido" SHALL ficar desabilitado enquanto o usuário autenticado não tiver cadastro de cliente salvo ou enquanto o formulário de dados de entrega estiver aberto. Nesses casos, o texto "Preencha os dados de entrega para confirmar o pedido." MUST aparecer abaixo do botão. As demais condições para confirmar (sacola com itens e bairro da vitrine atendido) MUST continuar valendo.

A API também exige cadastro de cliente **ativo** (`orders/order-placement`). Ao confirmar, a página MUST tratar a resposta assim:
- cadastro inativo: exibir "Seu cadastro está inativo. Fale com o atendimento." e continuar em `/checkout`;
- cadastro inexistente: exibir "Preencha os dados de entrega para confirmar o pedido." e recarregar os dados de entrega.

#### Scenario: Sem cadastro de cliente
- **WHEN** um usuário sem cadastro de cliente, com itens na sacola e bairro atendido, está em `/checkout`
- **THEN** "Confirmar pedido" está desabilitado e o texto "Preencha os dados de entrega para confirmar o pedido." é exibido

#### Scenario: Com cadastro de cliente
- **WHEN** um usuário com cadastro de cliente salvo, com itens na sacola e bairro atendido, está em `/checkout` com o resumo dos dados de entrega exibido
- **THEN** "Confirmar pedido" está habilitado e o texto de dados de entrega pendentes não aparece

#### Scenario: Alteração em andamento
- **WHEN** o cliente com cadastro clica em "Alterar" nos dados de entrega
- **THEN** "Confirmar pedido" fica desabilitado até ele salvar ou cancelar a alteração

#### Scenario: Cadastro inativo
- **WHEN** o cadastro de cliente foi desativado pelo administrador e o cliente confirma o pedido em `/checkout`
- **THEN** o toaster exibe "Seu cadastro está inativo. Fale com o atendimento.", a página continua em `/checkout` e nenhum pedido é criado
