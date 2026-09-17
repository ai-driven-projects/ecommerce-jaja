# Consumidor de Eventos (Event Consumer) Specification

## Purpose

Define como o backend do Jaja consome os eventos publicados no broker. Cobre o registro de consumidores, a fila por consumidor, o processamento uma única vez na mesma transação do caso de uso, a causa e a correlação dos eventos gerados, as novas tentativas, o descarte, a espera inicial e o funcionamento com o broker fora do ar.

## Requirements

### Requirement: Registro de consumidores
O backend SHALL permitir que os módulos registrem consumidores de eventos antes de a aplicação terminar de iniciar. Cada consumidor MUST declarar:
- um nome estável no formato `<módulo>.<ação>`, com segmentos em minúsculas, dígitos e hífen, separados por ponto e começando por letra (ex.: `orders.approve-payment`);
- o tipo do evento assinado, não vazio;
- opcionalmente, uma espera inicial em milissegundos, inteira de 0 a 300 000 (padrão 0);
- o handler, que recebe a mensagem e um gerenciador de transação.

Registro com nome, tipo ou espera inválidos MUST falhar com `EVENT_CONSUMER_INVALID`, e nome repetido MUST falhar com `EVENT_CONSUMER_DUPLICATED`. Nos dois casos, o backend MUST NOT terminar de iniciar.

#### Scenario: Consumidor válido
- **WHEN** um módulo registra o consumidor `orders.approve-payment` para o evento `order.placed`
- **THEN** o registro é aceito e o consumidor passa a ser assinado quando a aplicação iniciar

#### Scenario: Nome inválido
- **WHEN** um módulo registra um consumidor com o nome `ApprovePayment`
- **THEN** o registro falha com `EVENT_CONSUMER_INVALID` e o backend não termina de iniciar

#### Scenario: Nome repetido
- **WHEN** dois consumidores são registrados com o nome `orders.approve-payment`
- **THEN** o segundo registro falha com `EVENT_CONSUMER_DUPLICATED` e o backend não termina de iniciar

#### Scenario: Espera fora do limite
- **WHEN** um consumidor é registrado com espera inicial de -1 ou de 300 001 ms
- **THEN** o registro falha com `EVENT_CONSUMER_INVALID`

### Requirement: Fila própria por consumidor
Ao iniciar, com o consumo ligado, o backend MUST assinar cada consumidor registrado numa fila durável com o nome `jaja.<nome do consumidor>`, ligada ao exchange de eventos com routing key igual ao tipo do evento assinado. Cada consumidor MUST receber a própria cópia de cada evento do tipo assinado, independentemente dos outros consumidores do mesmo tipo. Várias instâncias do backend MUST dividir as mensagens da mesma fila. O backend MUST registrar no log quantos consumidores assinou.

#### Scenario: Dois consumidores do mesmo evento
- **WHEN** os consumidores `orders.approve-payment` e `orders.notify-customer` assinam `order.placed` e um evento `order.placed` é publicado
- **THEN** as filas `jaja.orders.approve-payment` e `jaja.orders.notify-customer` recebem cada uma a sua cópia da mensagem

#### Scenario: Sem consumidores registrados
- **WHEN** o backend inicia sem nenhum consumidor registrado
- **THEN** nenhuma fila de consumo é criada e o log informa zero consumidores assinados

### Requirement: Processamento uma única vez por consumidor
Cada mensagem MUST produzir efeito no máximo uma vez por consumidor, mesmo quando entregue mais de uma vez. O backend MUST registrar o par (consumidor, `messageId`) como processado **na mesma transação** em que o handler executa. Uma mensagem cujo par já está registrado MUST ser confirmada ao broker sem chamar o handler. Duas entregas simultâneas da mesma mensagem ao mesmo consumidor MUST resultar em uma única execução com efeito. A mesma mensagem MUST ser processada normalmente por consumidores diferentes.

#### Scenario: Mensagem repetida
- **WHEN** a mesma mensagem (mesmo `messageId`) chega duas vezes à fila de um consumidor
- **THEN** o handler produz efeito uma única vez, há um único registro de processada e as duas entregas são confirmadas

#### Scenario: Mesmo evento, consumidores diferentes
- **WHEN** um evento é processado pelo consumidor A e depois chega ao consumidor B
- **THEN** o consumidor B processa normalmente, e cada consumidor fica com o seu registro de processada

