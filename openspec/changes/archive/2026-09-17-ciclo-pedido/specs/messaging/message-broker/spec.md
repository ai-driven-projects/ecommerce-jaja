## MODIFIED Requirements

### Requirement: Serviço RabbitMQ no ambiente local
O `apps/backend/docker-compose.yml` SHALL ter o serviço `rabbitmq` (imagem `rabbitmq:4-management-alpine`, container `jaja-rabbitmq`, reinício `unless-stopped`) com:
- usuário e senha de desenvolvimento `jaja`;
- porta AMQP publicada em `RABBITMQ_PORT` (padrão 5672) e painel de gerenciamento em `RABBITMQ_MANAGEMENT_PORT` (padrão 15672);
- volume próprio para os dados e healthcheck.

O backend SHALL ter os scripts `broker:start`, `broker:stop` e `broker:logs`, sem alterar os scripts `db:*`. O `apps/backend/.env.example` SHALL documentar, sem credenciais reais: `RABBITMQ_PORT`, `RABBITMQ_MANAGEMENT_PORT`, `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_INSPECTION_QUEUE`, `OUTBOX_RELAY_ENABLED`, `OUTBOX_POLL_INTERVAL_MS`, `OUTBOX_BATCH_SIZE`, `EVENT_CONSUMERS_ENABLED`, `EVENT_CONSUMER_PREFETCH`, `EVENT_CONSUMER_MAX_ATTEMPTS` e `LIVE_EVENTS_ENABLED`.

#### Scenario: Subir o broker local
- **WHEN** o desenvolvedor roda `npm run broker:start --workspace=@jaja/backend`
- **THEN** o container `jaja-rabbitmq` fica saudável, o AMQP responde na porta 5672 e o painel em `http://localhost:15672` aceita o usuário e a senha `jaja`

#### Scenario: Porta configurada
- **WHEN** `RABBITMQ_PORT="5673"` está no `.env` do backend e o broker é iniciado
- **THEN** o AMQP é publicado na porta 5673 do host

#### Scenario: Parar o broker sem afetar o banco
- **WHEN** o desenvolvedor roda `npm run broker:stop --workspace=@jaja/backend`
- **THEN** o container `jaja-rabbitmq` para e o container `jaja-postgres` continua rodando

#### Scenario: Variáveis do consumo documentadas
- **WHEN** o desenvolvedor abre o `apps/backend/.env.example`
- **THEN** encontra `EVENT_CONSUMERS_ENABLED="true"`, `EVENT_CONSUMER_PREFETCH="10"` e `EVENT_CONSUMER_MAX_ATTEMPTS="5"`, cada uma com um comentário explicando o efeito e os limites

#### Scenario: Variável do feed ao vivo documentada
- **WHEN** o desenvolvedor abre o `apps/backend/.env.example`
- **THEN** encontra `LIVE_EVENTS_ENABLED="true"` com um comentário explicando que `"false"` desliga os avisos ao vivo

## ADDED Requirements

### Requirement: Assinatura transitória
O adapter de consumo SHALL aceitar uma assinatura **transitória**, para avisos que não precisam de garantia de entrega. Uma assinatura transitória MUST:
- declarar a fila como não durável, exclusiva da conexão e removida automaticamente ao fechar, ligada ao exchange de eventos com as routing keys pedidas;
- não declarar fila de espera nem de descarte;
- confirmar (ack) cada mensagem depois do processamento, qualquer que seja o resultado, registrando falhas e corpos inválidos só no log, sem `payload`;
- ser declarada de novo ao reconectar, sem recuperar as mensagens publicadas durante a queda.

Uma assinatura transitória com espera inicial MUST falhar com `MESSAGE_SUBSCRIPTION_INVALID`. As demais validações de assinatura continuam valendo.

#### Scenario: Fila transitória
- **WHEN** o backend assina `jaja.live.host1.4242.ab12cd` de forma transitória com a chave `#`
- **THEN** a fila existe como não durável e exclusiva, ligada a `jaja.events` com `#`, e não existem `jaja.live.host1.4242.ab12cd.wait` nem `.dead`

#### Scenario: Falha não repete a mensagem
- **WHEN** o processamento de uma mensagem numa assinatura transitória falha
- **THEN** a mensagem é confirmada, a falha vai para o log sem o `payload`, e a mensagem não é entregue de novo

#### Scenario: Espera inicial recusada
- **WHEN** uma assinatura transitória é pedida com espera inicial de 1 000 ms
- **THEN** a assinatura falha com `MESSAGE_SUBSCRIPTION_INVALID`
