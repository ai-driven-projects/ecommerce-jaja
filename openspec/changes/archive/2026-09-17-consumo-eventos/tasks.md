> **Execução:** dois subagentes separados, com contexto limpo, **nessa ordem**:
> - **Backend:** grupos 1–7;
> - **CLI:** grupos 8–9.
>
> Um grupo só começa depois de o anterior terminar com as validações passando.
>
> **Antes de começar:** conferir que os prompts 14 e 15 estão implementados (`apps/backend/src/messaging/` com o relay publicando e `POST /me/orders` gravando `order.placed`). Se não estiverem, parar e reportar.
>
> **Leitura prévia de cada subagente:**
> - todos: `.claude/skills/skills-standards.md`, o prompt `openspec/extras/prompts/16-consumo-eventos.md`, o `design.md` desta change e as referências de código da sua camada listadas no Contexto do prompt;
> - Backend, além disso: `packages/shared/src/messaging`, `packages/shared/src/events` e `packages/shared/src/db/transaction.manager.ts`.
>
> **Restrições:**
> - não alterar `packages/shared` nem `modules/*`;
> - não gravar credenciais reais em arquivos versionados (só os valores de desenvolvimento `jaja`);
> - o backend nunca lê `apps/cli`.
>
> Cada subagente encerra listando os arquivos criados/alterados e o resultado das validações. A conferência visual do painel do RabbitMQ (tarefa 7.5) exige login e fica para a conversa principal, com o usuário.

## 1. Ambiente e tabela de mensagens processadas (subagente Backend)

- [x] 1.1 Em `apps/backend/.env.example`, depois das variáveis do outbox, acrescentar com comentários `EVENT_CONSUMERS_ENABLED="true"` (`"false"` não assina filas), `EVENT_CONSUMER_PREFETCH="10"` (1 a 100) e `EVENT_CONSUMER_MAX_ATTEMPTS="5"` (1 a 20, contando a primeira). Copiar as mesmas chaves para o `apps/backend/.env` local (não versionado). Verificar com `git diff apps/backend/.env.example`: só as três chaves e os comentários.
- [x] 1.2 Em `apps/backend/prisma/models/messaging.model.prisma`, com a skill `backend-prisma-data`, criar o model `ProcessedMessage` (`@@map("processed_messages")`):
  - `consumer String`, `messageId String @db.Uuid @map("message_id")`, `messageType String @map("message_type")` e `processedAt DateTime @default(now()) @map("processed_at")`;
  - `@@id([consumer, messageId])` e `@@index([processedAt])`;
  - comentário acima do model: garante processar cada mensagem uma vez por consumidor, gravado na mesma transação do caso de uso e desfeito junto com a falha; a chave é composta porque o mesmo evento vai a vários consumidores; limpeza futura.

  Verificar com `npx prisma validate` em `apps/backend`.
