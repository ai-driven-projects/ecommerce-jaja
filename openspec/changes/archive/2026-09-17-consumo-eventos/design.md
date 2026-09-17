## Context

A motivação e o escopo estão em `proposal.md`. O comportamento está nas specs `messaging/event-consumer`, `messaging/message-broker` e `messaging/event-outbox`. O roteiro detalhado de implementação é o prompt `openspec/extras/prompts/16-consumo-eventos.md`. Este é o estado atual relevante.

**Shared (`@mentoria-360/shared`, somente leitura)**
- `MessageConsumer.subscribe({ queue, routingKeys, onMessage, channel? })`, que devolve `Promise<Result<void>>`, e `MESSAGE_CONSUMER` (`Symbol`).
- `EventConsumer` (`eventType`, `handle(message)`) não tem como receber a transação.
- `BrokerMessage.occurredAt` é `Date`.
- `domainEventToBrokerMessage` copia o `metadata` do evento para a mensagem sem alterações.
- `TransactionManager.runInTransaction(operation)` não tem opções nem noção de transação aninhada.

**Backend (prompts 14 e 15)**
- `RabbitMqMessagePublisher` já resolve o que o consumo também precisa:
  - conexão preguiçosa com `connecting` compartilhado e `discard` em `error`/`close`;
  - timeout de conexão de 5 s;
  - `redactCredentials` e `brokerAddress`, hoje funções privadas do arquivo.

  A reconexão só acontece na próxima publicação, e o relay publica a cada segundo. Isso não serve para o consumo, que não tem um gatilho periódico.
- `OutboxRelay` já tem `readInteger` (privado), liga/desliga por `ConfigService`, logs sem payload e espera do ciclo em `onModuleDestroy`.
- `nextAttemptAt(attempts, now)` em `outbox/outbox-backoff.ts` calcula `2^(n-1)` s com teto de 60 s e devolve `Date`.
- `DomainEventPrisma.append(events, tx)` exige `tx.client`, grava com `createMany` via `toOutboxEventRow(event)` e deixa o `metadata` como veio.
- `PrismaService.runInTransaction` usa `client.$transaction` sem opções (timeout padrão do Prisma de 5 s) e desconecta em `onModuleDestroy`.
- Sobre a ordem dos hooks do Nest:
  - `NestApplicationContext` executa os hooks dos módulos ordenados por `distance` decrescente, tanto para `onModuleDestroy` quanto para `onModuleInit`/`onApplicationBootstrap`;
  - `DbModule` é importado pelo `MessagingModule` e fica mais fundo na árvore, então o `$disconnect` pode rodar antes de o relay terminar o ciclo;
  - `onModuleInit` roda em todos os módulos antes de qualquer `onApplicationBootstrap`.
- `PlaceOrder` (`modules/orders`) abre a própria transação com `runInTransaction`, captura `ResultError` e devolve `Result.fail`. É o formato que os casos de uso chamados por consumidores terão no próximo prompt.
- Testes: Vitest com `*.spec.ts` ao lado dos arquivos e `messaging-outbox.e2e-spec.ts`, que roda só com `MESSAGING_E2E=true`. Não existe nenhum consumidor, `processed_messages` nem `src/messaging/consumer`.

**CLI**
- `broker/lib.ts` tem `readBackendEnv`, `readBrokerPorts` e `brokerUrls`, que nunca usam a URL com senha.
- Testes com `node:test` em `lib.test.ts`. Ainda não há consulta à API HTTP do painel.

## Goals / Non-Goals

**Goals:**
- Um handler de consumidor que só chama um caso de uso e devolve `Result`. Idempotência, transação, causa, novas tentativas e descarte ficam na infraestrutura, e o prompt 17 só registra consumidores.
- Separar o que é do broker (topologia, confirmação, espera e descarte, no adapter) do que é independente dele (idempotência, transação e causa, no runner). Trocar o RabbitMQ não mexe no runner.
- Deixar a mecânica visível no painel do RabbitMQ (filas `.wait` e `.dead`) sem ferramenta extra.
- Não mudar o comportamento de publicação nem de nenhuma rota HTTP.

**Non-Goals:**
- Exatamente uma vez na entrega: o objetivo é efeito único por consumidor, não entrega única.
- Handlers de longa duração: a transação do consumidor segue o timeout padrão do Prisma.
- Métricas, tracing distribuído ou tela de eventos: `correlationId` fica só no `metadata`.
- Controle de concorrência por agregado: é responsabilidade do caso de uso (estado do agregado).

## Decisions

