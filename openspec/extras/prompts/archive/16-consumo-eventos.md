# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Backend: `apps/backend` (NestJS 12, ESM com imports relativos terminando em `.js`, testes com Vitest em `**/*.spec.ts` e `**/*.e2e-spec.ts` via `vitest.config.e2e.ts`). Shared: `@mentoria-360/shared` (submódulo em `packages/shared`, consumido via `dist`). Skills em `.claude/skills/*`; padrão de nomes em `.claude/skills/skills-standards.md`.
- **Pré-requisitos: os prompts 14 (`infra-mensageria`) e 15 (`pedido`) já implementados.** O backend tem `MessagingModule` (`apps/backend/src/messaging/`) com o outbox (`DomainEventPrisma`, `OutboxPrisma`), o `OutboxRelay` e o `RabbitMqMessagePublisher`, que publica no exchange `topic` `jaja.events` com routing key igual ao `type` do evento. `POST /me/orders` grava o pedido e o evento `order.placed` na mesma transação, e o evento chega à fila de inspeção `jaja.events.all`.
- **Objetivo:** criar a infraestrutura de **consumo** de eventos que os serviços simulados do fluxo de pedido vão usar no próximo prompt. Cada consumidor tem a própria fila ligada ao exchange pelo tipo do evento. Ele processa cada mensagem **uma única vez**, mesmo que ela chegue repetida: a marca de "processada", o caso de uso e os novos eventos gravados no outbox ficam **na mesma transação**. Falhas passam por novas tentativas com espera crescente; esgotadas as tentativas, a mensagem vai para uma fila de descarte. Esta funcionalidade entrega **só a infraestrutura**: nenhum consumidor de negócio é registrado, e a validação usa consumidores de teste.
- **Propósito didático:** o projeto ensina arquitetura orientada a eventos com o mínimo de complexidade. Este prompt fecha o ciclo "grava no outbox → publica → consome → grava no outbox", que é a base do fluxo de pedido. As filas de espera e de descarte ficam visíveis no painel do RabbitMQ, para que o aluno veja uma nova tentativa e um descarte acontecendo.
- **Contratos já existentes no shared (manter, sem alterar):**
  - `MessageConsumer`, `MESSAGE_CONSUMER` e `ConsumeMessageIn` (`src/messaging/message-consumer.ts`): `subscribe({ queue, routingKeys, onMessage }): Promise<Result<void>>`, com `onMessage(message: BrokerMessage): Promise<Result<void>>`. `EventConsumer` (`eventType`, `handle(message)`) existe, mas **não é usado**: o handler do backend precisa receber a transação, e o shared não muda;
  - `BrokerMessage` (`messageId`, `type`, `payload`, `metadata`, `occurredAt: Date`) e `domainEventToBrokerMessage` (`src/messaging`);
  - `DomainEvent`, `DomainEventRepository`, `TransactionManager` / `TransactionContext` (`src/db/transaction.manager.ts`), `Result` e `ResultError`.
