## MODIFIED Requirements

### Requirement: Eventos gravados na mesma transação do agregado
O backend SHALL oferecer aos casos de uso a porta de repositório de eventos de domínio do shared (`append(events, tx)`) para registrar os eventos pendentes de um agregado. Os eventos MUST ser gravados na transação recebida, a mesma em que o agregado é persistido: se a transação for confirmada, todos os eventos ficam registrados como pendentes; se for desfeita, nenhum evento fica registrado. Cada evento MUST ser gravado com `id`, `type`, `aggregateType`, `aggregateId`, `payload`, `metadata` e `occurredAt`, e datas dentro de `payload` ou `metadata` MUST ser gravadas como texto ISO 8601. Quando a transação recebida for a de um consumidor processando uma mensagem, o `metadata` gravado MUST receber `causationId` e `correlationId` dessa mensagem, mantendo essas chaves quando o evento já as tiver. Fora de um consumidor, o `metadata` MUST ser gravado como veio no evento. Uma lista vazia MUST terminar com sucesso sem acessar o banco. Os módulos de domínio MUST conhecer só a porta: o armazenamento (tabela, colunas, status e tentativas) é detalhe do backend e MUST poder mudar sem alterar `modules/*` nem `packages/shared`.

#### Scenario: Transação confirmada
- **WHEN** um caso de uso abre uma transação, persiste o agregado, registra dois eventos com `append` na mesma transação e a transação é confirmada
- **THEN** os dois eventos ficam registrados como pendentes, com zero tentativas e disponíveis para publicação imediata

#### Scenario: Transação desfeita
- **WHEN** um caso de uso registra eventos com `append` e, ainda dentro da transação, ocorre um erro que a desfaz
- **THEN** nenhum dos eventos fica registrado

#### Scenario: Lista vazia
- **WHEN** `append` é chamado com uma lista vazia
- **THEN** o resultado é sucesso e nada é gravado

#### Scenario: Datas no payload
- **WHEN** um evento com uma data no `payload` é registrado e depois lido para publicação
- **THEN** a data aparece no `payload` como texto ISO 8601

#### Scenario: Evento gravado dentro de um consumidor
- **WHEN** um caso de uso chamado por um consumidor que processa a mensagem `A` registra um evento sem `causationId` nem `correlationId` no `metadata`
- **THEN** o evento é gravado com `metadata.causationId = A` e `metadata.correlationId` igual ao da mensagem (ou `A`, se ela não tiver um), mantendo as demais chaves do `metadata`

#### Scenario: Metadata do evento prevalece
- **WHEN** um evento com `metadata.correlationId = X` é registrado dentro de um consumidor cuja mensagem tem `correlationId = Y`
- **THEN** o evento é gravado com `correlationId = X`

### Requirement: Entrega pelo menos uma vez
A publicação MUST garantir que todo evento registrado seja publicado pelo menos uma vez, mas MAY publicar o mesmo evento mais de uma vez: se o processo parar depois de o broker confirmar a mensagem e antes de o evento ser marcado como publicado, o evento MUST continuar pendente e ser publicado de novo. O identificador da mensagem (`messageId`) MUST ser sempre o `id` do evento. Os consumidores do backend MUST usar esse identificador para descartar repetições, de modo que cada evento produza efeito no máximo uma vez por consumidor.

#### Scenario: Queda depois da publicação
- **WHEN** o broker confirma a mensagem de um evento e o processo cai antes de marcar o evento como publicado
- **THEN** o evento continua pendente e é publicado de novo, com o mesmo `messageId`, quando um relay voltar a rodar

#### Scenario: Republicação não repete o efeito
- **WHEN** um evento já processado por um consumidor é publicado de novo com o mesmo `messageId`
- **THEN** o consumidor confirma a mensagem repetida sem executar o handler outra vez