### 1. Duas etapas sequenciais com contexto limpo
Backend → CLI, cada uma em um subagente com contexto limpo, como pede o prompt. A validação manual do `broker:queues` com filas reais depende de o backend (ou o e2e) já criar as filas de consumo.

### 2. Handler próprio do backend, em vez do `EventConsumer` do shared
`TransactionalEventConsumer` (`name`, `eventType`, `delayMs?`, `handle(message, transactionManager)`) é definido em `src/messaging/consumer`. O `EventConsumer` do shared não recebe transação, e o prompt proíbe alterar o shared. A porta de transporte continua sendo a do shared (`MessageConsumer`).

Alternativas descartadas:
- **Usar `EventConsumer` e deixar o handler abrir a própria transação:** a marca de processada ficaria em outra transação, e uma queda entre as duas repetiria ou perderia o efeito.
- **Transação implícita por `AsyncLocalStorage` no `PrismaService`** (todo `runInTransaction` aninhado se junta ao de fora): funciona sem mudar a assinatura do handler, mas muda o comportamento global de todos os adapters e esconde o fluxo que o projeto quer ensinar.

### 3. `ActiveTransactionManager`: transação reaproveitada explicitamente
É uma classe de poucas linhas em `src/db`. O `runInTransaction(op)` executa `op(context)` com o contexto já aberto, e o erro sobe para quem abriu a transação. O caso de uso continua com `runInTransaction` + `append(..., tx)`.

Detalhe importante: quando o caso de uso captura um `ResultError` e devolve `Result.fail`, ele não desfaz nada, porque a transação não é dele. Por isso o runner transforma todo `Result.fail` do handler em exceção dentro do callback. Assim, a transação inteira é desfeita, inclusive as escritas parciais e a marca de processada.

Alternativa descartada: **passar `tx` direto ao handler** e esperar que ele chame repositórios. Isso duplicaria nos consumidores a orquestração que já está nos casos de uso.

### 4. Idempotência com `INSERT ... ON CONFLICT DO NOTHING` no início da transação
A tabela `processed_messages` tem chave primária `(consumer, message_id)`, e a inserção vem antes do handler, na mesma transação.
- `rowCount = 0`: mensagem repetida. O runner devolve `'duplicate'` sem chamar o handler, e o adapter confirma.
- Duas entregas simultâneas: a segunda inserção espera o bloqueio da chave e, depois do commit da primeira, recebe o conflito. Se a primeira fizer rollback, a segunda insere e processa.
- Chave composta: o mesmo evento é processado por vários consumidores.

Alternativas descartadas:
- **Consultar antes e inserir depois:** abre uma condição de corrida entre a leitura e a escrita.
- **Deduplicar no broker:** o RabbitMQ não oferece isso de forma nativa, e a garantia precisa estar na mesma transação do efeito.
- **Guardar o `messageId` no agregado:** espalharia a infraestrutura pelos módulos.

### 5. Causa e correlação pelo contexto da transação
O runner cria um `ConsumerTransactionContext` (`client` + `causation`) e o repassa pelo `ActiveTransactionManager`. `DomainEventPrisma.append` lê `readCausation(tx)` e o mapper acrescenta `causationId`/`correlationId` ao `metadata` só quando as chaves estão ausentes. Nada muda em `modules/*` nem no formato da mensagem.

`correlationId` vem do `metadata` da mensagem, ou do `messageId` quando ela não tem um. O primeiro evento de uma cadeia (ex.: `order.placed`) não tem `correlationId`, e os seguintes herdam o `id` dele.

Alternativa descartada: **pedir aos casos de uso que preencham o `metadata`**. Isso exigiria mudar a assinatura dos casos de uso e das entidades para cada evento.

### 6. Espera e descarte pelo broker: filas `.wait` (TTL por mensagem + dead-letter) e `.dead`
Numa falha, o adapter republica a mensagem em `<fila>.wait` pelo exchange padrão, com `expiration = backoffDelayMs(tentativa)` e o cabeçalho `x-jaja-attempt`. Só depois da confirmação do broker a original recebe `ack`. A `.wait` tem `x-dead-letter-exchange: ''` e `x-dead-letter-routing-key: <fila>`, então a mensagem expirada volta **só** para a fila do consumidor. A espera inicial (`delayMs`) usa o mesmo caminho, com o cabeçalho `x-jaja-delayed`.

