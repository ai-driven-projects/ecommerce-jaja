## ADDED Requirements

### Requirement: Rota do pedido
O acompanhamento do pedido SHALL ficar em `/cart/orders/<id>`, na pilha da aba Carrinho, com a barra de abas visível e a aba Carrinho selecionada. A rota MUST exigir sessão: sem sessão, ela leva a "Entrar" com a rota em `from` e volta ao pedido depois de entrar. Voltar MUST levar à aba Carrinho. É a rota aberta depois de confirmar o pedido no checkout.

#### Scenario: Depois de confirmar
- **WHEN** o pedido `3f1c9a52-…` acaba de ser criado no checkout e o cliente toca em voltar no acompanhamento
- **THEN** o acompanhamento mostrou "Pedido #3F1C9A52", e a aba Carrinho aparece, sem o checkout

#### Scenario: Sem sessão
- **WHEN** sem sessão, o app abre `/cart/orders/3f1c9a52-7b1e-4c2d-9e8f-0a1b2c3d4e5f`
- **THEN** a tela "Entrar" aparece com `from` apontando para essa rota

### Requirement: Leitura do pedido
Ao abrir, a tela SHALL buscar o pedido por `GET /me/orders/<id>`, com o token da sessão no cabeçalho. Enquanto a primeira resposta não chega, MUST mostrar o skeleton do cabeçalho, dos passos e dos itens. Valores em dinheiro MUST vir em centavos e ser formatados em reais só na exibição, e as datas MUST aparecer no fuso do aparelho. Esta etapa não atualiza o pedido sozinha: o pedido só muda na tela quando é lido de novo.

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
