## Context

Ver `proposal.md` — Why. O estado que importa para o desenho:

- `Order.advanceTo(status)` é público, valida que o destino é o próximo da sequência, devolve um clone com a data do passo e acrescenta o evento;
- `OrderStatusChangedEvent` é uma classe só, com o `type` derivado do status por `ORDER_STATUS_EVENT_TYPES` e payload igual nos quatro passos;
- `AdvanceOrderStatus` faz, para os quatro passos: valida id e status → `findById` → `hasReached` devolve `changed: false` sem abrir transação → `advanceTo` → `update` + `append` em uma `runInTransaction`;
- `ORDER_SIMULATION_STEPS`, em `apps/backend`, guarda o status de destino de cada consumidor;
- o caso de uso **não tem rota HTTP**: os únicos chamadores são os quatro consumidores simulados.

Restrições:

- os `type` publicados (`order.placed` e os quatro do ciclo) são contrato de integração já em uso pelo outbox, pelos consumidores, pelo SSE do cliente e pelo monitor — **não mudam**;
- `packages/shared` é submódulo e não é alterado; `AbstractDomainEvent` é a base de evento disponível;
- sem migration: o banco guarda o payload do evento como JSON em `domain_event`, e o pedido continua com status e datas;
- o ambiente é mockado: não há gateway, WMS nem roteirizador reais.

Este desenho **revisa as decisões 2, 3 e 4** do `design.md` da change arquivada `2026-09-17-ciclo-pedido`.

## Goals / Non-Goals

**Goals:**

- o domínio expressa as operações do negócio (aprovar pagamento, separar, despachar, entregar), cada uma com o seu contrato de entrada e o seu evento;
- a sequência do pedido deixa de ser decidida pela camada de adapter;
- a mecânica comum (idempotência, transação, gravação do evento) fica em **um** lugar, não em quatro cópias;
- o contrato publicado continua intacto, para a mudança não alcançar consumidores, monitor nem frontend.

**Non-Goals:**

- desfechos alternativos e novos status — o desenho só precisa **não atrapalhá-los**;
- levar os dados do passo para o pedido, para a API ou para as telas;
- separar os serviços simulados em eventos próprios (`payment.approved`, …), com o pedido reagindo a eles;
- qualquer otimização de concorrência além da que existe hoje.

## Decisions

### 1. Métodos de passo na entidade, com `advanceTo` privado

`Order` ganha `approvePayment`, `startPicking`, `dispatch` e `completeDelivery`. Cada um valida os dados do seu passo, chama o `advanceTo` **privado** (que mantém a checagem de transição e o clone com a data do passo) e acrescenta o seu evento ao clone. O `this` continua intacto, como hoje.

A decisão 2 do prompt 17 descartou "métodos por passo" porque repetiriam a mesma regra quatro vezes. Com o `advanceTo` privado compartilhado, a regra da sequência continua em um lugar só: o que cada método acrescenta é a validação dos seus dados e o seu evento — coisas que hoje não existem e que, num método genérico, teriam de virar um `switch`.

Alternativas descartadas:

- **manter `advanceTo` público com um mapa de fábricas de evento:** a entidade continuaria com um ponto único que conhece os quatro passos, e os dados de cada passo entrariam como um saco genérico;
- **máquina de estados configurada por tabela:** mais flexível do que o ciclo linear precisa, e esconde justamente o vocabulário que esta change quer explicitar.

### 2. Uma classe de evento por fato, com base comum

Quatro classes (`OrderPaymentApprovedEvent`, `OrderPickingStartedEvent`, `OrderOutForDeliveryEvent`, `OrderDeliveredEvent`), cada uma estendendo `AbstractDomainEvent` com o seu payload: a base `OrderStepPayload` (`customerId`, `previousStatus`, `status`, `changedAt`) mais os campos do passo. `ORDER_STATUS_EVENT_TYPES` sai da classe removida e passa a viver em `order-step.event.ts`, ainda como a chave que os consumidores assinam. `ORDER_AGGREGATE_TYPE` continua em `order-placed.event.ts`.

A decisão 3 do prompt 17 descartou "uma classe por evento" como "quatro arquivos quase idênticos, sem ganho". Isso valia enquanto o payload era o mesmo nos quatro; deixa de valer no momento em que cada passo carrega o seu dado — que é exatamente o que esta change faz.

`status` continua no payload mesmo sendo dedutível do `type`: o monitor e a linha do tempo leem os eventos de forma uniforme, e tirá-lo seria uma quebra sem ganho.

Alternativa descartada: **manter a classe única com um campo `data: Record<string, unknown>`** — mataria a tipagem e a validação, e empurraria a regra de cada passo para quem lê o evento.

### 3. Base abstrata para a mecânica do passo

`OrderStepUseCase<IN>` implementa `UseCase<IN, OrderStepOutputDTO>` com o `execute` completo (validar o id → `findById` → `hasReached` → `applyTo` → `update` + `append` na mesma transação) e dois pontos de extensão: `status` (o passo que o caso de uso conclui) e `applyTo(order, input)`. Os quatro casos de uso concretos só declaram esses dois e a sua entrada; a validação dos dados fica na entidade, então `applyTo` é uma chamada. A base **não** é exportada na API do pacote: o público são os quatro casos de uso.

