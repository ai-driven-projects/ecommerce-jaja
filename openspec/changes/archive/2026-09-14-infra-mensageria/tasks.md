> **Execução:** dois subagentes separados, com contexto limpo, **nessa ordem**:
> - **Backend:** grupos 1–6;
> - **CLI:** grupos 7–8.
>
> Um grupo só começa depois de o anterior terminar com as validações passando.
>
> **Leitura prévia de cada subagente:**
> - todos: `.claude/skills/skills-standards.md`, o prompt `openspec/extras/prompts/14-infra-mensageria.md`, o `design.md` desta change e as referências de código da sua camada listadas no Contexto do prompt;
> - Backend, além disso: `packages/shared/src/events`, `packages/shared/src/messaging` e `packages/shared/src/db/transaction.manager.ts`.
>
> **Restrições:**
> - não alterar `packages/shared` nem `modules/*`;
> - não gravar credenciais reais em arquivos versionados (só os valores de desenvolvimento `jaja`);
> - o backend nunca lê `apps/cli`.
>
> Cada subagente encerra listando os arquivos criados/alterados e o resultado das validações. A conferência visual do painel do RabbitMQ (tarefa 6.4) exige login e fica para a conversa principal, com o usuário.

## 1. Ambiente local do broker (subagente Backend)

- [x] 1.1 Adicionar o serviço `rabbitmq` ao `apps/backend/docker-compose.yml`:
  - `rabbitmq:4-management-alpine`, `container_name: jaja-rabbitmq`, `restart: unless-stopped`;
  - `RABBITMQ_DEFAULT_USER`/`RABBITMQ_DEFAULT_PASS` = `jaja`;
  - portas `${RABBITMQ_PORT:-5672}:5672` e `${RABBITMQ_MANAGEMENT_PORT:-15672}:15672`, com um comentário sobre a função de cada uma;
  - volume `rabbitmq_data` declarado em `volumes`;
  - healthcheck `rabbitmq-diagnostics -q ping`.

  Verificar com `docker compose config` sem erro, dentro de `apps/backend`.
- [x] 1.2 Em `apps/backend/package.json`, adicionar `broker:start` (`docker compose up -d rabbitmq`), `broker:stop` (`docker compose stop rabbitmq`) e `broker:logs` (`docker compose logs -f rabbitmq`), sem mudar os `db:*`. Instalar `amqplib` (dependência) e `@types/amqplib` (dev) no `@jaja/backend`. Verificar:
  - `npm ls amqplib @types/amqplib --workspace=@jaja/backend` lista os dois;
  - `npm run broker:start --workspace=@jaja/backend` deixa `docker inspect -f '{{.State.Health.Status}}' jaja-rabbitmq` em `healthy`;
  - `jaja-postgres` continua rodando.
- [x] 1.3 Em `apps/backend/.env.example`, acrescentar com comentários `RABBITMQ_PORT="5672"`, `RABBITMQ_MANAGEMENT_PORT="15672"`, `RABBITMQ_URL="amqp://jaja:jaja@localhost:5672"`, `RABBITMQ_EXCHANGE="jaja.events"`, `RABBITMQ_INSPECTION_QUEUE="jaja.events.all"` (só desenvolvimento; vazia = não cria fila), `OUTBOX_RELAY_ENABLED="true"`, `OUTBOX_POLL_INTERVAL_MS="1000"` e `OUTBOX_BATCH_SIZE="50"`. Copiar as mesmas chaves para o `apps/backend/.env` local (não versionado). Verificar com `git check-ignore apps/backend/.env` e com `git diff apps/backend/.env.example`, que só pode conter as credenciais de desenvolvimento `jaja`.

## 2. Tabela do outbox (subagente Backend)

- [x] 2.1 Criar `apps/backend/prisma/models/messaging.model.prisma` com a skill `backend-prisma-data`:
  - model `OutboxEvent` (`@@map("outbox_events")`), com os campos, tipos, padrões e `@map` snake_case do prompt;
  - `@@index([status, availableAt])` e `@@index([aggregateType, aggregateId])`;
  - comentário acima do model: tabela interna que implementa `DomainEventRepository`, gravação na transação do agregado, publicação pelo relay e papel de `available_at`.

  Verificar com `npx prisma validate` em `apps/backend`.
