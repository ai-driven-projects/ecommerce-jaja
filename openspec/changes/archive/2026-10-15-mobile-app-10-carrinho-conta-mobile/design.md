## Context

A etapa 9 entrega o carrinho do visitante atrás do contrato `CartRepository` (`state`, `changes`, `add`, `setQuantity`, `remove`, `refresh`), implementado pelo `GuestCartRepository` e registrado na DI como `CartRepository`. Telas, badge e detalhe do produto dependem só desse contrato e do `CartState`. Na etapa 9 o carrinho do visitante vale **mesmo com sessão**. Esta etapa troca a implementação registrada por uma que escolhe a fonte pela sessão, sem mudar as telas, a não ser em dois pontos da `CartPage` (Decisão 6).

A sessão da etapa 8 (`SessionRepository`, exposto como `Session`, que é um `Listenable` com `status`/`token`, e como `AuthRepository`) avisa os ouvintes a cada `_set`, **inclusive sem troca de estado**. O `AuthInterceptor` põe o Bearer em toda requisição com sessão e chama `expire()` no `401`. `mapHttpFailure` transforma `404` em `NotFoundFailure` **sem códigos** e outro `4xx` em `BackendRejectionFailure` com os `codes` do corpo.

Referência de comportamento (só leitura): a parte "conta" de `apps/frontend/src/modules/orders/data/cart.context.tsx` (fila de comandos, quantidades otimistas, mescla na chegada do token com o local apagado só no sucesso, `refresh` depois de erro) e `cart.api.ts`. Contrato: `MyCartController` e `throwFailure` (`apps/backend/src/modules/orders/{my-cart.controller,cart-http}.ts`). Todo comando responde `200` com o `CartDetailDTO` inteiro. `CART_PRODUCT_NOT_FOUND`/`CART_USER_NOT_FOUND` → `404`, o resto → `400`. A mescla nunca falha por causa dos itens. Mensagens: `CART_*` de `apps/frontend/src/shared/i18n/messages.pt.ts`.

## Goals / Non-Goals

**Goals:** carrinho da conta por `/me/cart` com quantidades na hora e fila de comandos; mescla ao entrar, com o local apagado só no sucesso; volta ao visitante ao sair; um repositório que escolhe a fonte pela sessão; recusas do backend com mensagem.

**Non-Goals (ficam para outras etapas):**
- Checkout, sessão obrigatória no "Finalizar pedido", `POST /me/cart/orders` e esvaziar depois do pedido: etapa 12. Nesta etapa `clear()` entra no contrato, mas nenhuma tela o usa.
- Varredura de textos e testes finais de DI e rotas: etapa 15.
- Em nenhuma etapa: recarregar o carrinho da conta ao abrir a aba (o web recarrega ao abrir a gaveta; ver "Decisões tomadas sem consulta") e "puxar para atualizar" no carrinho (o plano não lista).

## Decisions

### 1. Domínio (`lib/modules/cart/`)
- `errors/cart_errors.dart`: `CartErrorCode` ganha `productUnavailable('Produto indisponível.')`, e cada valor passa a levar também o código do backend que traduz (`CART_ITEM_QUANTITY_EXCEEDED`, `CART_ITEMS_LIMIT_EXCEEDED`, `CART_ITEM_QUANTITY_INVALID`, `CART_PRODUCT_NOT_FOUND`). Entra também `CartErrorCode? cartErrorFromCodes(List<String>)`, que devolve o primeiro código conhecido, na ordem recebida.
- `provider/cart_repository.dart`: `remove` passa a devolver `Future<Result<void>>`, porque a remoção na conta pode falhar e a mensagem precisa chegar à aba. Entra `Future<Result<void>> clear()`. O visitante devolve sempre `Ok`.
- `model/cart_state.dart`: entra o campo `AppFailure? mergeFailure` (padrão `null`), também no `copyWith`, com `clearMergeFailure` no molde do `clearPreviewFailure` entregue. O `previewFailure` passa a significar "falha ao obter o carrinho exibido": a prévia do visitante ou a carga da conta. O nome fica, para não mexer na UI.
- `model/account_cart_items.dart` (puro): `accountCartItems(CartDetail? detail, Map<String, int> overrides)` monta os `CartItem` exibidos. Primeiro as linhas da resposta, na ordem delas, com a quantidade do override quando houver (0 tira a linha). Depois os produtos do override que ainda não são linha (> 0), na ordem de inserção do `Map`. É o `applyQuantities` + `added` do web. Com isso, `count`, `lines` e `quantityOf` do `CartState` funcionam iguais nas duas fontes.