- [x] 1.3 Rodar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name messaging_processed_messages` e depois `npm run prisma:generate --workspace=@jaja/backend`. Verificar que o `migration.sql` contém só `CREATE TABLE "processed_messages"` (com a chave primária composta) e o `CREATE INDEX`. Se aparecer outra alteração, removê-la antes de aplicar.

## 2. Peças compartilhadas e transação (subagente Backend)

- [x] 2.1 Criar `src/messaging/backoff.ts` com `backoffDelayMs(attempts)` (`2^(attempts - 1)` s em ms, com teto de 60 000) e fazer `outbox/outbox-backoff.ts` (`nextAttemptAt`) usá-la (Decisão 11). Verificar:
  - `backoff.spec.ts`: 1ª, 2ª e 3ª falha (1 000, 2 000, 4 000) e teto de 60 000 na 7ª e na 10ª;
  - `outbox-backoff.spec.ts` continua passando sem alteração.
- [x] 2.2 Mover `readInteger` de `outbox/outbox-relay.ts` para `src/messaging/config.util.ts` (exportado, mesmo comportamento) e usá-lo no relay. Verificar com `outbox-relay.spec.ts` passando sem alteração.
- [x] 2.3 Mover `redactCredentials` e `brokerAddress` de `rabbitmq/rabbitmq-message.publisher.ts` para `src/messaging/rabbitmq/rabbitmq-url.util.ts` (exportados) e usá-los no publisher (Decisão 8). Verificar com `rabbitmq-message.publisher.spec.ts` passando sem alteração, inclusive o teste de log sem senha.
- [x] 2.4 Em `src/messaging/messaging-errors.ts`, acrescentar `MESSAGE_INVALID`, `MESSAGE_SUBSCRIPTION_INVALID`, `EVENT_CONSUMER_INVALID` e `EVENT_CONSUMER_DUPLICATED`, cada um com um comentário. Verificar com `npx tsc --noEmit -p apps/backend`.
- [x] 2.5 Criar `src/db/active-transaction.manager.ts` com `ActiveTransactionManager<CTX>` (`implements TransactionManager<CTX>`, Decisão 3) e o comentário sobre o rollback ser de quem abriu a transação. Verificar com `active-transaction.manager.spec.ts`:
  - `runInTransaction` repassa o mesmo contexto e devolve o valor da operação;
  - não chama nenhum `$transaction`;
  - o erro lançado pela operação sobe sem ser capturado.
- [x] 2.6 Em `src/db/prisma.service.ts`, mover o `$disconnect` de `onModuleDestroy` para `onApplicationShutdown` (`implements OnApplicationShutdown`), com o comentário sobre a ordem dos hooks do Nest (Decisão 12). Verificar com `npx tsc --noEmit -p apps/backend`; o encerramento limpo é conferido na tarefa 7.4.

## 3. Causa e correlação no outbox (subagente Backend)

- [x] 3.1 Criar `src/messaging/consumer/message-causation.ts` (Decisão 5):
  - tipos `MessageCausation` (`causationId`, `correlationId`) e `ConsumerTransactionContext extends PrismaTransactionContext` (`causation`);
  - `causationOf(message)`: `correlationId` do `metadata` quando for texto não vazio, senão o `messageId`;
  - `readCausation(tx?)`: devolve a causa do contexto ou `null`.

  Verificar com `message-causation.spec.ts`: correlação herdada; ausente, vazia ou não texto vira o `messageId`; `readCausation` sem contexto, sem `causation` ou com formato inválido devolve `null`.
- [x] 3.2 Em `outbox/outbox-event.mapper.ts`, `toOutboxEventRow(event, causation?)` acrescenta `causationId` e `correlationId` ao `metadata` só quando as chaves estiverem ausentes; em `outbox/domain-event.prisma.ts`, `append` passa `readCausation(tx)`. Verificar com `outbox-event.mapper.spec.ts`:
  - sem causa, o `metadata` fica igual;
  - com causa, as duas chaves são acrescentadas e as demais mantidas;
  - `correlationId` já presente no evento é mantido;
  - os testes existentes continuam passando.

## 4. Registro, marca de processada e runner (subagente Backend)

- [x] 4.1 Criar `src/messaging/consumer/event-consumer.ts` com a interface `TransactionalEventConsumer` (`name`, `eventType`, `delayMs?`, `handle(message, transactionManager)`) e o JSDoc do prompt: formato do nome, troca de nome perde a fila e a idempotência, repassar o `transactionManager` ao caso de uso, e terminar com `ok` quando a mensagem não se aplica mais. Verificar com `npx tsc --noEmit -p apps/backend`.
- [x] 4.2 Criar `src/messaging/consumer/event-consumer.registry.ts` com `EventConsumerRegistry` (`register`, `list`, Decisão 9). O registro inválido lança `Error` com `EVENT_CONSUMER_INVALID` e o nome, e o repetido lança `EVENT_CONSUMER_DUPLICATED`. Verificar com `event-consumer.registry.spec.ts`:
  - registro válido aparece em `list()` na ordem;
  - nomes `approve-payment`, `Orders.approve`, `orders.` e vazio falham;
  - `eventType` vazio falha;
  - `delayMs` -1, 1,5 e 300 001 falham, e 0 e 300 000 passam;
  - nome repetido falha com `EVENT_CONSUMER_DUPLICATED`.
- [x] 4.3 Criar `src/messaging/consumer/processed-message.prisma.ts` com `ProcessedMessagePrisma.markProcessed(consumer, message, tx)` usando `$executeRaw` com `Prisma.sql` e `ON CONFLICT (consumer, message_id) DO NOTHING`. Devolve `true` quando insere e `false` no conflito, com o comentário sobre entregas simultâneas (Decisão 4). Verificar com `npx tsc --noEmit -p apps/backend`; o comportamento é coberto pelo e2e da tarefa 7.1.
- [x] 4.4 Criar `src/messaging/consumer/event-consumer.runner.ts` com `EventConsumerRunner` (`OnApplicationBootstrap`):
  - `EVENT_CONSUMERS_ENABLED`;
  - assinatura de cada consumidor com `jaja.<name>`, `[eventType]`, `delayMs` e `onMessage`, e o log `N consumidor(es) assinado(s)` ou de consumo desligado;
  - falha de `subscribe` lança erro;
  - `handle(consumer, message)` público numa única `PrismaService.runInTransaction`: contexto com causa → `markProcessed` → handler com `ActiveTransactionManager` → `Result.fail` vira `ResultError` lançado. Exceção vira `Result.fail`, sem rejeitar;
  - logs de processada, repetida (`debug`) e falha (`warn`), sem `payload` nem `metadata`.

  Verificar com `event-consumer.runner.spec.ts` (fakes de `PrismaService` com registro de rollback, `ProcessedMessagePrisma`, `MessageConsumer` e consumidor, `ConfigService` simples, `vi.spyOn(Logger.prototype, …)`):
  - desligado: nenhuma assinatura;
  - ligado: uma assinatura por consumidor com fila, routing keys e `delayMs` corretos;
  - sucesso: `'processed'`, handler chamado com `ActiveTransactionManager` sobre o mesmo contexto, com a causa;
  - repetida: `'duplicate'`, handler não chamado;
  - handler com `Result.fail`: rollback registrado e resultado com os códigos;
  - handler lança exceção: `Result.fail`, sem rejeitar;
  - nenhum log contém o `payload` nem o `metadata`.

## 5. Adapter RabbitMQ de consumo e módulo (subagente Backend)

- [x] 5.1 Criar `src/messaging/rabbitmq/broker-message.parser.ts` com `parseBrokerMessage(content)` (Decisão 7). Verificar com `broker-message.parser.spec.ts`:
  - mensagem válida com `occurredAt` como `Date`, e `metadata` ausente virando `{}`;
  - `MESSAGE_INVALID` para JSON inválido, `messageId` ausente ou que não é UUID, `type` vazio, `payload` ausente ou que não é objeto (array, texto, `null`), `metadata` que não é objeto e `occurredAt` inválido.
- [x] 5.2 Criar `src/messaging/rabbitmq/rabbitmq-message.consumer.ts` com `RabbitMqMessageConsumer` e o tipo `RabbitMqSubscription` (Decisões 6 e 8):
  - validação da assinatura e retorno sem esperar o broker;
  - conexão própria com reconexão agendada por `backoffDelayMs`, uma tentativa por vez, retomando todas as assinaturas;
  - canal de confirmação por assinatura com `prefetch`;
  - topologia: exchange, fila ligada às routing keys, `.wait` com dead-letter pelo exchange padrão e `.dead`;
  - fluxo de entrega na ordem do prompt: inválida → espera inicial → tentativa → `ack`, `.wait` ou `.dead`;
  - republicação confirmada antes do `ack`, e `nack` com requeue se a republicação falhar;
  - comentários sobre o TTL por mensagem e os argumentos fixos das filas;
  - logs só com host:porta, id, tipo e consumidor;
  - `onModuleDestroy` cancelando, esperando as mensagens em processamento e fechando.

  Verificar com `rabbitmq-message.consumer.spec.ts` (`vi.mock('amqplib')`, `vi.useFakeTimers`):
  - declara exchange, as três filas com os argumentos corretos, os binds e o `prefetch`;
  - assinatura com fila vazia, sem routing keys ou repetida → `MESSAGE_SUBSCRIPTION_INVALID`;
  - sucesso → `ack`;
  - falha na tentativa 1 de 5 → publica em `.wait` com `expiration` `"1000"`, `x-jaja-attempt` 2 e `x-jaja-last-error`, e o `ack` só vem depois da confirmação;
  - falha na tentativa 5 de 5 → `.dead` com `MAX_ATTEMPTS_EXCEEDED`;
  - exceção em `onMessage` conta como falha;
  - corpo inválido → `.dead` com `MESSAGE_INVALID`, sem chamar `onMessage`;
  - `delayMs` → a primeira entrega vai para `.wait` com `x-jaja-delayed`, e a seguinte (com o cabeçalho) chama `onMessage`;
  - republicação não confirmada → `nack` com requeue;
  - conexão recusada → `subscribe` ok, aviso sem a senha, e nova tentativa depois do tempo de espera, que assina as filas guardadas;
  - `close` da conexão → reconexão agendada;
  - `onModuleDestroy` cancela os consumidores e só fecha depois de a mensagem em processamento terminar.
- [x] 5.3 Em `src/messaging/messaging.module.ts`, registrar `ProcessedMessagePrisma`, `EventConsumerRegistry`, `EventConsumerRunner` e o provider de `MESSAGE_CONSUMER` (`useFactory` com `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `EVENT_CONSUMER_PREFETCH` e `EVENT_CONSUMER_MAX_ATTEMPTS` lidos com `readInteger`). Exportar `EventConsumerRegistry` e atualizar o comentário sobre trocar os dois providers. Em `src/messaging/index.ts`, exportar também `EventConsumerRegistry`, `TransactionalEventConsumer` e `MessageCausation`. Verificar:
  - `npm run build --workspace=@jaja/backend` sem erro;
  - `npm run dev --workspace=@jaja/backend` com o broker no ar registra `0 consumidor(es) assinado(s)`, o início do relay e nenhum aviso de conexão.

