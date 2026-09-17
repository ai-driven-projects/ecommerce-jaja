# Prompts dos desenhos da aula de arquitetura

Os desenhos 1 a 7 já existem como `imagem-01.png` … `imagem-07.png` nesta pasta. Este
arquivo traz os prompts dos **7 que faltam** (8 a 14), para gerar `imagem-08.png` …
`imagem-14.png` no mesmo estilo.

A numeração acompanha o deck em `docs/aula-arquitetura/`, que tem os 14 temas em SVG:

| # | Tema | PNG |
|---|---|---|
| 01–07 | monorepo, camadas, agregado, blocos, evento, catálogo, onde mora o código | feitos |
| 08 | Transactional outbox | falta |
| 09 | Topologia no RabbitMQ | falta |
| 10 | Vida de uma mensagem no consumidor | falta |
| 11 | Coreografia do pedido | falta |
| 12 | Tempo real (SSE) | falta |
| 13 | Monitor de eventos do admin | falta |
| 14 | Garantias e decisões | falta |

**Como usar:** cole o bloco *Estilo base* + o prompt do desenho desejado. Todo texto
citado entre aspas deve aparecer no desenho exatamente como está escrito — os nomes de
fila, evento e arquivo são os reais do código, não podem ser inventados nem traduzidos.

---

## Estilo base

> Ilustração educativa em formato 16:9, fundo de papel off-white levemente texturizado,
> como uma página de caderno de anotações fotografada.
>
> **Traço:** tudo desenhado à mão com marcador, linhas levemente trêmulas e imperfeitas.
> Caixas de cantos arredondados, preenchidas com cor pastel e hachura diagonal de lápis
> visível por dentro. Paleta: lilás, pêssego, azul-claro, verde-menta, amarelo-manteiga,
> rosa-claro e cinza-claro.
>
> **Título:** letra de mão preta, grossa e arredondada, no topo, precedido do número do
> desenho dentro de um círculo desenhado à mão. Sob o título, um risco de marcador azul
> levemente ondulado. Abaixo, o subtítulo em cinza, letra de mão menor, em minúsculas.
>
> **Ícones:** adesivos vetoriais planos e simpáticos (estilo de pacote de ícones), um por
> caixa, nunca fotografias.
>
> **Setas:** setas pretas desenhadas à mão para o fluxo principal, com um rótulo
> manuscrito curto por cima. As observações de destaque vão em **letra roxa manuscrita**,
> ligadas ao alvo por uma seta tracejada roxa. Proibições são um **X vermelho** grosso.
> Caixas em destaque ganham três ou quatro risquinhos curtos ao redor, como brilho.
>
> **Rodapé:** três post-its levemente inclinados, com sombra — um **verde com ✓** (a
> regra), um **amarelo com cadeado ou lâmpada** (a sutileza) e um **rosa com ✗** (o
> antipadrão). Uma ou duas linhas manuscritas em cada.
>
> **Texto:** todo em português do Brasil, sem erros de grafia e sem texto ilegível.
> Nomes de arquivo, fila e rota em letra de mão monoespaçada, menores e em cinza.

---

## 08 — Transactional outbox

Número **8** no círculo, em azul.

**Título:** "Transactional outbox"
**Subtítulo:** "como o evento nunca se perde entre o banco e o broker — o coração da arquitetura"

**Layout:** duas faixas horizontais empilhadas, ligadas por uma seta preta descendente
rotulada "depois, fora da tx"; à direita, duas caixas de exceção.

**Faixa 1 — cabeçalho "1 · UMA TRANSAÇÃO SÓ"**, caixa grande azul-clara com o rótulo
`PlaceOrder.execute()` no topo. Dentro, quatro linhas empilhadas como um extrato de
banco de dados, com ícone de cilindro de banco:

- "BEGIN"
- "INSERT orders" — legenda cinza: "o pedido, com os itens e preços congelados"
- "UPDATE carts" — legenda: "o carrinho da conta fica vazio"
- "INSERT outbox_events" — legenda: "status PENDING · o evento order.placed"
- "COMMIT"

Fecho da faixa, em preto e negrito: "Os três gravam juntos — ou nenhum grava."

**Faixa 2 — cabeçalho "2 · O RELAY PUBLICA DEPOIS"**, caixa pêssego com `OutboxRelay` e
ícone de relógio/engrenagem. Legenda: "a cada 1 segundo, dentro do backend" e, menor,
"OUTBOX_POLL_INTERVAL_MS · não é uma rota HTTP". Dentro, três passos em sequência:

- "SELECT … FOR UPDATE SKIP LOCKED" — "até 50 pendentes, do mais antigo para o mais novo"
- "publish() com confirm" — "só segue quando o RabbitMQ confirma a mensagem"
- "UPDATE status = PUBLISHED" — "com published_at — a linha fica no banco como histórico"

Anotação roxa apontando para o SKIP LOCKED: "outra instância pula as linhas travadas:
nunca publicam o mesmo". Fecho da faixa: "Depende só da porta MessagePublisher."

**Caixa de exceção 1 (amarela), título "SE A PUBLICAÇÃO FALHAR":** "O evento continua
PENDING: attempts + 1, last_error gravado e available_at empurrado para o futuro
(backoff)." Em negrito: "Broker fora do ar não derruba o backend nem o checkout."

**Caixa de exceção 2 (rosa), título "ENTREGA AO MENOS UMA VEZ":** "Se o processo cair
entre o confirm e o commit, o evento segue pendente e é publicado de novo — com o mesmo
messageId." Em negrito: "É por isso que todo consumidor precisa ser idempotente."

**Rodapé do desenho, em cinza mono:** "apps/backend/src/messaging/outbox/ ·
outbox-relay.ts · outbox.prisma.ts · domain-event.prisma.ts"

**Post-its:** verde ✓ "grava o evento na mesma transação do agregado" · amarelo 🔒 "a
publicação é sempre depois do commit" · rosa ✗ "nunca publicar dentro do caso de uso"

---

## 09 — A topologia no RabbitMQ

Número **9** no círculo, em laranja.

**Título:** "A topologia no RabbitMQ"
**Subtítulo:** "um exchange, seis filas — e a routing key é sempre o type do evento"

**Layout:** metade de cima, o leque do exchange para as filas; metade de baixo, o zoom no
trio de uma fila.

**Metade de cima:** à esquerda, caixa pêssego `OutboxRelay` com ícone de avião de papel,
legenda "publish com confirm, persistent: true". Seta preta para o centro, onde fica uma
caixa lilás grande em destaque, com ícone de central telefônica:

- "EXCHANGE" (rótulo pequeno) / `jaja.events` (grande) / "topic · durável" / "roteia pela
  routing key" / em cinza mono: "RABBITMQ_EXCHANGE"

Do exchange saem cinco setas em leque para cinco filas empilhadas à direita, cada uma uma
caixa com nome mono e legenda:

- `jaja.payment.approve-order` — "binding order.placed · durável · espera 3 s"
- `jaja.store.start-picking` — "binding order.payment-approved · espera 2 s"
- `jaja.delivery.dispatch-order` — "binding order.picking-started · espera 6 s"
- `jaja.delivery.complete-order` — "binding order.out-for-delivery · espera 8 s"
- `jaja.live.<host>.<pid>.<rand>` — "binding # · transiente, uma por instância, cópia de
  tudo" (esta em cor diferente das outras quatro, para destacar que é outra natureza)

Sob as quatro primeiras, uma chave desenhada à mão com o texto: "As quatro primeiras são
filas de trabalho: cada mensagem vai para uma instância." No canto do exchange, em cinza:
"PREFETCH=10 · MAX_ATTEMPTS=5".

**Metade de baixo**, dentro de uma moldura tracejada com o título "TODA FILA DE TRABALHO
VEM EM TRIO — AQUI, A DO PAGAMENTO": três caixas lado a lado, ligadas em ciclo.

- centro, azul, em destaque: `jaja.payment.approve-order` — "a fila de trabalho",
  "durável, dividida entre instâncias", "é a única com consumidor"
- esquerda, amarela: `…approve-order.wait` — "espera e nova tentativa", "TTL por mensagem,
  sem consumidor", em mono: `x-dead-letter-exchange: ''`
- direita, cinza: `…approve-order.dead` — "mensagens descartadas", "ficam para inspeção no
  painel", em mono: `x-jaja-dead-reason`

Setas rotuladas: da fila de trabalho para a `.wait` "falhou"; da `.wait` de volta para a
fila "TTL expira"; da fila de trabalho para a `.dead` "5ª falha".

Anotação roxa: "A .wait devolve a mensagem pelo exchange padrão, direto para a fila de
origem: os outros consumidores do mesmo evento não recebem cópia da retentativa."

**Rodapé:** "apps/backend/src/messaging/rabbitmq/ · painel em http://localhost:15672
(jaja / jaja)"

