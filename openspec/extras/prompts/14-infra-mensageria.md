# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Backend: `apps/backend` (NestJS 12, ESM com imports relativos terminando em `.js`, testes com Vitest em `**/*.spec.ts` e `**/*.e2e-spec.ts` via `vitest.config.e2e.ts`). Shared: `@mentoria-360/shared` (submódulo em `packages/shared`, consumido via `dist`). Skills em `.claude/skills/*`; padrão de nomes em `.claude/skills/skills-standards.md`.
- **Objetivo:** criar a infraestrutura de mensageria que o checkout orientado a eventos vai usar nos próximos prompts. Um caso de uso grava os eventos de domínio **na mesma transação** do agregado (padrão outbox), e um processo dentro do backend lê esses eventos de tempos em tempos e os publica no RabbitMQ. Esta funcionalidade entrega **só a publicação**: nenhum consumidor, fila de negócio ou evento de domínio real é criado aqui.
- **Propósito didático:** o projeto ensina arquitetura orientada a eventos com o mínimo de complexidade. O outbox entra direto, como a solução adotada (sem versão "antes e depois").
- **Contratos já existentes no shared (manter, sem alterar):**
  - `AggregateRoot` (`src/base/aggregate-root.ts`): `addEvent` (protected), `hasEvents`, `peekEvents`, `pullEvents`, `clearEvents`. Os eventos pendentes acompanham o clone em `cloneWith` (a instância anterior mantém os seus), então um método de comportamento imutável adiciona o evento na instância devolvida (`next.instance.addEvent(...)`);
  - `DomainEvent` / `AbstractDomainEvent` (`src/events`): `id`, `type`, `aggregateType`, `aggregateId`, `payload`, `metadata`, `occurredAt`;
  - `DomainEventRepository` (`src/events/domain-event.repository.ts`): `append(events: DomainEvent[], tx?: TransactionContext): Promise<Result<void>>`, a porta que os casos de uso usam para gravar eventos;
  - `DomainEventStatus` (`PENDING`, `PUBLISHED`) e `OutboxEvent`;
  - `TransactionManager` / `TransactionContext` (`src/db/transaction.manager.ts`);
  - `MessagePublisher`, `MESSAGE_PUBLISHER`, `BrokerMessage`, `PublishMessageIn`, `PublishMessageOptions` (`src/messaging/message-publisher.ts`) e `domainEventToBrokerMessage` (`src/messaging/domain-event-to-broker-message.ts`, que copia `aggregateId` e `aggregateType` para dentro do `payload`);
  - `MessageConsumer`, `MESSAGE_CONSUMER` e `EventConsumer` existem, mas **não são usados nesta funcionalidade**.
- **Decisões de arquitetura:**
  - **Outbox encapsulado no backend:** os módulos de domínio (`modules/*`) só conhecem `DomainEventRepository`. Tabela, colunas, status e tentativas são detalhes do backend e podem mudar sem afetar os módulos.
  - **Gravação explícita no caso de uso:** o caso de uso abre a transação com `TransactionManager.runInTransaction`, persiste o agregado e chama `append(aggregate.pullEvents(), tx)`, como em `modules/auth/src/app/use-case/create-user.use-case.ts` (erro lançado dentro do callback desfaz a transação). Nenhum caso de uso usa isso ainda: o primeiro será o do pedido.
  - **Broker trocável:** o backend publica sempre por `MessagePublisher` (token `MESSAGE_PUBLISHER`). O RabbitMQ é um adapter; trocar de broker é trocar esse provider. Os termos `exchange`/`routingKey`/`queue` de `PublishMessageOptions` são interpretados de forma genérica: `routingKey` é o `type` do evento.
  - **Relay não é controller HTTP:** é um provider Nest que roda em intervalo dentro do próprio processo do backend.