- **Decisões de arquitetura:**
  - **Broker trocável também no consumo:** o backend consome sempre pela porta `MessageConsumer` (token `MESSAGE_CONSUMER`). O RabbitMQ é um adapter com **conexão própria**, separada da conexão de publicação (o RabbitMQ recomenda separar as duas: o controle de fluxo que bloqueia quem publica não pode parar quem consome). Filas de espera e de descarte são detalhe do adapter.
  - **Uma fila por consumidor:** a fila `jaja.<nome do consumidor>` é ligada ao exchange `jaja.events` com routing key igual ao tipo do evento. Dois consumidores do mesmo evento recebem cada um a sua cópia; duas instâncias do backend dividem as mensagens da mesma fila.
  - **Idempotência por consumidor:** a entrega é pelo menos uma vez (outbox e broker podem repetir). O consumidor grava `(consumidor, messageId)` na tabela `processed_messages` **na mesma transação** do caso de uso: se a linha já existe, a mensagem é repetida e é descartada sem chamar o handler. Qualquer falha desfaz tudo, inclusive a marca, e a mensagem volta a ser tentada.
  - **Transação reaproveitada:** o consumidor abre a transação e entrega ao handler um `TransactionManager` que **reaproveita a transação ativa** (`ActiveTransactionManager`), em vez de abrir outra. Os casos de uso continuam iguais (`runInTransaction` + `append(aggregate.pullEvents(), tx)`, como `PlaceOrder`) e não sabem se foram chamados por um controller ou por um consumidor.
  - **Causa e correlação:** os eventos gravados dentro de um consumidor recebem no `metadata` o `causationId` (o `messageId` da mensagem que os causou) e o `correlationId` (o da mensagem, ou o próprio `messageId` quando ela não tiver um). No próximo prompt, todos os eventos de um mesmo pedido terão o `correlationId` do `order.placed`. Quem preenche é o `DomainEventPrisma`, a partir do contexto da transação: `modules/*` não mudam.
  - **Novas tentativas e espera pelo broker:** nada de `setTimeout` segurando a mensagem nem a transação. Uma falha publica a mensagem na fila de espera `<fila>.wait` com `expiration` e confirma (ack) a original. Ao expirar, o RabbitMQ devolve a mensagem **direto à fila do consumidor** (dead-letter pelo exchange padrão), sem passar pelo `jaja.events`, então os outros consumidores não recebem cópia. A mesma fila atende a **espera inicial** opcional do consumidor (`delayMs`), que o próximo prompt usa para simular o tempo do pagamento, da separação e da entrega.
  - **Sem ordem garantida:** novas tentativas e consumo em paralelo (`prefetch`) podem inverter a ordem das mensagens. Os handlers conferem o estado do agregado antes de agir. Uma mensagem que não se aplica mais termina com sucesso (e registra no log) em vez de falhar.
- **Referências de código** (o código é a fonte da verdade do **padrão**; este prompt é a fonte da verdade das **regras**):
  - mensageria: `apps/backend/src/messaging/` inteiro, principalmente `rabbitmq/rabbitmq-message.publisher.ts` (conexão preguiçosa, `discard`, `redactCredentials`, `brokerAddress`, `closeQuietly`), `outbox/outbox-relay.ts` (`ConfigService`, `readInteger`, liga/desliga, logs sem payload, espera do ciclo ao desligar), `outbox/domain-event.prisma.ts`, `outbox/outbox-event.mapper.ts`, `outbox/outbox-backoff.ts`, `messaging-errors.ts`, `error-message.util.ts` e `messaging.module.ts`;
  - transação: `apps/backend/src/db/prisma.service.ts` (`PrismaTransactionContext`), `modules/orders/src/order/use-case/place-order.use-case.ts` (caso de uso com `runInTransaction` e `append`) e `modules/orders/test/mock/fake-transaction.manager.ts`;
  - testes: `outbox/*.spec.ts`, `rabbitmq/rabbitmq-message.publisher.spec.ts` (`vi.mock('amqplib')`, log sem senha) e `apps/backend/test/messaging-outbox.e2e-spec.ts` (`describe.runIf`, evento de teste que estende `AbstractDomainEvent`, fila temporária com `amqplib`, limpeza);
  - ambiente: `apps/backend/.env.example` e `apps/backend/docker-compose.yml`;
  - CLI: `apps/cli/src/commands/broker/broker.commands.ts`, `broker/lib.ts` (`readBackendEnv`, `readBrokerPorts`, `brokerUrls`), `broker/lib.test.ts`, `commands/index.ts` e `apps/cli/README.md`. O CLI se adapta à aplicação; o backend nunca lê `apps/cli`.
- **Ordem de desligamento:** o Nest executa `onModuleDestroy` dos módulos mais profundos primeiro, então o `PrismaService` (`DbModule`) pode desconectar antes de o relay e os consumidores terminarem o que está em andamento. Este prompt move o `$disconnect` para `onApplicationShutdown`, que roda depois de todos os `onModuleDestroy`.
- Spec desta funcionalidade: change `openspec/changes/consumo-eventos`, gerada a partir deste prompt. Em caso de dúvida sobre comportamento, valem as specs e o `design.md` da change.
- **Fora do escopo desta funcionalidade:**
  - consumidores de negócio (pagamento, separação, entrega), novos status e eventos do pedido, linha do tempo e SSE: ficam para o prompt 17 (`ciclo-pedido`);
  - reprocessar mensagens da fila de descarte (feito à mão pelo painel do RabbitMQ), limpeza periódica de `processed_messages` e tela de eventos no admin;
  - ordem garantida por agregado, filas quorum, cluster, processos separados de consumo e adapter em memória ou de outro broker;
  - limite de novas entregas feitas pelo próprio broker (mensagem que derruba o processo antes do ack);
  - frontend, `packages/shared` e `modules/*`.

