## Context

A motivação e o escopo estão em `proposal.md`. O comportamento está nas specs `messaging/event-outbox` e `messaging/message-broker`. O roteiro detalhado de implementação é o prompt `openspec/extras/prompts/14-infra-mensageria.md`. Este é o estado atual relevante.

**Shared (`@mentoria-360/shared`, somente leitura)**
- `DomainEvent` e `AbstractDomainEvent` (valida `id` e `aggregateId` como UUID, `occurredAt` padrão `new Date()`), `DomainEventStatus` (`PENDING`, `PUBLISHED`) e `OutboxEvent`.
- `DomainEventRepository.append(events, tx?)`: o `tx` é opcional no contrato, mas o outbox só tem garantia dentro da transação do agregado.
- `MessagePublisher` / `MESSAGE_PUBLISHER` (`Symbol`), `PublishMessageOptions` genérico (`exchange`, `routingKey`, `queue`, `channel`, `headers`) e `domainEventToBrokerMessage`, que copia `aggregateId`/`aggregateType` para o `payload` e mantém `occurredAt` como `Date`.
- `AggregateRoot.pullEvents()` devolve e limpa os eventos pendentes.

**Backend**
- `PrismaService.runInTransaction` usa `client.$transaction(async (tx) => …)` sem opções, com o padrão do Prisma de 5 s de timeout para transações interativas. `PrismaTransactionContext` expõe `client`.
- Os adapters `*.prisma.ts` (ex.: `cart.prisma.ts`) usam `Result.tryAsync` e caem em `this.prisma.client` quando não recebem `tx`. Para eventos isso seria perigoso, por isso a regra é outra aqui.
- `StoresModule` escolhe o provider por configuração com `useFactory` + `ConfigService` e registra um aviso único. `ConfigModule` é global.
- `main.ts` não chama `enableShutdownHooks()`. Não existe `src/messaging`, nenhum model de mensageria nem dependência de AMQP.
- Testes: Vitest com `**/*.spec.ts` (unitário) e `**/*.e2e-spec.ts` (`vitest.config.e2e.ts`). O único e2e (`app.e2e-spec.ts`) monta o `AppModule`.
- `docker-compose.yml` só tem `postgres` (host `DB_PORT`, 5433). O script `db:stop` do backend e o `db:stop` do CLI rodam `docker compose down`, e a limpeza do CLI prevê `down -v`.

**CLI**
- `db/lib.ts` já tem `compose(ctx, args)` (roda na pasta do backend, detecta `docker compose` ou `docker-compose`), `requireBackend` e a leitura do `.env` com `parseEnv`. `core/net.ts` tem `isPortOpen` e `waitForPort`.
- Testes com `node:test` (`*.test.ts`); `commands/index.test.ts` valida a árvore de comandos.
- O `doctor` compara `.env` com `.env.example` (`envCheck`): novas chaves no exemplo viram aviso "faltando" até o `.env` local ser atualizado.
- O `setup` (`setup/setup.wizard.ts`) só sobe o Postgres, na etapa `db` com `ensureDatabaseUp`. O wizard interrompe as etapas seguintes só em `error`; `warn` segue.
- A descrição do `doctor` e a etapa de volume da limpeza (`clean/clean.wizard.ts`, ainda placeholder) citam só o banco.

## Goals / Non-Goals

**Goals:**
- Um caminho único e testável do evento de domínio até o broker, que o caso de uso do pedido use sem conhecer tabela nem broker.
- Nenhuma dependência de disponibilidade do broker para subir o backend ou atender HTTP.
- Código curto e explícito, adequado ao propósito didático: cada peça (mapper, espera, publicação em ordem, relay, adapter) é uma unidade pequena com teste próprio.

**Non-Goals:**
- Ordem estrita por agregado entre ciclos (ver Riscos).
- Exatamente uma vez na entrega ou deduplicação no produtor.
- Limpeza ou arquivamento de eventos publicados, métricas e fila de mensagens mortas.
- Configuração do broker de produção (fica para o deploy).

## Decisions