- [x] 2.2 Rodar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name messaging_outbox` e depois `npm run prisma:generate --workspace=@jaja/backend`. Verificar que o `migration.sql` gerado contém só `CREATE TABLE "outbox_events"` e os dois `CREATE INDEX`. Se aparecer outra alteração (ex.: a coluna gerada `search_document`), removê-la antes de aplicar.

## 3. Outbox: peças puras e gravação (subagente Backend)

- [x] 3.1 Criar `src/messaging/messaging-errors.ts` com `MessagingErrors` (`as const`): `MESSAGING_TRANSACTION_REQUIRED`, `MESSAGE_BROKER_UNAVAILABLE` e `MESSAGE_PUBLISH_FAILED`. Verificar com `npx tsc --noEmit -p apps/backend`.
- [x] 3.2 Criar `src/messaging/outbox/outbox-event.mapper.ts` com `toOutboxEventRow(event)` e `toDomainEvent(row)`, com datas de `payload`/`metadata` convertidas para texto ISO (Decisão 4). Verificar com `outbox-event.mapper.spec.ts`:
  - evento → linha preserva todos os campos;
  - data no `payload` vira texto ISO;
  - linha → `DomainEvent` → `domainEventToBrokerMessage` gera `messageId` = id do evento, `type` e `payload` com `aggregateId`/`aggregateType`.
- [x] 3.3 Criar `src/messaging/outbox/outbox-backoff.ts` com `nextAttemptAt(attempts, now)`: `2^(attempts - 1)` s, com teto de 60 s. Verificar com `outbox-backoff.spec.ts`: 1ª, 2ª e 3ª falha (1 s, 2 s, 4 s), 7ª falha (60 s, teto) e 10ª falha (60 s).
- [x] 3.4 Criar `src/messaging/outbox/publish-in-order.ts` com `publishInOrder(events, publisher)` (Decisão 6). Verificar com `publish-in-order.spec.ts` (publisher falso):
  - publica todos na ordem com `routingKey` = `type`;
  - falha do `Result` no 2º evento para sem chamar o 3º e devolve `publishedIds` só com o 1º;
  - exceção conta como falha, com a mensagem do erro;
  - lista vazia não chama o publisher.
- [x] 3.5 Criar `src/messaging/outbox/domain-event.prisma.ts` com `DomainEventPrisma` (`@Injectable`, `implements DomainEventRepository`, Decisão 3):
  - `Result.tryAsync`;
  - lista vazia ok sem banco;
  - sem `tx`/`client`, falha com `MESSAGING_TRANSACTION_REQUIRED`;
  - `createMany` no `client` da transação com `toOutboxEventRow`.

  Verificar com `npx tsc --noEmit -p apps/backend`. O comportamento é coberto pelo e2e da tarefa 6.1.
- [x] 3.6 Criar `src/messaging/outbox/outbox.prisma.ts` com `OutboxPrisma.processPendingBatch(limit, publish)` (Decisão 5):
  - transação própria com `timeout: 30_000` e comentário do motivo;
  - `$queryRaw` com `Prisma.sql` e `FOR UPDATE SKIP LOCKED`;
  - marcação dos publicados;
  - atualização do evento que falhou, com `last_error` truncado em 500 e `nextAttemptAt`;
  - retorno `{ published, failed }`;
  - comentários sobre a transação aberta durante a publicação e a entrega pelo menos uma vez.

  Verificar com `npx tsc --noEmit -p apps/backend`. O comportamento é coberto pelo e2e da tarefa 6.1.

## 4. Relay (subagente Backend)

- [x] 4.1 Criar `src/messaging/outbox/outbox-relay.ts` com `OutboxRelay` (`OnApplicationBootstrap`, `OnModuleDestroy`, Decisão 7):
  - leitura e validação de `OUTBOX_RELAY_ENABLED`, `OUTBOX_POLL_INTERVAL_MS` e `OUTBOX_BATCH_SIZE`;
  - `setInterval` e log único de início;
  - `runOnce()` público, sem sobreposição e com exceções capturadas;
  - logs `N evento(s) publicado(s)` e `warn` com `id`, `type` e erro, sem `payload`;
  - encerramento aguardando o ciclo.

  Verificar com `outbox-relay.spec.ts` (`OutboxPrisma` e publisher falsos, `ConfigService` simples, `vi.useFakeTimers` e `vi.spyOn(Logger.prototype, …)`):
  - `runOnce` repassa o tamanho do lote e devolve as contagens;
  - dois `runOnce` simultâneos processam um só lote;
  - `OUTBOX_RELAY_ENABLED=false` não agenda intervalo;
  - intervalo e lote inválidos voltam aos padrões;
  - exceção do `OutboxPrisma` é registrada e o ciclo seguinte roda;
  - o log de falha não contém o `payload`;
  - `onModuleDestroy` cancela o intervalo.

## 5. Adapter RabbitMQ e módulo (subagente Backend)

- [x] 5.1 Criar `src/messaging/rabbitmq/rabbitmq-message.publisher.ts` com `RabbitMqMessagePublisher` (Decisão 8):
  - conexão preguiçosa com timeout de 5 s e promise compartilhada;
  - `createConfirmChannel`, exchange `topic` durável e fila de inspeção opcional ligada com `#`;
  - handlers de `error`/`close`;
  - `publish` com corpo e propriedades da spec, aguardando confirmação;
  - erros `MESSAGE_BROKER_UNAVAILABLE`/`MESSAGE_PUBLISH_FAILED`;
  - host:porta nos logs e sanitização da URL/senha nas mensagens;
  - `onModuleInit` com tentativa sem bloquear;
  - `onModuleDestroy` fechando canal e conexão.

  Verificar com `rabbitmq-message.publisher.spec.ts` (`vi.mock('amqplib')`):
  - declara o exchange `topic` durável;
  - com fila de inspeção, declara a fila durável e liga com `#`; sem ela, não declara fila;
  - publica com `routingKey`, `persistent`, `messageId`, `contentType`, `appId` e `timestamp` em segundos, e só resolve após a confirmação;
  - nack → `MESSAGE_PUBLISH_FAILED`;
  - falha de conexão → `MESSAGE_BROKER_UNAVAILABLE`, e a chamada seguinte tenta conectar de novo;
  - duas publicações simultâneas abrem uma única conexão;
  - evento `close` descarta a conexão;
  - nenhum log nem mensagem de erro contém a senha da URL.
