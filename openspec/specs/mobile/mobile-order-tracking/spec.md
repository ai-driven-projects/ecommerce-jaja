# Acompanhamento do Pedido no App Mobile (Mobile Order Tracking) Specification

## Purpose

Define o acompanhamento do pedido no app mobile Jajá: a rota do pedido na pilha da aba Carrinho, com sessão, que lê o pedido por `GET /me/orders/<id>` e mostra o cabeçalho, a linha do tempo dos status, os itens e totais, o puxar para atualizar, o acompanhamento ao vivo por `GET /me/orders/<id>/stream` (com reconexão, indicador e destaque do passo concluído) e os estados de pedido não encontrado e de falha.

## Requirements

### Requirement: Rota do pedido
O acompanhamento do pedido SHALL ficar em `/cart/orders/<id>`, na pilha da aba Carrinho, com a barra de abas visível e a aba Carrinho selecionada. A rota MUST exigir sessão: sem sessão, ela leva a "Entrar" com a rota em `from` e volta ao pedido depois de entrar. Voltar MUST levar à aba Carrinho. É a rota aberta depois de confirmar o pedido no checkout.

#### Scenario: Depois de confirmar
- **WHEN** o pedido `3f1c9a52-…` acaba de ser criado no checkout e o cliente toca em voltar no acompanhamento
- **THEN** o acompanhamento mostrou "Pedido #3F1C9A52", e a aba Carrinho aparece, sem o checkout

#### Scenario: Sem sessão
- **WHEN** sem sessão, o app abre `/cart/orders/3f1c9a52-7b1e-4c2d-9e8f-0a1b2c3d4e5f`
- **THEN** a tela "Entrar" aparece com `from` apontando para essa rota

### Requirement: Leitura do pedido
Ao abrir, a tela SHALL buscar o pedido por `GET /me/orders/<id>`, com o token da sessão no cabeçalho. Enquanto a primeira resposta não chega, MUST mostrar o skeleton do cabeçalho, dos passos e dos itens. Valores em dinheiro MUST vir em centavos e ser formatados em reais só na exibição, e as datas MUST aparecer no fuso do aparelho. Depois da primeira carga, o pedido MUST ser lido de novo a cada aviso do acompanhamento ao vivo, além de quando o cliente puxa a tela ou toca em "Tentar de novo".

#### Scenario: Primeira carga
- **WHEN** o cliente abre o acompanhamento e a API ainda não respondeu
- **THEN** sai `GET /me/orders/<id>` com o Bearer e a tela mostra o skeleton

#### Scenario: Sessão expirada
- **WHEN** a API responde `401` ao `GET /me/orders/<id>`
- **THEN** a sessão termina e a tela "Entrar" aparece com a rota do pedido em `from`

### Requirement: Cabeçalho do pedido
Com o pedido carregado, a tela SHALL mostrar "Pedido #<número>" (os 8 primeiros caracteres do id em maiúsculas) e o selo do status atual com o rótulo do web. Abaixo, MUST mostrar "Feito hoje às HH:MM" quando o pedido é do dia corrente, senão "Feito em DD/MM/AAAA às HH:MM". Depois vêm o endereço copiado no pedido, em uma linha ("Rua, número · complemento · bairro · cidade/UF", sem o complemento quando ele falta ou está em branco), e "Quem recebe: <nome>".

#### Scenario: Pedido de hoje
- **WHEN** o pedido `3f1c9a52-…`, recebido hoje às 09:03, com status `PLACED`, entrega na Avenida Santos Dumont, 1500, Sala 3, Aldeota, Fortaleza/CE, para Maria Souza
- **THEN** a tela mostra "Pedido #3F1C9A52", o selo "Pedido recebido", "Feito hoje às 09:03", "Avenida Santos Dumont, 1500 · Sala 3 · Aldeota · Fortaleza/CE" e "Quem recebe: Maria Souza"

#### Scenario: Pedido de outro dia, sem complemento
- **WHEN** o pedido foi feito em 14/10/2026 às 18:30, o dia corrente é 15/10/2026 e o endereço não tem complemento
- **THEN** a tela mostra "Feito em 14/10/2026 às 18:30" e o endereço sem o trecho do complemento

### Requirement: Linha do tempo dos status
O cartão "Status do pedido" SHALL listar os cinco passos, nesta ordem e com estes rótulos: "Pedido recebido" (`PLACED`), "Pagamento aprovado" (`PAYMENT_APPROVED`), "Separando na loja" (`PICKING`), "A caminho" (`OUT_FOR_DELIVERY`) e "Entregue" (`DELIVERED`). Os passos até o status atual, inclusive, MUST aparecer concluídos, com a hora do passo em `HH:MM:SS`. O passo seguinte MUST aparecer como atual, com "Em andamento…", enquanto o pedido não foi entregue. Os demais MUST aparecer pendentes, com "Aguardando". Com o pedido entregue, MUST aparecer "Pedido entregue às HH:MM. Obrigado por comprar no já já!". O selo do status MUST ter o tom do web: verde em `PLACED`, `PAYMENT_APPROVED` e `OUT_FOR_DELIVERY`, amarelo em `PICKING` e neutro em `DELIVERED`.