- **Referências de código** (o código é a fonte da verdade do **padrão**; este prompt é a fonte da verdade das **regras**):
  - transação e client: `apps/backend/src/db/prisma.service.ts` (`PrismaTransactionContext` com `client`), `apps/backend/src/db/db.module.ts` e `apps/backend/src/modules/orders/cart.prisma.ts` (uso do `tx` recebido, `Result.tryAsync`, `$queryRaw` com `Prisma.sql`);
  - provider escolhido por configuração com `useFactory` + `ConfigService` e aviso único no log: `apps/backend/src/modules/stores/stores.module.ts` e `geocoding-provider.token.ts`;
  - testes Vitest com `vi.stubGlobal`/`vi.spyOn(Logger.prototype, ...)` e conferência de que segredo não vai para o log: `apps/backend/src/modules/stores/google-geocoding.provider.spec.ts`;
  - e2e: `apps/backend/test/app.e2e-spec.ts`;
  - Docker e ambiente: `apps/backend/docker-compose.yml` (Postgres na porta do host `DB_PORT`, 5433 por padrão) e `apps/backend/.env.example`;
  - CLI: `apps/cli/src/commands/db/db.commands.ts`, `apps/cli/src/commands/db/lib.ts` (`compose(ctx, args)`), `apps/cli/src/commands/doctor/checks.ts` e `apps/cli/README.md`. O CLI se adapta à aplicação; o backend nunca lê `apps/cli`.
- `ConfigModule` já é global (`apps/backend/src/shared/shared.module.ts`). `main.ts` ainda não chama `app.enableShutdownHooks()`. As portas 5672 e 15672 estão livres na máquina de desenvolvimento, mas continuam configuráveis pelo `.env`.
- Spec desta funcionalidade: change `openspec/changes/infra-mensageria`, gerada a partir deste prompt. Em caso de dúvida sobre comportamento, valem as specs e o `design.md` da change.
- **Fora do escopo desta funcionalidade:**
  - consumidores: `MessageConsumer`, filas por consumidor, tabela de mensagens processadas (idempotência), reaproveitamento da transação ativa entre consumidor e caso de uso;
  - eventos de negócio, agregado de pedido, contratos de eventos entre módulos, delay dos serviços simulados (a coluna `available_at` fica pronta, mas nada a adia além das novas tentativas);
  - adapter em memória ou de outro broker, processos separados, tela de eventos no admin, frontend;
  - alterações em `packages/shared` e em `modules/*`.

# Backend

- **Docker e ambiente:**
  - em `apps/backend/docker-compose.yml`, adicionar o serviço `rabbitmq` (`rabbitmq:4-management-alpine`, `container_name: jaja-rabbitmq`, `restart: unless-stopped`), com `RABBITMQ_DEFAULT_USER`/`RABBITMQ_DEFAULT_PASS` = `jaja`, portas `${RABBITMQ_PORT:-5672}:5672` (AMQP) e `${RABBITMQ_MANAGEMENT_PORT:-15672}:15672` (painel), volume `rabbitmq_data` e healthcheck `rabbitmq-diagnostics -q ping`. Comentar a função de cada porta, como no Postgres;
  - em `apps/backend/package.json`, scripts `broker:start` (`docker compose up -d rabbitmq`), `broker:stop` (`docker compose stop rabbitmq`) e `broker:logs` (`docker compose logs -f rabbitmq`), sem mudar os scripts `db:*`;
  - em `apps/backend/.env.example`, com comentários: `RABBITMQ_PORT="5672"`, `RABBITMQ_MANAGEMENT_PORT="15672"`, `RABBITMQ_URL="amqp://jaja:jaja@localhost:5672"`, `RABBITMQ_EXCHANGE="jaja.events"`, `RABBITMQ_INSPECTION_QUEUE="jaja.events.all"` (só para desenvolvimento: fila que recebe cópia de todos os eventos para inspeção no painel; vazia, não é criada), `OUTBOX_RELAY_ENABLED="true"`, `OUTBOX_POLL_INTERVAL_MS="1000"` e `OUTBOX_BATCH_SIZE="50"`;
  - instalar `amqplib` e `@types/amqplib` no `@jaja/backend`.

