# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Pacote de domínio desta entrega: `modules/orders` (`@jaja/orders`, agregados `cart` e `order`, prompts 13 e 15). Backend: `apps/backend` (NestJS 12, ESM com imports relativos terminando em `.js`, Vitest). Frontend: `apps/frontend` (Next.js 16, React 19) — **não muda nesta entrega**. Shared: `@mentoria-360/shared` (submódulo em `packages/shared`). Skills em `.claude/skills/*`; padrão de nomes em `.claude/skills/skills-standards.md`.
- **Pré-requisitos: prompts 15 (`pedido`), 16 (`consumo-eventos`), 17 (`ciclo-pedido`) e 18 (`monitor-pedidos`) já implementados.** O que existe hoje:
  - o pedido nasce `PLACED` e anda sozinho até `DELIVERED` pela sequência `PLACED` → `PAYMENT_APPROVED` → `PICKING` → `OUT_FOR_DELIVERY` → `DELIVERED`, com a data de cada passo no próprio pedido;
  - **eventos:** duas classes em `modules/orders/src/order/event/`. `OrderPlacedEvent` (`order.placed`), com payload de negócio (cliente, itens congelados e totais); e `OrderStatusChangedEvent`, **uma classe para os quatro passos**, com o `type` derivado do status pelo mapa `ORDER_STATUS_EVENT_TYPES` (`order.payment-approved`, `order.picking-started`, `order.out-for-delivery`, `order.delivered`) e payload igual nos quatro (`customerId`, `previousStatus`, `status`, `changedAt`);
  - **entidade:** `Order.advanceTo(status)` valida que o destino é o **próximo** da sequência, devolve um clone com a data do passo e acrescenta o `OrderStatusChangedEvent`;
  - **caso de uso:** `AdvanceOrderStatus`, **um só para os quatro passos**, entrada `{ orderId, status }`: valida o id e o status, lê o pedido, devolve `changed: false` sem abrir transação quando o pedido já alcançou o destino e, senão, grava pedido e evento na mesma transação;
  - **serviços simulados:** `apps/backend/src/modules/orders/simulation/order-simulation.steps.ts` tem a tabela `ORDER_SIMULATION_STEPS` (`consumerName`, `eventType`, **`status`**, `baseDelayMs`), e `order-simulation.consumers.ts` registra os quatro consumidores com um handler genérico que lê `payload.aggregateId` e chama `AdvanceOrderStatus` com o status da tabela e o `transactionManager` do consumidor;
  - o outbox publica com routing key igual ao `type`; `LiveEventFeed`, o SSE do cliente (`GET /me/orders/:id/stream`), o monitor administrativo e a linha do tempo leem só `type`, `aggregateType`, `aggregateId` e `occurredAt` — **nenhum deles lê o payload dos eventos do pedido**.
- **Objetivo:** trocar o desenho genérico ("mudar o status") pelo desenho de negócio ("aprovar o pagamento", "separar", "despachar", "entregar"), em três frentes:
  1. **um caso de uso por operação de negócio**, no lugar do `AdvanceOrderStatus` genérico;
  2. **um evento por fato**, cada um com o payload do seu passo, no lugar da classe única;
  3. **a sequência do pedido sai da camada de adapter**: hoje a tabela do backend diz para qual status o pedido deve ir; passa a dizer só qual serviço reage a qual evento, e o domínio decide a consequência.