## 6. Testes do conjunto (subagente Backend)

- [x] 6.1 Rodar `npm run test --workspace=@jaja/backend` e `npm run lint --workspace=@jaja/backend`. Verificar que terminam sem erros e que os specs existentes do outbox e do publisher passam sem alteração de comportamento.

## 7. Integração e validação do backend (subagente Backend)

- [x] 7.1 Criar `apps/backend/test/messaging-consumer.e2e-spec.ts` (Decisão 13):
  - cabeçalho de pré-requisitos e `describe.runIf(process.env.MESSAGING_E2E === 'true')`;
  - `AppModule` com `OUTBOX_RELAY_ENABLED=false` e `EVENT_CONSUMER_MAX_ATTEMPTS=2`;
  - consumidores `messaging-test.echo` (modos `ok`, `fail-once` e `always-fail`, gravando `messaging.test-echoed` pelo `DomainEventPrisma` com o `transactionManager` recebido) e `messaging-test.delayed` (`delayMs: 1500`) registrados antes de `app.init()`;
  - espera por consulta ao banco e às filas, com timeout.

  Cenários:
  - processada: `processed_messages` com uma linha e o eco pendente com `causationId` e `correlationId` = id original;
  - correlação herdada: `correlationId = X` no original → eco com `X`;
  - repetida: a mesma mensagem publicada duas vezes com `amqplib` → uma linha processada e um eco;
  - nova tentativa: `fail-once` passa pela `.wait` e termina com um só eco;
  - descarte: `always-fail` em `.dead` com `MAX_ATTEMPTS_EXCEEDED` e `x-jaja-attempt = 2`, sem linha processada nem eco;
  - inválida: corpo que não é JSON publicado na fila → `.dead` com `MESSAGE_INVALID`;
  - espera inicial: `messaging-test.delayed` chamado ≥ 1,5 s depois da publicação;
  - `afterAll` apaga `processed_messages` com `consumer LIKE 'messaging-test.%'` e `outbox_events` com `aggregate_type = 'MessagingTest'`, exclui as filas `jaja.messaging-test.*` (inclusive `.wait` e `.dead`) e fecha app e conexão.

  Verificar:
  - com Postgres e RabbitMQ no ar e sem `npm run dev` rodando, `MESSAGING_E2E=true npm run test:e2e --workspace=@jaja/backend` passa, inclusive `messaging-outbox.e2e-spec.ts`;
  - sem a variável, os dois arquivos aparecem como ignorados e `app.e2e-spec.ts` passa.
