# Outbox de Eventos (Event Outbox) Specification

## Purpose

Define como o backend do Jaja registra os eventos de domínio junto com o agregado (padrão outbox) e os publica depois no broker: gravação transacional, relay em intervalo, ordem, bloqueio entre relays, novas tentativas, entrega pelo menos uma vez e funcionamento com o broker fora do ar.

## Requirements

### Requirement: Eventos gravados na mesma transação do agregado
O backend SHALL oferecer aos casos de uso a porta de repositório de eventos de domínio do shared (`append(events, tx)`) para registrar os eventos pendentes de um agregado. Os eventos MUST ser gravados na transação recebida, a mesma em que o agregado é persistido: se a transação for confirmada, todos os eventos ficam registrados como pendentes; se for desfeita, nenhum evento fica registrado. Cada evento MUST ser gravado com `id`, `type`, `aggregateType`, `aggregateId`, `payload`, `metadata` e `occurredAt`, e datas dentro de `payload` ou `metadata` MUST ser gravadas como texto ISO 8601. Quando a transação recebida for a de um consumidor processando uma mensagem, o `metadata` gravado MUST receber `causationId` e `correlationId` dessa mensagem, mantendo essas chaves quando o evento já as tiver. Fora de um consumidor, o `metadata` MUST ser gravado como veio no evento. Uma lista vazia MUST terminar com sucesso sem acessar o banco. Os módulos de domínio MUST conhecer só a porta: o armazenamento (tabela, colunas, status e tentativas) é detalhe do backend e MUST poder mudar sem alterar `modules/*` nem `packages/shared`.

#### Scenario: Transação confirmada
- **WHEN** um caso de uso abre uma transação, persiste o agregado, registra dois eventos com `append` na mesma transação e a transação é confirmada
- **THEN** os dois eventos ficam registrados como pendentes, com zero tentativas e disponíveis para publicação imediata

#### Scenario: Transação desfeita
- **WHEN** um caso de uso registra eventos com `append` e, ainda dentro da transação, ocorre um erro que a desfaz
- **THEN** nenhum dos eventos fica registrado

#### Scenario: Lista vazia
- **WHEN** `append` é chamado com uma lista vazia
- **THEN** o resultado é sucesso e nada é gravado

#### Scenario: Datas no payload
- **WHEN** um evento com uma data no `payload` é registrado e depois lido para publicação
- **THEN** a data aparece no `payload` como texto ISO 8601

#### Scenario: Evento gravado dentro de um consumidor
- **WHEN** um caso de uso chamado por um consumidor que processa a mensagem `A` registra um evento sem `causationId` nem `correlationId` no `metadata`
- **THEN** o evento é gravado com `metadata.causationId = A` e `metadata.correlationId` igual ao da mensagem (ou `A`, se ela não tiver um), mantendo as demais chaves do `metadata`

#### Scenario: Metadata do evento prevalece
- **WHEN** um evento com `metadata.correlationId = X` é registrado dentro de um consumidor cuja mensagem tem `correlationId = Y`
- **THEN** o evento é gravado com `correlationId = X`

### Requirement: Gravação fora de transação recusada
O registro de eventos MUST exigir a transação do agregado. Chamar `append` com eventos e sem contexto de transação (ou com um contexto sem conexão transacional) MUST falhar com o código `MESSAGING_TRANSACTION_REQUIRED`, sem gravar nenhum evento.

#### Scenario: Sem transação
- **WHEN** `append` é chamado com um evento e sem o contexto de transação
- **THEN** o resultado é falha com `MESSAGING_TRANSACTION_REQUIRED` e o evento não é registrado

### Requirement: Relay em intervalo configurável e desligável
O backend SHALL publicar os eventos pendentes com um relay que roda em intervalo dentro do próprio processo, sem rota HTTP. A configuração MUST vir do ambiente:
- `OUTBOX_RELAY_ENABLED`: `"false"` desliga o relay; qualquer outro valor ou ausência o mantém ligado;
- `OUTBOX_POLL_INTERVAL_MS`: intervalo entre ciclos, padrão 1000, mínimo 100;
- `OUTBOX_BATCH_SIZE`: eventos por ciclo, padrão 50, entre 1 e 500.