#### Scenario: Pagamento aprovado
- **WHEN** o pedido está em `PAYMENT_APPROVED`, recebido às 09:03:07 e aprovado às 09:03:12
- **THEN** "Pedido recebido" mostra "09:03:07", "Pagamento aprovado" mostra "09:03:12", "Separando na loja" mostra "Em andamento…", e "A caminho" e "Entregue" mostram "Aguardando"

#### Scenario: Pedido entregue
- **WHEN** o pedido está em `DELIVERED`, entregue às 09:20
- **THEN** os cinco passos aparecem concluídos, nenhum mostra "Em andamento…", o selo é "Entregue" e aparece "Pedido entregue às 09:20. Obrigado por comprar no já já!"

### Requirement: Itens e totais do pedido
O cartão "Itens do pedido" SHALL listar os itens na ordem recebida, com a foto (ou a arte de reserva, sem foto), o nome, "× <quantidade>" e o total da linha. Abaixo MUST mostrar "Subtotal", "Entrega de bike" com a taxa ou "Grátis" quando ela é zero, e "Total" com "Pagamento simulado", com os valores gravados no pedido, sem recalcular. Quando o pedido tem instruções, MUST aparecer o cartão "Instruções para o entregador" com o texto. Sem instruções, esse cartão não aparece.

#### Scenario: Pedido com taxa e sem instruções
- **WHEN** o pedido tem "Banana prata" × 2 (R$ 13,98) e "Leite integral 1 L" × 1 (R$ 5,49), subtotal de 1947 centavos, taxa de 799 e total de 2746, sem instruções
- **THEN** a tela mostra as duas linhas, "Subtotal" R$ 19,47, "Entrega de bike" R$ 7,99, "Total" R$ 27,46 com "Pagamento simulado", e não mostra "Instruções para o entregador"

#### Scenario: Frete grátis com instruções
- **WHEN** o pedido tem `deliveryFeeCents` 0 e as instruções "Deixar na recepção"
- **THEN** "Entrega de bike" mostra "Grátis" e o cartão "Instruções para o entregador" mostra "Deixar na recepção"

### Requirement: Puxar para atualizar
Puxar a tela para baixo SHALL buscar o pedido de novo por `GET /me/orders/<id>`, com o skeleton no lugar do conteúdo até a resposta chegar, e MUST mostrar o pedido lido, inclusive o status que mudou desde a carga anterior. Se o pedido já estiver em falha, puxar a tela também tenta de novo.

#### Scenario: Status avançou
- **WHEN** a tela mostra o pedido em `PLACED`, o cliente puxa a tela e a API responde o pedido em `PICKING`
- **THEN** sai um novo `GET /me/orders/<id>`, o selo passa a "Separando na loja" e "A caminho" mostra "Em andamento…"

### Requirement: Pedido não encontrado e falha de carga
Quando a API responde `404` (pedido inexistente, de outra conta ou com id malformado), a tela SHALL mostrar o estado vazio "Pedido não encontrado." com a única ação "Voltar para a loja", que abre a aba Início, sem o banner de erro. Qualquer outra falha (rede, servidor, resposta fora do formato) MUST mostrar o banner "Não foi possível carregar o pedido." com a mensagem da falha e "Tentar de novo", que busca o pedido de novo.

#### Scenario: Pedido de outra conta
- **WHEN** o cliente abre o pedido de outra conta e a API responde `404` com `ORDER_NOT_FOUND`
- **THEN** a tela mostra "Pedido não encontrado." e "Voltar para a loja", e o toque nessa ação abre a aba Início

#### Scenario: Servidor fora do ar
- **WHEN** a API responde `500` e o cliente toca em "Tentar de novo", e a nova resposta é o pedido
- **THEN** primeiro aparece o banner "Não foi possível carregar o pedido." e depois o pedido

### Requirement: Avisos ao vivo do pedido
Com o pedido carregado e ainda não entregue, a tela SHALL abrir o stream `GET /me/orders/<id>/stream` com `Accept: text/event-stream` e o token da sessão no cabeçalho `Authorization`, nunca na URL. Cada evento `order` MUST disparar uma nova leitura de `GET /me/orders/<id>`; o evento `ping` e eventos de outro nome MUST ser ignorados, e o conteúdo do evento nunca é usado como dado do pedido. Quando o stream conecta (inclusive depois de uma reconexão), o pedido MUST ser lido de novo. Essas leituras MUST manter o pedido na tela, sem skeleton, com no máximo uma leitura em andamento e uma pendente: uma rajada de avisos gera no máximo duas leituras, e a última começa depois do último aviso. Se uma dessas leituras falhar, o pedido exibido MUST continuar na tela; se ela responder `404`, a tela MUST passar a "Pedido não encontrado.".

