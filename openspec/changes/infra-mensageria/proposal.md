## Why

O próximo passo do Jaja é o checkout orientado a eventos: o pedido vai avisar pagamento, separação e entrega por mensagens. Antes disso, o backend precisa de um caminho confiável do evento de domínio até o broker: gravar o evento junto com o agregado (sem perder evento quando a transação dá certo nem publicar evento de transação desfeita) e publicá-lo depois, mesmo que o broker esteja fora do ar no momento. Esta change entrega só essa infraestrutura de publicação (padrão outbox + RabbitMQ), sem consumidores nem eventos de negócio, para que o pedido já nasça usando-a.

## What Changes

- **Outbox no backend (`@jaja/backend`):**
  - tabela interna `outbox_events` (model `OutboxEvent` em `prisma/models/messaging.model.prisma`) e a migration `messaging_outbox`, só com a tabela e os índices;
  - implementação da porta `DomainEventRepository` do shared: grava os eventos **na transação recebida** do caso de uso e recusa gravar sem transação (`MESSAGING_TRANSACTION_REQUIRED`). Os módulos de domínio continuam conhecendo só a porta;
  - relay dentro do próprio processo do backend (não é rota HTTP): lê lotes de eventos pendentes em intervalo configurável, com bloqueio de linhas entre relays, publica em ordem, para no primeiro erro, marca os publicados e agenda nova tentativa com espera crescente (1 s, 2 s, 4 s… até 60 s). Entrega **pelo menos uma vez**;
  - configuração por `.env`: `OUTBOX_RELAY_ENABLED`, `OUTBOX_POLL_INTERVAL_MS` e `OUTBOX_BATCH_SIZE`.
- **Broker (`@jaja/backend`):**
  - publicação sempre pela porta `MESSAGE_PUBLISHER` do shared, com o RabbitMQ como adapter trocável por configuração do provider;
  - exchange `topic` durável (`jaja.events`), routing key igual ao tipo do evento, mensagem persistente em JSON e confirmação do broker;
  - conexão preguiçosa com reconexão: o backend sobe e responde às rotas HTTP com o RabbitMQ fora do ar, e os eventos ficam pendentes até ele voltar;
  - fila de inspeção opcional para desenvolvimento (`jaja.events.all`), que recebe cópia de todos os eventos;
  - credenciais da URL do broker nunca aparecem em logs nem em mensagens de erro;
  - dependências novas `amqplib` e `@types/amqplib`; `main.ts` passa a chamar `app.enableShutdownHooks()` para o relay e a conexão fecharem ao parar o processo.
- **Ambiente local:**
  - serviço `rabbitmq` (`rabbitmq:4-management-alpine`) no `apps/backend/docker-compose.yml`, com painel na porta 15672, volume próprio e healthcheck;
  - scripts `broker:start`, `broker:stop` e `broker:logs` no backend e as variáveis `RABBITMQ_*` e `OUTBOX_*` no `.env.example`.
- **CLI (`@jaja/cli`):**
  - menu `broker` ("Mensageria local") com `broker:status`, `broker:start`, `broker:stop` e `broker:logs`;
  - `doctor` ganha a verificação do RabbitMQ local (só aviso) e o texto do Docker passa a citar Postgres e RabbitMQ;
  - README com o novo menu.
- **Testes:** unitários (mapper, espera entre tentativas, publicação em ordem, relay e adapter RabbitMQ com `amqplib` simulado) e um e2e opcional (`MESSAGING_E2E=true`) contra Postgres e RabbitMQ reais.
- Fora do escopo: consumidores e filas de negócio, idempotência de consumo, eventos de domínio reais, agregado de pedido, adapter em memória ou de outro broker, tela de eventos no admin e qualquer alteração em `packages/shared` ou `modules/*`.

## Capabilities

### New Capabilities

- `messaging/event-outbox`: gravação dos eventos de domínio na mesma transação do agregado pela porta de repositório de eventos, recusa de gravação fora de transação, relay em intervalo configurável e desligável, lote limitado, ordem por ocorrência, bloqueio de linhas entre relays, parada no primeiro erro, novas tentativas com espera crescente (teto de 60 s), entrega pelo menos uma vez e funcionamento com o broker fora do ar.
- `messaging/message-broker`: publicação sempre pela porta de publicação de mensagens, com o RabbitMQ como adapter trocável; exchange `topic` durável, routing key igual ao tipo do evento, mensagem persistente em JSON (`messageId`, `type`, `payload`, `metadata`, `occurredAt`), confirmação do broker e reconexão; fila de inspeção opcional; credenciais fora dos logs; serviço `rabbitmq` no Docker Compose e comandos `broker` do CLI.

### Modified Capabilities

Nenhuma. Nenhuma spec existente muda de comportamento: nenhum caso de uso grava eventos ainda, e as rotas HTTP atuais não mudam.

## Impact

- `apps/backend`:
  - banco: `prisma/models/messaging.model.prisma` e a migration `messaging_outbox` (aditiva);
  - código novo em `src/messaging/` (`messaging-errors.ts`, `outbox/*`, `rabbitmq/*`, `messaging.module.ts`, `index.ts`) com testes `*.spec.ts` ao lado e `test/messaging-outbox.e2e-spec.ts`;
  - alterados: `src/app.module.ts` (importa `MessagingModule`), `src/main.ts` (`enableShutdownHooks`), `package.json` (scripts `broker:*`, `amqplib`, `@types/amqplib`), `docker-compose.yml` e `.env.example`;
  - o `.env` local de cada desenvolvedor pode receber as novas variáveis; sem elas, os padrões do código valem, mas o `doctor` do CLI aponta as chaves faltando.
- `apps/cli`: `src/commands/broker/*` (novo menu), `src/commands/index.ts`, `src/commands/doctor/checks.ts` e `README.md`.
- `package-lock.json`: novas dependências do backend.
- Infraestrutura local: novo container `jaja-rabbitmq` (portas 5672 e 15672, configuráveis) e volume `rabbitmq_data`. Os comandos que já fazem `docker compose down` (`db:stop` do backend e do CLI, limpeza do volume) passam a afetar também o RabbitMQ.
- Sem mudanças em APIs HTTP, no frontend, em `packages/shared` ou em `modules/*`.