### 1. Duas etapas sequenciais com contexto limpo
Backend → CLI, cada uma em um subagente com contexto limpo, como pede o prompt. O CLI se adapta ao que o backend define (serviço `rabbitmq` e variáveis do `.env.example`), e o backend nunca lê `apps/cli`.

### 2. Outbox em `apps/backend/src/messaging`, fora de `modules/*`
Tabela, status, tentativas e relay são infraestrutura do backend. Os módulos só recebem, pelos controllers, uma instância de `DomainEventRepository` (`DomainEventPrisma`), como já recebem os outros adapters `*.prisma.ts`.

Alternativas descartadas:
- **Pacote `modules/messaging`:** colocaria detalhe de persistência num pacote de domínio sem regra de negócio.
- **Implementação no shared:** o shared não conhece Prisma nem Nest, e o prompt proíbe alterá-lo.

### 3. Gravação explícita no caso de uso, com transação obrigatória
O caso de uso chama `append(aggregate.pullEvents(), tx)` dentro de `runInTransaction`, depois de persistir o agregado. `DomainEventPrisma.append` falha com `MESSAGING_TRANSACTION_REQUIRED` quando não recebe `tx` com `client`, em vez de cair no client global. Lista vazia retorna ok antes dessa verificação. A gravação usa `createMany` com as colunas do evento, e `status`, `attempts` e `available_at` vêm dos padrões do banco. A chave primária é o `id` do evento, então gravar o mesmo evento duas vezes falha e desfaz a transação.

Alternativas descartadas:
- **Cair no client global sem `tx`**, como os outros adapters: permitiria gravar o evento fora da transação do agregado, sem erro visível.
- **Despacho automático no repositório do agregado** (salvar agregado → gravar eventos): esconde o fluxo, que é justamente o que o projeto quer ensinar, e acopla todo repositório à mensageria.

### 4. Tabela `outbox_events` com `status` texto e `available_at`
- `status` é `String` com os valores de `DomainEventStatus`, e não enum Prisma: novos estados não exigem migration de tipo e o shared continua sendo a fonte dos valores.
- `available_at` separa "pendente" de "pode publicar agora": hoje só a espera entre tentativas o adia, e depois servirá para atrasos intencionais.
- Índice `(status, available_at)` para a leitura do relay e `(aggregate_type, aggregate_id)` para consultas futuras por agregado.
- `payload` e `metadata` em `jsonb`. O mapper faz `JSON.parse(JSON.stringify(...))` para gravar datas internas como texto ISO; `occurred_at` fica como coluna de data.

### 5. Relay por polling com `FOR UPDATE SKIP LOCKED` e transação aberta durante a publicação
`OutboxPrisma.processPendingBatch(limit, publish)` faz tudo numa transação: seleciona com `$queryRaw` (`status = 'PENDING' AND available_at <= now()`, `ORDER BY occurred_at, id`, `LIMIT`, `FOR UPDATE SKIP LOCKED`), chama `publish`, marca os publicados (`status = 'PUBLISHED'`, `published_at = now()`) e atualiza o que falhou (`attempts + 1`, `last_error` truncado, `available_at = nextAttemptAt(attempts + 1, new Date())`).

- **Timeout da transação:** o padrão do Prisma (5 s) pode expirar num lote grande ou numa conexão lenta ao broker. `OutboxPrisma` usa `prisma.client.$transaction(fn, { timeout: 30_000 })` diretamente, porque `runInTransaction` não aceita opções, e comenta o motivo. O adapter RabbitMQ usa timeout de conexão (5 s), para que uma tentativa de conexão presa nunca passe do timeout da transação.
- **Contagens:** `published = publishedIds.length` e `failed = failure ? 1 : 0`.

Alternativas descartadas:
- **Marcar como "em processamento" e publicar fora da transação:** libera a transação mais cedo, mas exige estado extra e recuperação de linhas presas por processos que caíram.
- **`LISTEN/NOTIFY` do Postgres ou CDC (Debezium):** menos latência, mas mais peças para explicar e operar do que o projeto precisa.
- **Relay como processo separado:** fora do escopo, e o bloqueio de linhas já permite várias instâncias do backend.