#### Scenario: Pedido avança com a tela aberta
- **WHEN** a tela mostra o pedido em `PAYMENT_APPROVED`, chega um evento `order` e a nova leitura responde o pedido em `PICKING`
- **THEN** sai um novo `GET /me/orders/<id>` sem o skeleton, o selo passa a "Separando na loja" e "A caminho" mostra "Em andamento…"

#### Scenario: Rajada de avisos
- **WHEN** chegam três eventos `order` enquanto uma leitura ainda está em andamento
- **THEN** sai só mais uma leitura depois que a atual termina

#### Scenario: Sinal de vida
- **WHEN** o stream entrega só eventos `ping`
- **THEN** nenhuma leitura nova do pedido é feita

### Requirement: Reconexão do stream
Quando a conexão do stream cai (rede, fim da resposta ou resposta de erro que não é `401`, `403` nem `404`), o app SHALL tentar de novo depois de uma espera crescente: 1 s, 2 s, 4 s, 8 s e 10 s daí em diante. A espera MUST voltar a 1 s depois de uma conexão bem-sucedida. As respostas `401`, `403` e `404` MUST encerrar o stream sem nova tentativa; o `401` também encerra a sessão, como em toda requisição.

#### Scenario: Quedas seguidas
- **WHEN** o stream falha cinco vezes seguidas e depois conecta
- **THEN** as esperas antes de cada nova tentativa são 1 s, 2 s, 4 s, 8 s e 10 s, e a próxima queda espera 1 s

#### Scenario: Pedido recusado no stream
- **WHEN** o stream responde `404`
- **THEN** nenhuma nova tentativa é agendada e o indicador ao vivo some

### Requirement: Indicador ao vivo
Ao lado do selo do status, a tela SHALL mostrar "Ao vivo" com um ponto verde enquanto o stream está conectado, e "Reconectando…" com um ponto neutro enquanto ele está abrindo ou à espera de nova tentativa. Sem stream (pedido entregue, não carregado, tela em segundo plano) ou com o stream encerrado por recusa, o indicador MUST não aparecer.

#### Scenario: Conexão e queda
- **WHEN** o stream conecta e, depois, a conexão cai
- **THEN** a tela mostra "Ao vivo" e, depois, "Reconectando…"

#### Scenario: Pedido entregue
- **WHEN** o pedido carregado está em `DELIVERED`
- **THEN** o stream não é aberto e nem "Ao vivo" nem "Reconectando…" aparecem

### Requirement: Parada e retomada do acompanhamento ao vivo
O stream SHALL ser fechado, e a espera de nova tentativa cancelada, quando o pedido chega a `DELIVERED`, quando o cliente sai da tela, quando outra aba é aberta e quando o app vai para segundo plano. Ao voltar para a aba ou para o app com o pedido ainda não entregue, o stream MUST ser aberto de novo, com a espera de volta a 1 s, e o pedido MUST ser lido de novo ao conectar.

#### Scenario: Entregue com a tela aberta
- **WHEN** um evento `order` leva a uma leitura que responde o pedido em `DELIVERED`
- **THEN** o stream é fechado, o indicador some e aparece "Pedido entregue às HH:MM. Obrigado por comprar no já já!"

#### Scenario: Segundo plano
- **WHEN** o app vai para segundo plano com o acompanhamento aberto e depois volta
- **THEN** o stream é fechado ao sair e aberto de novo ao voltar, com uma nova leitura do pedido

#### Scenario: Sair da tela
- **WHEN** o cliente volta para a aba Carrinho a partir do acompanhamento
- **THEN** o stream é fechado e nenhuma nova tentativa ou leitura acontece depois

### Requirement: Destaque do passo concluído com a tela aberta
Os passos concluídos depois do status com que a tela abriu SHALL receber um destaque breve (fundo verde claro que some em cerca de 1,5 s), uma vez, quando passam a concluídos. Os passos que já estavam concluídos ao abrir MUST não ter destaque. Com as animações desligadas no aparelho, o destaque MUST não aparecer.

#### Scenario: Passo concluído com a tela aberta
- **WHEN** a tela abriu com o pedido em `PLACED` e um aviso leva o pedido a `PAYMENT_APPROVED`
- **THEN** "Pagamento aprovado" recebe o destaque e "Pedido recebido" não