- **Por que agora:** o contrato de entrada único (`{ orderId, status }`) não tem onde receber o dado de cada passo (id da transação do pagamento, lista de separação, entregador e código de rastreio, quem recebeu), e os desfechos alternativos que virão (pagamento recusado, item em falta, entrega frustrada) não são "avançar para o próximo status". Fazer a separação agora custa pouco: **os `type` na linha não mudam**, então não há migration, nem quebra de consumidores, do monitor, do SSE ou do frontend.
- **Decisões:**
  - **Métodos de passo na entidade:** `Order` ganha `approvePayment`, `startPicking`, `dispatch` e `completeDelivery`. A regra da sequência **continua em um lugar só**: um `advanceTo` **privado** faz o clone com a data do passo e a checagem do próximo status; cada método público valida os seus dados e acrescenta o seu evento. (O `design.md` do prompt 17 descartou "métodos por passo" porque repetiriam a mesma regra quatro vezes; com o `advanceTo` privado compartilhado, não repetem.)
  - **Um evento por fato, com base comum:** os quatro payloads compartilham `customerId`, `previousStatus`, `status` e `changedAt` (tipo `OrderStepPayload`) e cada um acrescenta os campos do seu passo. `status` continua no payload, mesmo sendo dedutível do `type`, para a leitura uniforme do monitor.
  - **Os dados simulados nascem no backend, não no domínio:** o id de transação, a lista de separação, o entregador, o código de rastreio e a previsão de entrega são dados de **sistemas externos**; quem os produz é o serviço simulado (`apps/backend`), e o domínio só os recebe e valida. Devem ser **determinísticos** a partir do id do pedido (nada de `Math.random`), para os testes e o log ficarem estáveis.
  - **Dado do passo fica no evento, não em coluna do pedido:** o pedido continua guardando só status e datas; o dado de cada passo vive no payload do evento (tabela `domain_event`). Levar esses dados para colunas do pedido é assunto de outro prompt e **não** entra aqui — nenhuma migration nesta entrega.
  - **Mecânica compartilhada em uma base abstrata:** a plumbing de "valida o id → lê o pedido → passo já concluído devolve `changed: false` sem abrir transação → aplica → grava pedido e evento na mesma transação" fica em uma classe abstrata, e não em quatro cópias. A especialização é o **contrato** e a **semântica**, não o encanamento.
  - **`ORDER_STATUS_EVENT_TYPES` continua existindo:** é o que os consumidores usam para assinar. Só deixa de ser o gerador do `type` de uma classe única.
- **Referências de código** (o código é a fonte da verdade do **padrão**; este prompt é a fonte da verdade das **regras**):
  - domínio: `modules/orders/src/order/**` (`event/`, `model/order.entity.ts`, `use-case/advance-order-status.use-case.ts`, `use-case/place-order.use-case.ts`, `dto/order.dto.ts`, `errors.ts`) e `modules/orders/test/order/**` (inclusive os mocks em `test/mock/`);
  - backend: `apps/backend/src/modules/orders/simulation/` (`order-simulation.steps.ts`, `order-simulation.consumers.ts`), `apps/backend/test/modules/orders/simulation/order-simulation.consumers.spec.ts` e `apps/backend/test/order-lifecycle.e2e-spec.ts`;
  - specs: `openspec/specs/orders/order-lifecycle/spec.md` e o `design.md` da change arquivada `openspec/changes/archive/2026-09-17-ciclo-pedido/` (decisões 2, 3, 4 e 5, que esta entrega revisa).
- `@jaja/orders` é consumido pelo backend via `dist`: rodar `npm run build --workspace=@jaja/orders` antes de usar o pacote no backend. Os testes do pacote de domínio usam jest; os do backend, Vitest. O frontend não importa pacotes `@jaja/*`.
- Spec desta funcionalidade: change `openspec/changes/passos-do-pedido`, gerada a partir deste prompt. Em caso de dúvida sobre comportamento, valem as specs e o `design.md` da change.
- **Fora do escopo desta funcionalidade:**
  - novos status e desfechos alternativos: pagamento recusado, cancelamento, estorno, item em falta, entrega frustrada e compensação;
  - guardar os dados do passo em colunas do pedido, exibi-los no acompanhamento do cliente ou no monitor, e qualquer migration;
  - dar eventos próprios aos serviços simulados (`payment.approved`, `delivery.dispatched`, …), com o pedido reagindo a eles — a simplificação didática documentada no `design.md` do prompt 17 continua valendo e é assunto de outro prompt;
  - mudar os `type` publicados, o outbox, o consumo de eventos, o `LiveEventFeed`, o SSE, o monitor e a linha do tempo;
  - qualquer alteração no frontend, em `packages/shared`, no seed e no agregado `cart`;
  - endpoint administrativo para avançar um pedido à mão.

# Negócio

Skills: `module-entity`, `module-use-case`, `module-dto`. Tudo em `modules/orders`.

- **Erros** (`src/order/errors.ts`): acrescentar a `OrderErrors`, depois de `ORDER_STATUS_TRANSITION_INVALID`, os códigos de dado de passo inválido: `ORDER_PAYMENT_DATA_INVALID`, `ORDER_PICKING_DATA_INVALID`, `ORDER_DISPATCH_DATA_INVALID` e `ORDER_DELIVERY_DATA_INVALID`. Acrescentar também `ORDER_PAYMENT_METHODS = ['SIMULATED', 'CREDIT_CARD', 'PIX'] as const` e `OrderPaymentMethod`, com o comentário de que só `SIMULATED` é usado hoje (não há dado de pagamento real) e os outros documentam onde os meios reais entram.

