## ADDED Requirements

### Requirement: Tipo das filas configurável
O adapter RabbitMQ SHALL ler `RABBITMQ_QUEUE_TYPE`, com os valores `classic` (padrão) ou `quorum`. Esse tipo MUST ser aplicado às três filas de cada assinatura `work` (`<fila>`, `<fila>.wait` e `<fila>.dead`) e à fila de inspeção. As filas de assinaturas `broadcast` MUST continuar `classic`, não duráveis e exclusivas, qualquer que seja o valor, porque uma fila `quorum` não pode ser exclusiva. O tipo MUST ser declarado sempre de forma explícita (`x-queue-type`), inclusive `classic` e inclusive nas filas `broadcast`, porque o broker pode ter outro tipo padrão: no Amazon MQ for RabbitMQ 4.2+, uma fila declarada sem tipo vira `quorum`. Um valor diferente de `classic` ou `quorum` MUST impedir o início da aplicação, com uma mensagem que cita a variável e os valores aceitos.

O comportamento das filas (espera por expiração por mensagem, retorno da `.wait` para `<fila>` por dead-letter, descarte, cabeçalhos de controle e confirmações) MUST ser o mesmo nos dois tipos. O tipo de uma fila não muda depois de criada: trocar `RABBITMQ_QUEUE_TYPE` num broker que já tem as filas exige apagá-las antes. Nesse caso, a declaração com tipo diferente MUST falhar com o erro da assinatura no log, sem expor credenciais. O `apps/backend/.env.example` SHALL documentar `RABBITMQ_QUEUE_TYPE="classic"`, com um comentário explicando quando usar `quorum` (broker em cluster) e a restrição de troca.

#### Scenario: Filas quorum
- **WHEN** o backend assina o consumidor `orders.approve-payment` com `RABBITMQ_QUEUE_TYPE="quorum"`
- **THEN** as filas `jaja.orders.approve-payment`, `jaja.orders.approve-payment.wait` e `jaja.orders.approve-payment.dead` são do tipo `quorum`, e a fila `jaja.live.<host>.<pid>.<sufixo>` continua `classic` e exclusiva

#### Scenario: Nova tentativa com quorum
- **WHEN** com `RABBITMQ_QUEUE_TYPE="quorum"` o processamento de uma mensagem falha uma vez e depois tem sucesso
- **THEN** a mensagem passa pela fila `.wait`, volta para a fila do consumidor depois da espera e é processada, como no tipo `classic`

#### Scenario: Valor inválido
- **WHEN** o backend inicia com `RABBITMQ_QUEUE_TYPE="stream"`
- **THEN** a aplicação não sobe, e o erro cita `RABBITMQ_QUEUE_TYPE` e os valores `classic` e `quorum`

#### Scenario: Padrão local
- **WHEN** o backend inicia sem `RABBITMQ_QUEUE_TYPE`
- **THEN** as filas são declaradas do tipo `classic`, e as filas que já existiam no broker local são aceitas sem erro

#### Scenario: Broker com padrão quorum
- **WHEN** o backend assina um consumidor com `RABBITMQ_QUEUE_TYPE="classic"` num broker cujo tipo padrão de fila é `quorum`
- **THEN** as filas do consumidor e a fila `broadcast` são criadas como `classic`

### Requirement: Conexão com TLS
O adapter SHALL aceitar URLs `amqps://` em `RABBITMQ_URL` e MUST então conectar com TLS, verificando o certificado do broker, na porta informada ou na 5671 por padrão. Uma URL `amqp://` MUST continuar conectando sem TLS na porta 5672 por padrão, como no ambiente local. Nos logs, o broker MUST continuar identificado só por host e porta, nos dois casos.

#### Scenario: Broker gerenciado
- **WHEN** `RABBITMQ_URL="amqps://usuario:senha@b-1234.mq.sa-east-1.amazonaws.com:5671"`
- **THEN** o backend publica e consome por TLS, e os logs citam só `b-1234.mq.sa-east-1.amazonaws.com:5671`

#### Scenario: Porta padrão do amqps
- **WHEN** `RABBITMQ_URL="amqps://usuario:senha@broker.exemplo"` não informa porta
- **THEN** o backend conecta com TLS na porta 5671