**Post-its:** verde ✓ "a routing key é o type do evento" · amarelo 🔌 "trocar de broker
mexe só nos adaptadores" · rosa ✗ "nenhuma fila é declarada na mão no painel"

---

## 10 — A vida de uma mensagem no consumidor

Número **10** no círculo, em verde.

**Título:** "A vida de uma mensagem no consumidor"
**Subtítulo:** "o caminho feliz à esquerda, os três desvios à direita — EventConsumerRunner"

**Layout:** coluna larga à esquerda com quatro passos numerados de cima para baixo; três
caixas de desvio empilhadas à direita; faixa de rodapé sobre causação.

**Passo 1** (caixa azul, ícone de envelope chegando): "1 · A mensagem chega na fila do
consumidor" — legenda mono: "jaja.payment.approve-order · prefetch 10 · uma instância só
recebe".

**Passo 2** (caixa amarela, ícone de ampulheta): "2 · A espera do serviço acontece no
broker" — "Na primeira entrega a mensagem é republicada em .wait com expiration: 3000,
volta sozinha quando o TTL expira." Em negrito: "Nenhum setTimeout segurando transação."

**Passo 3** (caixa verde grande, em destaque com risquinhos de brilho, ícone de cadeado ou
cofre): "3 · UMA TRANSAÇÃO SÓ — TUDO OU NADA", com quatro linhas empilhadas:

- `markProcessed()` — "grava a marca em processed_messages"
- `handler(msg, tx)` — "chama AdvanceOrderStatus com a mesma tx"
- `append(novos eventos)` — "o próximo evento nasce PENDING no outbox"
- "COMMIT" — "marca, status e próximo evento nascem juntos"

**Passo 4** (caixa cinza, ícone de ✓): "4 · ack — a mensagem sai da fila" — "O relay já vai
encontrar o novo evento pendente e publicar o próximo passo." Uma seta preta curva sai
daqui e volta para o passo 1, fechando o ciclo.

**Desvio 1 (lilás), "SE A MARCA JÁ EXISTIA":** "A chave é (consumer, messageId): o handler
nem roda e a mensagem recebe ack." Em negrito: "É a idempotência."

**Desvio 2 (amarelo), "SE QUALQUER PASSO FALHAR":** "Rollback de tudo — inclusive da marca.
Republica com x-jaja-attempt + 1 e espera o backoff na .wait."

**Desvio 3 (rosa), "NA 5ª TENTATIVA":** "Vai para a .dead com o motivo no cabeçalho."

**Faixa de rodapé (pêssego), "CAUSAÇÃO — O QUE LIGA UM EVENTO AO OUTRO":** "O evento
gravado dentro de um consumidor herda a origem da mensagem: causationId = quem causou
este evento; correlationId = o id que atravessa a cadeia inteira, do order.placed até o
order.delivered."

**Rodapé:** "apps/backend/src/messaging/consumer/ · event-consumer.runner.ts ·
processed-message.prisma.ts · message-causation.ts"

**Post-its:** verde ✓ "marca, efeito e próximo evento na mesma transação" · amarelo 💡 "a
espera mora na fila, não no código" · rosa ✗ "nunca dar ack antes do commit"

---

## 11 — O pedido, do checkout à entrega

Número **11** no círculo, em rosa.

**Título:** "O pedido, do checkout à entrega"
**Subtítulo:** "coreografia: ninguém manda em ninguém — cada serviço reage ao evento do passo anterior"

**Layout:** tabela desenhada à mão, de cima para baixo, com quatro colunas de cabeçalho
manuscrito: "TEMPO" · "STATUS DO PEDIDO" · "EVENTO GRAVADO" · "QUEM GRAVOU". Entre uma
linha e a seguinte, uma faixa estreita e inclinada representando o serviço que reage.

Linhas da tabela:

| tempo | status | evento | quem gravou |
|---|---|---|---|
| "0 s" | "PLACED" | `order.placed` | `Order.place()` — "no POST /me/orders do checkout" |
| "3 s" | "PAYMENT_APPROVED" | `order.payment-approved` | `Order.advanceTo()` — "dentro da transação do consumidor" |
| "5 s" | "PICKING" | `order.picking-started` | `Order.advanceTo()` — "mesmo caso de uso, outro consumidor" |
| "11 s" | "OUT_FOR_DELIVERY" | `order.out-for-delivery` | `Order.advanceTo()` — "a tela do cliente já mostra «a caminho»" |
| "19 s" | "DELIVERED" | `order.delivered` | `Order.advanceTo()` — "fim da cadeia: ninguém assina este evento" |