# Backend

- **Ambiente** em `apps/backend/.env.example`, depois das variáveis do outbox, com comentários:
  - `EVENT_CONSUMERS_ENABLED="true"`: `"false"` não assina nenhuma fila (o backend continua publicando);
  - `EVENT_CONSUMER_PREFETCH="10"`: mensagens em processamento ao mesmo tempo por consumidor (1 a 100);
  - `EVENT_CONSUMER_MAX_ATTEMPTS="5"`: tentativas antes do descarte, contando a primeira (1 a 20).

- **Tabela de mensagens processadas** em `apps/backend/prisma/models/messaging.model.prisma` (skill: backend-prisma-data):
  - model `ProcessedMessage`, tabela `processed_messages`, colunas em snake_case via `@map`:
    - `consumer String`: nome do consumidor;
    - `messageId String @db.Uuid`: `messageId` da mensagem (o `id` do evento);
    - `messageType String`;
    - `processedAt DateTime @default(now())`;
    - `@@id([consumer, messageId])` e `@@index([processedAt])` (limpeza futura);
  - comentar acima do model: tabela interna do backend que garante processar cada mensagem uma vez por consumidor. A linha é gravada na mesma transação do caso de uso, e uma falha desfaz a marca junto. A chave é composta porque o mesmo evento é processado por vários consumidores. A tabela cresce com o uso, e a limpeza fica para depois.
