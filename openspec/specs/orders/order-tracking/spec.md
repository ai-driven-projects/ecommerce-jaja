# Acompanhamento do Pedido (Order Tracking) Specification

## Purpose

Define a página `/pedidos/:id/acompanhar` da loja, que mostra ao cliente autenticado o pedido real que ele fez. Cobre o carregamento, a exigência de sessão, o pedido não encontrado, o cabeçalho, os passos do pedido atualizados ao vivo, os itens, os totais e as instruções para o entregador.

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
- o badge com o nome do status atual: "Pedido recebido", "Pagamento aprovado", "Separando na loja", "A caminho" ou "Entregue";
- o indicador de atualização ao vivo, conforme "Atualização ao vivo";
- "Feito hoje às HH:MM" quando o pedido é do dia atual, ou "Feito em DD/MM/AAAA às HH:MM" nos outros dias, no fuso do navegador;
- o endereço de entrega copiado no pedido (logradouro, número, complemento quando houver, bairro e cidade/UF) e o nome de quem recebe.

A aba do navegador MUST ter o título "Pedido #<número> — já já".

#### Scenario: Pedido recém-confirmado
- **WHEN** a cliente abre o acompanhamento do pedido que acabou de confirmar
- **THEN** vê "Pedido #<8 primeiros caracteres do id em maiúsculas>", o badge "Pedido recebido", "Feito hoje às <hora da confirmação>", o endereço de entrega e quem recebe, e a aba tem o título "Pedido #<número> — já já"

#### Scenario: Badge acompanha o status
- **WHEN** a cliente está com o acompanhamento aberto e o pedido passa a `OUT_FOR_DELIVERY`
- **THEN** o badge passa a "A caminho" sem recarregar a página

#### Scenario: Endereço copiado no pedido
- **WHEN** depois de confirmar o pedido a cliente altera o endereço do cadastro e abre o acompanhamento
- **THEN** o cabeçalho mostra o endereço da confirmação, e não o novo

### Requirement: Passos do pedido
A página SHALL exibir os passos "Pedido recebido", "Pagamento aprovado", "Separando na loja", "A caminho" e "Entregue", nessa ordem, cada um correspondendo a um status de `orders/order-lifecycle`. Conforme o status atual:
- os passos até o status atual MUST aparecer concluídos, cada um com a hora com segundos (`HH:MM:SS`, no fuso do navegador) da data do passo, para que a demora de cada serviço simulado fique visível;
- enquanto o pedido não estiver `DELIVERED`, o passo seguinte ao status atual MUST aparecer destacado como em andamento, com o texto "Em andamento…";
- os demais passos MUST aparecer pendentes, com o texto "Aguardando".

Com o pedido `DELIVERED`, todos os passos MUST aparecer concluídos, e a página MUST exibir "Pedido entregue às HH:MM. Obrigado por comprar no já já!". A lista de passos MUST anunciar as mudanças a leitores de tela sem mover o foco, e animações MUST respeitar `prefers-reduced-motion`.

#### Scenario: Pedido recebido
- **WHEN** a cliente abre o acompanhamento de um pedido com status `PLACED`
- **THEN** "Pedido recebido" aparece concluído com a hora do pedido, "Pagamento aprovado" aparece em andamento com "Em andamento…", e "Separando na loja", "A caminho" e "Entregue" aparecem pendentes com "Aguardando"

#### Scenario: Pedido separando
- **WHEN** a cliente abre o acompanhamento de um pedido com status `PICKING`
- **THEN** "Pedido recebido", "Pagamento aprovado" e "Separando na loja" aparecem concluídos com as horas dos passos, "A caminho" aparece em andamento e "Entregue" aparece pendente

#### Scenario: Pedido entregue
- **WHEN** a cliente abre o acompanhamento de um pedido `DELIVERED`
- **THEN** os cinco passos aparecem concluídos com as horas em `HH:MM:SS`, e a página mostra "Pedido entregue às <hora da entrega>. Obrigado por comprar no já já!"

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

### Requirement: Atualização ao vivo
Com o pedido carregado e ainda não entregue, a página SHALL abrir o stream `GET /me/orders/:id/stream` enviando o token no cabeçalho `Authorization`. O token MUST NOT aparecer na URL. A página MUST reler o pedido por `GET /me/orders/:id` a cada aviso recebido e a cada reconexão do stream, com no máximo uma leitura em andamento e uma pendente, e MUST atualizar o cabeçalho e os passos sem recarregar.

O indicador do cabeçalho MUST mostrar:
- "Ao vivo", com uma marca verde, enquanto o stream está aberto;
- "Reconectando…" enquanto o stream está sendo aberto ou reaberto;
- nada quando não há stream (pedido entregue ou stream encerrado por `401`/`404`).

Se o stream cair, a página MUST tentar reabri-lo com espera crescente de 1 s até 10 s. Com `401`, `403` ou `404`, a página MUST parar de tentar. A página MUST fechar o stream quando o pedido chega a `DELIVERED`, quando sai da página, quando a sessão muda e quando o id muda.

#### Scenario: Passos avançam sem recarregar
- **WHEN** a cliente confirma um pedido e fica no acompanhamento
- **THEN** a página mostra "Ao vivo" e os passos avançam sozinhos até "Entregue", cada um com a hora, sem recarregar

#### Scenario: Token fora da URL
- **WHEN** a página abre o stream do pedido
- **THEN** a requisição vai para `/me/orders/<id>/stream` sem token na URL e com o cabeçalho `Authorization`

#### Scenario: Backend reinicia no meio
- **WHEN** o backend para durante o ciclo e volta alguns segundos depois
- **THEN** a página mostra "Reconectando…" enquanto o backend está fora e, quando ele volta, mostra "Ao vivo" e o passo atualizado

#### Scenario: Recarregar no meio do ciclo
- **WHEN** a cliente recarrega o acompanhamento de um pedido `PAYMENT_APPROVED`
- **THEN** a página mostra o passo atual e continua avançando ao vivo

#### Scenario: Pedido já entregue
- **WHEN** a cliente abre o acompanhamento de um pedido `DELIVERED`
- **THEN** a página não abre o stream e não mostra o indicador