- [x] 7.2 Rodar `npm run build --workspace=@jaja/backend`. Verificar que termina sem erros.
- [x] 7.3 Com `npm run dev --workspace=@jaja/backend` (porta 4000), o broker no ar e os seeds aplicados, confirmar um pedido pelo `apps/backend/src/modules/orders/test/order.integration.http` (cenário de sucesso). Verificar:
  - a resposta `201` com `status: "PLACED"`;
  - a linha `order.placed` em `outbox_events` fica `PUBLISHED`;
  - `curl -s -u jaja:jaja http://localhost:15672/api/queues/%2F/jaja.events.all` mostra a mensagem;
  - `curl -s -u jaja:jaja http://localhost:15672/api/connections` lista a conexão de publicação. Não há conexão de consumo aberta, porque não há assinaturas.
- [x] 7.4 Com o backend rodando:
  1. `npm run broker:stop --workspace=@jaja/backend`, e verificar que `curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/storefront/categories` responde `200` e que os avisos do log não contêm a senha;
  2. `npm run broker:start --workspace=@jaja/backend` e confirmar outro pedido, verificando que ele é publicado sem reiniciar o backend;
  3. encerrar o backend com Ctrl+C, verificando que o log não tem erro de Prisma desconectado nem exceção no encerramento.
