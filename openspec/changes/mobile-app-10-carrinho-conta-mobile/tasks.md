> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive "Dependências da etapa anterior") e a spec `mobile/mobile-cart` desta change. Referência de comportamento (só leitura): os arquivos do web e do backend citados no Context do design.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; nenhuma dependência nova; nada de `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`. Decisão nova durante a aplicação vai para "Decisões tomadas sem consulta" do `design.md`, prefixada com o lote.

## 1. Conferência e domínio

- [ ] 1.1 Ler os arquivos listados em "Dependências da etapa anterior" do design (nomes já conferidos com o código entregue); se algo divergir durante a aplicação, seguir o código e registrar no `design.md`.
- [ ] 1.2 Em `lib/modules/cart/errors/cart_errors.dart`, acrescentar `productUnavailable` e o código do backend de cada valor, mais `cartErrorFromCodes` (Decisão 1).
- [ ] 1.3 Testes em `test/modules/cart/errors/cart_errors_test.dart`: cada `CART_*` vira o seu valor; `['ALGO_NOVO', 'CART_ITEMS_LIMIT_EXCEEDED']` → `itemsLimitExceeded`; lista sem código conhecido → `null`.
- [ ] 1.4 Em `cart_repository.dart`, `remove` → `Future<Result<void>>` e `clear()` novo; em `cart_state.dart`, o campo `mergeFailure`, com `copyWith`/`clearMergeFailure` (Decisão 1).
- [ ] 1.5 Criar `lib/modules/cart/model/account_cart_items.dart` (Decisão 1).
- [ ] 1.6 Testes em `test/modules/cart/model/account_cart_items_test.dart`: sem `detail` nem overrides → vazio; override muda a quantidade na posição; 0 tira a linha; produto novo entra no fim, na ordem de inserção; `CartState.count` soma o resultado.

## 2. Cliente do carrinho da conta

- [ ] 2.1 Em `test/infra/api/support/cart_json.dart`, acrescentar as recusas `400` com cada `CART_*`, `404` com `CART_PRODUCT_NOT_FOUND` e `400` com `ALGO_NOVO`.
- [ ] 2.2 Criar `lib/infra/cart/account_cart_api.dart` com `AccountCartApi` e `mapCartFailure` (Decisão 2).
- [ ] 2.3 Testes em `test/infra/cart/account_cart_api_test.dart` (`Dio` + `FakeHttpClientAdapter`): método, caminho e corpo de `load`, `add`, `setQuantity`, `remove`, `clear` e `merge`; id com caractere especial sai codificado; `200` vira `CartDetail`.
- [ ] 2.4 Testes de falha no mesmo arquivo: `400` `CART_ITEM_QUANTITY_EXCEEDED` → "Limite de 99 unidades por produto." com `statusCode`/`codes` mantidos; `404` → "Produto indisponível."; `ALGO_NOVO` → "Não foi possível concluir. Tente novamente."; `500` e rede mantêm as mensagens; `load` com `404` não é traduzido.

## 3. Visitante, fake e ViewModel

- [ ] 3.1 Em `GuestCartRepository`, acrescentar `pendingItems()` e `clear()` e fazer `remove` devolver `Ok` (Decisão 3).
- [ ] 3.2 Testes em `guest_cart_repository_test.dart`: `pendingItems()` espera o `restore` e devolve os itens guardados; `clear()` apaga a chave, zera o estado, avisa e descarta prévia em curso; `remove` devolve `Ok`.
- [ ] 3.3 Em `FakeCartRepository`, `remove` com `Result` programável (`enqueueRemove`, no molde do `enqueueSetQuantity`) e `clear()` gravado em `clearCalls` (Decisão 5); ajustar os testes que usam o `remove` antigo.
- [ ] 3.4 Em `CartViewModel`, `remove` lê o `Result` e a falha preenche `failureMessage`; teste no `cart_view_model_test.dart`.

## 4. Repositório pela sessão: fonte