### 2. Cliente da conta (`lib/infra/cart/account_cart_api.dart`)
`AccountCartApi(Dio)` tem `load()`, `add(id, quantity)`, `setQuantity(id, quantity)`, `remove(id)`, `clear()` e `merge(List<CartItem>)`. Todos devolvem `Future<Result<CartDetail>>` via `runRequest` + `parseCartDetail`, e o corpo da mescla vem de `encodeCartItems`. O caminho usa `Uri.encodeComponent(productId)`. Não passa token: o interceptor cuida disso.
Nos quatro comandos (não em `load`/`merge`), `mapCartFailure` traduz a falha. Um `BackendRejectionFailure` com código conhecido vira o mesmo tipo, com `message`/`code` do `CartErrorCode` e o mesmo `statusCode`/`codes`. Um `NotFoundFailure` vira `NotFoundFailure(message: 'Produto indisponível.', code: CartErrorCode.productUnavailable)`. As outras falhas passam sem mudança, e a recusa sem código conhecido mantém "Não foi possível concluir. Tente novamente.".

### 3. `GuestCartRepository` (ajustes)
- `Future<List<CartItem>> pendingItems()`: espera o `restore` terminar e devolve os itens guardados. A mescla usa esse método.
- `clear()` (contrato): esvazia os itens, apaga a chave, cancela o `Timer`, invalida a geração da prévia, zera o `detail` e avisa.
- `remove` devolve `Ok` (contrato novo). O resto não muda.

### 4. `SessionCartRepository` (`lib/infra/cart/session_cart_repository.dart`)
`SessionCartRepository extends ChangeNotifier implements CartRepository` recebe `GuestCartRepository`, `AccountCartApi` e `Session`. É **o** `CartRepository` do app.
- **Fonte:** `start()` (uma vez, pelo bootstrap) assina o `Session` e o `changes` do visitante e avalia a sessão atual. A chave da fonte é o token: `status == authenticated ? token : null`. Aviso sem troca de token é ignorado. `unknown` e `anonymous` usam o visitante: `state` é o `guest.state` e as mudanças dele são repassadas (`notifyListeners` + `changes`). As ações também são delegadas.
- **Entrar** (token novo): abre uma **geração**, zera o estado da conta (`detail` nulo → `isRestoring: true`), avisa e enfileira a carga inicial. A carga lê `guest.pendingItems()`. Sem itens, faz `load()`. Com itens, faz `merge(items)`: no `Ok`, `guest.clear()` e o `detail` da resposta. Na `Failure`, guarda `mergeFailure` e faz `load()`. Se a carga falhar, `previewFailure` recebe a falha e `detail` vira `CartDetail.empty()`.
- **Sair** (token nulo): abre outra geração, descarta o estado da conta (overrides, pendências, falhas) e volta ao visitante, avisando. Uma resposta ou tarefa da fila de geração antiga é descartada e não envia nada. Nenhuma chamada apaga o carrinho do servidor.
- **Estado da conta:** `CartState(items: accountCartItems(detail, overrides), detail: detail ?? empty, isRestoring: detail == null && previewFailure == null, isSyncing: pending > 0, previewFailure, mergeFailure)`.
- **Comandos:** id aparado e em minúsculas. Primeiro a regra pura da etapa 9 (`addCartItem`/`setCartItemQuantity`) roda sobre os itens exibidos. Se ela falhar, a `ValidationFailure` volta sem enviar nada e sem avisar. Depois: override da quantidade nova (0 em `remove`/`setQuantity 0`, todas as linhas em 0 no `clear`), `pending++` e aviso. Em seguida o comando entra na **fila** (um `Future` encadeado, cada tarefa só começa depois da anterior; a carga inicial é a primeira da fila). `setQuantity(id, 0)` usa `remove`. No `Ok`, `detail` recebe a resposta e `previewFailure` fica nulo. Na `Failure`, ela é devolvida a quem chamou e, se não for `SessionFailure`, um `load()` entra na fila. No fim de cada comando, `pending--`. Ao chegar a 0, os overrides são apagados e há aviso.
- **`refresh()`** (o "Tentar de novo"): na conta, se `guest.pendingItems()` não está vazio (mescla pendente), refaz a mescla como na entrada. Senão, `load()` na fila. Nos dois casos a falha anterior só é trocada quando a resposta chega. No visitante, `guest.refresh()`.
- **`dispose()`:** tira o ouvinte da sessão, cancela a assinatura do visitante e fecha o `StreamController`. O visitante é descartado pela DI.