Alternativas descartadas:
- **`nack` com `requeue: true`:** volta imediatamente, sem espera, e uma mensagem com problema consome CPU em laço.
- **`setTimeout` antes de reprocessar:** segura a mensagem sem `ack` e ocupa o `prefetch`. Se o processo cair, a espera se perde, e a espera inicial de minutos travaria o consumidor.
- **Republicar no exchange `jaja.events`:** todos os consumidores do tipo receberiam de novo.
- **TTL fixo na fila (`x-message-ttl`) com uma fila por nível de espera:** evita o problema da cabeça da fila (Risco 1), mas multiplica filas. Mudar o valor pelo `.env` também quebraria a declaração (`PRECONDITION_FAILED`, argumentos de fila não mudam).
- **Plugin `rabbitmq_delayed_message_exchange`:** exige imagem customizada e esconde a mecânica.
- **`x-delivery-limit` de filas quorum:** limita as novas entregas, mas sem espera entre elas e com outro tipo de fila. Fica para quando houver cluster.

A contagem de tentativas vem de um cabeçalho próprio (`x-jaja-attempt`), e não de `x-death`. Assim, a contagem não depende do formato de `x-death`, que mudou entre versões do RabbitMQ, e a espera inicial não conta como tentativa.

### 7. Mensagem inválida vai direto para `.dead`
Um corpo que não se transforma em `BrokerMessage` (JSON, `messageId` UUID, `type`, objetos, `occurredAt`) nunca vai dar certo. Tentar de novo só atrasaria o descarte. O UUID é exigido porque `processed_messages.message_id` é `uuid`, e o `messageId` publicado pelo outbox sempre é o `id` UUID do evento.

### 8. Adapter de consumo separado do publisher, com reconexão ativa
`RabbitMqMessageConsumer` tem conexão própria, recomendação do RabbitMQ: quando o broker aplica controle de fluxo, ele bloqueia a conexão de quem publica, e o consumo não pode parar junto. Ao contrário do publisher, o consumo não tem um gatilho natural, então a reconexão é agendada com `backoffDelayMs` e uma tentativa por vez. Ao conectar, o adapter refaz a topologia e as assinaturas guardadas.

Cada assinatura tem um canal próprio (`createConfirmChannel` + `prefetch`):
- o `prefetch` por canal isola os consumidores;
- um erro de canal (ex.: argumento de fila divergente) derruba só aquela assinatura;
- o canal de confirmação serve também para as republicações na `.wait` e na `.dead`, que precisam de confirmação antes do `ack`.

`redactCredentials` e `brokerAddress` saem do publisher para `rabbitmq/rabbitmq-url.util.ts` e passam a ser usados pelos dois adapters. `subscribe` guarda a assinatura e devolve `ok` sem esperar a conexão, como o publisher faz ao iniciar: o backend nunca espera o broker.

### 9. Registro explícito e runner no `onApplicationBootstrap`
`EventConsumerRegistry` é um provider singleton do `MessagingModule`, exportado. Os módulos de negócio (prompt 17) injetam o registro e chamam `register` no `onModuleInit`. O `EventConsumerRunner` assina todos no `onApplicationBootstrap`, que o Nest só executa depois de todos os `onModuleInit`. Registro inválido lança erro e impede a subida, porque é erro de programação e precisa aparecer na hora.

Alternativa descartada: **decorator + `DiscoveryService`**. É mais "mágico" e mais difícil de acompanhar para quem está aprendendo. O registro explícito mostra em uma linha quem consome o quê.

### 10. Nome do consumidor como identidade
`jaja.<name>` dá nome à fila, e `name` é a chave de idempotência. O formato `<módulo>.<ação>` evita colisão entre módulos e deixa as filas agrupadas no painel. Renomear um consumidor cria uma fila nova (a antiga fica órfã com o que tiver) e zera o histórico de processadas. Isso fica documentado no JSDoc, sem migração automática.

### 11. Configuração compartilhada e `.env`
`readInteger` sai do relay para `messaging/config.util.ts`, e `backoffDelayMs` para `messaging/backoff.ts`. `nextAttemptAt` passa a usar `backoffDelayMs`, e os testes existentes provam que nada mudou.

Variáveis novas:
- `EVENT_CONSUMERS_ENABLED`: `"false"` desliga;
- `EVENT_CONSUMER_PREFETCH`: 10, de 1 a 100;
- `EVENT_CONSUMER_MAX_ATTEMPTS`: 5, de 1 a 20.

Os valores são globais: por consumidor, só `delayMs`, porque é o que o próximo prompt precisa.

### 12. Desligamento: `$disconnect` em `onApplicationShutdown`
O Nest executa todos os `onModuleDestroy` (inclusive o do adapter de consumo, que cancela as assinaturas e espera as mensagens em andamento, e o do relay) e só depois `onApplicationShutdown`. Com o `$disconnect` nesse último hook, nenhuma transação em andamento perde a conexão, independentemente da profundidade dos módulos. A mudança também corrige o mesmo risco que já existia no relay.

