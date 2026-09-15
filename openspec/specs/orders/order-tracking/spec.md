# Acompanhamento do Pedido (Order Tracking) Specification

## Purpose

Define a página `/pedidos/:id/acompanhar` da loja, que mostra ao cliente autenticado o pedido real que ele fez. Cobre o carregamento, a exigência de sessão, o pedido não encontrado, o cabeçalho, os passos do pedido, os itens, os totais e as instruções para o entregador.

## Requirements

### Requirement: Acompanhamento exige sessão
A rota `/pedidos/:id/acompanhar` SHALL continuar acessível sem redirecionamento.

Até a sessão ser conhecida no navegador, e durante a primeira carga do pedido, a página MUST exibir uma estrutura estática de carregamento, sem dados de pedido.

Sem sessão, a página MUST:
- exibir "Entre para acompanhar seu pedido." com o link "Entrar", que leva a `/entrar` com o parâmetro `voltar` igual à rota atual;
- MUST NOT consultar a API.

Com sessão, a página MUST consultar o pedido do usuário. Um erro diferente de "pedido não encontrado" MUST aparecer em um toaster.

#### Scenario: Visitante sem sessão
- **WHEN** um visitante sem sessão abre `/pedidos/<id>/acompanhar`
- **THEN** vê "Entre para acompanhar seu pedido." e o link "Entrar", apontando para `/entrar` com `voltar` igual a `/pedidos/<id>/acompanhar`, e nenhuma chamada à API de pedidos é feita

#### Scenario: Entrar pelo acompanhamento
- **WHEN** a dona do pedido clica em "Entrar" nessa página e entra com a conta dela
- **THEN** volta a `/pedidos/<id>/acompanhar` e vê o pedido

#### Scenario: Recarregar mantém o pedido
- **WHEN** a cliente autenticada recarrega o acompanhamento de um pedido dela
- **THEN** vê primeiro a estrutura de carregamento e depois o mesmo pedido

### Requirement: Pedido não encontrado
Quando a API responde que o pedido não foi encontrado, a página SHALL exibir "Pedido não encontrado." com o link "Voltar para a loja", sem dados de nenhum pedido. Isso vale inclusive para pedido de outro usuário e id malformado.

#### Scenario: Pedido de outra conta
- **WHEN** um usuário autenticado abre o acompanhamento de um pedido feito por outra conta
- **THEN** vê "Pedido não encontrado." e o link "Voltar para a loja"

#### Scenario: Número de exemplo antigo
- **WHEN** um usuário autenticado abre `/pedidos/4211/acompanhar`
- **THEN** vê "Pedido não encontrado."

### Requirement: Cabeçalho do pedido
Com o pedido carregado, a página SHALL exibir:
- o título "Pedido #<número>", em que o número são os 8 primeiros caracteres do id em maiúsculas (por exemplo, `3F1C9A52`);
- o badge "Pedido recebido";
- "Feito hoje às HH:MM" quando o pedido é do dia atual, ou "Feito em DD/MM/AAAA às HH:MM" nos outros dias, no fuso do navegador;
- o endereço de entrega copiado no pedido (logradouro, número, complemento quando houver, bairro e cidade/UF) e o nome de quem recebe.

A aba do navegador MUST ter o título "Pedido #<número> — já já".

#### Scenario: Pedido recém-confirmado
- **WHEN** a cliente abre o acompanhamento do pedido que acabou de confirmar
- **THEN** vê "Pedido #<8 primeiros caracteres do id em maiúsculas>", o badge "Pedido recebido", "Feito hoje às <hora da confirmação>", o endereço de entrega e quem recebe, e a aba tem o título "Pedido #<número> — já já"

#### Scenario: Endereço copiado no pedido
- **WHEN** depois de confirmar o pedido a cliente altera o endereço do cadastro e abre o acompanhamento
- **THEN** o cabeçalho mostra o endereço da confirmação, e não o novo

### Requirement: Passos do pedido
A página SHALL exibir os passos "Pedido recebido", "Pagamento aprovado", "Separando na loja", "A caminho" e "Entregue", nessa ordem.

Com o status `PLACED`:
- só "Pedido recebido" MUST aparecer concluído, com a hora do pedido;
- os demais passos MUST aparecer pendentes, com o texto "Aguardando".

#### Scenario: Pedido recebido
- **WHEN** a cliente abre o acompanhamento de um pedido com status `PLACED`
- **THEN** "Pedido recebido" aparece concluído com a hora do pedido, e "Pagamento aprovado", "Separando na loja", "A caminho" e "Entregue" aparecem pendentes com "Aguardando"

### Requirement: Itens, totais e instruções do pedido
A página SHALL exibir os itens do pedido na ordem gravada. Cada item mostra a miniatura (ou a ilustração de reserva), o nome, "× <quantidade>" e o total da linha.

Abaixo dos itens, a página SHALL exibir:
- o subtotal;
- a entrega, com "Grátis" quando for 0;
- o total, com o rótulo "Pagamento simulado".

Os valores MUST ser os gravados no pedido, e não os preços atuais do catálogo. As instruções para o entregador MUST aparecer quando existirem, e o bloco MUST NOT aparecer quando forem `null`.

#### Scenario: Itens e totais com entrega cobrada
- **WHEN** a cliente abre o acompanhamento de um pedido com dois itens e subtotal abaixo de R$ 79,00
- **THEN** vê os dois itens com nome, quantidade e total da linha, o subtotal, a entrega de R$ 4,90 e o total com "Pagamento simulado"

#### Scenario: Entrega grátis
- **WHEN** a cliente abre o acompanhamento de um pedido com subtotal de pelo menos R$ 79,00
- **THEN** a entrega aparece como "Grátis"

#### Scenario: Pedido sem instruções
- **WHEN** a cliente abre o acompanhamento de um pedido confirmado sem instruções para o entregador
- **THEN** a página não mostra o bloco de instruções

### Requirement: Sem mapa nem entregador nesta entrega
O acompanhamento MUST NOT exibir nenhum destes elementos, que voltam com o fluxo de entrega:
- o mapa ilustrativo;
- o entregador (nome, avaliação e botões de mensagem e ligar);
- a janela ou previsão de chegada;
- uma loja fixa.

Em 375px de largura, a página MUST caber sem rolagem horizontal.

#### Scenario: Sem dados fictícios de entrega
- **WHEN** a cliente abre o acompanhamento de um pedido dela
- **THEN** a página não mostra mapa, entregador, previsão de chegada nem nome de loja

#### Scenario: Acompanhamento no celular
- **WHEN** a cliente abre o acompanhamento em uma tela de 375px de largura
- **THEN** o conteúdo cabe na largura da tela, sem rolagem horizontal