### 6. Publicação em ordem, parando no primeiro erro
`publishInOrder(events, publisher)` publica um evento por vez com `domainEventToBrokerMessage(event)` e `options.routingKey = event.type`, e para na primeira falha (resultado de falha ou exceção capturada), devolvendo `{ publishedIds, failure }`. Função pura sobre a porta, testável sem banco nem broker.

Alternativa descartada:
- **Publicar o lote em paralelo:** mais rápido, mas inverteria a ordem dos eventos de um mesmo agregado dentro do ciclo.

### 7. `OutboxRelay` como provider com `setInterval`
- **Configuração:** lida no construtor com `ConfigService`. Valor não numérico ou fora da faixa (intervalo < 100; lote fora de 1–500) volta ao padrão, sem ajustar ao limite mais próximo.
- **Início:** em `onApplicationBootstrap`, se ligado, agenda `runOnce()` e registra intervalo e lote uma vez.
- **Sem sobreposição:** `runOnce()` guarda a promise do ciclo em andamento. Se ela existe, o novo ciclo devolve `{ published: 0, failed: 0 }` sem ir ao banco.
- **Erros e logs:** exceções são capturadas e registradas com `Logger.error`, e o ciclo seguinte roda normalmente. Na falha de publicação, o `warn` usa `id` e `type` do evento (o relay os obtém da lista do lote).
- **Encerramento:** `onModuleDestroy` faz `clearInterval` e aguarda a promise em andamento.
- **Construtor:** `(OutboxPrisma, @Inject(MESSAGE_PUBLISHER) MessagePublisher, ConfigService)`, para o e2e montar um segundo relay com um publisher apontando para uma porta sem broker.
- **Exportação:** o relay não é exportado pelo módulo, e o e2e o obtém com `app.get(OutboxRelay)`.

Alternativa descartada:
- **`@nestjs/schedule`:** nova dependência só para um intervalo, e a sobreposição de ciclos continuaria sendo tratada à mão.

### 8. Adapter RabbitMQ com `amqplib` direto
`RabbitMqMessagePublisher` recebe `{ url, exchange, inspectionQueue }` e não é `@Injectable`: é criado pela factory.

- **Conexão:** guarda `connection`, `channel` e `connecting: Promise | null`. `ensureChannel()` reaproveita a promise em andamento. A conexão abre com timeout de 5 s e `createConfirmChannel()`, declara o exchange `topic` durável e, com fila de inspeção, `assertQueue(durable)` + `bindQueue(queue, exchange, '#')`.
- **Quedas:** handlers de `error` e `close` na conexão e no canal zeram as referências. `error` sem handler derrubaria o processo.
- **Publicação:** `channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(body)), props)` com as propriedades da spec e espera da confirmação via callback (ou `waitForConfirms`).
  - Falha ao obter canal → `MESSAGE_BROKER_UNAVAILABLE`.
  - Nack, erro no callback ou exceção em `publish` → `MESSAGE_PUBLISH_FAILED`.
- **Aquecimento:** `onModuleInit` chama `ensureChannel()` sem aguardar o resultado para a subida, registrando só aviso na falha, para o backend nunca esperar o broker. `onModuleDestroy` fecha canal e conexão, ignorando erros.
- **Segredo:** host e porta vêm de `new URL(url)`, e as mensagens de erro de terceiros passam por uma função que remove a URL e a senha antes de ir para log ou para o `Result`.

Alternativas descartadas:
- **`amqp-connection-manager` ou `@golevelup/nestjs-rabbitmq`:** reconexão pronta, mas escondem justamente o comportamento que a aula mostra e trazem mais dependências.
- **Exchange `direct` ou `fanout`:** `topic` permite assinar por padrão (`order.*`) e ainda aceita a fila de inspeção com `#`.

### 9. `MessagingModule` e troca de broker por provider
O módulo importa `DbModule` e registra `DomainEventPrisma`, `OutboxPrisma`, `OutboxRelay` e o provider de `MESSAGE_PUBLISHER` com `useFactory` + `ConfigService`. Padrões: `RABBITMQ_URL` = `amqp://jaja:jaja@localhost:5672`, `RABBITMQ_EXCHANGE` = `jaja.events` e `RABBITMQ_INSPECTION_QUEUE` vazio = sem fila. Exporta `DomainEventPrisma` e `MESSAGE_PUBLISHER`. Um comentário registra que trocar de broker é trocar esse provider. `AppModule` importa o módulo, e `main.ts` chama `app.enableShutdownHooks()`.