### 13. Validação por testes unitários e e2e opcional com consumidores de teste
O runner é testado com fakes (transação, marca, consumidor). O adapter é testado com `vi.mock('amqplib')`, verificando a ordem republicar → confirmar → `ack`.

O e2e segue o padrão de `messaging-outbox.e2e-spec.ts`:
- registra os consumidores `messaging-test.*` antes de `app.init()`;
- publica pelo caminho real (outbox + `runOnce`), ou direto com `amqplib` nos casos de repetição e de corpo inválido;
- usa `EVENT_CONSUMER_MAX_ATTEMPTS=2` para o descarte levar cerca de 1 s;
- remove linhas e filas `messaging-test` ao final.

### 14. CLI: `broker:queues` pela API HTTP do painel
O comando usa `GET /api/queues/%2F` com autenticação básica tirada de `RABBITMQ_URL` do `.env` do backend, sem adicionar `amqplib` ao CLI. `summarizeQueues` é uma função pura (testável com `node:test`) que agrupa `jaja.<nome>`, `.wait` e `.dead`. O comando termina com `warn` quando a API não responde ou quando há mensagens descartadas, nunca com `error`, seguindo o critério do `doctor` para o broker.

## Risks / Trade-offs

- **[TTL por mensagem só expira na cabeça da `.wait`: uma espera longa atrasa uma curta que esteja atrás]** → aceito e documentado. As esperas são curtas (até 60 s nas tentativas), e a espera inicial de um consumidor costuma ser constante, então as mensagens da mesma fila expiram em ordem. Se incomodar, a alternativa são filas por nível de espera (Decisão 6).
- **[Timeout padrão de 5 s da transação interativa do Prisma limita o handler]** → os handlers do prompt 17 são escritas curtas no banco, e o tempo simulado fica na `.wait`, fora da transação. Um timeout vira falha comum e nova tentativa.
- **[`prefetch` × pool de conexões do banco: até `prefetch` transações por consumidor ao mesmo tempo]** → padrão 10, com poucos consumidores. Se o pool esgotar, a transação espera ou falha e a mensagem é tentada de novo. O valor é ajustável pelo `.env`.
- **[Mensagem que derruba o processo antes do `ack` é entregue de novo para sempre (sem limite de novas entregas no broker)]** → fora do escopo, e registrado no prompt. `x-jaja-attempt` só conta falhas tratadas. Filas quorum com `x-delivery-limit` resolveriam.
- **[Falha da republicação na `.wait`/`.dead` depois do `nack` com requeue pode gerar laço rápido enquanto o broker recusa]** → a republicação só falha com o canal ou o broker com problema, e nesse caso o canal cai e a assinatura é refeita com a espera de reconexão.
- **[Mudar argumentos das filas depois de criadas (ex.: dead-letter da `.wait`) causa `PRECONDITION_FAILED`]** → os argumentos são fixos no código, sem vir do `.env`. Uma mudança futura exige apagar as filas no painel, e isso fica documentado no comentário do adapter.
- **[Renomear consumidor perde idempotência e deixa fila órfã]** → documentado no contrato (Decisão 10).
- **[`processed_messages` cresce sem limite]** → índice em `processed_at` pronto para a limpeza futura. O volume didático é pequeno.
- **[Ordem das mensagens pode inverter]** → documentado na spec. Os casos de uso do prompt 17 conferem o estado do pedido e terminam com sucesso quando a ação não se aplica mais.
- **[`messaging-outbox.e2e-spec.ts` monta o `AppModule` com o consumo ligado]** → sem consumidores registrados nada é assinado, e o e2e do outbox continua igual. O e2e do consumo usa filas `jaja.messaging-test.*`, que não colidem com as de negócio.
- **[`.env` local sem as novas chaves]** → os padrões do código valem, e o `doctor` aponta as chaves faltando.

## Migration Plan

1. Aplicar a migration `messaging_processed_messages`. Ela é aditiva: cria só `processed_messages` e o índice.
2. Subir o backend. Sem consumidores registrados, o log mostra zero assinaturas e nenhuma fila nova é criada. Publicação e rotas HTTP continuam iguais.
3. As filas de consumo só aparecem quando o prompt 17 registrar consumidores (ou durante o e2e).

**Rollback:** reverter o código e remover a tabela com `DROP TABLE processed_messages;` e a pasta da migration. Filas `jaja.<consumidor>`, `.wait` e `.dead` que tenham sido criadas podem ser apagadas pelo painel. A mudança do `$disconnect` pode ser revertida sozinha, sem efeito funcional.