- Executar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name messaging_processed_messages`, conferir que a migration só cria a tabela e o índice, e rodar `npm run prisma:generate --workspace=@jaja/backend`.

- **Transação** em `apps/backend/src/db/`:
  - `active-transaction.manager.ts`: `ActiveTransactionManager<CTX extends TransactionContext>` (`implements TransactionManager<CTX>`), construído com o contexto de uma transação já aberta. `runInTransaction(operation)` só executa `operation(context)`, sem abrir, confirmar nem desfazer nada: erro lançado sobe para quem abriu a transação. Comentar que o objetivo é deixar um caso de uso participar da transação de quem o chamou, e que o rollback é sempre de quem abriu a transação;
  - `prisma.service.ts`: mover o `$disconnect` de `onModuleDestroy` para `onApplicationShutdown` (implementando `OnApplicationShutdown`), com um comentário sobre a ordem dos hooks do Nest;
  - o `db` não tem `index.ts`: a mensageria importa `ActiveTransactionManager` pelo caminho relativo, como já faz com `prisma.service.js`.

- **Mensageria** em `apps/backend/src/messaging/` (arquivos em inglês; nomes de classe como abaixo):
  - `messaging-errors.ts`: acrescentar `MESSAGE_INVALID` (corpo que não é uma mensagem válida), `MESSAGE_SUBSCRIPTION_INVALID` (fila ou routing keys vazias, ou fila já assinada), `EVENT_CONSUMER_INVALID` (nome ou tipo de evento inválido no registro) e `EVENT_CONSUMER_DUPLICATED`.
  - `backoff.ts`: extrair de `outbox/outbox-backoff.ts` a função `backoffDelayMs(attempts: number): number` (`2^(attempts - 1)` segundos, teto de 60 s). `nextAttemptAt` passa a usá-la sem mudar de comportamento, e os testes do outbox continuam passando. Criar `backoff.spec.ts`.
  - `consumer/message-causation.ts`:
    - tipo `MessageCausation` (`causationId`, `correlationId`) e `ConsumerTransactionContext extends PrismaTransactionContext` com `causation: MessageCausation`;
    - `causationOf(message: BrokerMessage): MessageCausation`: `causationId = message.messageId`; `correlationId = metadata.correlationId` quando for texto não vazio, senão `message.messageId`;
    - `readCausation(tx?: TransactionContext): MessageCausation | null`: lê a causa do contexto sem depender do tipo concreto.
  - `outbox/outbox-event.mapper.ts`: `toOutboxEventRow(event, causation?)` acrescenta `causationId` e `correlationId` ao `metadata` gravado **só quando o evento ainda não tiver essas chaves** (o evento vence). Sem causa, nada muda.
  - `outbox/domain-event.prisma.ts`: `append(events, tx)` passa `readCausation(tx)` ao mapper. O resto do comportamento não muda (lista vazia, transação obrigatória).
  - `consumer/event-consumer.ts`: interface `TransactionalEventConsumer`, com JSDoc:
    - `name`: nome estável no formato `<módulo>.<ação>` em kebab-case (regex `^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$`, ex.: `orders.approve-payment`), que dá nome à fila e à marca de processada. Documentar que **trocar o nome cria outra fila e perde o histórico de idempotência**;
    - `eventType`: tipo do evento assinado (ex.: `order.placed`), igual à routing key;
    - `delayMs?`: espera antes da primeira tentativa (padrão 0, inteiro de 0 a 300 000);
    - `handle(message: BrokerMessage, transactionManager: TransactionManager): Promise<Result<void>>`: o `transactionManager` recebido reaproveita a transação do consumidor e deve ser repassado ao caso de uso. Falha ou exceção desfaz tudo e agenda nova tentativa; mensagem que não se aplica mais deve terminar com `Result.ok()`.
  - `consumer/event-consumer.registry.ts`: `EventConsumerRegistry` (`@Injectable()`):
    - `register(consumer)`: valida o nome pela regex, o `eventType` não vazio e o `delayMs`; em caso de erro, lança `Error` com `EVENT_CONSUMER_INVALID` e o nome. Nome repetido lança `EVENT_CONSUMER_DUPLICATED`. É erro de programação e deve impedir o backend de subir;
    - `list()`: consumidores na ordem de registro;
    - JSDoc: os módulos registram seus consumidores no `onModuleInit` (que o Nest executa em todos os módulos antes de qualquer `onApplicationBootstrap`), injetando o registro do `MessagingModule`.
  - `consumer/processed-message.prisma.ts`: `ProcessedMessagePrisma` (`@Injectable()`). `markProcessed(consumer: string, message: BrokerMessage, tx: PrismaTransactionContext): Promise<boolean>` grava com `$executeRaw` e `INSERT ... ON CONFLICT (consumer, message_id) DO NOTHING`. Devolve `true` quando inseriu e `false` quando a mensagem já tinha sido processada. Comentar que duas entregas simultâneas da mesma mensagem esperam uma pela outra na chave primária, e a segunda encontra o conflito depois do commit da primeira.
  - `consumer/event-consumer.runner.ts`: `EventConsumerRunner` (`@Injectable()`, `OnApplicationBootstrap`):
    - lê `EVENT_CONSUMERS_ENABLED` (`"false"` desliga; padrão ligado) com `ConfigService`;
    - ao iniciar, se ligado, assina cada consumidor do registro com `MessageConsumer.subscribe`: `queue = 'jaja.' + name`, `routingKeys = [eventType]`, `delayMs` e `onMessage = (message) => this.handle(consumer, message)`. Registra no log `N consumidor(es) assinado(s)`, ou que o consumo está desligado. Falha no `subscribe` lança erro, porque é erro de programação (fila vazia ou repetida);
    - `handle(consumer, message): Promise<Result<'processed' | 'duplicate'>>` (público para os testes), numa única `PrismaService.runInTransaction`:
      1. monta o contexto `ConsumerTransactionContext` com a causa (`causationOf(message)`);
      2. `markProcessed`: se devolver `false`, termina com `'duplicate'` sem chamar o handler;
      3. chama `consumer.handle(message, new ActiveTransactionManager(context))`;
      4. falha do `Result` lança `ResultError` com os códigos, desfazendo a transação inteira;
    - exceção vira `Result.fail` (códigos do `ResultError` ou `errorMessage`); nunca rejeita;
    - log: `Mensagem <messageId> (<type>) processada por <name>`; na repetida, `debug` com o mesmo texto e "já processada"; na falha, `warn` com id, tipo, consumidor e códigos, **nunca** o `payload` nem o `metadata`.
  - `rabbitmq/broker-message.parser.ts`: `parseBrokerMessage(content: Buffer): Result<BrokerMessage>`, função pura. Espera JSON com `messageId` (uuid), `type` (texto não vazio), `payload` e `metadata` (objetos; `metadata` ausente vira `{}`) e `occurredAt` (data ISO válida, convertida para `Date`). Qualquer outra coisa, inclusive JSON inválido, devolve `MESSAGE_INVALID`.
  - `rabbitmq/rabbitmq-message.consumer.ts`: `RabbitMqMessageConsumer` (`implements MessageConsumer`, `OnModuleDestroy`), construído com `{ url, exchange, prefetch, maxAttempts }`. `subscribe` aceita `RabbitMqSubscription` (`ConsumeMessageIn` com `delayMs?`), tipo exportado pelo adapter e usado pelo runner:
    - **validação:** `queue` vazia, `routingKeys` vazio ou fila já assinada → `Result.fail(MESSAGE_SUBSCRIPTION_INVALID)`; caso contrário, guarda a assinatura e devolve `Result.ok()` **sem esperar o broker**;
    - **conexão própria e preguiçosa:** conecta na primeira assinatura, com o mesmo timeout do publisher. Broker fora do ar nunca impede o backend de subir: registra aviso e tenta de novo com `backoffDelayMs` (sem limite de tentativas), e ao conectar retoma **todas** as assinaturas. `error`/`close` da conexão descartam o estado (como `discard` no publisher) e agendam a reconexão; uma só tentativa fica em andamento por vez;
    - **topologia por assinatura, num canal próprio** (`createConfirmChannel` + `prefetch(prefetch)`), para que um erro de canal derrube só aquela assinatura (que é refeita):
      - exchange `topic` durável (o mesmo do publisher);
      - fila `<queue>` durável, ligada ao exchange com cada routing key;
      - fila `<queue>.wait` durável, com `x-dead-letter-exchange: ''` e `x-dead-letter-routing-key: <queue>`, sem consumidores: a mensagem expirada volta direto para `<queue>`;
      - fila `<queue>.dead` durável, sem argumentos;
    - **entrega** (`noAck: false`), para cada mensagem:
      1. `parseBrokerMessage`; inválida → publica em `<queue>.dead` com o cabeçalho `x-jaja-dead-reason: MESSAGE_INVALID` e confirma a original;
      2. `delayMs > 0` e sem o cabeçalho `x-jaja-delayed` → publica em `<queue>.wait` com `expiration = delayMs` e `x-jaja-delayed: true` e confirma a original;
      3. tentativa atual = `x-jaja-attempt` (padrão 1); chama `onMessage`; exceção conta como falha;
      4. sucesso → `ack`;
      5. falha com tentativa `< maxAttempts` → publica em `<queue>.wait` com `expiration = backoffDelayMs(tentativa)`, `x-jaja-attempt = tentativa + 1` e `x-jaja-last-error` (códigos, até 500 caracteres) e confirma a original;
      6. falha na última tentativa → publica em `<queue>.dead` com `x-jaja-dead-reason: MAX_ATTEMPTS_EXCEEDED`, `x-jaja-attempt` e `x-jaja-last-error` e confirma a original;
    - as republicações usam o exchange padrão (`''`) com routing key igual ao nome da fila, preservam corpo, `messageId`, `type`, `timestamp`, `contentType` e os cabeçalhos anteriores, são `persistent` e **aguardam a confirmação do broker antes do `ack`**. Se a republicação falhar, `nack` com `requeue: true`, e a mensagem é entregue de novo;
    - comentar a limitação do TTL por mensagem: a mensagem só expira quando chega ao início da fila de espera. Uma espera longa pode atrasar uma curta que esteja atrás dela, o que é aceitável aqui;
    - log: conexão (só host e porta), assinatura (`Consumindo <queue> (<routing keys>)`), nova tentativa (`warn` com id, tipo, tentativa e espera) e descarte (`error` com id, tipo e motivo), **nunca** o payload, a URL ou a senha (reaproveitar `redactCredentials`/`brokerAddress`, extraídos para `rabbitmq/rabbitmq-url.util.ts` e usados pelo publisher e pelo consumer);
    - `onModuleDestroy`: para de agendar reconexão, cancela os consumidores (`channel.cancel`), **aguarda as mensagens em processamento terminarem** e fecha canais e conexão.
  - `messaging.module.ts`:
    - `providers`: acrescentar `ProcessedMessagePrisma`, `EventConsumerRegistry`, `EventConsumerRunner` e `{ provide: MESSAGE_CONSUMER, inject: [ConfigService], useFactory }`, criando o `RabbitMqMessageConsumer` a partir de `RABBITMQ_URL`, `RABBITMQ_EXCHANGE` (mesmos padrões do publisher), `EVENT_CONSUMER_PREFETCH` (padrão 10, de 1 a 100) e `EVENT_CONSUMER_MAX_ATTEMPTS` (padrão 5, de 1 a 20). Valores inválidos voltam ao padrão; mover `readInteger` para `messaging/config.util.ts` e usá-lo também no relay;
    - `exports`: acrescentar `EventConsumerRegistry`;
    - atualizar o comentário do módulo: trocar de broker é trocar os providers de `MESSAGE_PUBLISHER` e `MESSAGE_CONSUMER`.
  - `index.ts`: exportar também `EventConsumerRegistry`, o tipo `TransactionalEventConsumer` e `MessageCausation`.

- **Testes unitários** (Vitest, ao lado dos arquivos):
  - `backoff.spec.ts`: 1 s, 2 s, 4 s e teto de 60 s; `outbox-backoff.spec.ts` continua passando;
  - `active-transaction.manager.spec.ts`: repassa o mesmo contexto, não abre transação e deixa o erro lançado subir;
  - `message-causation.spec.ts`: `correlationId` herdado do `metadata`; ausente ou vazio vira o `messageId`; `readCausation` sem contexto ou sem causa devolve `null`;
  - `outbox-event.mapper.spec.ts`: acrescentar a causa gravada no `metadata`, sem sobrescrever chaves do evento;
  - `event-consumer.registry.spec.ts`: registro válido; nome sem ponto, com maiúscula ou vazio; `eventType` vazio; `delayMs` negativo ou acima do limite; nome repetido; `list()` na ordem;
  - `event-consumer.runner.spec.ts` (fakes de `PrismaService`, `ProcessedMessagePrisma`, `MessageConsumer` e consumidor):
    - desligado: nenhuma assinatura;
    - ligado: uma assinatura por consumidor com `jaja.<name>`, `[eventType]` e `delayMs`;
    - `handle` com sucesso: marca, chama o handler com um `ActiveTransactionManager` sobre o mesmo contexto, e o contexto traz a causa;
    - repetida: handler não chamado, resultado `'duplicate'`;
    - handler com `Result.fail`: a transação é desfeita (o fake registra o rollback) e o resultado traz os códigos;
    - handler lança exceção: `Result.fail`, sem rejeitar;
    - nenhum log contém o payload;
  - `broker-message.parser.spec.ts`: mensagem válida (com `occurredAt` como `Date` e `metadata` ausente virando `{}`); JSON inválido; `messageId` ausente ou que não é uuid; `type` vazio; `payload` que não é objeto; `occurredAt` inválido;
  - `rabbitmq-message.consumer.spec.ts` (`vi.mock('amqplib')`):
    - declara exchange, fila, `.wait` (com os argumentos de dead-letter) e `.dead`, liga as routing keys e aplica o `prefetch`;
    - assinatura inválida ou repetida → `MESSAGE_SUBSCRIPTION_INVALID`;
    - sucesso → `ack`;
    - falha na tentativa 1 de 5 → publica em `.wait` com `expiration` 1000 e `x-jaja-attempt` 2, espera a confirmação e só então faz o `ack`;
    - falha na última tentativa → `.dead` com `MAX_ATTEMPTS_EXCEEDED`;
    - mensagem inválida → `.dead` com `MESSAGE_INVALID`, sem chamar `onMessage`;
    - `delayMs` → primeira entrega vai para `.wait` com `x-jaja-delayed`, e a segunda (com o cabeçalho) chama `onMessage`;
    - republicação sem confirmação → `nack` com `requeue`;
    - broker fora do ar → `subscribe` devolve ok, registra aviso sem a senha e reconecta depois, retomando as assinaturas;
    - `onModuleDestroy` cancela os consumidores e espera a mensagem em processamento.
- **Teste de integração** `apps/backend/test/messaging-consumer.e2e-spec.ts`, com `describe.runIf(process.env.MESSAGING_E2E === 'true')` e o cabeçalho de pré-requisitos no padrão de `messaging-outbox.e2e-spec.ts` (Postgres e RabbitMQ rodando, migrations aplicadas, nenhum `npm run dev` do backend rodando):
  - monta o `AppModule` com `OUTBOX_RELAY_ENABLED=false` e `EVENT_CONSUMER_MAX_ATTEMPTS=2`. **Antes de `app.init()`**, registra no `EventConsumerRegistry` dois consumidores de teste:
    - `messaging-test.echo` (`messaging.test-event`): conforme `payload.mode`: `ok` grava pelo `DomainEventPrisma` um evento `messaging.test-echoed` (`aggregateType: 'MessagingTest'`) com o `transactionManager` recebido; `fail-once` grava o evento e falha na primeira vez que vê aquele `messageId`, e dá certo na segunda; `always-fail` grava o evento e sempre falha;
    - `messaging-test.delayed` (`messaging.test-delayed`, `delayMs: 1500`): só registra o horário em que foi chamado;
  - publica as mensagens de teste pelo caminho real (`runInTransaction` + `append` + `OutboxRelay.runOnce()`) e, nos casos de repetição e de corpo inválido, direto no exchange/fila com `amqplib`. Espera o resultado consultando o banco e as filas, com timeout.

  Cenários:
  - **processada:** o evento `ok` gera uma linha em `processed_messages` e um `messaging.test-echoed` pendente no outbox com `metadata.causationId` = id do evento original e `metadata.correlationId` = o mesmo id;
  - **correlação herdada:** evento original com `metadata.correlationId = X` gera o eco com `correlationId = X`;
  - **repetida:** a mesma mensagem publicada duas vezes (mesmo `messageId`) gera uma única linha processada e um único eco;
  - **nova tentativa:** `fail-once` passa por `jaja.messaging-test.echo.wait` e termina processada, com **um só** eco (o da tentativa que falhou foi desfeito);
  - **descarte:** `always-fail` termina em `jaja.messaging-test.echo.dead` com `x-jaja-dead-reason = MAX_ATTEMPTS_EXCEEDED` e `x-jaja-attempt = 2`, sem linha processada e sem eco;
  - **inválida:** um corpo que não é JSON publicado na fila do consumidor vai para `.dead` com `MESSAGE_INVALID`;
  - **espera inicial:** `messaging-test.delayed` é chamado pelo menos 1,5 s depois da publicação;
  - ao final: apagar as linhas de `processed_messages` com `consumer LIKE 'messaging-test.%'` e as de `outbox_events` com `aggregate_type = 'MessagingTest'`, e excluir as filas `jaja.messaging-test.*` (inclusive `.wait` e `.dead`).
- `messaging-outbox.e2e-spec.ts` continua passando.

- Validação:
  - `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` sem erros;
  - `npm run broker:start --workspace=@jaja/backend`, depois `MESSAGING_E2E=true npm run test:e2e --workspace=@jaja/backend` passando;
  - subir o backend (`npm run dev --workspace=@jaja/backend`, porta 4000): o log mostra `0 consumidor(es) assinado(s)` (nenhum de negócio ainda), e `POST /me/orders` continua gravando e publicando `order.placed` como no prompt 15;
  - parar o RabbitMQ com o backend rodando e subir de novo: o backend continua respondendo, e o consumo e a publicação voltam sozinhos;
  - `Ctrl+C` no backend encerra sem erro de Prisma desconectado no log.

# CLI

- Em `broker/lib.ts`, com testes em `broker/lib.test.ts`:
  - `readBrokerCredentials(env)`: usuário e senha tirados de `RABBITMQ_URL` do `apps/backend/.env` (padrão `jaja`/`jaja`), só para autenticar na API do painel e **nunca** exibidos;
  - `summarizeQueues(queues)`: função pura que recebe a lista da API (`name`, `messages_ready`, `messages_unacknowledged`, `consumers`) e agrupa por consumidor (`jaja.<nome>`, `.wait` e `.dead`), mantendo `jaja.events.all` à parte, e devolve as linhas da tabela e a lista de filas `.dead` com mensagens.
- Criar `broker:queues` ("Filas do RabbitMQ") no menu `broker`: consulta `GET http://localhost:<RABBITMQ_MANAGEMENT_PORT>/api/queues/%2F` com autenticação básica e mostra, por consumidor, mensagens prontas, em processamento, na espera e descartadas, e o número de consumidores conectados:
  - painel fora do ar ou credencial recusada → aviso com a dica `jaja broker:start` (sem mostrar a senha);
  - alguma fila `.dead` com mensagens → aviso `N mensagem(ns) descartada(s) em <fila>`, com a dica de inspecionar pelo painel;
  - senão → sucesso.