### 10. E2E opcional contra serviços reais
`test/messaging-outbox.e2e-spec.ts` roda só com `MESSAGING_E2E=true` (`describe.runIf`), para `npm run test:e2e` continuar funcionando sem broker.

- **Montagem:** define `process.env.OUTBOX_RELAY_ENABLED = 'false'` antes de compilar o `AppModule`, para os ciclos automáticos não disputarem as linhas com o teste.
- **Evento de teste:** `MessagingTestEvent extends AbstractDomainEvent`.
- **Fila do teste:** o próprio teste abre uma conexão `amqplib`, declara uma fila exclusiva e temporária ligada ao exchange com `messaging.test-event` e consome com timeout.
- **Isolamento:** o teste só lê e apaga linhas com `aggregate_type = 'MessagingTest'`. Eventos de outros agregados eventualmente pendentes no banco de desenvolvimento não são tocados, mas podem entrar no lote do `runOnce()`. Por isso as asserções usam os ids do teste e não as contagens absolutas.

### 11. CLI: menu `broker` sobre o `compose` existente
- **Arquivos:** `src/commands/broker/broker.commands.ts` e `src/commands/broker/lib.ts`, reaproveitando `compose` e `requireBackend` de `db/lib.ts`.
- **Funções puras em `lib.ts`**, testadas em `lib.test.ts`:
  - `readBrokerPorts(env)`, com padrões 5672/15672 e porta inválida voltando ao padrão;
  - `brokerUrls(ports)`, que devolve `amqp://localhost:<porta>` e `http://localhost:<porta>`, sem credenciais;
  - `parseComposeServiceState(stdout)`, que interpreta o `docker compose ps --format json rabbitmq`.
- **Comandos:**
  - `broker:status`: `ok` quando saudável, `warn` quando parado ou sem Docker;
  - `broker:start`: `up -d --wait rabbitmq`; com `docker-compose` legado, sem `--wait`, cai em `up -d` + `waitForPort`;
  - `broker:stop`: `stop rabbitmq`;
  - `broker:logs`: `logs --tail 100 -f rabbitmq`, como `db:logs`.
- **Dry-run** como em `db:stop`.
- **Menu:** grupo "Ambiente local", ícone 🐇, registrado em `commands/index.ts` logo após `dbMenu`.
- **Doctor:** `brokerCheck` com `isPortOpen('localhost', RABBITMQ_PORT)`, `warn` com a dica `jaja broker:start`. O texto do `dockerCheck` passa a citar Postgres e RabbitMQ.

### 12. CLI: `setup`, `db:stop` e textos acompanham o broker
- **`ensureBrokerUp(ctx)` em `broker/lib.ts`**, no molde de `ensureDatabaseUp`:
  - porta de `RABBITMQ_PORT` aberta → broker no ar, sem chamar o compose;
  - porta fechada → o mesmo caminho do `broker:start` (`up -d --wait rabbitmq`, ou `up -d` + `waitForPort` no `docker-compose` legado);
  - em dry-run só registra o comando.

  O `broker:start` e a etapa do setup usam a mesma função.
- **Etapa `broker` do `setup`:** logo depois de `db`, marcada por padrão, com `requires: ['env', 'docker']`. Falha vira `warn` com a dica `jaja broker:start`, nunca `error`: o backend sobe sem o broker, e um `error` interromperia migrations, build e seed.
- **`db:stop`:** `compose stop postgres` no lugar de `down`. Cada menu cuida só do seu serviço, como o `broker:stop` (`stop rabbitmq`). A restrição do prompt ("sem mudar os scripts `db:*`") vale para o `apps/backend/package.json`, cujo `db:stop` continua com `docker compose down`.
- **Textos:**
  - a descrição do `doctor` cita o RabbitMQ;
  - a etapa `db` da limpeza (placeholder) e a descrição do wizard falam em volumes locais do banco e do RabbitMQ;
  - o id `db` da etapa é mantido, para não mudar `--steps db`.

