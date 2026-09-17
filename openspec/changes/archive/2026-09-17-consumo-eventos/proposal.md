## Why

O fluxo de pedido do Jaja já publica o `order.placed` no RabbitMQ pelo outbox, mas nada consome esse evento: o ciclo "grava no outbox → publica → consome → grava no outbox" ainda não fecha, e é ele que vai mover o pedido por pagamento, separação e entrega simulados. Antes de criar esses consumidores, o backend precisa de uma infraestrutura de consumo confiável. Como a entrega é pelo menos uma vez, cada mensagem precisa ter efeito uma única vez por consumidor, a falha precisa desfazer tudo e ser tentada de novo sem travar a fila, e a mensagem que nunca dá certo precisa ficar visível para inspeção. Esta change entrega só essa infraestrutura, validada com consumidores de teste, para que o próximo prompt (`ciclo-pedido`) só registre consumidores de negócio.

## What Changes

- **Consumo pelo backend (`@jaja/backend`):**
  - consumo sempre pela porta `MESSAGE_CONSUMER` do shared, com o RabbitMQ como adapter trocável e **conexão própria**, separada da publicação;
  - registro de consumidores no backend: nome estável `<módulo>.<ação>`, tipo do evento assinado, espera inicial opcional (`delayMs`) e handler que recebe a mensagem e um gerenciador de transação. Registro inválido ou repetido impede o backend de subir;
  - uma fila durável por consumidor (`jaja.<nome>`), ligada ao exchange `jaja.events` pelo tipo do evento;
  - processamento **uma única vez por consumidor**: nova tabela `processed_messages` (migration `messaging_processed_messages`). A marca de processada, o caso de uso e os novos eventos do outbox ficam na mesma transação, e uma falha desfaz tudo, inclusive a marca;
  - os casos de uso chamados por um consumidor **reaproveitam a transação dele** sem mudar de código (mesmo `runInTransaction` usado pelos controllers);
  - eventos gravados dentro de um consumidor recebem `causationId` e `correlationId` no `metadata`, sem sobrescrever chaves do próprio evento;
  - novas tentativas com espera crescente (1 s, 2 s, 4 s… até 60 s) pela fila `<fila>.wait`, que devolve a mensagem só à fila do consumidor. Esgotado o limite, ou com mensagem inválida, a mensagem vai para `<fila>.dead`;
  - espera inicial opcional pela mesma fila `.wait`, para simular o tempo dos serviços no próximo prompt;
  - consumo desligável; o backend sobe e continua atendendo HTTP com o broker fora do ar; a reconexão retoma as assinaturas; o desligamento espera as mensagens em processamento;
  - logs sem `payload`, `metadata` ou credenciais;
  - configuração por `.env`: `EVENT_CONSUMERS_ENABLED`, `EVENT_CONSUMER_PREFETCH` e `EVENT_CONSUMER_MAX_ATTEMPTS`.
- **Ajustes na infraestrutura existente (`@jaja/backend`):**
  - o cálculo de espera entre tentativas e a leitura de inteiros da configuração passam a ser compartilhados pelo relay e pelo consumo, sem mudar o comportamento do outbox;
  - a limpeza de credenciais da URL do broker passa a ser usada também pelo consumo;
  - o `PrismaService` desconecta no último hook de desligamento, para o relay e os consumidores terminarem o trabalho em andamento antes.
- **CLI (`@jaja/cli`):** novo comando `broker:queues`, que lista as filas por consumidor (prontas, em processamento, na espera e descartadas) pela API do painel e avisa quando houver mensagens descartadas, sem exibir a senha.
- **Testes:** unitários (espera, transação reaproveitada, causa, mapper, registro, runner, parser e adapter com `amqplib` simulado) e um e2e opcional (`MESSAGING_E2E=true`) contra Postgres e RabbitMQ reais com consumidores de teste.
- Fora do escopo: consumidores de negócio e novos status ou eventos do pedido; reprocessamento automático da fila de descarte; limpeza de `processed_messages`; ordem garantida por agregado; filas quorum; processos separados de consumo; limite de novas entregas feitas pelo próprio broker; tela de eventos no admin; frontend; alterações em `packages/shared` e `modules/*`.

## Capabilities

### New Capabilities

- `messaging/event-consumer`: registro de consumidores de eventos no backend, fila por consumidor, processamento uma única vez por consumidor na mesma transação do caso de uso, transação reaproveitada, causa e correlação dos eventos gerados, novas tentativas com espera crescente, descarte, espera inicial opcional, ausência de ordem garantida, consumo desligável e resiliente ao broker e logs sem dados sensíveis.

### Modified Capabilities

- `messaging/message-broker`:
  - o consumo também passa por uma porta, e trocar de broker é trocar os dois providers;
  - a conexão de consumo é própria e reconecta sozinha;
  - novas filas de consumo, espera e descarte, com cabeçalhos de controle e republicação confirmada antes da confirmação da original;
  - novo comando `broker:queues` no CLI;
  - o `.env.example` documenta as variáveis do consumo.
- `messaging/event-outbox`:
  - "Entrega pelo menos uma vez" passa a citar o descarte de repetições pelos consumidores;
  - "Eventos gravados na mesma transação do agregado" passa a incluir `causationId` e `correlationId` quando a gravação acontece dentro de um consumidor.

## Impact

- `apps/backend`:
  - banco: model `ProcessedMessage` em `prisma/models/messaging.model.prisma` e a migration `messaging_processed_messages` (aditiva);
  - código novo:
    - `src/db/active-transaction.manager.ts`;
    - em `src/messaging/`: `backoff.ts`, `config.util.ts`, `consumer/*` (registro, runner, marca de processada, causa) e `rabbitmq/*` (consumer, parser, utilitários da URL);
    - testes `*.spec.ts` ao lado e `test/messaging-consumer.e2e-spec.ts`;
  - alterados:
    - `src/db/prisma.service.ts` (hook de desligamento);
    - em `src/messaging/`: `messaging.module.ts`, `index.ts`, `messaging-errors.ts`, `outbox/outbox-backoff.ts`, `outbox/outbox-relay.ts`, `outbox/outbox-event.mapper.ts`, `outbox/domain-event.prisma.ts` e `rabbitmq/rabbitmq-message.publisher.ts`;
    - `.env.example`;
  - sem novas dependências (`amqplib` já instalado); o `.env` local pode receber as novas variáveis, e sem elas valem os padrões.
- `apps/cli`: `src/commands/broker/broker.commands.ts`, `broker/lib.ts`, `broker/lib.test.ts` e `README.md`.
- RabbitMQ local: novas filas duráveis por consumidor (`jaja.<nome>`, `.wait` e `.dead`), criadas só quando houver consumidores registrados. Nesta change, só o e2e as cria, e ele as remove ao final.
- Sem mudanças em APIs HTTP, no frontend, em `packages/shared` ou em `modules/*`. `POST /me/orders` continua gravando e publicando `order.placed` como antes.