- **Eventos** (`src/order/event/`): apagar `order-status-changed.event.ts` e criar, no lugar, a base comum e quatro classes, cada uma no seu arquivo. Nenhuma altera `OrderPlacedEvent`.
  - `order-step.event.ts`: `ORDER_STATUS_EVENT_TYPES` (movido para cá, sem mudar os valores) e `OrderStatusEventType`; `ORDER_AGGREGATE_TYPE` continua em `order-placed.event.ts` e é importado de lá, sem cópia; o tipo `OrderStepPayload` (`customerId`, `previousStatus`, `status`, `changedAt` em texto ISO 8601) e a entrada comum `OrderStepEventInput` (`orderId`, `customerId`, `previousStatus`, `changedAt: Date`). Documentar que todo evento de passo é um fato já consumido, gravado na mesma transação da mudança pelo `DomainEventRepository.append`, publicado pelo outbox com routing key igual ao `type`, com `aggregateType` `Order`, `occurredAt` igual à data do passo e `metadata` vazio (causa e correlação são preenchidas pelo outbox).
  - `order-payment-approved.event.ts` → `OrderPaymentApprovedEvent`, `type` `order.payment-approved`, payload `OrderStepPayload & { transactionId, paymentMethod, amountCents }`. `amountCents` é o total do pedido; `transactionId` e `paymentMethod` vêm do gateway.
  - `order-picking-started.event.ts` → `OrderPickingStartedEvent`, `type` `order.picking-started`, payload `OrderStepPayload & { pickingListId, itemCount }`. `itemCount` é a soma das quantidades do pedido.
  - `order-out-for-delivery.event.ts` → `OrderOutForDeliveryEvent`, `type` `order.out-for-delivery`, payload `OrderStepPayload & { courierName, trackingCode, estimatedDeliveryAt }` (texto ISO 8601).
  - `order-delivered.event.ts` → `OrderDeliveredEvent`, `type` `order.delivered`, payload `OrderStepPayload & { receivedBy }`.
  - Cada classe segue o padrão de `OrderPlacedEvent`: construtor privado, `tryCreate` com `Result.try` em volta de `super.tryCreateFromProps` (`toISOString` estoura para data inválida) e `create` que estoura pelo `validator`. `previousStatus` e `status` são os da sequência, não validados de novo aqui: quem garante a transição é a entidade.
  - `event/index.ts`: exportar os cinco arquivos e atualizar o union `OrderEvent` para `OrderPlacedEvent | OrderPaymentApprovedEvent | OrderPickingStartedEvent | OrderOutForDeliveryEvent | OrderDeliveredEvent`.

- **Entidade** (`src/order/model/order.entity.ts`):
  - `advanceTo` passa a ser **privado** e a **não criar evento**: recebe o próximo status e `now`, mantém a checagem de transição (`ORDER_STATUS_TRANSITION_INVALID`) e devolve o clone com o status, a data do passo e `updatedAt`.
  - Quatro métodos públicos, cada um `(input, now: Date = new Date()): Result<Order>`, que validam os seus dados, chamam o `advanceTo` privado e acrescentam o seu evento ao clone (o `this` continua intacto):
    - `approvePayment({ transactionId, paymentMethod })` → `PAYMENT_APPROVED` + `OrderPaymentApprovedEvent` com `amountCents: this.totalCents`. `transactionId`: texto não vazio depois do `trim`, até 64 caracteres; `paymentMethod`: um de `ORDER_PAYMENT_METHODS`. Qualquer um inválido falha com `ORDER_PAYMENT_DATA_INVALID`, **sem** alterar o pedido e **sem** evento.
    - `startPicking({ pickingListId })` → `PICKING` + `OrderPickingStartedEvent` com `itemCount: this.itemCount`. `pickingListId`: texto não vazio depois do `trim`, até 64 caracteres; senão `ORDER_PICKING_DATA_INVALID`.
    - `dispatch({ courierName, trackingCode, estimatedDeliveryAt })` → `OUT_FOR_DELIVERY` + `OrderOutForDeliveryEvent`. `courierName`: de 2 a 100 caracteres depois do `trim`; `trackingCode`: texto não vazio, até 64; `estimatedDeliveryAt`: data válida e **não anterior** à data do passo; senão `ORDER_DISPATCH_DATA_INVALID`.
    - `completeDelivery({ receivedBy })` → `DELIVERED` + `OrderDeliveredEvent`. `receivedBy` é opcional: ausente, `null` ou vazio usa o `recipientName` do pedido; presente, de 2 a 100 caracteres depois do `trim`, senão `ORDER_DELIVERY_DATA_INVALID`. O payload nunca vai com `receivedBy` vazio.
  - Os dados do passo **não** viram props do pedido: nada de novas colunas, `OrderProps` ou `OrderDTO`. Documentar isso no comentário da classe, junto com a ordem "valida os dados → avança → grava o evento".
  - `hasReached`, `isValidStatus`, os getters, `toDTO` e o resto não mudam.