### 5. DI e bootstrap
- `configureDependencies`: `AccountCartApi` (lazy singleton) e `SessionCartRepository` (lazy singleton com `dispose`). `CartRepository` passa a apontar para `getIt<SessionCartRepository>()`, e o `GuestCartRepository` continua registrado como fonte.
- `createRootWidget`: logo depois do `restore()` do visitante, `getIt<SessionCartRepository>().start()` (síncrono). Assim, a entrada já restaurada com sessão dispara a mescla ou a carga sem depender de quem lê o carrinho primeiro.
- `registerFakeDependencies` continua registrando o `FakeCartRepository` como `CartRepository`. O fake ganha `clear` e o `remove` com `Result`, com resultados programáveis e chamadas gravadas.

### 6. Aba Carrinho e ViewModels
- `CartViewModel.remove` passa a ler o `Result`, e a falha preenche `failureMessage` como em `changeQuantity`.
- `CartPage`: o estado `previewFailure` passa a vir **antes** do vazio (a carga da conta pode falhar sem itens; no visitante a falha só existe com itens, então nada muda lá). Com `mergeFailure`, entra no topo da lista, fora do skeleton, o `StateErrorBanner(title: 'Não foi possível juntar o carrinho deste aparelho à sua conta.', failure: mergeFailure, onRetry: retry)` acima do vazio ou das linhas. O título fica como constante pública.
- `ProductDetailViewModel` e a página não mudam: as mensagens novas chegam pelo `failure.message`.

### 7. Testes e fakes
- `SessionCartRepository` é testado com o `GuestCartRepository` real (`FakeKeyValueStore`, `previewDelay: Duration.zero`, sobre um `Dio` e um adaptador próprios, para a prévia do visitante não consumir as respostas da conta), a `AccountCartApi` sobre `Dio` + `FakeHttpClientAdapter` e o `FakeAuthRepository` da etapa 8 como `Session` (`emit(user)`, `sessionToken`). O `FakeHttpClientAdapter` entregue responde **em ordem** (`enqueueResponse`/`enqueueError`) e grava `requests` (método, caminho e corpo); para segurar uma resposta e provar a fila, o teste usa uma subclasse local com `Completer`, no molde do `_HoldingHttpClientAdapter` de `guest_cart_repository_test.dart`. O token do `FakeAuthRepository` é fixo (`sessionToken`); o teste de troca de token usa uma subclasse local que sobrescreve `token`.
- JSON de exemplo: reaproveitar `test/infra/api/support/cart_json.dart` da etapa 9 (o `CartDetailDTO` da conta tem o mesmo formato da prévia: `cartPreviewJson`, `emptyCartPreviewJson`, `previewWithLine(line)`) e acrescentar respostas de recusa (`400` com `CART_*`, `404` com `CART_PRODUCT_NOT_FOUND`, `400` com `ALGO_NOVO`).

### 8. `CLAUDE.md`
Só acréscimos: "Etapa 10" no estado atual. Em "Regras de domínio › Carrinho": a fonte escolhida pelo token da sessão no `SessionCartRepository`; a fila de comandos com overrides; a mescla com o local apagado só no sucesso e a nova tentativa pelo "Tentar de novo" ou na próxima entrada; a volta ao visitante ao sair; e as recusas traduzidas pelo `CartErrorCode`. Sai a frase da etapa 9 de que o carrinho do visitante vale com sessão: é uma descrição de estado, não uma regra que se afrouxa.

## Dependências da etapa anterior

