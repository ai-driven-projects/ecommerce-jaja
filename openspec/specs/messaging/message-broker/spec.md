# Broker de Mensagens (Message Broker) Specification

## Purpose

Define como o backend do Jaja entrega mensagens ao broker: a porta única de publicação, o RabbitMQ como adapter trocável, o formato e a durabilidade das mensagens, a conexão resiliente, a proteção das credenciais e o ambiente local do broker (Docker Compose e CLI).

## Requirements

### Requirement: Publicação pela porta de mensagens com broker trocável
Todo envio de mensagem do backend MUST passar pela porta de publicação do shared (`MessagePublisher`, token `MESSAGE_PUBLISHER`). O RabbitMQ SHALL ser o adapter registrado para essa porta, e trocar de broker MUST exigir só trocar o provider do token, sem alterar o relay, o registro de eventos, `modules/*` ou `packages/shared`. As opções de publicação MUST ser interpretadas de forma genérica: `routingKey`, quando informada, define a chave de roteamento; sem ela, vale o `type` da mensagem.

#### Scenario: Relay depende só da porta
- **WHEN** o provider de `MESSAGE_PUBLISHER` é substituído por outra implementação da porta
- **THEN** o relay publica os eventos por ela sem nenhuma outra mudança de código

#### Scenario: Routing key padrão
- **WHEN** uma mensagem do tipo `messaging.test-event` é publicada sem `routingKey` nas opções
- **THEN** ela é roteada com a chave `messaging.test-event`

### Requirement: Exchange topic durável e roteamento pelo tipo do evento
O adapter MUST publicar em um exchange do tipo `topic`, durável, cujo nome vem de `RABBITMQ_EXCHANGE` (padrão `jaja.events`), declarado pelo próprio adapter ao conectar. A routing key de cada evento publicado pelo relay MUST ser o `type` do evento, para que consumidores futuros assinem por padrão (por exemplo, `order.*`).

#### Scenario: Exchange criado ao conectar
- **WHEN** o backend conecta a um RabbitMQ sem o exchange `jaja.events`
- **THEN** o exchange `jaja.events` passa a existir, do tipo `topic` e durável

#### Scenario: Fila ligada pelo tipo
- **WHEN** uma fila está ligada ao exchange com a chave `messaging.test-event` e o relay publica um evento desse tipo
- **THEN** a fila recebe a mensagem

### Requirement: Formato e durabilidade da mensagem
Cada mensagem MUST ter corpo JSON com `messageId` (o `id` do evento), `type`, `payload`, `metadata` e `occurredAt` em texto ISO 8601. O `payload` de um evento publicado pelo relay MUST incluir `aggregateId` e `aggregateType`. A mensagem MUST ser persistente e levar as propriedades `contentType` `application/json`, `messageId`, `type`, `timestamp` (segundos desde a época), `appId` `jaja-backend` e os `headers` das opções de publicação, quando houver.

#### Scenario: Mensagem recebida por uma fila
- **WHEN** o relay publica um evento `messaging.test-event` do agregado `MessagingTest`
- **THEN** a fila ligada recebe uma mensagem persistente com `contentType` `application/json`, `messageId` igual ao `id` do evento e corpo com o mesmo `type`, o `payload` do evento acrescido de `aggregateId` e `aggregateType`, o `metadata` e o `occurredAt` em ISO 8601

### Requirement: Confirmação do broker e erros de publicação
Uma publicação MUST ser considerada bem-sucedida só depois de o broker confirmar o recebimento da mensagem. Se não houver conexão com o broker, a publicação MUST falhar com `MESSAGE_BROKER_UNAVAILABLE`. Se o broker recusar a mensagem ou ocorrer erro durante a publicação, MUST falhar com `MESSAGE_PUBLISH_FAILED`. Falhas MUST ser devolvidas como resultado de falha, sem lançar exceção para quem publica.

#### Scenario: Confirmação recebida
- **WHEN** o broker confirma a mensagem
- **THEN** a publicação termina com sucesso

#### Scenario: Broker recusa a mensagem
- **WHEN** o broker responde com recusa (nack) à mensagem
- **THEN** a publicação falha com `MESSAGE_PUBLISH_FAILED`

#### Scenario: Broker inacessível
- **WHEN** uma mensagem é publicada com o RabbitMQ parado
- **THEN** a publicação falha com `MESSAGE_BROKER_UNAVAILABLE`

### Requirement: Conexão preguiçosa e reconexão
O adapter MUST conectar ao broker na primeira publicação e MUST tentar conectar uma vez ao iniciar a aplicação, registrando só um aviso se não conseguir. Uma queda ou erro da conexão ou do canal MUST descartar a conexão atual, e a publicação seguinte MUST tentar conectar de novo. Publicações simultâneas sem conexão MUST compartilhar a mesma tentativa de conexão em andamento, sem abrir conexões duplicadas. Ao encerrar a aplicação, o adapter MUST fechar o canal e a conexão.

#### Scenario: Nova tentativa depois de falhar
- **WHEN** uma publicação falha com `MESSAGE_BROKER_UNAVAILABLE` e o broker volta antes da publicação seguinte
- **THEN** a publicação seguinte conecta e termina com sucesso

#### Scenario: Conexão cai com o backend rodando
- **WHEN** o RabbitMQ é parado e iniciado de novo com o backend rodando
- **THEN** a primeira publicação depois da volta reabre a conexão, sem reiniciar o backend