É a mesma mecânica de `AdvanceOrderStatus` (inclusive a leitura fora da transação e o "já concluído" terminando em sucesso), agora com o status vindo do caso de uso em vez da entrada.

Alternativas descartadas:

- **quatro cópias do `execute`:** ~60 linhas de transação e idempotência duplicadas, com quatro lugares para corrigir o mesmo bug;
- **composição por callback** (um colaborador `run(status, orderId, apply)`): equivalente em efeito, mas deixa cada caso de uso com uma indireção a mais e sem contrato explícito do que é o passo;
- **manter `AdvanceOrderStatus` público e só renomear os chamadores:** não resolveria nem a entrada por passo nem a saída da sequência do adapter.

### 4. Dados simulados nascem no backend e são determinísticos

Id de transação, lista de separação, entregador, código de rastreio e previsão de entrega representam **sistemas externos**; quem os produz é o serviço simulado (`order-simulation.data.ts`, em `apps/backend`), e o domínio só recebe e valida. São derivados do id do pedido (`TX-`, `SEP-`, `JAJA-` + os 8 primeiros caracteres em maiúsculas), com entregador fixo e previsão de `agora + 15 min`.

Determinismo em vez de `Math.random`: os testes conferem valores exatos, o log do ciclo fica legível e reprocessar uma mensagem produz o mesmo dado.

Alternativa descartada: **gerar os dados no domínio** — inverteria as camadas, e o pedido passaria a inventar dados de sistemas que não são dele.

### 5. O dado do passo vive no evento, não no pedido

O pedido continua projetando só status e datas; o fato completo fica no payload em `domain_event`. Isso mantém a change sem migration e sem mexer em API nem em tela.

Trade-off assumido: o agregado emite um evento com dados que ele não guarda. É aceitável porque esses dados são do fato, não do estado do pedido — nenhuma regra do pedido depende deles hoje. Quando uma tela precisar exibir o código de rastreio, a coluna entra por outro prompt, junto com a regra que a usa.

### 6. Um código de erro por passo

`ORDER_PAYMENT_DATA_INVALID`, `ORDER_PICKING_DATA_INVALID`, `ORDER_DISPATCH_DATA_INVALID` e `ORDER_DELIVERY_DATA_INVALID`, em vez de um `ORDER_STEP_DATA_INVALID` genérico: a falha diz qual serviço mandou dado ruim, e o frontend (que hoje não recebe nenhum deles) poderá dar mensagens diferentes sem um novo contrato. `ORDER_STATUS_INVALID` continua existindo, mas só para pedido gravado com status e datas inconsistentes.

## Risks / Trade-offs

- **[Os quatro casos de uso ficam finos hoje: status, `applyTo` e a entrada]** → é a especialização que interessa (nome, contrato e teste próprios); a mecânica não foi duplicada. O corpo cresce quando entrar a primeira regra própria (recusa, item em falta, entrega frustrada), e aí ela fica contida em um arquivo.
- **[Herança em vez de composição na base do passo]** → o `execute` é fechado e há só dois pontos de extensão; a base não é exportada, então nada fora do pacote depende dessa forma.
- **[Payload cresce sem ninguém consumir os campos novos]** → o custo é uma coluna JSON maior em `domain_event`; em troca, o dado do fato existe desde já e a próxima change não precisa reescrever eventos.
- **[Quebrar sem querer o contrato publicado]** → o e2e do ciclo confere os cinco `type` na ordem, e o frontend não é tocado: se o frontend precisar de ajuste, é sinal de quebra e a implementação deve parar e reportar.
- **[Leitura do pedido fora da transação]** → risco herdado do prompt 17 e inalterado: só um consumidor conclui cada passo, e a marca de processada cobre a mesma mensagem. Com dois produtores do mesmo passo, seria preciso `update` condicional (`WHERE status = anterior`).
- **[Eventos antigos com payload sem os campos novos]** → nenhum consumidor lê esses campos; quem for ler no futuro precisa tratá-los como opcionais nos eventos gravados antes desta change.

## Migration Plan

1. **Domínio (`@jaja/orders`):** erros, eventos, entidade, DTOs, casos de uso e testes; `npm test` e `npm run build` no workspace.
2. **Backend (`@jaja/backend`):** dados simulados, tabela dos passos, consumidores e testes; `npm run test`, `npm run lint` e `npm run build` no workspace. Depende do `dist` do passo 1.
3. **Conferência manual:** um pedido do frontend até `DELIVERED`, com o acompanhamento ao vivo, o monitor administrativo e o payload dos eventos em `domain_event`.

Sem migration de banco e sem mudança de contrato publicado, o rollback é reverter os commits: eventos gravados pela versão nova continuam legíveis pela antiga (campos extras no payload são ignorados), e vice-versa.