Faixas de serviço entre as linhas, cada uma com um ícone e fundo pastel próprio:

- `payment.approve-order` (cartão de crédito) — "gateway de pagamento · espera 3 s na fila
  .wait antes de agir"
- `store.start-picking` (cesta) — "a loja separa os itens · espera 2 s"
- `delivery.dispatch-order` (moto) — "o entregador sai com o pedido · espera 6 s"
- `delivery.complete-order` (casa com pacote) — "entrega ao cliente · espera 8 s"

Anotação roxa apontando para o vão entre o pagamento e a separação: "Para colocar emissão
de nota fiscal entre o pagamento e a separação, basta registrar mais um consumidor.
Nenhum código existente muda."

Nota em cinza no rodapé: "Os tempos são da simulação (ORDER_SIMULATION_DELAY_FACTOR
multiplica todos eles)."

**Post-its:** verde ✓ "cada efeito é o gatilho do próximo" · amarelo 💡 "acrescentar um
passo é acrescentar um consumidor" · rosa ✗ "ninguém orquestra a sequência"

---

## 12 — Como a tela fica viva

Número **12** no círculo, em azul.

**Título:** "Como a tela fica viva"
**Subtítulo:** "do evento no broker até o pedido se mexendo na tela, sem o usuário apertar F5"

**Layout:** três faixas verticais rotuladas no topo — "BROKER" (lilás), "BACKEND" (azul),
"NAVEGADOR" (verde) — e uma escada de seis caixas descendo e atravessando as faixas, cada
uma ligada à seguinte por seta preta.

1. (broker) "O evento é publicado no exchange, como qualquer outro" — legenda: "o feed ao
   vivo não tem canal próprio — ele escuta o mesmo jaja.events" · selo mono: "topic"
2. (broker) "Fila transiente, uma por instância, assinando tudo (#)" — "exclusiva e
   apagada junto com a conexão — cada instância recebe sua própria cópia" · mono:
   `jaja.live.<host>.<pid>`
3. (backend) "Cada mensagem vira um item de um Subject do RxJS" — "em memória, sem
   idempotência e sem retentativa: aviso perdido é aviso perdido" · mono:
   `LiveEventFeed.events$`
4. (backend) "Filtra pelo pedido e monta o aviso — sem payload de negócio" — "só
   { orderId, eventType, messageId, occurredAt } + um ping a cada 20 s" · mono:
   `OrderLiveUpdates`
5. (backend) "Sai pela rota SSE do pedido (e a do admin, com todos)" — "conexão HTTP que
   fica aberta, text/event-stream" · mono: `@Sse(':id/stream')`
6. (navegador) "O navegador abre o stream com fetch, não com EventSource" — "a EventSource
   nativa não manda cabeçalho — e o token nunca vai na URL" · mono: `openEventStream()`
7. (navegador) "Ao receber o aviso, a tela busca o pedido de novo na API REST" — "a REST
   continua sendo a fonte da verdade; o aviso só diz «olhe de novo»" · mono:
   `useLiveRefetch()`

Da última caixa, uma seta curva volta para a caixa da API REST do backend, mostrando a
releitura.

**Faixa de destaque no rodapé (amarela), com ícone de lâmpada:** "Por que o aviso não
carrega o estado: se uma mensagem se perder — broker reiniciou, instância sem conexão — a
tela não fica errada. A próxima leitura corrige sozinha. É o que permite usar uma fila sem
garantia nenhuma para a parte visual."

**Post-its:** verde ✓ "o aviso só diz «mexeu»; a REST diz o quê" · amarelo 🔌 "fila ao
vivo é descartável de propósito" · rosa ✗ "sem polling e sem token na URL"

---

## 13 — O monitor de eventos do admin

Número **13** no círculo, em roxo.

**Título:** "O monitor de eventos do admin"
**Subtítulo:** "observabilidade sem plugin: três leituras do banco viram a linha do tempo de um pedido"

**Layout:** três caixas-fonte no topo, lado a lado, convergindo por setas para uma caixa
única no meio; abaixo, a maquete da tela.

**Fontes:**

- (azul, ícone de cilindro) `outbox_events` — "o evento saiu daqui?" — mono: "status ·
  attempts", "published_at · last_error"
- (verde, ícone de carimbo) `processed_messages` — "quem já processou?" — mono: "consumer ·
  message_id", "processed_at"