- **DTOs** (`src/order/dto/order.dto.ts`): apagar `AdvanceOrderStatusInputDTO`; renomear `AdvanceOrderStatusOutputDTO` para `OrderStepOutputDTO` (mesmos campos `status` e `changed`, comentário atualizado para "passo") e criar as quatro entradas, cada uma com o seu comentário:
  - `ApproveOrderPaymentInputDTO { orderId, transactionId, paymentMethod }`;
  - `StartOrderPickingInputDTO { orderId, pickingListId }`;
  - `DispatchOrderInputDTO { orderId, courierName, trackingCode, estimatedDeliveryAt: Date }`;
  - `CompleteOrderDeliveryInputDTO { orderId, receivedBy?: string | null }`.

- **Casos de uso** (`src/order/use-case/`): apagar `advance-order-status.use-case.ts` e criar:
  - `order-step.use-case.ts` → `abstract class OrderStepUseCase<IN extends { orderId: string }> implements UseCase<IN, OrderStepOutputDTO>`, com o construtor recebendo `OrderRepository`, `DomainEventRepository` e `TransactionManager`, os membros abstratos `status` (o passo que o caso de uso conclui) e `applyTo(order, input): Result<Order>`, e o `execute` com a mecânica de hoje, **na mesma ordem e com os mesmos desfechos** do `AdvanceOrderStatus`:
    1. `Id.required` sobre `orderId` (ausente ou malformado falha com o erro do `Id`);
    2. `findById` (falha, inclusive `ORDER_NOT_FOUND`, encerra);
    3. `hasReached(this.status)` → `Result.ok({ status: <atual>, changed: false })` **sem abrir transação** e sem gravar;
    4. `applyTo(order, input)`, que valida os dados do passo e chama o método da entidade (passo fora de ordem falha com `ORDER_STATUS_TRANSITION_INVALID`, dado inválido com o código do passo);
    5. em uma `runInTransaction`: `update` do pedido e `append` dos eventos com o mesmo `tx`, com `throwsIfFailed` para desfazer tudo e o `catch` de `ResultError` virando `Result.fail`;
    6. `Result.ok({ status, changed: true })`.

    No JSDoc, manter as observações do caso de uso de hoje: a leitura fora da transação (contrato do shared) e o "já concluído" terminando com sucesso para tolerar mensagem repetida ou fora de ordem. **Não** exportar esta classe em `use-case/index.ts`: ela é colaboradora interna, e a API pública do pacote são os quatro casos de uso.
  - `approve-order-payment.use-case.ts` → `ApproveOrderPayment` (`status` `PAYMENT_APPROVED`, `applyTo` chamando `order.approvePayment`);
  - `start-order-picking.use-case.ts` → `StartOrderPicking` (`PICKING`, `order.startPicking`);
  - `dispatch-order.use-case.ts` → `DispatchOrder` (`OUT_FOR_DELIVERY`, `order.dispatch`);
  - `complete-order-delivery.use-case.ts` → `CompleteOrderDelivery` (`DELIVERED`, `order.completeDelivery`).

    Cada um com JSDoc próprio: o que a operação significa no negócio, quem a dispara (o serviço simulado de pagamento, a loja, a entrega), o evento que grava e as suas falhas. `use-case/index.ts` exporta só os quatro.

