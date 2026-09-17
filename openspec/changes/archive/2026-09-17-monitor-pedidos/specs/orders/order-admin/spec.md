## Purpose

Define a administração de pedidos do Jaja: a API só para administradores (lista, resumo do dia, detalhe e stream de avisos), a lista de pedidos ao vivo em `/admin/orders`, o contador de pedidos em andamento no menu e o comando do CLI que zera os pedidos antes de uma demonstração.

## ADDED Requirements

### Requirement: Endpoints administrativos de pedidos
Os endpoints `GET /orders`, `GET /orders/summary`, `GET /orders/stream`, `GET /orders/:id` e `GET /orders/:id/events` SHALL ser administrativos, conforme `admin/admin-api-authorization`: sem token válido, `401`; com token de usuário sem `admin`, `403` com `ADMIN_REQUIRED`. Os caminhos fixos (`summary`, `stream`) MUST ter prioridade sobre `:id`.

#### Scenario: Lista sem token
- **WHEN** um cliente sem token chama `GET /orders`
- **THEN** o sistema responde `401`

#### Scenario: Cliente comum
- **WHEN** a cliente `ana.pereira.carvalho@jaja.dev` (`admin = false`) chama `GET /orders/summary` ou `GET /orders/stream` com seu token
- **THEN** o sistema responde `403` com `ADMIN_REQUIRED`, em JSON

### Requirement: Lista de pedidos na API
`GET /orders` SHALL devolver uma página de pedidos não excluídos, ordenados do mais recente para o mais antigo (`placedAt` decrescente, desempate por `id`), no formato `{ items, total, page, pageSize, totalPages }`.

Cada item MUST ter:
- `id`, `status` e `customerName` (nome do usuário do cliente);
- `deliveryNeighborhood`, `deliveryCity` e `itemCount` (soma das quantidades);
- `totalCents`, `placedAt` e `statusChangedAt` (a data do passo mais recente, ou `placedAt`).

Parâmetros:
- `page` e `pageSize`: inteiros positivos, padrão 1 e 20, `pageSize` limitado a 100; valores inválidos voltam ao padrão;
- `status`: um status do pedido ou `IN_PROGRESS` (qualquer status diferente de `DELIVERED`); outro valor é ignorado;
- `search`: texto aparado; vazio é ignorado. Encontra pedidos cujo número (o começo do id sem hífens) começa com o texto, sem diferenciar maiúsculas, ou cujo nome do cliente contém os termos, sem diferenciar maiúsculas nem acentos.

#### Scenario: Pedido novo no topo
- **WHEN** a cliente confirma um pedido e o administrador chama `GET /orders`
- **THEN** o pedido é o primeiro item, com `customerName`, bairro, cidade, `itemCount`, `totalCents` e `status` atuais

#### Scenario: Em andamento
- **WHEN** o administrador chama `GET /orders?status=IN_PROGRESS`
- **THEN** a resposta traz só pedidos com status diferente de `DELIVERED`

#### Scenario: Busca pelo número
- **WHEN** o administrador chama `GET /orders?search=0cfd7dab` para o pedido `#0CFD7DAB`
- **THEN** o pedido aparece na resposta

#### Scenario: Busca pelo cliente sem acento
- **WHEN** o administrador chama `GET /orders?search=ana pereira`
- **THEN** a resposta traz os pedidos da cliente "Ana Pereira Carvalho"

#### Scenario: Filtro inválido
- **WHEN** o administrador chama `GET /orders?status=XYZ&pageSize=0`
- **THEN** o filtro de status é ignorado e a página tem o tamanho padrão de 20

### Requirement: Resumo do dia
`GET /orders/summary` SHALL devolver, considerando "hoje" como o dia atual no fuso `America/Sao_Paulo`:
- `placedToday`: pedidos feitos hoje;
- `inProgress`: pedidos (de qualquer dia) com status diferente de `DELIVERED`;
- `deliveredToday`: pedidos entregues hoje;
- `revenueTodayCents`: soma de `totalCents` dos pedidos feitos hoje;
- `averageTicketTodayCents`: média inteira de `totalCents` dos pedidos feitos hoje, ou `null` sem pedidos hoje;
- `averageDeliveryMinutesToday`: média de `deliveredAt - placedAt`, em minutos com uma casa decimal, dos pedidos entregues hoje, ou `null` sem entregas hoje;
- `latestInProgress`: até 6 pedidos em andamento, do mais recente para o mais antigo, no formato dos itens da lista.