- Atualizar `apps/cli/README.md` com `broker:queues` e a explicação curta das filas `<fila>`, `.wait` e `.dead`.
- Validação: `npm test --workspace=@jaja/cli` e `npm run build --workspace=@jaja/cli` sem erros; executar `broker:queues` com o broker parado (aviso) e, depois do e2e sem a limpeza das filas ou com o backend rodando, com o broker no ar.

# Specs da change

- Nova capability `messaging/event-consumer`:
  - consumidores registrados no backend com nome estável, tipo do evento e espera inicial opcional; registro inválido ou repetido impede o backend de subir;
  - uma fila durável por consumidor, ligada ao exchange pelo tipo do evento;
  - processamento uma única vez por consumidor (`processed_messages`), com a marca, o caso de uso e os novos eventos na mesma transação; falha desfaz tudo;
  - caso de uso reaproveitando a transação do consumidor, sem saber quem o chamou;
  - `causationId` e `correlationId` nos eventos gravados por um consumidor;
  - novas tentativas com espera crescente pela fila `.wait`, voltando só para a fila do consumidor; descarte em `.dead` depois do limite ou com mensagem inválida;
  - sem ordem garantida entre mensagens;
  - consumo desligável, backend sobe e continua com o broker fora do ar, reconexão retoma as assinaturas, desligamento espera as mensagens em processamento;
  - logs sem payload, metadata ou credenciais.