- [ ] 4.1 Criar `lib/infra/cart/session_cart_repository.dart` com `start()`, a escolha da fonte pelo token, a geração e a fila (Decisão 4).
- [ ] 4.2 Criar em `test/infra/cart/session_cart_repository_test.dart` um montador com `GuestCartRepository` real (adaptador próprio), `AccountCartApi` sobre uma subclasse local do `FakeHttpClientAdapter` que segura respostas e `FakeAuthRepository` como `Session`, com subclasse local para trocar o token (Decisão 7).
- [ ] 4.3 Testes de fonte: `unknown`/`anonymous` delegam ao visitante e repassam os avisos dele; entrar sem itens locais → só `GET /me/cart`, `isRestoring` até a resposta e depois as linhas da conta; aviso repetido com o mesmo token não recarrega.
- [ ] 4.4 Testes de saída: sair volta ao visitante vazio, sem `DELETE /me/cart`; entrar de novo recarrega a conta; resposta da conta que chega depois de sair é descartada; trocar de token recarrega.
- [ ] 4.5 Teste de carga com falha: `GET /me/cart` `500` → `previewFailure`, `isRestoring` falso e `detail` vazio; `refresh()` recarrega e limpa a falha no sucesso.

## 5. Repositório pela sessão: comandos e mescla

- [ ] 5.1 Testes de comando: `add` aplica o override e muda `count`/`quantityOf` antes da resposta; `setQuantity` envia `PUT` com `{quantity}`; `setQuantity(id, 0)` e `remove` enviam `DELETE`; `clear` envia `DELETE /me/cart`.
- [ ] 5.2 Teste da fila (cenário "Mudança na hora e em ordem"): com a primeira resposta segurada, o segundo `PUT` só sai depois dela; `isSyncing` até a fila esvaziar; o estado final é a última resposta e os overrides somem.
- [ ] 5.3 Testes de recusa: regra local (98 + 3) devolve `ValidationFailure` sem requisição; `404` devolve "Produto indisponível." e enfileira `GET /me/cart`; `401` devolve `SessionFailure` sem recarga.
- [ ] 5.4 Testes de mescla (cenário "Entrar com itens do visitante"): `POST /me/cart/merge` com `{"items": …}`, sem `GET`; no sucesso o armazenamento do visitante fica sem a chave e o estado mostra a resposta.
- [ ] 5.5 Testes de falha na mescla: `500` → `mergeFailure`, `GET /me/cart` em seguida, itens locais mantidos; `refresh()` remescla e, no sucesso, limpa `mergeFailure` e o local.

## 6. DI, bootstrap e aba Carrinho

- [ ] 6.1 Em `service_locator.dart`, registrar `AccountCartApi` e `SessionCartRepository` e apontar `CartRepository` para ele (Decisão 5); em `bootstrap.dart`, `start()` logo depois do `restore()` do visitante.
- [ ] 6.2 Em `service_locator_test.dart`: `CartRepository` é a instância de `SessionCartRepository`; `test/app/bootstrap_test.dart` continua passando sem mudar os pedidos esperados.
- [ ] 6.3 Na `CartPage`, banner de falha antes do vazio e o aviso de mescla no topo (Decisão 6).
- [ ] 6.4 Widget tests em `cart_page_test.dart`: `previewFailure` sem itens mostra "Não foi possível carregar o carrinho."; `mergeFailure` mostra o aviso da mescla acima das linhas (e acima do vazio) e "Tentar de novo" chama `refresh`; falha do `remove` aparece no `SnackBar`.
- [ ] 6.5 Widget test do detalhe do produto: `add` do fake devolvendo a falha "Produto indisponível." mostra essa mensagem no `SnackBar`.

## 7. CLAUDE.md e verificação final

- [ ] 7.1 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 8 pede, sem afrouxar regra existente.
- [ ] 7.2 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso e os `.freezed.dart` estão em dia.
- [ ] 7.3 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [ ] 7.4 `cd apps/mobile && flutter test` com todos os testes passando, inclusive `test/core/architecture_test.dart`.
- [ ] 7.5 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