- **Tabela do outbox** em `apps/backend/prisma/models/messaging.model.prisma` (skill: backend-prisma-data):
  - model `OutboxEvent`, tabela `outbox_events`, colunas em snake_case via `@map`:
    - `id String @id @db.Uuid` — o `id` do evento de domínio;
    - `type String`, `aggregateType String`, `aggregateId String @db.Uuid`;
    - `payload Json` e `metadata Json` (`jsonb`);
    - `occurredAt DateTime`;
    - `status String @default("PENDING")` — valores de `DomainEventStatus`;
    - `attempts Int @default(0)`, `availableAt DateTime @default(now())`, `publishedAt DateTime?`, `lastError String?` e `createdAt DateTime @default(now())`;
    - `@@index([status, availableAt])` (leitura do relay) e `@@index([aggregateType, aggregateId])` (consultas futuras por agregado);
  - comentar acima do model: tabela interna do backend que implementa `DomainEventRepository` (os módulos não a conhecem); o evento é gravado na mesma transação do agregado e publicado depois pelo relay; `available_at` controla quando o evento pode ser publicado (hoje só adiado nas novas tentativas).
- Executar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name messaging_outbox`, conferir que a migration só cria a tabela e os índices, e `npm run prisma:generate --workspace=@jaja/backend`.

- **Mensageria** em `apps/backend/src/messaging/` (arquivos em inglês; nomes de classe como abaixo):
  - `messaging-errors.ts` — `MessagingErrors` (objeto `as const`): `MESSAGING_TRANSACTION_REQUIRED`, `MESSAGE_BROKER_UNAVAILABLE` e `MESSAGE_PUBLISH_FAILED`.
  - `outbox/outbox-event.mapper.ts` — funções puras:
    - `toOutboxEventRow(event: DomainEvent)`: `id`, `type`, `aggregateType`, `aggregateId`, `payload`, `metadata` e `occurredAt` (datas dentro do `payload`/`metadata` viram texto ISO no JSON);
    - `toDomainEvent(row)`: devolve um objeto que satisfaz `DomainEvent` a partir da linha lida, para ser convertido por `domainEventToBrokerMessage`.
  - `outbox/outbox-backoff.ts` — `nextAttemptAt(attempts: number, now: Date): Date`: espera de `2^(attempts - 1)` segundos após a falha de número `attempts` (1 s, 2 s, 4 s…), com teto de 60 s.
  - `outbox/domain-event.prisma.ts` — `DomainEventPrisma` (`@Injectable()`, `implements DomainEventRepository`):
    - `append(events, tx)` com `Result.tryAsync`;
    - lista vazia termina ok sem ir ao banco;
    - **sem `tx`** (ou sem `client` no contexto) falha com `MESSAGING_TRANSACTION_REQUIRED`, sem gravar: fora da transação do agregado o outbox perde a garantia;
    - grava com `createMany` no `client` da transação recebida, usando `toOutboxEventRow` (status, tentativas e `available_at` ficam com os padrões do banco).
  - `outbox/outbox.prisma.ts` — `OutboxPrisma` (`@Injectable()`), acesso do relay à tabela: `processPendingBatch(limit, publish)`, que numa única transação:
    1. seleciona com `$queryRaw` até `limit` linhas com `status = 'PENDING' AND available_at <= now()`, ordenadas por `occurred_at` e `id`, com `FOR UPDATE SKIP LOCKED` (vários relays nunca publicam a mesma linha ao mesmo tempo);
    2. chama `publish(events)` com as linhas convertidas por `toDomainEvent`;
    3. marca os ids publicados como `PUBLISHED` com `published_at = now()`;
    4. para o id que falhou: `attempts + 1`, `last_error` (mensagem truncada em 500 caracteres) e `available_at = nextAttemptAt(attempts + 1, now)`, mantendo `PENDING`;
    5. devolve `{ published: number; failed: number }`.

    Comentar que a transação fica aberta durante a publicação do lote (aceitável com lotes pequenos) e que a entrega é **pelo menos uma vez**: se o processo cair depois de publicar e antes do commit, o evento é publicado de novo, e os consumidores futuros precisarão ser idempotentes.
  - `outbox/publish-in-order.ts` — `publishInOrder(events: DomainEvent[], publisher: MessagePublisher): Promise<{ publishedIds: string[]; failure: { id: string; error: string } | null }>`: publica um de cada vez, na ordem, com `domainEventToBrokerMessage(event)` e `options.routingKey = event.type`; **para no primeiro erro** (falha do `Result` ou exceção), sem tentar os seguintes, para não inverter a ordem dos eventos de um mesmo agregado.
  - `outbox/outbox-relay.ts` — `OutboxRelay` (`@Injectable()`, `OnApplicationBootstrap`, `OnModuleDestroy`):
    - lê `OUTBOX_RELAY_ENABLED` (`"false"` desliga; padrão ligado), `OUTBOX_POLL_INTERVAL_MS` (padrão 1000, mínimo 100) e `OUTBOX_BATCH_SIZE` (padrão 50, entre 1 e 500) com `ConfigService`; valores inválidos voltam ao padrão;
    - ao iniciar a aplicação, se ligado, agenda `runOnce()` com `setInterval` e registra uma vez no log o intervalo e o tamanho do lote;
    - `runOnce(): Promise<{ published: number; failed: number }>` é público (usado nos testes): chama `OutboxPrisma.processPendingBatch(batchSize, (events) => publishInOrder(events, publisher))`; se um ciclo ainda estiver rodando, o novo ciclo termina sem fazer nada (sem sobreposição); qualquer exceção do ciclo é registrada e não derruba o intervalo;
    - log: `N evento(s) publicado(s)` só quando `published > 0`; na falha, `warn` com o `id` e o `type` do evento e a mensagem de erro, **nunca** o `payload`;
    - ao desligar, cancela o intervalo e aguarda o ciclo em andamento terminar.
  - `rabbitmq/rabbitmq-message.publisher.ts` — `RabbitMqMessagePublisher` (`implements MessagePublisher`, `OnModuleDestroy`), construído com `{ url, exchange, inspectionQueue }`:
    - **conexão preguiçosa:** conecta na primeira publicação (e tenta uma vez ao iniciar o módulo, só registrando aviso se falhar). Abre um canal com confirmação (`createConfirmChannel`), declara o exchange `topic` durável e, com `inspectionQueue` preenchida, declara a fila durável e a liga ao exchange com `#`;
    - **backend não depende do broker para subir:** RabbitMQ fora do ar nunca impede o backend de iniciar nem de responder às rotas HTTP; os eventos continuam `PENDING` e são publicados quando o broker voltar;
    - **reconexão:** eventos `error`/`close` da conexão ou do canal descartam a conexão atual, e a próxima publicação reconecta; conexões simultâneas são evitadas reaproveitando a mesma tentativa em andamento;
    - `publish({ message, options })`: publica no exchange com `routingKey = options?.routingKey ?? message.type`, corpo JSON (`messageId`, `type`, `payload`, `metadata`, `occurredAt` em ISO) e propriedades `persistent: true`, `contentType: 'application/json'`, `messageId`, `type`, `timestamp` (segundos), `appId: 'jaja-backend'` e `headers` de `options`; aguarda a confirmação do broker; conexão indisponível → `Result.fail(MESSAGE_BROKER_UNAVAILABLE)`; recusa ou erro na publicação → `Result.fail(MESSAGE_PUBLISH_FAILED)`;
    - **segredo:** a URL contém usuário e senha e **nunca** aparece em logs nem em mensagens de erro (registrar só host e porta);
    - `onModuleDestroy` fecha canal e conexão.
  - `messaging.module.ts` — `MessagingModule` (importa `DbModule`):
    - `providers`: `DomainEventPrisma`, `OutboxPrisma`, `OutboxRelay` e `{ provide: MESSAGE_PUBLISHER, inject: [ConfigService], useFactory }` criando o `RabbitMqMessagePublisher` a partir de `RABBITMQ_URL` (padrão `amqp://jaja:jaja@localhost:5672`), `RABBITMQ_EXCHANGE` (padrão `jaja.events`) e `RABBITMQ_INSPECTION_QUEUE` (vazio = sem fila de inspeção), como em `stores.module.ts`;
    - `exports`: `DomainEventPrisma` (para os controllers passarem aos casos de uso, como já fazem com os adapters `*.prisma.ts`) e `MESSAGE_PUBLISHER`;
    - comentar no módulo que trocar de broker é trocar só o provider de `MESSAGE_PUBLISHER`.
  - `index.ts` exportando o módulo, `DomainEventPrisma` e `MessagingErrors`.