- **Testes** (jest, em `modules/orders/test/`, espelhando `src/`):
  - apagar `test/order/order-status-changed.event.test.ts` e `test/order/advance-order-status.use-case.test.ts`, aproveitando os casos que continuam valendo;
  - um arquivo por evento (`test/order/order-payment-approved.event.test.ts` e os outros três), no padrão de `order-placed.event.test.ts`: `type`, `aggregateType`, `aggregateId`, `occurredAt` igual a `changedAt`, `metadata` vazio, payload completo (inclusive o campo do passo), id diferente a cada criação, `orderId` inválido e data inválida;
  - um arquivo por caso de uso (`test/order/approve-order-payment.use-case.test.ts` e os outros três), cobrindo: caminho feliz (pedido gravado no novo status, evento do tipo certo com o payload do passo, tudo na mesma transação), passo já concluído (`changed: false`, nada gravado, nenhuma transação aberta), passo fora de ordem (`ORDER_STATUS_TRANSITION_INVALID`), `orderId` ausente ou inválido, pedido inexistente (`ORDER_NOT_FOUND`), dado do passo inválido (o código do passo, sem gravar) e falha ao gravar o evento desfazendo o pedido;
  - em `test/order/order.entity.test.ts`: trocar os testes de `advanceTo` pelos dos quatro métodos (evento certo e payload, data do passo preenchida, `this` intacto, pulo de passo, pedido entregue, e a validação de dado de cada passo, inclusive `receivedBy` ausente caindo no `recipientName` e `estimatedDeliveryAt` anterior à data do passo);
  - manter `test/mock/in-memory-order.repository.ts` e `in-memory-domain-event.repository.ts` como estão, se atenderem; ajustar só o necessário.
  - Rodar `npm test --workspace=@jaja/orders` e `npm run build --workspace=@jaja/orders`.

> Os passos dos casos de uso podem gerar erros e parar o processo.

# Backend

Skill: `backend-controller` (só para o padrão de camada; **nenhuma rota nova**). Tudo em `apps/backend`.

- **Dados dos serviços simulados:** criar `src/modules/orders/simulation/order-simulation.data.ts` com os geradores **determinísticos** a partir do id do pedido (nada de aleatório), cada um com o comentário de que representa o dado de um sistema externo: `simulatedTransactionId(orderId)` (`TX-<8 primeiros do id em maiúsculas>`), `simulatedPickingListId(orderId)` (`SEP-<idem>`), `simulatedTrackingCode(orderId)` (`JAJA-<idem>`), `SIMULATED_COURIER_NAME` (`'Entregador Simulado'`) e `estimatedDeliveryAt(now)` (`now` + 15 minutos). O meio de pagamento é sempre `'SIMULATED'`.
- **Tabela dos passos** (`order-simulation.steps.ts`): `OrderSimulationStep` perde o campo `status` e ganha `execute(deps, orderId)`, que monta os dados simulados do serviço e chama o caso de uso do passo com os adapters e o `transactionManager` recebidos, devolvendo `Promise<Result<OrderStepOutputDTO>>`. Declarar o tipo das dependências (`OrderRepository`, `DomainEventRepository` e `TransactionManager`). Os quatro itens continuam com os mesmos `consumerName`, `eventType` e `baseDelayMs` de hoje, agora apontando para `ApproveOrderPayment`, `StartOrderPicking`, `DispatchOrder` e `CompleteOrderDelivery`. Atualizar o comentário do arquivo: a tabela diz **qual serviço reage a qual evento**; qual status o pedido alcança é decisão do domínio.
- **Consumidores** (`order-simulation.consumers.ts`): o handler continua lendo `payload.aggregateId` (ausente → `ORDER_NOT_FOUND`) e passa a chamar `step.execute({ orderRepository: this.orderPrisma, domainEventRepository: this.domainEventPrisma, transactionManager }, orderId)`. O log de sucesso deixa de imprimir o status da tabela e passa a imprimir o status devolvido pelo caso de uso (`Pedido <8 primeiros> → <status>`); o log de "nada mudou" continua em `debug`. Registro, espera, `ORDER_SIMULATION_ENABLED` e `ORDER_SIMULATION_DELAY_FACTOR` não mudam.
- **Testes:**
  - `test/modules/orders/simulation/order-simulation.consumers.spec.ts`: manter os casos de registro (nomes, eventos assinados, esperas, fator, desligado) e atualizar os de processamento — o pedido é gravado no status do passo, o evento gravado é o do tipo certo **com os dados simulados no payload**, o `transactionManager` recebido é o usado, passo já concluído termina em sucesso só com log `debug`, e a falha do caso de uso é repassada;
  - `test/order-lifecycle.e2e-spec.ts` (`MESSAGING_E2E=true`): manter a sequência dos cinco `type` e acrescentar a conferência de que o payload de cada evento de passo traz os campos do seu passo (id de transação, lista de separação, entregador e rastreio, quem recebeu);
  - rodar `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` sem erros.