- [x] 5.2 Criar `src/messaging/messaging.module.ts` (Decisão 9) e `src/messaging/index.ts` (exporta `MessagingModule`, `DomainEventPrisma` e `MessagingErrors`). Importar `MessagingModule` em `src/app.module.ts` e chamar `app.enableShutdownHooks()` em `src/main.ts`. Verificar:
  - `npm run build --workspace=@jaja/backend` sem erro;
  - `npm run dev --workspace=@jaja/backend` com o broker no ar registra uma vez o início do relay (intervalo e lote), sem avisos de conexão;
  - Ctrl+C encerra o processo sem erro.

## 6. Integração e validação do backend (subagente Backend)

- [x] 6.1 Criar `apps/backend/test/messaging-outbox.e2e-spec.ts` (Decisão 10):
  - cabeçalho com os pré-requisitos e `describe.runIf(process.env.MESSAGING_E2E === 'true')`;
  - `AppModule` com `OUTBOX_RELAY_ENABLED=false`;
  - `MessagingTestEvent` (`type: 'messaging.test-event'`, `aggregateType: 'MessagingTest'`);
  - fila exclusiva e temporária do teste ligada com `messaging.test-event`.

  Cenários:
  - commit grava `PENDING` com `attempts = 0`;
  - erro depois do `append` não grava;
  - `append` sem `tx` → `MESSAGING_TRANSACTION_REQUIRED`;
  - `runOnce()` publica: mensagem com o mesmo `messageId`, `type` e `payload`, e a linha fica `PUBLISHED` com `published_at`;
  - relay com `RabbitMqMessagePublisher` numa porta sem broker mantém `PENDING`, com `attempts = 1`, `last_error` e `available_at` no futuro;
  - `afterAll` apaga as linhas `aggregate_type = 'MessagingTest'` e fecha app e conexão.

  Verificar:
  - com o broker no ar, `MESSAGING_E2E=true npm run test:e2e --workspace=@jaja/backend` passa;
  - sem a variável, o arquivo aparece como ignorado e `app.e2e-spec.ts` continua passando.