- Importar `MessagingModule` em `apps/backend/src/app.module.ts` e chamar `app.enableShutdownHooks()` em `main.ts`, para o relay e a conexão fecharem ao parar o processo.

- **Testes unitários** (Vitest, ao lado dos arquivos):
  - `outbox-event.mapper.spec.ts`: evento → linha preserva todos os campos; linha → `DomainEvent` → `domainEventToBrokerMessage` gera `messageId` = id do evento, `type` e `payload` com `aggregateId`/`aggregateType`;
  - `outbox-backoff.spec.ts`: 1ª, 2ª, 3ª falha (1 s, 2 s, 4 s) e teto de 60 s;
  - `publish-in-order.spec.ts` (publisher falso): publica todos na ordem com `routingKey` = `type`; falha do `Result` no segundo evento para sem chamar o terceiro; exceção conta como falha; lista vazia não chama o publisher;
  - `outbox-relay.spec.ts` (`OutboxPrisma` e publisher falsos, `ConfigService` simples): `runOnce` repassa o tamanho do lote e devolve as contagens; dois `runOnce` simultâneos processam um só lote; com `OUTBOX_RELAY_ENABLED=false` nenhum intervalo é agendado; o log de falha não contém o `payload`;
  - `rabbitmq-message.publisher.spec.ts` (`vi.mock('amqplib')`): declara o exchange `topic` durável; com fila de inspeção, declara e liga com `#`; publica com `routingKey`, `persistent`, `messageId` e `contentType` corretos e aguarda confirmação; falha de conexão → `MESSAGE_BROKER_UNAVAILABLE` e a próxima chamada tenta reconectar; nenhum log contém a senha da URL.