- Em `messaging/message-broker`:
  - alterar "Publicação pela porta de mensagens com broker trocável": o consumo também passa por uma porta (`MESSAGE_CONSUMER`), e trocar de broker é trocar os dois providers;
  - alterar "Conexão preguiçosa e reconexão": o consumo usa conexão própria, com reconexão automática e espera crescente, sem depender de uma publicação;
  - adicionar "Filas de consumo, espera e descarte": nomes `jaja.<consumidor>`, `.wait` com dead-letter para a fila do consumidor, `.dead`, cabeçalhos `x-jaja-attempt`, `x-jaja-delayed`, `x-jaja-last-error` e `x-jaja-dead-reason`, republicação confirmada antes do `ack`;
  - alterar "Comandos do broker no CLI": acrescentar `broker:queues`.
- Em `messaging/event-outbox`:
  - alterar "Entrega pelo menos uma vez": os consumidores descartam repetições pelo `messageId`, por consumidor;
  - alterar "Eventos gravados na mesma transação do agregado": dentro de um consumidor, o `metadata` gravado recebe `causationId` e `correlationId` sem sobrescrever as chaves do evento.

> Obs: IMPORTANTE!!! Executar as duas partes (Backend e CLI) em subagentes separados, cada um com contexto limpo, de forma sequencial (o CLI depende das filas criadas pelo backend para a validação manual). Antes de começar, conferir que os prompts 14 e 15 estão implementados (`apps/backend/src/messaging/` com o relay publicando e `POST /me/orders` gravando `order.placed`); se não estiverem, parar e reportar. Cada subagente deve ler `.claude/skills/skills-standards.md` e, antes de criar seus arquivos, as referências de código da sua camada listadas no Contexto. O do backend deve ler também os contratos do shared listados no Contexto (`packages/shared/src/messaging`, `src/events`, `src/db/transaction.manager.ts`) e não pode alterar `packages/shared` nem `modules/*`. Nenhum subagente deve gravar credenciais reais em arquivos versionados. Uma parte só começa depois de a anterior terminar com as validações passando, e cada subagente encerra listando os arquivos criados ou alterados e o resultado das validações.