- [x] 6.2 Rodar `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend`. Verificar que os três terminam sem erros.
- [x] 6.3 Com `npm run dev --workspace=@jaja/backend` (porta 4000) e o broker no ar, verificar pela API de gerenciamento (credenciais de desenvolvimento):
  - `curl -s -u jaja:jaja http://localhost:15672/api/exchanges/%2F/jaja.events` responde `type: "topic"` e `durable: true`;
  - `curl -s -u jaja:jaja http://localhost:15672/api/queues/%2F/jaja.events.all` mostra a fila durável ligada com `#`.

  Depois:
  1. Rodar `npm run broker:stop --workspace=@jaja/backend`.
  2. Verificar que `curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/storefront/categories` responde `200` e que o log só tem avisos de broker indisponível, sem a senha.
  3. Rodar `broker:start` e gravar um evento de teste pendente (via e2e com `OUTBOX_RELAY_ENABLED` ligado no processo `dev`, ou `INSERT` manual com `aggregate_type = 'MessagingTest'`).
  4. Verificar no log a reconexão e `1 evento(s) publicado(s)`, e a mensagem na fila `jaja.events.all` (`GET /api/queues/%2F/jaja.events.all` com `messages` ≥ 1).
  5. Apagar a linha de teste.
- [x] 6.4 (Conversa principal, com o usuário) Abrir `http://localhost:15672`, entrar com `jaja`/`jaja` e conferir no painel o exchange `jaja.events` e a fila `jaja.events.all` com a mensagem de teste. Verificar com captura de tela do painel.

## 7. Menu `broker` do CLI (subagente CLI)

- [x] 7.1 Criar `apps/cli/src/commands/broker/lib.ts` (Decisão 11) com `readBrokerPorts(env)`, `brokerUrls(ports)` e `parseComposeServiceState(stdout)`, reaproveitando `compose` e `requireBackend` de `db/lib.ts`. Verificar com `apps/cli/src/commands/broker/lib.test.ts` (`node:test`):
  - portas padrão 5672/15672 sem as chaves no `.env`;
  - portas do `.env`, e porta inválida voltando ao padrão;
  - URLs sem usuário nem senha;
  - estado `running`/`healthy`, parado e saída vazia.
- [x] 7.2 Criar `apps/cli/src/commands/broker/broker.commands.ts` com `broker:status`, `broker:start`, `broker:stop` e `broker:logs` e o menu `brokerMenu`:
  - id `broker`, título "Mensageria local", grupo "Ambiente local", ícone 🐇;
  - dry-run como em `db:stop`;
  - `start` com `up -d --wait rabbitmq` e fallback para `waitForPort`.

  Registrar o menu em `src/commands/index.ts` logo após `dbMenu`. Verificar com `npm test --workspace=@jaja/cli`: `index.test.ts` passa, com ids únicos.
- [x] 7.3 Em `apps/cli/src/commands/doctor/checks.ts`, criar `brokerCheck`: lê `RABBITMQ_PORT` do `apps/backend/.env` com padrão 5672 e usa `isPortOpen('localhost', porta)`. Porta aberta → `ok`; fechada → `warn` com a dica `jaja broker:start`; nunca `error`. Incluir o check depois de `databaseCheck` e ajustar o hint do `dockerCheck` para citar Postgres e RabbitMQ. Verificar com `npm run build --workspace=@jaja/cli`.
- [x] 7.4 Em `apps/cli/src/commands/db/db.commands.ts`, fazer o `db:stop` parar só o PostgreSQL, sem derrubar o RabbitMQ:
  - `compose(ctx, ['stop', 'postgres'])` no lugar de `['down']`;
  - dry-run `[dry-run] $ docker compose stop postgres`;
  - descrição "Para o container do PostgreSQL (dados são mantidos no volume)", keyword `stop` no lugar de `down`, resumos "PostgreSQL parado" e "docker compose stop postgres falhou".

  Ver a Decisão 12 do `design.md`: a restrição do prompt vale só para os scripts `db:*` do `apps/backend/package.json`, que continuam iguais. Verificar com `npm run build --workspace=@jaja/cli`; o comportamento é conferido na tarefa 8.3.