Da change `mobile-app-09-carrinho-anonimo-mobile`, conferida no código entregue:
- `lib/modules/cart/model/cart_entity.dart`: `CartItem(productId, quantity)`, `CartLine` (com `productId`, `quantity`, `isAvailable`) e `CartDetail` (`lines`, `itemCount`, totais em `Money`, `hasUnavailableItems`) com `CartDetail.empty()`.
- `lib/modules/cart/model/cart_rules.dart`: `addCartItem` e `setCartItemQuantity` (puras, `Result<List<CartItem>>`), `removeCartItem` (pura, devolve `List<CartItem>` e nunca falha), todas com ids aparados e em minúsculas e listas imutáveis, `cartItemMaxQuantity`, `cartMaxItems`.
- `lib/modules/cart/model/cart_state.dart`: classe imutável à mão com `items`, `detail`, `isRestoring`, `isSyncing`, `previewFailure` e os derivados `count`, `lines` (linhas do `detail` com a quantidade de `items`; produto fora de `items` sai), `quantityOf`, `isEmpty`, `awaitsFirstPreview`, e `copyWith(..., clearPreviewFailure)`.
- `lib/modules/cart/errors/cart_errors.dart`: `enum CartErrorCode { quantityExceeded, itemsLimitExceeded, quantityInvalid }` com `message`; a falha de regra é `ValidationFailure`.
- `lib/modules/cart/provider/cart_repository.dart` com `state`, `changes` (broadcast), `add`/`setQuantity` → `Future<Result<void>>`, `remove` → `Future<void>` e `refresh()`.
- `lib/infra/api/cart_dto.dart`: `parseCartDetail(Object?)` e `encodeCartItems(List<CartItem>)` → `{"items": [...]}`. `test/infra/api/support/cart_json.dart`.
- `lib/infra/cart/{guest_cart_storage,guest_cart_repository}.dart`: `GuestCartRepository(Dio, GuestCartStorage, {previewDelay})` com `restore()` idempotente, as ações e o `refresh()` esperando o `restore`, a geração da prévia e `dispose()`; `GuestCartStorage.write([])` apaga a chave (`GuestCartStorage.storageKey`).
- DI: `GuestCartStorage`/`GuestCartRepository` lazy singletons e `CartRepository` → `getIt<GuestCartRepository>()`. `bootstrap.dart` chama `unawaited(getIt<GuestCartRepository>().restore())` depois da sessão. `CartViewModel(CartRepository)` com `changeQuantity`/`remove` (`Command1`; hoje `_remove` ignora o resultado e devolve `Ok`), `retry()` e `failureMessage`. `ProductDetailViewModel(CatalogRepository, CartRepository)` com `addToCart`.
- `CartPage` com os estados na ordem skeleton → vazio → `StateErrorBanner` → linhas, e os textos como constantes públicas.
- `test/modules/cart/support/{cart_fixtures,fake_cart_repository}.dart` (`FakeCartRepository({state})` com `enqueueAdd`/`enqueueSetQuantity`/`holdAdd`, `emit`, `addCalls`/`setQuantityCalls`/`removeCalls`/`refreshCalls`) e `registerFakeDependencies(..., cart:)`.
- Da etapa 8 (conferido no código): `Session` (`Listenable`, `status`, `token`, `expire()`), `SessionStatus`, o `SessionRepository` avisando a cada `_set`, o `AuthInterceptor`, `FakeAuthRepository implements Session` com `emit(AuthUser?)` e `sessionToken`, `mapHttpFailure`, `runRequest`, `BackendRejectionFailure(statusCode, codes)`, `NotFoundFailure`, `SessionFailure`, `StateErrorBanner({title, failure, onRetry})`.

Se um nome diferir, a aplicação segue o nome entregue e registra a diferença abaixo, com o prefixo do lote.

## Decisões tomadas sem consulta

