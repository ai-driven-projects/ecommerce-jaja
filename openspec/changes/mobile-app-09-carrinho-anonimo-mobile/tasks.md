> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive "Dependências da etapa anterior") e as specs `mobile/mobile-cart`, `mobile/mobile-product` e `mobile/mobile-navigation` desta change. Referência de comportamento (só leitura): os arquivos do web e do backend citados no Context do design.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; nenhuma dependência nova; nada de `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`. Decisão nova durante a aplicação vai para "Decisões tomadas sem consulta" do `design.md`, prefixada com o lote.

## 1. Domínio cart

- [ ] 1.1 Conferir no código as dependências da etapa 8 listadas no design; registrar no `design.md` qualquer nome diferente e seguir com o nome entregue.
- [ ] 1.2 Criar `lib/modules/cart/model/cart_entity.dart` (`CartItem`, `CartLine`, `CartDetail` com `empty()`, Decisão 1) e rodar o codegen; teste de `CartDetail.empty()` (totais zero, limite 7900).
- [ ] 1.3 Criar `lib/modules/cart/errors/cart_errors.dart` com `CartErrorCode` e as três mensagens (Decisão 1).
- [ ] 1.4 Criar `lib/modules/cart/model/cart_rules.dart` (constantes com a origem, `normalizeCartItems`, `addCartItem`, `setCartItemQuantity`, `removeCartItem`).
- [ ] 1.5 Testes em `test/modules/cart/model/cart_rules_test.dart`: normalização do cenário "Conteúdo guardado irregular", não-lista → vazio, 51 produtos → 50; somar mantém a posição; 98+3 → `quantityExceeded`; 51º → `itemsLimitExceeded`; 0, −1 e 100 ao incluir → `quantityInvalid`; `set` 0 remove, 100 → `quantityExceeded`; lista original intacta.
- [ ] 1.6 Criar `lib/modules/cart/model/cart_state.dart` (Decisão 1) e testes: `count` soma local; `lines` aplica a quantidade local e tira ausentes; `quantityOf`; `awaitsFirstPreview` só com itens, sem linhas e sem falha.
- [ ] 1.7 Criar `lib/modules/cart/provider/cart_repository.dart` (Decisão 1); `flutter analyze` sem problemas.

## 2. Armazenamento e DTO

- [ ] 2.1 Acrescentar `remove(key)` ao `KeyValueStore`, ao `SharedPreferencesKeyValueStore` e ao `FakeKeyValueStore` (respeitando `failOnWrite`); teste do `remove` em `test/infra/storage/`.
- [ ] 2.2 Criar `lib/infra/cart/guest_cart_storage.dart` (Decisão 2).
- [ ] 2.3 Testes em `test/infra/cart/guest_cart_storage_test.dart` com `FakeKeyValueStore`: grava e lê de volta na ordem; chave `jaja.guest-cart`; texto ilegível → vazio; lista vazia apaga a chave; mesmo conteúdo não regrava; `failOnRead` → vazio.
- [ ] 2.4 Criar `test/infra/api/support/cart_json.dart` (prévia com linha disponível, linha indisponível com `lineTotalCents: null`, `thumbUrl: null`, campo extra e variantes inválidas).
- [ ] 2.5 Criar `lib/infra/api/cart_dto.dart` (Decisão 3) e testes em `test/infra/api/cart_dto_test.dart`: conversão completa em `Money`; indisponível sem total; preço negativo ou campo ausente → `FormatException` com o campo; `encodeCartItems` → `{"items": [...]}`.

## 3. Repositório do carrinho

- [ ] 3.1 Criar `lib/infra/cart/guest_cart_repository.dart` (Decisão 4).
- [ ] 3.2 Testes de `restore` em `test/infra/cart/guest_cart_repository_test.dart` (`Dio` + `FakeHttpClientAdapter` + `FakeKeyValueStore`): nasce `isRestoring`; vazio não chama a API; com itens pede a prévia com o corpo `{"items": …}` sem `Authorization`; ação feita antes do fim do `restore` espera por ele.
- [ ] 3.3 Testes de mudança: `add` muda `count`, grava e avisa (`notifyListeners` e `changes`) antes da resposta; falha de regra devolve a `ValidationFailure` sem gravar nem avisar; `setQuantity` 0 e `remove` tiram o item.
- [ ] 3.4 Testes da prévia com `testWidgets` + `tester.pump`: três mudanças em menos de 250 ms → um pedido com a quantidade final; resposta de geração antiga é descartada; esvaziar não chama a API e zera o `detail`.
- [ ] 3.5 Testes de itens que somem ou mudam de preço: prévia sem a linha de B tira B do estado e do armazenamento; segunda prévia com preço novo atualiza a linha e o subtotal.
- [ ] 3.6 Testes de falha: `500` preenche `previewFailure`, mantém itens e o `detail` anterior; `refresh()` pede na hora e limpa a falha no sucesso; nada notifica depois do `dispose`.

## 4. DI, fakes e ViewModels