Pedidos excluídos MUST ficar fora de todas as contas.

#### Scenario: Sem pedidos
- **WHEN** não há pedidos e o administrador chama `GET /orders/summary`
- **THEN** a resposta tem as contagens e o faturamento em 0, `averageTicketTodayCents` e `averageDeliveryMinutesToday` `null` e `latestInProgress` vazio

#### Scenario: Pedido entregue
- **WHEN** um pedido feito hoje chega a `DELIVERED` e o administrador chama o resumo
- **THEN** `placedToday` e `deliveredToday` o contam, `inProgress` não o conta, e `averageDeliveryMinutesToday` considera o tempo dele

### Requirement: Detalhe administrativo do pedido
`GET /orders/:id` SHALL devolver o pedido não excluído com:
- `customer` (`id`, `name`, `email`, `phone`);
- os itens na ordem gravada;
- endereço, quem recebe, instruções e totais;
- `status`, `placedAt`, `paymentApprovedAt`, `pickingStartedAt`, `outForDeliveryAt` e `deliveredAt`;
- `updatedAt`.

Pedido inexistente, excluído ou com id malformado MUST responder `404` com `ORDER_NOT_FOUND`.

#### Scenario: Pedido de qualquer cliente
- **WHEN** o administrador chama `GET /orders/:id` com o id do pedido da cliente
- **THEN** o sistema responde `200` com o pedido e `customer.email` igual a `ana.pereira.carvalho@jaja.dev`

#### Scenario: Id malformado
- **WHEN** o administrador chama `GET /orders/nao-e-uuid`
- **THEN** o sistema responde `404` com `ORDER_NOT_FOUND`

### Requirement: Stream administrativo de pedidos
`GET /orders/stream` SHALL abrir um stream `text/event-stream` que avisa sempre que um evento de **qualquer** pedido é publicado. Cada aviso MUST ser um evento SSE `order`, com `data` contendo só `orderId`, `eventType`, `messageId` e `occurredAt` (ISO 8601), sem dados do pedido nem do payload. O stream MUST enviar `ping` a cada 20 s e MUST ser autorizado pelo cabeçalho `Authorization` antes de abrir. As telas MUST ler os dados pela API REST, usando o aviso só como sinal.

#### Scenario: Avisos de dois pedidos
- **WHEN** o administrador está com o stream aberto e dois clientes confirmam pedidos
- **THEN** ele recebe os avisos `order` dos dois pedidos, com os `orderId` de cada um, e nenhum dado dos pedidos

### Requirement: Lista de pedidos ao vivo no admin
A página `/admin/orders` SHALL exibir:
- o título "Pedidos", o subtítulo "`N` pedido(s) · `M` em andamento" e o indicador de atualização ao vivo;
- os filtros Todos, Em andamento, Pedido recebido, Pagamento aprovado, Separando na loja, A caminho e Entregue;
- a busca "Buscar por número ou cliente";
- uma tabela com Pedido (`#` + número), Cliente, Destino (bairro · cidade · `N` itens), Status, Atualizado (`HH:MM:SS` de `statusChangedAt`) e Total;
- paginação.

Página, filtro e busca MUST ficar na URL, e recarregar MUST reproduzir a lista. A busca MUST aplicar cerca de 300 ms depois da última tecla e voltar à primeira página. A linha inteira MUST levar a `/admin/orders/:id`, pelo mouse ou pelo teclado.

A lista MUST ser relida a cada aviso do stream administrativo e a cada reconexão, sem recarregar a página, com destaque breve nas linhas novas e na célula de status que mudou (sem animação com `prefers-reduced-motion`).

Sem pedidos e sem filtros, a página MUST mostrar "Nenhum pedido ainda." e "Os pedidos feitos na loja aparecem aqui na hora, sem recarregar.". Com filtros sem resultado, "Nenhum pedido encontrado." com "Limpar filtros". Nenhum pedido de exemplo MUST aparecer.