#### Scenario: Publicações simultâneas sem conexão
- **WHEN** duas publicações começam ao mesmo tempo sem conexão aberta
- **THEN** só uma conexão é aberta e as duas publicações a usam

### Requirement: Fila de inspeção opcional para desenvolvimento
Com `RABBITMQ_INSPECTION_QUEUE` preenchida, o adapter MUST declarar uma fila durável com esse nome e ligá-la ao exchange com a chave `#`, para receber cópia de todos os eventos publicados. Com a variável vazia ou ausente, nenhuma fila MUST ser criada pelo backend.

#### Scenario: Fila de inspeção configurada
- **WHEN** o backend publica um evento com `RABBITMQ_INSPECTION_QUEUE="jaja.events.all"`
- **THEN** a fila durável `jaja.events.all` existe, ligada a `jaja.events` com `#`, e recebe a mensagem

#### Scenario: Sem fila de inspeção
- **WHEN** o backend conecta com `RABBITMQ_INSPECTION_QUEUE` vazia
- **THEN** o backend declara só o exchange, sem nenhuma fila

### Requirement: Credenciais do broker fora dos logs
A URL de conexão (`RABBITMQ_URL`, padrão `amqp://jaja:jaja@localhost:5672`) contém usuário e senha e MUST NOT aparecer em logs nem em mensagens de erro, inteira ou em parte. Quando precisar identificar o broker, o backend MUST registrar só host e porta. O CLI MUST seguir a mesma regra ao exibir o endereço do broker.

#### Scenario: Aviso de broker indisponível
- **WHEN** o backend não consegue conectar a `amqp://usuario:s3nh4@localhost:5999`
- **THEN** o aviso cita `localhost:5999` e nenhum log ou mensagem de erro contém `s3nh4`

### Requirement: Serviço RabbitMQ no ambiente local
O `apps/backend/docker-compose.yml` SHALL ter o serviço `rabbitmq` (imagem `rabbitmq:4-management-alpine`, container `jaja-rabbitmq`, reinício `unless-stopped`) com usuário e senha de desenvolvimento `jaja`, porta AMQP publicada em `RABBITMQ_PORT` (padrão 5672), painel de gerenciamento em `RABBITMQ_MANAGEMENT_PORT` (padrão 15672), volume próprio para os dados e healthcheck. O backend SHALL ter os scripts `broker:start`, `broker:stop` e `broker:logs`, sem alterar os scripts `db:*`. O `apps/backend/.env.example` SHALL documentar `RABBITMQ_PORT`, `RABBITMQ_MANAGEMENT_PORT`, `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_INSPECTION_QUEUE`, `OUTBOX_RELAY_ENABLED`, `OUTBOX_POLL_INTERVAL_MS` e `OUTBOX_BATCH_SIZE`, sem credenciais reais.

#### Scenario: Subir o broker local
- **WHEN** o desenvolvedor roda `npm run broker:start --workspace=@jaja/backend`
- **THEN** o container `jaja-rabbitmq` fica saudável, o AMQP responde na porta 5672 e o painel em `http://localhost:15672` aceita o usuário e a senha `jaja`

#### Scenario: Porta configurada
- **WHEN** `RABBITMQ_PORT="5673"` está no `.env` do backend e o broker é iniciado
- **THEN** o AMQP é publicado na porta 5673 do host

#### Scenario: Parar o broker sem afetar o banco
- **WHEN** o desenvolvedor roda `npm run broker:stop --workspace=@jaja/backend`
- **THEN** o container `jaja-rabbitmq` para e o container `jaja-postgres` continua rodando

### Requirement: Comandos do broker no CLI
O CLI SHALL ter o menu `broker` ("Mensageria local") com:
- `broker:status`: estado do serviço `rabbitmq` no Docker Compose e as URLs do AMQP e do painel, com as portas de `RABBITMQ_PORT` e `RABBITMQ_MANAGEMENT_PORT` do `apps/backend/.env` (padrões 5672 e 15672), sem exibir senha;
- `broker:start`: sobe o serviço `rabbitmq` e aguarda o healthcheck;
- `broker:stop`: para só o serviço `rabbitmq`;
- `broker:logs`: acompanha os logs do serviço `rabbitmq`.

O `doctor` SHALL verificar se o RabbitMQ local responde, com resultado no máximo de aviso (nunca erro), já que o backend sobe sem ele, e o texto da verificação do Docker SHALL citar Postgres e RabbitMQ. O `apps/cli/README.md` SHALL documentar o menu `broker`.

#### Scenario: Status com broker parado
- **WHEN** o desenvolvedor roda `broker:status` com o serviço `rabbitmq` parado
- **THEN** o CLI informa que o serviço não está rodando, mostra `amqp://localhost:5672` e `http://localhost:15672` sem usuário nem senha e termina com aviso

#### Scenario: Subir pelo CLI
- **WHEN** o desenvolvedor roda `broker:start`
- **THEN** o CLI executa o Docker Compose para o serviço `rabbitmq`, espera o healthcheck ficar saudável e termina com sucesso

#### Scenario: Doctor com broker parado
- **WHEN** o desenvolvedor roda `doctor` com o RabbitMQ parado
- **THEN** a verificação do RabbitMQ aparece como aviso, com a dica de rodar `broker:start`, e não conta como erro