- (pêssego, ícone de lista) `EventConsumerRegistry` — "quem deveria processar?" — "os
  consumidores registrados nesta instância, e a espera de cada um"

**Caixa central (lilás, em destaque):** `EventTimelinePrisma` — "cruza os três por evento e
deduz o estado de cada consumidor".

**Maquete da tela**, moldura de navegador com o título "O QUE A TELA MOSTRA — GET
/orders/:id/events". Dentro, duas entradas de linha do tempo:

- `order.picking-started` · selo verde "PUBLISHED" — "publicado há 1 s · attempts 0 ·
  causationId aponta para o evento anterior"
- `delivery.dispatch-order · aguardando` — "esperado em +6 s — a marca de processada ainda
  não existe"

Ao lado, uma legenda de três selos, cada um com sua cor: "evento pendente" — "ainda não
saiu do outbox"; "aguardando" — "publicado, ainda sem marca"; "processado" — "a marca
existe, com a hora".

Anotação roxa: "Nada disso pergunta ao RabbitMQ: os três estados são deduzidos do banco.
Retentativa e descarte ficam invisíveis aqui — vivem no broker."

**Rodapé:** "apps/backend/src/messaging/monitoring/ · event-timeline.prisma.ts ·
event-timeline.builder.ts"

**Post-its:** verde ✓ "o banco já conta a história toda" · amarelo 💡 "o estado é deduzido,
não guardado" · rosa ✗ "o painel do broker não é a fonte da verdade"

---

## 14 — Seis perguntas para fechar a revisão

Número **14** no círculo, em verde.

**Título:** "Seis perguntas para fechar a revisão"
**Subtítulo:** "se a turma souber responder estas, entendeu a arquitetura"

**Layout:** grade de seis cartões, três por linha, cada um com a pergunta em letra de mão
preta no topo, um selo colorido com a palavra-chave da resposta, um ícone e duas ou três
linhas de texto. Cada cartão em uma cor pastel diferente.

1. **"E se o RabbitMQ cair?"** · selo "nada trava" · ícone de tomada desligada
   "O checkout continua funcionando: o pedido é gravado e o evento fica PENDING. O relay
   tenta de novo a cada rodada, com backoff, e o publisher reconecta sozinho. Quando o
   broker volta, a fila de eventos pendentes sai em ordem."
2. **"E se a mesma mensagem chegar duas vezes?"** · selo "idempotência" · ícone de carimbo
   "A chave primária (consumer, message_id) barra a segunda. O handler não roda e a
   mensagem recebe ack como duplicata. Repetição é esperada: a entrega é «ao menos uma
   vez», nunca «exatamente uma»."
3. **"E se o handler falhar no meio?"** · selo "tudo ou nada" · ícone de cofre
   "Rollback de tudo — inclusive da marca de processada. A mensagem é republicada com
   x-jaja-attempt + 1 e espera o backoff na .wait. Na 5ª tentativa vai para a .dead, com o
   motivo no cabeçalho."
4. **"E se eu subir duas instâncias do backend?"** · selo "escala horizontal" · ícone de
   dois servidores
   "O relay usa FOR UPDATE SKIP LOCKED: duas instâncias nunca publicam o mesmo evento. As
   filas de trabalho dividem as mensagens entre elas. Só o feed ao vivo é diferente: cada
   instância tem a sua fila e recebe uma cópia."
5. **"E se as mensagens chegarem fora de ordem?"** · selo "tolerância" · ícone de cartas
   embaralhadas
   "O caso de uso pergunta hasReached(status) antes de mudar qualquer coisa. Se o pedido já
   passou daquele ponto, responde ok sem gravar nada. Mensagem que não se aplica mais não é
   erro — é só mensagem velha."
6. **"E se eu quiser trocar o RabbitMQ por outra coisa?"** · selo "o teste da arquitetura" ·
   ícone de plugue
   "Troca-se apenas os dois providers de MESSAGE_PUBLISHER e MESSAGE_CONSUMER no
   MessagingModule. Relay, runner, casos de uso e entidades não mudam. É para isso que
   servem as portas em packages/shared/src/messaging."

**Faixa final**, atravessando a largura toda, em letra maior e com brilho ao redor: "A
pergunta que amarra tudo: quem publica o evento não sabe quem vai consumir — e é isso que
deixa o sistema crescer sem reescrita."

Neste desenho, a faixa final substitui os três post-its.