#### Scenario: Pedido aparece sem recarregar
- **WHEN** o administrador está em `/admin/orders` numa janela e a cliente confirma um pedido em outra sessão
- **THEN** a linha do pedido aparece no topo da lista sem recarregar, com destaque, e o status dela avança conforme o ciclo do pedido

#### Scenario: Lista vazia
- **WHEN** não há pedidos e o administrador abre `/admin/orders`
- **THEN** vê "Nenhum pedido ainda." e nenhuma linha de exemplo

#### Scenario: Filtro na URL
- **WHEN** o administrador escolhe "Entregue", busca "ana" e recarrega a página
- **THEN** a lista mantém o filtro "Entregue" e a busca "ana"

### Requirement: Uma conexão ao vivo por aba do admin
A área administrativa SHALL abrir **uma** conexão com `GET /orders/stream` por aba, enquanto houver sessão de administrador, com o token no cabeçalho `Authorization` e nunca na URL. Lista, contador do menu, dashboard e painel do pedido MUST usar essa mesma conexão. Ao cair, a conexão MUST ser reaberta com espera crescente, e, ao voltar, as telas MUST reler os dados. O indicador "Ao vivo" MUST mostrar "Ao vivo" com a conexão aberta, "Reconectando…" enquanto abre ou reabre e "Desconectado" quando encerrada por erro de autorização.

#### Scenario: Uma conexão
- **WHEN** o administrador está em `/admin/orders/:id`, com o menu e o painel na tela
- **THEN** existe uma única requisição aberta para `/orders/stream`, sem token na URL

#### Scenario: Backend reinicia
- **WHEN** o backend para e volta com o admin aberto
- **THEN** o indicador mostra "Reconectando…" e, ao voltar, "Ao vivo", com a lista e o contador atualizados

### Requirement: Contador de pedidos em andamento no menu
O item "Pedidos" do menu lateral do admin SHALL exibir o número de pedidos em andamento (`inProgress` do resumo), atualizado ao vivo. O contador MUST ficar oculto enquanto carrega e quando o número é 0.

#### Scenario: Contador acompanha o ciclo
- **WHEN** não há pedidos em andamento, a cliente confirma um pedido e ele chega a `DELIVERED`
- **THEN** o contador aparece com 1 depois da confirmação, sem recarregar, e some quando o pedido é entregue

### Requirement: Limpar pedidos pelo CLI
O CLI SHALL ter o comando `db:clear-orders` ("Limpar pedidos"), que:
- pede confirmação antes de apagar (assumida com `--yes`), e em dry-run só lista o que faria;
- apaga, numa única transação, as marcas de processamento das mensagens de eventos de pedidos, os eventos de pedidos do outbox e todos os pedidos, com seus itens;
- em seguida, com o RabbitMQ no ar, esvazia as filas `jaja.*` (consumidores, espera, descarte e inspeção), exceto as filas `jaja.live.*`, sem exibir credenciais;
- com o RabbitMQ fora do ar, termina com aviso, e os dados do banco continuam apagados;
- informa quantos pedidos e eventos foram apagados e quantas filas foram esvaziadas.

Nenhum outro dado (clientes, carrinhos, catálogo, usuários, eventos de outros agregados) MUST ser apagado.

#### Scenario: Limpeza para demonstração
- **WHEN** o desenvolvedor roda `db:clear-orders --yes` com pedidos no banco
- **THEN** `orders`, `order_items` e os eventos `aggregate_type = 'Order'` ficam vazios, as marcas de processamento desses eventos somem, as filas de pedidos ficam com 0 mensagens, e clientes e catálogo continuam iguais

#### Scenario: Dry-run
- **WHEN** o desenvolvedor roda `db:clear-orders --dry-run`
- **THEN** o CLI mostra o que apagaria e nenhum dado nem fila é alterado

#### Scenario: Sem confirmação
- **WHEN** o desenvolvedor roda `db:clear-orders` e responde "não" à confirmação
- **THEN** nada é apagado