- [ ] 4.1 Em `service_locator.dart`, registrar `GuestCartStorage`, `GuestCartRepository` e `CartRepository` (Decisão 5); em `bootstrap.dart`, `restore()` sem esperar; ajustar `test/app/bootstrap_test.dart` se precisar do mock do `SharedPreferences`.
- [ ] 4.2 Em `service_locator_test.dart`: `CartRepository` e `GuestCartRepository` são a mesma instância.
- [ ] 4.3 Criar `test/modules/cart/support/cart_fixtures.dart` e `fake_cart_repository.dart` (Decisão 9); `registerFakeDependencies` aceita `FakeCartRepository? cart`.
- [ ] 4.4 Criar `lib/ui/modules/cart/view_models/cart_view_model.dart` (Decisão 6) e registrá-lo em `registerViewModels()`.
- [ ] 4.5 Testes do `CartViewModel` com `FakeCartRepository`: `state` inicial e atualizado por `changes`; `changeQuantity` e `remove` chamam o repositório; falha preenche `failureMessage`; `retry` chama `refresh`; `dispose` cancela a assinatura.
- [ ] 4.6 Em `ProductDetailViewModel`, receber `CartRepository` e acrescentar `quantity`, `increment`/`decrement`, `inCart` e `addToCart` (Decisão 6); ajustar a DI e os testes existentes que o constroem.
- [ ] 4.7 Testes novos do `ProductDetailViewModel`: `quantity` presa a 1..99; `addToCart` chama `add(id, 3)` e devolve quantidade e total `R$ 38,70` para 1290 × 3; sucesso volta a 1; falha mantém a quantidade; `inCart` muda quando o carrinho emite.

## 5. Widgets do carrinho

- [ ] 5.1 Criar `lib/ui/shared/widgets/quantity_stepper.dart` (Decisão 7) e widget tests: rótulos de "Diminuir/Aumentar quantidade de <nome>", callbacks, `onIncrement: null` desabilita o "+".
- [ ] 5.2 Criar `lib/ui/modules/cart/widgets/cart_line_tile.dart` (Decisão 7).
- [ ] 5.3 Widget tests da linha: nome, unidade, preço e total `R$ 25,80` com quantidade 2 de R$ 12,90; "+" desabilitado em 99; "−" em 1 pede quantidade 0; tocar no nome chama `onOpenProduct(slug)`; indisponível mostra "Indisponível" e "Remover", sem stepper nem total.
- [ ] 5.4 Criar `lib/ui/modules/cart/widgets/cart_summary.dart` (Decisão 7) e widget tests dos cenários "Entrega cobrada" e "Entrega grátis", do aviso de indisponíveis e do "Atualizando" com `isSyncing`.
- [ ] 5.5 Em `AppNavigationShell`, acrescentar `cartCount` e o `Badge` (Decisão 7); widget tests: 0 sem badge, 3 mostra "3", 120 mostra "99+".
- [ ] 5.6 Criar `lib/ui/modules/cart/widgets/cart_navigation_shell.dart` (Decisão 7).

## 6. Aba Carrinho e rotas

- [ ] 6.1 Reescrever `lib/ui/modules/cart/pages/cart_page.dart` (Decisão 7); apagar `PlaceholderBody` e o teste dele se não sobrar consumidor.
- [ ] 6.2 Widget tests em `test/ui/modules/cart/pages/cart_page_test.dart`: skeleton ao restaurar e na primeira prévia; vazio com "Ver produtos" chamando `onOpenSearch`; banner com "Tentar de novo" chamando `refresh`; linhas e resumo; "Finalizar pedido · R$ 30,70" desabilitado; falha de regra mostra a mensagem no `SnackBar`.
- [ ] 6.3 Em `app_routes.dart`, `cartProduct` e `cartProductLocation`; em `app_router.dart`, o shell com `CartNavigationShell`, o ramo `/cart` com a `CartPage` real e a rota filha `product/:slug` (Decisão 8).
- [ ] 6.4 Em `test/app/router/app_router_test.dart`: tocar no nome de uma linha abre `/cart/product/<slug>` com a aba Carrinho selecionada e voltar retorna à aba; o badge mostra a contagem do `FakeCartRepository`; "Ver produtos" abre a Buscar sem filtros.

## 7. Detalhe do produto ligado

- [ ] 7.1 Em `ProductDetailPage`, trocar `onAddToCart` por `onOpenCart`, montar o rodapé com stepper, "Adicionar · <total>", "Adicionando…" e "Você já tem N no carrinho.", e o cartão de entrega (Decisão 7); passar `onOpenCart` nas três rotas de produto.
- [ ] 7.2 Ajustar os widget tests existentes da página que esperavam o botão desabilitado.
- [ ] 7.3 Widget tests novos: "Adicionar · R$ 38,70" com quantidade 3; `holdAdd()` mostra "Adicionando…" desabilitado; sucesso mostra "Adicionado ao carrinho" e "3 un · R$ 38,70" e volta a 1; "Você já tem 3 no carrinho."; falha mostra "Limite de 99 unidades por produto."; cartão de entrega com `R$ 79,00` e `R$ 4,90`.
- [ ] 7.4 Em `app_router_test.dart`: adicionar no detalhe aumenta o badge e "Ver carrinho" no aviso abre a aba Carrinho.

## 8. CLAUDE.md e verificação final

- [ ] 8.1 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 10 pede, sem apagar regra existente.
- [ ] 8.2 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso e os `.freezed.dart` estão em dia.
- [ ] 8.3 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [ ] 8.4 `cd apps/mobile && flutter test` com todos os testes passando, inclusive `test/core/architecture_test.dart`.
- [ ] 8.5 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
