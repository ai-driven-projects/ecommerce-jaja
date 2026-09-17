## Purpose

Define o feed de eventos ao vivo do backend do Jaja: cada instância do backend recebe uma cópia de todos os eventos publicados, só para avisar telas abertas em tempo real, sem a garantia de entrega do consumo de negócio.

## ADDED Requirements

### Requirement: Cópia de todos os eventos por instância
Com o feed ligado, cada instância do backend SHALL assinar, ao iniciar, uma fila transitória própria com nome no formato `jaja.live.<host>.<pid>.<sufixo aleatório>` (só letras minúsculas, dígitos, ponto e hífen), ligada ao exchange de eventos com a chave `#`. Cada evento publicado MUST chegar a **todas** as instâncias com o feed ligado, e não só a uma delas. O feed MUST entregar cada mensagem recebida, em memória, a todos os interessados da própria instância, e o backend MUST registrar no log a fila assinada.

#### Scenario: Duas instâncias
- **WHEN** duas instâncias do backend estão rodando com o feed ligado e um evento é publicado
- **THEN** cada instância recebe a sua cópia do evento pela sua própria fila `jaja.live.*`

#### Scenario: Interessados na mesma instância
- **WHEN** duas conexões ao vivo abertas na mesma instância esperam eventos e um evento é publicado
- **THEN** as duas recebem o evento

### Requirement: Feed sem garantia de entrega
O feed SHALL servir só para avisos. Ele MUST NOT usar novas tentativas, fila de espera, fila de descarte nem registro de mensagens processadas, e cada mensagem MUST ser confirmada ao broker mesmo que um interessado falhe. A fila do feed MUST desaparecer quando a conexão da instância fecha. Mensagens publicadas enquanto a instância está sem conexão com o broker MUST ser perdidas pelo feed, sem afetar o outbox, os consumidores de negócio ou o estado dos pedidos. Ao reconectar, o feed MUST voltar a receber os eventos novos sem reiniciar o backend.

#### Scenario: Broker volta
- **WHEN** o RabbitMQ para e volta com o backend rodando
- **THEN** o feed volta a receber os eventos publicados depois da volta, e os eventos publicados durante a queda não chegam ao feed

#### Scenario: Backend encerrado
- **WHEN** a instância do backend é encerrada
- **THEN** a fila `jaja.live.*` dela deixa de existir no RabbitMQ

### Requirement: Feed desligável
Com `LIVE_EVENTS_ENABLED="false"`, o backend MUST NOT assinar a fila do feed, e as conexões ao vivo recebem só o sinal de vida. Ausente ou com outro valor, o feed fica ligado.

#### Scenario: Feed desligado
- **WHEN** o backend inicia com `LIVE_EVENTS_ENABLED="false"`
- **THEN** nenhuma fila `jaja.live.*` é criada, e um stream ao vivo aberto não recebe avisos de eventos