Valor não numérico ou fora da faixa MUST voltar ao padrão. Ligado, o relay MUST começar ao iniciar a aplicação e registrar uma única vez no log o intervalo e o tamanho do lote. Um ciclo que começa enquanto o anterior ainda roda MUST terminar sem processar nada. Um erro inesperado em um ciclo MUST ser registrado no log sem interromper os ciclos seguintes. Ao encerrar a aplicação, o relay MUST parar de agendar ciclos e aguardar o ciclo em andamento terminar.

#### Scenario: Relay desligado
- **WHEN** o backend inicia com `OUTBOX_RELAY_ENABLED="false"`
- **THEN** nenhum ciclo é agendado e eventos pendentes continuam pendentes

#### Scenario: Valores inválidos
- **WHEN** o backend inicia com `OUTBOX_POLL_INTERVAL_MS="50"` e `OUTBOX_BATCH_SIZE="abc"`
- **THEN** o relay usa intervalo de 1000 ms e lote de 50 eventos

#### Scenario: Ciclos sem sobreposição
- **WHEN** um novo ciclo é disparado enquanto o anterior ainda está publicando
- **THEN** só o primeiro ciclo processa um lote

#### Scenario: Erro inesperado em um ciclo
- **WHEN** a leitura do banco lança um erro em um ciclo
- **THEN** o erro é registrado no log e o ciclo seguinte roda normalmente

### Requirement: Lote limitado e ordem de publicação
Cada ciclo MUST considerar só eventos pendentes cujo momento de disponibilidade já chegou, no máximo o tamanho do lote, ordenados por `occurredAt` e, no empate, por `id`. Os eventos do lote MUST ser publicados um de cada vez, nessa ordem, com a routing key igual ao `type` do evento. Cada evento publicado MUST passar a publicado, com o momento da publicação registrado, e MUST NOT ser lido de novo por ciclos seguintes.

#### Scenario: Lote maior que o limite
- **WHEN** há 120 eventos pendentes disponíveis e o lote é 50
- **THEN** o ciclo publica os 50 com `occurredAt` mais antigo, na ordem, e os outros 70 continuam pendentes

#### Scenario: Evento publicado
- **WHEN** um ciclo publica um evento com sucesso
- **THEN** o evento fica publicado com o momento da publicação e não é publicado de novo nos ciclos seguintes

#### Scenario: Evento ainda indisponível
- **WHEN** um evento pendente tem o momento de disponibilidade no futuro
- **THEN** o ciclo não o publica

### Requirement: Bloqueio de eventos entre relays
Vários relays (processos ou instâncias do backend) MUST poder rodar ao mesmo tempo sem publicar o mesmo evento em paralelo: um evento lido por um ciclo MUST ficar bloqueado para os outros até esse ciclo terminar, e os outros ciclos MUST seguir com os eventos não bloqueados, sem esperar.

#### Scenario: Dois relays simultâneos
- **WHEN** dois relays executam um ciclo ao mesmo tempo sobre os mesmos eventos pendentes
- **THEN** cada evento é publicado por no máximo um dos dois ciclos

### Requirement: Parada no primeiro erro e novas tentativas
Quando a publicação de um evento falhar (resultado de falha ou exceção), o ciclo MUST parar e MUST NOT tentar os eventos seguintes do lote, que continuam pendentes sem alteração. O evento que falhou MUST continuar pendente, com as tentativas somadas em 1, a mensagem do erro (truncada em 500 caracteres) e o momento de disponibilidade adiado. Após a falha de número `n`, a espera MUST ser de `2^(n-1)` segundos (1 s, 2 s, 4 s…), com teto de 60 s. Os eventos publicados antes da falha no mesmo ciclo MUST ficar publicados. O ciclo MUST informar quantos eventos publicou e quantos falharam.

