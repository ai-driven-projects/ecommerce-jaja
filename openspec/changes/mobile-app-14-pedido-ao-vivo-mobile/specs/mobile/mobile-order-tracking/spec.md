## MODIFIED Requirements

### Requirement: Leitura do pedido
Ao abrir, a tela SHALL buscar o pedido por `GET /me/orders/<id>`, com o token da sessão no cabeçalho. Enquanto a primeira resposta não chega, MUST mostrar o skeleton do cabeçalho, dos passos e dos itens. Valores em dinheiro MUST vir em centavos e ser formatados em reais só na exibição, e as datas MUST aparecer no fuso do aparelho. Depois da primeira carga, o pedido MUST ser lido de novo a cada aviso do acompanhamento ao vivo, além de quando o cliente puxa a tela ou toca em "Tentar de novo".

#### Scenario: Primeira carga
- **WHEN** o cliente abre o acompanhamento e a API ainda não respondeu
- **THEN** sai `GET /me/orders/<id>` com o Bearer e a tela mostra o skeleton

#### Scenario: Sessão expirada
- **WHEN** a API responde `401` ao `GET /me/orders/<id>`
- **THEN** a sessão termina e a tela "Entrar" aparece com a rota do pedido em `from`

## ADDED Requirements

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