- Fonte escolhida pelo **token** (não só pelo `status`): troca de conta sem passar por `anonymous` também recarrega, e os avisos repetidos do `SessionRepository` não disparam nova carga.
- Na conta, as regras de limite rodam no aparelho antes do envio, para todos os comandos. O web deixa a API recusar o `add` acima do limite. O resultado é o mesmo texto, sem viagem à rede, e a tradução das recusas continua valendo para o que só o servidor sabe (produto indisponível, limite já cheio no servidor).
- Falha na mescla aparece como banner na aba Carrinho, com "Tentar de novo" (padrão único de estados), em vez do toaster do web. A nova tentativa também acontece sozinha na próxima entrada ou abertura do app com sessão, como no web.
- Falha na carga da conta mostra o banner "Não foi possível carregar o carrinho." (o web mostra toaster e carrinho vazio).
- Ao sair, o app mostra o carrinho do visitante como está no aparelho: vazio depois de uma mescla bem-sucedida, como pede o plano. Se a mescla tinha falhado, os itens que ficaram guardados aparecem de novo, como no web.
- `remove` passa a devolver `Result` e `clear()` entra no contrato, este sem consumidor até a etapa 12.
- O carrinho da conta não é recarregado ao abrir a aba: a aba mantém estado no shell, e a carga já acontece na entrada, depois de cada recusa e no "Tentar de novo".
- `404` dos comandos vira "Produto indisponível." mesmo sem código, porque o `mapHttpFailure` descarta os códigos do `404`, e nesses caminhos o `404` só vem de `CART_PRODUCT_NOT_FOUND`/`CART_USER_NOT_FOUND`.
- Lote 1: a conferência da 1.1 não achou nome divergente. Mudar `remove` e incluir `clear()` no contrato (1.4) quebraria a compilação das duas implementações, então o lote 1 já fez o mínimo nelas: no `GuestCartRepository`, `remove` devolve `Future<Result<void>>` (o corpo já devolvia `Ok`) e `clear()` entrou com o comportamento da Decisão 3 (espera o `restore`, cancela o `Timer`, invalida a geração, zera itens/`detail`/`previewFailure`, avisa e grava a lista vazia, que apaga a chave). No `FakeCartRepository`, `remove` devolve `Ok` e `clear()` esvazia os itens e soma `clearCalls`. Fica para a 3.1: `pendingItems()` e conferir esse `clear()`; para a 3.2, os testes dele; para a 3.3, `enqueueRemove` e os testes que usam o `remove` antigo.
- Lote 1: `CartErrorCode` guarda o código do backend no campo `backendCode`. `accountCartItems` põe em minúsculas o id das linhas, e as chaves dos overrides já chegam aparadas e em minúsculas (o `SessionCartRepository` deve normalizar o id antes de gravar o override).
- Lote 1: `mapCartFailure` também traduz o `404` do `clear()` para "Produto indisponível." (a Decisão 2 fala dos quatro comandos). `401`, `5xx`, rede e recusa sem código conhecido passam como vieram. `load` e `merge` usam só `runRequest` + `parseCartDetail`, sem tradução.
- Lote 1: os JSONs de recusa ficam em `test/infra/api/support/cart_json.dart`: `cartRejectionJson(statusCode, codes)`, `quantityExceededJson`, `itemsLimitExceededJson`, `quantityInvalidJson`, `productNotFoundJson` (`404`) e `unknownRejectionJson` (`ALGO_NOVO`).
- Lote 2: `pendingItems()` devolve o `state.items` do visitante depois do `restore` (é o que está gravado; a prévia que tira produto grava junto). O `clear()` do lote 1 foi conferido contra a Decisão 3 sem mudança. No `FakeCartRepository`, o `remove` passou a consumir a fila de `enqueueRemove` como o `setQuantity` (aplica a mudança um microtask depois da chamada); nenhum teste existente precisou mudar.
- Lote 2: o `SessionCartRepository` já implementa os comandos, a mescla e o `refresh()` (o grupo 5 só testa). Cada troca de token começa **uma fila nova**: a tarefa da fila antiga confere a geração antes de enviar e não envia nada; a resposta de geração antiga é descartada. Assim, uma resposta segurada da sessão anterior não atrasa a carga da nova.
- Lote 2: na mescla bem-sucedida, o `guest.clear()` roda **mesmo que a sessão tenha mudado** enquanto a resposta vinha: a mescla já valeu no servidor e não apagar faria a próxima entrada somar os itens de novo. Só o estado da conta é que fica descartado.
- Lote 2: falha no `GET /me/cart` mantém o último `detail` recebido (vazio antes do primeiro, como pede a Decisão 4) e preenche `previewFailure`; é o comportamento da prévia do visitante. O `load` de sucesso não limpa `mergeFailure`; ela só some numa mescla que dá certo (ou ao sair).
- Lote 2: comando cuja tarefa foi descartada por troca de token devolve `Ok` sem enviar; se a resposta chegou depois da troca, devolve o `Result` dela sem mexer no estado. Os overrides são gravados para todos os ids exibidos (0 para os que saem), então `clear` usa a mesma regra com a lista vazia.
- Lote 2: `test/infra/cart/session_cart_repository_test.dart` tem o montador `build({guestItems})` (visitante real com `FakeKeyValueStore` e `Dio` próprio, `previewDelay: Duration.zero`; `AccountCartApi` sobre `_HoldingHttpClientAdapter`, com `hold()` que segura a próxima resposta; `_SwitchableAuthRepository` com `switchToken`), e o helper `accountCalls()` (`'MÉTODO caminho'`). O grupo 5 deve acrescentar os testes nesse arquivo, reaproveitando o montador. O `start()` não é chamado pelo montador; os avisos do `changes` chegam um microtask depois, então zere os contadores depois de um `pumpEventQueue()`.
- Lote 3: os testes do grupo 5 usam o helper `signedInWith(cart)` (entra com o carrinho dado e zera requisições, avisos e `emitted`) e `_canetaCart(n)` (só a caneta com `n` unidades). No teste da fila, a última resposta traz uma quantidade diferente do override (outro aparelho somou), para provar que os overrides somem no fim da fila.
- Lote 3: na `CartPage`, o aviso da mescla (`CartPage.mergeErrorTitle`) aparece acima do banner de carga, do vazio e das linhas, mas **não** durante o skeleton ("fora do skeleton"): logo depois da mescla que falha, o `GET /me/cart` ainda está em curso e o skeleton fica sozinho até ele responder. O "Tentar de novo" dele chama o mesmo `retry()` (`refresh()`), que remescla. A falha da lixeira vai para o `SnackBar` pelo mesmo `failureMessage` da quantidade.
- Lote 3: o `bootstrap_test.dart` passou sem mudança depois do `start()`; o `service_locator_test.dart` confere `AccountCartApi` e `SessionCartRepository` registrados e removidos no `resetDependencies`, e que o `CartRepository` não é mais o `GuestCartRepository`.
- Lote 4: no `CLAUDE.md`, além dos acréscimos e da saída da frase da etapa 9 (Decisão 8), o item do estado global do visitante deixou de dizer que o `GuestCartRepository` é o `CartRepository` da DI ("mesma instância"): era descrição de estado que ficou falsa, não regra; agora diz que ele é a fonte do visitante registrada para o `SessionCartRepository`. Nenhuma regra foi afrouxada.
- Lote 4: verificação final sem desvio do plano: `build_runner` sem `.freezed.dart` alterado, `flutter analyze` sem problemas e `flutter test` com 952 testes passando (inclui `architecture_test.dart`). O `git status --short` só mostra fora de `apps/mobile/` e desta change o `openspec/loops/mobile-app/loop.json` e `openspec/changes/mobile-app-11-dados-entrega-mobile/`, que já estavam assim no início do lote e não são desta change (são do loop e da proposta da etapa 11); nenhum `build/` nem `.dart_tool/`.
- Nenhuma lacuna de API encontrada: `apps/mobile/docs/lacunas-da-api.md` não é criado nesta etapa.

## Risks / Trade-offs

- [Resposta de sessão antiga mexendo no carrinho novo] → geração por token; tarefa ou resposta de geração antiga é ignorada. Coberto por teste de sair com comando pendente.
- [Fila lenta com rede ruim] → quantidade e badge não esperam a fila. Só o resumo fica "Atualizando".
- [Mescla duplicada] → a carga inicial roda uma vez por token. O "Tentar de novo" só remescla enquanto o local não foi apagado, e o servidor soma as quantidades com limite de 99.
- [Prévia do visitante rodando com sessão] → o `restore` do visitante pode pedir uma prévia na abertura com sessão. É inofensivo e descartado, e evitá-lo exigiria acoplar o visitante à sessão.