- [x] 7.5 Etapa `broker` no `setup`:
  - em `apps/cli/src/commands/broker/lib.ts`, criar `ensureBrokerUp(ctx)` no molde de `ensureDatabaseUp`: lê `RABBITMQ_PORT` com `readBrokerPorts`; porta aberta → no ar, sem chamar o compose; fechada → `up -d --wait rabbitmq`, com o mesmo fallback do `broker:start` (`up -d` + `waitForPort`); em dry-run só registra o comando. Devolve se o broker ficou no ar. O `broker:start` (tarefa 7.2) passa a usar essa função;
  - em `apps/cli/src/commands/setup/setup.wizard.ts`, etapa `broker` logo depois de `db`: label "Mensageria local", descrição "Se a porta do RabbitMQ não responder, sobe o serviço rabbitmq com Docker Compose e espera o healthcheck", `defaultSelected: true`, `requires: ['env', 'docker']`;
  - broker no ar → `ok`; falha → `warn` com a dica `jaja broker:start`, nunca `error` (o backend sobe sem o broker, e o wizard só interrompe as etapas seguintes em `error`);
  - incluir o RabbitMQ na descrição do `setupWizard` e `rabbitmq`/`broker` nos `keywords`.

  Verificar com `npm test --workspace=@jaja/cli` e `npm run build --workspace=@jaja/cli`; o comportamento é conferido na tarefa 8.3.
- [x] 7.6 Atualizar os textos que ainda citam só o banco:
  - `apps/cli/src/commands/doctor/doctor.command.ts`: descrição "Verifica Node, npm, git, Docker, dependências, submódulos, .env, banco, RabbitMQ e Prisma Client";
  - `apps/cli/src/commands/clean/clean.wizard.ts`, etapa `db` (id mantido, para não mudar `--steps db`): label "Volumes locais (banco e RabbitMQ)", descrição "docker compose down -v (apaga os dados do PostgreSQL e do RabbitMQ locais)" e `danger` "Apaga TODOS os dados do PostgreSQL e do RabbitMQ locais.";
  - descrição do `cleanWizard`: "Remove builds, caches, node_modules, lockfile e os volumes locais (banco e RabbitMQ)".

  Verificar com `grep -n "RabbitMQ" apps/cli/src/commands/doctor/doctor.command.ts apps/cli/src/commands/clean/clean.wizard.ts`, que lista a descrição do doctor, a etapa e a descrição da limpeza.
- [x] 7.7 Atualizar `apps/cli/README.md`:
  - linha do menu `broker` na tabela do menu inicial;
  - `broker/` na seção Estrutura;
  - linha da etapa `broker` na tabela do "Setup do ambiente local";
  - `db:stop` descrito como parada só do PostgreSQL, e nota de que a limpeza de volume (`docker compose down -v`) apaga também os dados do RabbitMQ;
  - `doctor` e `clean` citando o RabbitMQ.

  Verificar com `grep -n "broker\|RabbitMQ" apps/cli/README.md`, que lista a tabela do menu, a etapa do setup, a estrutura, o `db:stop` e a nota da limpeza.

## 8. Validação do CLI (subagente CLI)

- [x] 8.1 Rodar `npm test --workspace=@jaja/cli` e `npm run build --workspace=@jaja/cli`. Verificar que os dois terminam sem erros.
- [x] 8.2 Executar em headless `npm run cli -- broker:stop`, `npm run cli -- broker:status`, `npm run cli -- broker:start`, `npm run cli -- broker:status` e `npm run cli -- doctor`. Verificar:
  - o `status` com o broker parado termina com aviso e mostra `amqp://localhost:5672` e `http://localhost:15672`, sem senha;
  - o `start` termina após o healthcheck;
  - o `status` seguinte fica `ok`;
  - o `doctor` mostra a verificação do RabbitMQ `ok` (e `warn` se repetido com o broker parado, sem virar erro);
  - `docker ps` mostra `jaja-postgres` rodando durante todo o teste.
- [x] 8.3 Depois da 8.2, com Postgres e RabbitMQ no ar, executar em headless e verificar:
  1. `npm run cli -- db:stop`: `docker ps` mostra `jaja-rabbitmq` rodando e `jaja-postgres` parado;
  2. `npm run cli -- db:start`: termina com "Banco pronto" e `jaja-postgres` volta a rodar;
  3. `npm run cli -- broker:stop` e depois `npm run cli -- setup --steps broker --dry-run`: `env` e `docker` entram por dependência, a etapa só registra `docker compose up -d --wait rabbitmq` e o container continua parado;
  4. `npm run cli -- setup --steps broker`: termina `ok` depois do healthcheck (`docker inspect -f '{{.State.Health.Status}}' jaja-rabbitmq` = `healthy`);
  5. repetir `npm run cli -- setup --steps broker`: termina `ok` com a porta já aberta, sem subir nada de novo;
  6. ao final, `docker ps` mostra `jaja-postgres` e `jaja-rabbitmq` rodando.