### Requirement: Transação única e reaproveitada pelo caso de uso
O backend MUST abrir uma transação para cada mensagem e entregar ao handler um gerenciador de transação que **reaproveita essa transação**, em vez de abrir outra. Um caso de uso chamado pelo handler com esse gerenciador MUST gravar o agregado e os eventos no outbox dentro da transação do consumidor, sem nenhuma mudança no caso de uso. Se o handler terminar com falha ou lançar exceção, MUST ser desfeito tudo o que foi gravado na transação: a marca de processada, as alterações do caso de uso e os eventos do outbox.

#### Scenario: Handler com sucesso
- **WHEN** o handler chama um caso de uso que persiste um agregado e registra um evento no outbox
- **THEN** a marca de processada, o agregado e o evento pendente são confirmados juntos

#### Scenario: Handler falha depois de gravar
- **WHEN** o handler grava um evento no outbox e termina com falha
- **THEN** nada fica gravado (nem a marca de processada nem o evento) e a mensagem segue para nova tentativa

#### Scenario: Handler lança exceção
- **WHEN** o handler lança uma exceção
- **THEN** a transação é desfeita, a exceção é tratada como falha e o consumo das próximas mensagens continua

### Requirement: Causa e correlação dos eventos gerados
Todo evento registrado no outbox durante o processamento de uma mensagem MUST receber no `metadata` o `causationId`, igual ao `messageId` da mensagem, e o `correlationId`, igual ao `correlationId` do `metadata` da mensagem quando for um texto não vazio e, caso contrário, ao `messageId` da mensagem. Chaves `causationId` ou `correlationId` já presentes no `metadata` do evento MUST ser mantidas. Eventos registrados fora de um consumidor MUST NOT receber essas chaves.

#### Scenario: Primeira mensagem da cadeia
- **WHEN** um consumidor processa uma mensagem com `messageId` `A` e sem `correlationId`, e grava um novo evento
- **THEN** o novo evento é gravado com `causationId = A` e `correlationId = A`

#### Scenario: Correlação herdada
- **WHEN** um consumidor processa uma mensagem com `messageId` `B` e `metadata.correlationId = A`, e grava um novo evento
- **THEN** o novo evento é gravado com `causationId = B` e `correlationId = A`

#### Scenario: Evento fora de consumidor
- **WHEN** um caso de uso chamado por um controller HTTP grava um evento
- **THEN** o `metadata` do evento não recebe `causationId` nem `correlationId`

### Requirement: Novas tentativas com espera crescente
Uma mensagem cujo processamento falhar MUST ser tentada de novo depois de uma espera de `2^(tentativa - 1)` segundos, com teto de 60 s (1 s depois da primeira falha, 2 s depois da segunda, e assim por diante), até o limite de tentativas de `EVENT_CONSUMER_MAX_ATTEMPTS` (padrão 5, de 1 a 20; valores inválidos voltam ao padrão), contando a primeira. A espera MUST acontecer no broker, sem manter a mensagem nem a transação abertas no backend. A mensagem devolvida depois da espera MUST voltar só à fila do consumidor que falhou, sem ser entregue de novo aos outros consumidores. Enquanto espera, a mensagem MUST NOT impedir o consumo das demais.

#### Scenario: Falha seguida de sucesso
- **WHEN** o handler falha na primeira tentativa de uma mensagem e tem sucesso na segunda
- **THEN** a mensagem volta à fila do consumidor cerca de 1 s depois, é processada, e fica gravado só o efeito da segunda tentativa

#### Scenario: Outros consumidores não recebem de novo
- **WHEN** o consumidor A falha numa mensagem que o consumidor B já processou
- **THEN** a nova tentativa chega só à fila de A

### Requirement: Descarte de mensagens
Uma mensagem MUST ser movida para a fila de descarte do consumidor, e deixar de ser tentada, quando:
- falhar na última tentativa permitida (motivo `MAX_ATTEMPTS_EXCEEDED`, com o número de tentativas e o último erro);
- o corpo não for uma mensagem válida (motivo `MESSAGE_INVALID`), sem chamar o handler.

É válida a mensagem com JSON, `messageId` UUID, `type` não vazio, `payload` objeto, `metadata` objeto ou ausente e `occurredAt` com data ISO 8601 válida. Uma mensagem descartada MUST NOT deixar registro de processada nem efeito do handler, e MUST continuar disponível para inspeção.

#### Scenario: Tentativas esgotadas
- **WHEN** o handler falha em todas as tentativas de uma mensagem com `EVENT_CONSUMER_MAX_ATTEMPTS=2`
- **THEN** a mensagem fica na fila de descarte do consumidor com o motivo `MAX_ATTEMPTS_EXCEEDED`, 2 tentativas e o último erro, sem registro de processada