- [ ] 7.5 **Pulada a pedido do usuário em 17/09/2026** (filas e cabeçalhos já conferidos pelo e2e e pela API do painel). (Conversa principal, com o usuário) Rodar o e2e com a limpeza das filas temporariamente comentada, ou pausar antes do `afterAll`. Abrir `http://localhost:15672`, entrar com `jaja`/`jaja` e conferir as filas `jaja.messaging-test.echo`, `.wait` e `.dead`, e a mensagem descartada com os cabeçalhos `x-jaja-*`. Verificar com captura de tela do painel e, depois, remover as filas de teste.

## 8. Comando `broker:queues` do CLI (subagente CLI)

- [x] 8.1 Em `apps/cli/src/commands/broker/lib.ts`, criar `readBrokerCredentials(env)` e `summarizeQueues(queues)` (Decisão 14). Verificar com `broker/lib.test.ts` (`node:test`):
  - credenciais tiradas de `RABBITMQ_URL`, padrão `jaja`/`jaja` sem a chave ou com URL inválida, e senha com caracteres codificados decodificada;
  - `summarizeQueues` agrupa `jaja.orders.approve-payment`, `.wait` e `.dead` numa linha do consumidor `orders.approve-payment`, mantém `jaja.events.all` à parte e lista as filas `.dead` com mensagens;
  - fila `.wait` ou `.dead` sem a principal ainda aparece no consumidor;
  - lista vazia não gera linhas.
- [x] 8.2 Em `apps/cli/src/commands/broker/broker.commands.ts`, criar `broker:queues` ("Filas do RabbitMQ", grupo "Mensageria", keywords `filas`, `queues`, `dead`, `descarte`), consultando `GET http://localhost:<RABBITMQ_MANAGEMENT_PORT>/api/queues/%2F` com autenticação básica e timeout curto:
  - tabela por consumidor com prontas, em processamento, na espera, descartadas e consumidores conectados;
  - fila de inspeção à parte;
  - `warn` com a dica `jaja broker:start` quando o painel não responder ou recusar a credencial;
  - `warn` "N mensagem(ns) descartada(s) em <fila>" com a dica do painel;
  - `ok` nos demais casos;
  - nenhuma saída com a senha.

  Incluir o comando no `brokerMenu`. Verificar com `npm test --workspace=@jaja/cli`: `index.test.ts` passa, com ids únicos.
- [x] 8.3 Atualizar `apps/cli/README.md` com `broker:queues` no menu `broker` e uma explicação curta das filas `jaja.<consumidor>`, `.wait` e `.dead`. Verificar com `grep -n "broker:queues\|\.wait\|\.dead" apps/cli/README.md`.

## 9. Validação do CLI (subagente CLI)

- [x] 9.1 Rodar `npm test --workspace=@jaja/cli` e `npm run build --workspace=@jaja/cli`. Verificar que os dois terminam sem erros.
- [x] 9.2 Executar em headless e verificar:
  1. `npm run cli -- broker:stop` e `npm run cli -- broker:queues`: aviso de painel sem resposta, com a dica `broker:start` e sem senha;
  2. `npm run cli -- broker:start` e `npm run cli -- broker:queues`: `ok`, com `jaja.events.all` listada à parte;
  3. criar com `curl -s -u jaja:jaja -X PUT -H 'content-type: application/json' -d '{"durable":true}' http://localhost:15672/api/queues/%2F/jaja.cli-test.check.dead` e publicar uma mensagem nela pelo `amq.default` (`POST /api/exchanges/%2F/amq.default/publish`). Rodar `npm run cli -- broker:queues` e conferir a linha `cli-test.check` com 1 descartada e o aviso "1 mensagem(ns) descartada(s) em jaja.cli-test.check.dead";
  4. apagar a fila de teste (`curl -s -u jaja:jaja -X DELETE http://localhost:15672/api/queues/%2F/jaja.cli-test.check.dead`) e conferir que `broker:queues` volta a `ok`.