- **Conferência manual:** com Postgres e RabbitMQ no ar e o backend em `npm run dev --workspace=@jaja/backend`, fazer um pedido pelo frontend (sem alterá-lo) e conferir: o acompanhamento do cliente continua andando ao vivo até "Entregue"; o monitor administrativo continua mostrando os cinco eventos na ordem, com causa e correlação; e, na tabela `domain_event`, o payload de cada evento de passo traz os dados do seu passo. Nada no frontend deve precisar de ajuste — se precisar, parar e reportar, porque o contrato publicado não deveria ter mudado.

# Specs da change

Só `orders/order-lifecycle` muda. As capabilities `orders/order-placement`, `orders/order-tracking`, `orders/order-monitor` e as de `messaging/*` **não mudam** (os `type` publicados, o outbox, o consumo e os avisos ao vivo continuam iguais) — confirmar isso na proposta em vez de editá-las.

- Manter sem alteração os requisitos "Sequência de status do pedido" e "Data de cada passo".
- Substituir "Evento a cada mudança de status" por **"Evento de negócio de cada passo"**: cada passo grava, na mesma transação da mudança, o evento do seu fato — `order.payment-approved`, `order.picking-started`, `order.out-for-delivery` e `order.delivered` —, todos com `aggregateType` `Order`, `aggregateId` do pedido, `occurredAt` igual à data do passo e payload com a base (`customerId`, `previousStatus`, `status`, `changedAt`) mais os campos do passo (transação, meio e valor; lista de separação e quantidade de itens; entregador, rastreio e previsão; quem recebeu). Publicação pelo outbox com routing key igual ao `type` e "ler um pedido gravado não gera eventos" continuam valendo.
- Substituir "Avanço idempotente" por **"Operações do passo"**: cada operação (`ApproveOrderPayment`, `StartOrderPicking`, `DispatchOrder`, `CompleteOrderDelivery`) conclui o seu passo; pedido que já concluiu o passo termina com sucesso sem gravar nada; pedido inexistente falha com `ORDER_NOT_FOUND`; pedido em um passo fora de ordem falha com `ORDER_STATUS_TRANSITION_INVALID`; dado do passo inválido falha com o código do passo (`ORDER_PAYMENT_DATA_INVALID`, `ORDER_PICKING_DATA_INVALID`, `ORDER_DISPATCH_DATA_INVALID`, `ORDER_DELIVERY_DATA_INVALID`), sem gravar nada e sem evento. O status **deixa de ser entrada** de operação: some o cenário de `ORDER_STATUS_INVALID` por status de destino inválido.
- Alterar "Serviços simulados do pedido": a tabela troca a coluna "Avança para" por "Operação" e ganha os dados simulados de cada serviço; acrescentar que esses dados são determinísticos a partir do id do pedido. Nomes dos consumidores, eventos assinados, esperas, fator e desligamento não mudam.
- Manter "Cadeia de causa e correlação do pedido" como está.

> Obs: IMPORTANTE!!! Executar as duas partes (Negócio e Backend) em subagentes separados, com contexto limpo, de forma sequencial: o Backend depende do build de `@jaja/orders`.
>
> Antes de começar, conferir que os prompts 15 a 18 estão implementados (`Order.advanceTo`, `AdvanceOrderStatus`, `ORDER_SIMULATION_STEPS` e o monitor administrativo); se não estiverem, parar e reportar.
>
> Cada subagente deve ler `.claude/skills/skills-standards.md` e, antes de criar seus arquivos, as referências de código da sua camada listadas no Contexto — inclusive o `design.md` da change arquivada `2026-09-17-ciclo-pedido`, cujas decisões 2, 3 e 4 este prompt revisa. Também:
> - nenhum subagente altera `packages/shared`, o frontend, o seed, o schema Prisma ou qualquer migration;
> - nenhum subagente muda os valores de `ORDER_STATUS_EVENT_TYPES` nem o `type` de `order.placed`;
> - o do backend não mata backends já rodando (usa outra porta se a 4000 estiver ocupada).
>
> Uma parte só começa depois de a anterior terminar com as validações passando, e cada subagente encerra listando os arquivos criados, alterados ou apagados e o resultado das validações. A conferência manual no navegador é repetida na conversa principal, com o usuário.