- **Teste de integração** `apps/backend/test/messaging-outbox.e2e-spec.ts` (roda com `npm run test:e2e --workspace=@jaja/backend`), com `describe.runIf(process.env.MESSAGING_E2E === 'true')` e um cabeçalho explicando os pré-requisitos (Postgres e RabbitMQ do `docker-compose.yml` rodando e migration aplicada). Monta o `AppModule` com `OUTBOX_RELAY_ENABLED=false`, usa um evento de teste que estende `AbstractDomainEvent` (`type: 'messaging.test-event'`, `aggregateType: 'MessagingTest'`) e, antes de publicar, liga ao exchange uma fila exclusiva e temporária do próprio teste (com `amqplib`) com a routing key `messaging.test-event`. Cenários:
  - `runInTransaction` + `append` com commit grava as linhas `PENDING`;
  - erro lançado dentro da transação depois do `append` não grava nada;
  - `append` sem `tx` falha com `MESSAGING_TRANSACTION_REQUIRED`;
  - `OutboxRelay.runOnce()` publica: a fila do teste recebe a mensagem com o mesmo `messageId`, `type` e `payload`, e a linha fica `PUBLISHED` com `published_at`;
  - com um `OutboxRelay` montado sobre um `RabbitMqMessagePublisher` apontando para uma porta sem broker, `runOnce()` mantém a linha `PENDING`, com `attempts = 1`, `last_error` e `available_at` no futuro;
  - ao final, apagar as linhas com `aggregate_type = 'MessagingTest'`.