#### Scenario: Corpo inválido
- **WHEN** chega à fila de um consumidor uma mensagem cujo corpo não é JSON
- **THEN** a mensagem vai direto para a fila de descarte com o motivo `MESSAGE_INVALID`, sem chamar o handler

### Requirement: Espera inicial opcional
Um consumidor com espera inicial maior que zero MUST começar a processar cada mensagem só depois de decorrida essa espera, contada da chegada da mensagem à sua fila. A espera MUST acontecer no broker e MUST ser aplicada uma única vez por mensagem, sem se repetir nas novas tentativas. Consumidores sem espera MUST processar a mensagem assim que ela chega.

#### Scenario: Consumidor com espera
- **WHEN** um consumidor com espera inicial de 1 500 ms recebe uma mensagem
- **THEN** o handler é chamado pelo menos 1,5 s depois da chegada da mensagem

### Requirement: Ordem não garantida
O consumo MUST NOT garantir a ordem de processamento entre mensagens, nem entre mensagens do mesmo agregado: novas tentativas, espera inicial e processamento em paralelo de até `EVENT_CONSUMER_PREFETCH` mensagens por consumidor (padrão 10, de 1 a 100; valores inválidos voltam ao padrão) podem inverter a ordem. Um handler que receber uma mensagem que não se aplica mais ao estado atual SHALL terminar com sucesso, registrando o motivo no log, em vez de falhar.

#### Scenario: Mensagem que não se aplica mais
- **WHEN** um handler recebe uma mensagem cuja ação já não faz sentido no estado atual do agregado e termina com sucesso
- **THEN** a mensagem é registrada como processada e não é tentada de novo

### Requirement: Consumo desligável e resiliente ao broker
Com `EVENT_CONSUMERS_ENABLED="false"`, o backend MUST NOT assinar nenhuma fila e MUST continuar publicando eventos normalmente; ausente ou com outro valor, o consumo fica ligado. O backend MUST iniciar e atender rotas HTTP com o broker fora do ar. Nesse caso, MUST registrar um aviso e tentar reconectar com espera crescente (teto de 60 s), sem limite de tentativas. Ao reconectar, depois de o broker voltar ou de a conexão cair, MUST retomar todas as assinaturas sem reiniciar o backend. O consumo MUST usar uma conexão separada da publicação. Ao desligar a aplicação, o backend MUST parar de receber mensagens, aguardar as que estão em processamento terminarem e só então encerrar as conexões com o broker e com o banco.

#### Scenario: Consumo desligado
- **WHEN** o backend inicia com `EVENT_CONSUMERS_ENABLED="false"` e consumidores registrados
- **THEN** nenhuma fila é assinada, o log informa que o consumo está desligado e os eventos continuam sendo publicados

#### Scenario: Broker volta depois do início
- **WHEN** o backend inicia com o RabbitMQ parado e o RabbitMQ é iniciado depois
- **THEN** o backend responde às rotas HTTP desde o início e, quando o broker volta, assina as filas dos consumidores sem reiniciar

#### Scenario: Desligamento com mensagem em processamento
- **WHEN** a aplicação é encerrada enquanto um handler está processando uma mensagem
- **THEN** o handler termina, a mensagem é confirmada ou devolvida conforme o resultado, e só depois as conexões com o broker e com o banco são fechadas, sem erro de conexão encerrada no log

### Requirement: Logs do consumo sem dados sensíveis
Os logs do consumo MUST registrar a assinatura de cada fila, as mensagens processadas, as repetidas descartadas, as novas tentativas (com a tentativa e a espera) e os descartes (com o motivo), identificando a mensagem só por `messageId`, `type` e nome do consumidor. Os logs MUST NOT conter o `payload`, o `metadata`, a URL do broker nem as credenciais; a conexão MUST ser identificada só por host e porta.

#### Scenario: Falha no handler
- **WHEN** o handler falha ao processar uma mensagem com dados pessoais no `payload`
- **THEN** o aviso no log traz o `messageId`, o `type`, o consumidor e os códigos de erro, sem nenhum dado do `payload` ou do `metadata`

#### Scenario: Broker indisponível
- **WHEN** o consumo tenta conectar com a URL `amqp://jaja:jaja@localhost:5672` e o broker está parado
- **THEN** o aviso no log cita `localhost:5672` e não contém o usuário nem a senha