Alternativas descartadas:
- **Manter o `db:stop` do CLI com `docker compose down` e só documentar:** parar o broker ao pedir para parar o banco é um efeito colateral inesperado, e o prompt não restringe os comandos do CLI.
- **Deixar o `setup` sem o broker:** quem prepara o ambiente do zero ficaria sem RabbitMQ e com avisos de broker indisponível no log do backend.
- **Etapa `broker` com `error` quando falha:** travaria o setup por uma dependência que o backend não exige para subir.

## Risks / Trade-offs

- **[Ordem entre ciclos: se A falha e fica adiado, um evento B posterior do mesmo agregado pode ser publicado antes de A]** → aceito nesta entrega. A parada no primeiro erro evita a inversão dentro do ciclo e, com o broker fora do ar, todos falham juntos. Os consumidores do pedido deverão tolerar ordem diferente (por estado ou versão). Bloquear o agregado inteiro fica para quando houver consumidores reais.
- **[Entrega duplicada (queda entre a confirmação do broker e o commit)]** → `messageId` é sempre o `id` do evento, e a idempotência dos consumidores entra com eles.
- **[Transação e bloqueio de linhas abertos durante a publicação]** → lote limitado (padrão 50, máximo 500), timeout explícito de 30 s e timeout de conexão de 5 s. Se a transação expirar, o ciclo é registrado como erro e os eventos continuam pendentes.
- **[Relógio: `available_at <= now()` usa o relógio do Postgres, e `nextAttemptAt` usa o do backend; colunas `timestamp` sem fuso comparadas com `now()` dependem do fuso da sessão]** → no ambiente local o container roda em UTC e o Prisma grava em UTC. O e2e confere "disponibilidade no futuro" e a publicação. Uma diferença de poucos segundos só antecipa ou atrasa uma nova tentativa.
- **[Broker fora do ar gera um aviso por ciclo]** → esperado e pedido pela validação. A espera crescente limita novas tentativas por evento, não os avisos.
- **[O script `db:stop` do backend (`docker compose down`) e a limpeza de volume do CLI (`down -v`) também derrubam ou apagam o RabbitMQ]** → o script do backend fica como está, porque o prompt pede para não mudar os `db:*`, e a limpeza cita o RabbitMQ na própria etapa e no README do CLI. O `db:stop` do CLI não tem esse efeito (Decisão 12). Os eventos pendentes ficam no Postgres, não no broker, então nada se perde além de mensagens ainda não consumidas nas filas.
- **[`.env` local sem as novas chaves]** → o código usa os padrões, e o `doctor` aponta as chaves faltando. A etapa do backend acrescenta as chaves ao `.env` local (não versionado).
- **[Encerramento: relay e adapter fecham em paralelo nos hooks do Nest]** → uma publicação interrompida vira falha comum, e o evento continua pendente para o próximo processo.
- **[`amqplib` é CommonJS num backend ESM]** → importar pelo default (`import amqp from 'amqplib'`) ou pelos nomes suportados pelo interop, conferindo com `npm run build` e com `vi.mock('amqplib')` nos testes.

## Migration Plan

1. Aplicar a migration `messaging_outbox`. Ela é aditiva: cria só `outbox_events` e os dois índices.
2. Subir o RabbitMQ (`broker:start`, ou a etapa `broker` do `setup`) antes ou depois do backend: a ordem não importa.
3. Em ambientes sem broker, o backend funciona normalmente. Se não houver eventos gravados (nenhum caso de uso grava ainda), o relay só consulta a tabela vazia. `OUTBOX_RELAY_ENABLED=false` desliga até as consultas.

**Rollback:** reverter o código e remover a tabela com `DROP TABLE outbox_events;` e a pasta da migration (o Prisma não gera migration de descida). O container e o volume do RabbitMQ podem ser removidos com `docker compose rm -sf rabbitmq` e `docker volume rm` do `rabbitmq_data`.