- Validação:
  - `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` sem erros;
  - `npm run broker:start --workspace=@jaja/backend`, depois `MESSAGING_E2E=true npm run test:e2e --workspace=@jaja/backend` passando;
  - subir o backend (`npm run dev --workspace=@jaja/backend`, porta 4000) e conferir no painel `http://localhost:15672` (usuário e senha `jaja`) o exchange `jaja.events` e a fila `jaja.events.all`;
  - parar o RabbitMQ (`npm run broker:stop --workspace=@jaja/backend`) com o backend rodando: o backend continua respondendo (ex.: `GET /storefront/categories`), sem erro por ciclo além do aviso de broker indisponível; subir o RabbitMQ de novo e ver a conexão restabelecida na próxima publicação.

# CLI

- Seguindo o padrão do menu `db` (`db.commands.ts`, `lib.ts`), criar o menu `broker` ("Mensageria local") com:
  - `broker:status` — estado do serviço `rabbitmq` no Docker Compose e as URLs do AMQP e do painel (portas lidas de `RABBITMQ_PORT`/`RABBITMQ_MANAGEMENT_PORT` do `apps/backend/.env`, com os padrões 5672/15672), sem exibir senha;
  - `broker:start` — `docker compose up -d rabbitmq`, aguardando o healthcheck;
  - `broker:stop` — `docker compose stop rabbitmq`;
  - `broker:logs` — `docker compose logs -f rabbitmq`.
- Em `doctor/checks.ts`, acrescentar uma verificação do RabbitMQ local (`warn`, nunca erro: o backend sobe sem ele) e ajustar o texto do Docker para mencionar Postgres e RabbitMQ.
- Atualizar `apps/cli/README.md` com o menu `broker`.
- Validação: `npm test --workspace=@jaja/cli` e `npm run build --workspace=@jaja/cli` sem erros; executar `broker:status`, `broker:stop`, `broker:start` e `doctor`.

# Specs da change

- Nova capability `messaging/event-outbox`:
  - gravação dos eventos de domínio na mesma transação do agregado pela porta `DomainEventRepository`, sem os módulos conhecerem a tabela;
  - gravação fora de transação recusada;
  - relay em intervalo configurável e desligável, lote limitado, ordem por `occurred_at`, bloqueio de linhas entre relays, parada no primeiro erro, novas tentativas com espera crescente (teto de 60 s) e entrega pelo menos uma vez;
  - relay e backend continuam funcionando com o broker fora do ar.
- Nova capability `messaging/message-broker`:
  - publicação sempre pela porta `MESSAGE_PUBLISHER`, com o RabbitMQ como adapter trocável;
  - exchange `topic` durável, routing key = tipo do evento, mensagem persistente em JSON com `messageId`, `type`, `payload`, `metadata` e `occurredAt`, confirmação do broker e reconexão;
  - fila de inspeção opcional para desenvolvimento;
  - credenciais nunca expostas em logs;
  - serviço `rabbitmq` no Docker Compose e comandos `broker` do CLI.

> Obs: IMPORTANTE!!! Executar as duas partes (Backend e CLI) em subagentes separados com contexto limpo em cada um deles, de forma sequencial (o CLI depende do serviço `rabbitmq` no `docker-compose.yml` e das variáveis do `.env.example`). Cada subagente deve ler `.claude/skills/skills-standards.md` e, antes de criar seus arquivos, as referências de código da sua camada listadas no Contexto. O do backend deve ler também os contratos do shared listados no Contexto (`packages/shared/src/events`, `src/messaging`, `src/db/transaction.manager.ts`) e não pode alterar `packages/shared` nem `modules/*`. Nenhum subagente deve gravar credenciais reais em arquivos versionados. Uma parte só começa depois de a anterior terminar com as validações passando, e cada subagente encerra listando os arquivos criados/alterados e o resultado das validações.