#### Scenario: Falha no meio do lote
- **WHEN** um lote tem os eventos A, B e C, e a publicação de B falha
- **THEN** A fica publicado, B continua pendente com uma tentativa a mais, a mensagem do erro e disponibilidade adiada, C não é tentado e continua pendente, e o ciclo informa 1 publicado e 1 falha

#### Scenario: Espera crescente
- **WHEN** um evento falha pela 1ª, 2ª e 3ª vez
- **THEN** ele fica disponível de novo 1 s, 2 s e 4 s depois de cada falha, respectivamente

#### Scenario: Teto da espera
- **WHEN** um evento falha pela 10ª vez
- **THEN** ele fica disponível de novo 60 s depois da falha

#### Scenario: Mensagem de erro longa
- **WHEN** a publicação falha com uma mensagem de 2000 caracteres
- **THEN** o evento guarda só os primeiros 500 caracteres da mensagem

### Requirement: Entrega pelo menos uma vez
A publicação MUST garantir que todo evento registrado seja publicado pelo menos uma vez, mas MAY publicar o mesmo evento mais de uma vez: se o processo parar depois de o broker confirmar a mensagem e antes de o evento ser marcado como publicado, o evento MUST continuar pendente e ser publicado de novo. O identificador da mensagem (`messageId`) MUST ser sempre o `id` do evento. Os consumidores do backend MUST usar esse identificador para descartar repetições, de modo que cada evento produza efeito no máximo uma vez por consumidor.

#### Scenario: Queda depois da publicação
- **WHEN** o broker confirma a mensagem de um evento e o processo cai antes de marcar o evento como publicado
- **THEN** o evento continua pendente e é publicado de novo, com o mesmo `messageId`, quando um relay voltar a rodar

#### Scenario: Republicação não repete o efeito
- **WHEN** um evento já processado por um consumidor é publicado de novo com o mesmo `messageId`
- **THEN** o consumidor confirma a mensagem repetida sem executar o handler outra vez

### Requirement: Backend e relay funcionam com o broker fora do ar
A indisponibilidade do broker MUST NOT impedir o backend de iniciar nem de responder às rotas HTTP. Com o broker fora do ar, os ciclos do relay MUST registrar a falha como aviso e manter os eventos pendentes, com novas tentativas conforme a espera crescente. Quando o broker voltar, os eventos pendentes MUST ser publicados nos ciclos seguintes, sem reiniciar o backend.

#### Scenario: Subida sem broker
- **WHEN** o backend inicia com o RabbitMQ parado
- **THEN** a aplicação sobe, registra um aviso de broker indisponível e `GET /storefront/categories` responde normalmente

#### Scenario: Evento pendente com broker fora do ar
- **WHEN** o relay executa um ciclo com um evento pendente e o broker inacessível
- **THEN** o evento continua pendente com uma tentativa, a mensagem do erro e a disponibilidade no futuro

#### Scenario: Broker volta
- **WHEN** o RabbitMQ volta a responder com o backend rodando e há eventos pendentes disponíveis
- **THEN** um ciclo seguinte publica os eventos e os marca como publicados

### Requirement: Logs do relay sem dados do evento
O relay MUST registrar no log a quantidade de eventos publicados só nos ciclos em que publicou ao menos um (`N evento(s) publicado(s)`). Na falha, MUST registrar um aviso com o `id` e o `type` do evento e a mensagem do erro. Os logs do relay MUST NOT conter o `payload` nem o `metadata` dos eventos.

#### Scenario: Ciclo sem eventos
- **WHEN** um ciclo não encontra eventos pendentes disponíveis
- **THEN** nada é registrado no log

#### Scenario: Log de falha
- **WHEN** a publicação de um evento com `payload` `{ "email": "cliente@exemplo.com" }` falha
- **THEN** o aviso contém o `id`, o `type` e a mensagem do erro, e nenhum log contém `cliente@exemplo.com`
