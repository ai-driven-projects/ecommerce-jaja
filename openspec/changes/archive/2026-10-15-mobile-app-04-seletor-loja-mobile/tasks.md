> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive "Dependências da etapa anterior") e as specs `mobile/mobile-store` e `mobile/mobile-architecture` desta change. Referência de comportamento (só leitura): os arquivos do web citados no Context do design.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; dependências só por `flutter pub add` (nunca `pub upgrade`); nada de `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`. Decisão nova durante a aplicação vai para "Decisões tomadas sem consulta" do `design.md`, prefixada com o lote.

## 1. Dependências, cidade/UF e domínio `store`

- [x] 1.1 Conferir no código as dependências da etapa 3 listadas no design; registrar no `design.md` qualquer nome diferente e seguir com o nome entregue.
- [x] 1.2 `cd apps/mobile && flutter pub add watch_it shared_preferences freezed_annotation dev:freezed`; conferir no `pubspec.yaml` e registrar as versões resolvidas no `design.md`.
- [x] 1.3 Criar `lib/core/value_objects/city_state.dart` (Decisão 2) com a expressão copiada de `store-address.util.ts` e a origem no comentário.
- [x] 1.4 Testes em `test/core/value_objects/city_state_test.dart`: endereços das duas lojas do seed → `São Paulo/SP` e `Rio de Janeiro/RJ`; UF minúscula vira maiúscula; `null`, vazio e "Rua X, 10" → `null`.
- [x] 1.5 Criar `lib/modules/store/model/store_entity.dart` (`Store` com `freezed` e o getter `place`) e rodar `dart run build_runner build --delete-conflicting-outputs`; o `.freezed.dart` gerado fica no repositório.
- [x] 1.6 Criar `lib/modules/store/model/current_store.dart` (`pickCurrentStore`) e `lib/modules/store/provider/store_repository.dart` (Decisão 1); remover `lib/modules/.gitkeep`.
- [x] 1.7 Criar `test/modules/store/support/store_fixtures.dart` (lojas `paulista` e `rioBranco` do seed) e testes em `test/modules/store/model/`: igualdade por valor, `place` com e sem `Cidade/UF`, e `pickCurrentStore` (lembrada ativa, lembrada desconhecida, nula/vazia, lista vazia → `null`).

## 2. DTO, armazenamento e repositório

- [x] 2.1 Criar `lib/infra/api/storefront_store_dto.dart` (Decisão 3) com `fromJson`, `toEntity` e `parseStorefrontStores`.
- [x] 2.2 Testes em `test/infra/api/storefront_store_dto_test.dart` a partir do JSON das duas lojas do seed: campos convertidos, `address: null`, campos extras ignorados (`phone`), item sem `slug` e corpo que não é lista lançam.
- [x] 2.3 Criar `lib/infra/storage/key_value_store.dart` e `shared_preferences_key_value_store.dart` (Decisão 4).
- [x] 2.4 Testes em `test/infra/storage/shared_preferences_key_value_store_test.dart` com `SharedPreferences.setMockInitialValues`: lê valor existente, ausente → `null`, gravar e ler de volta.
- [x] 2.5 Criar `test/infra/storage/support/fake_key_value_store.dart` (mapa em memória, `failOnRead`/`failOnWrite` que fazem a leitura devolver `null` e a gravação não gravar, sem lançar).
- [x] 2.6 Criar `lib/infra/store/api_store_repository.dart` (Decisão 5: `runRequest`, guarda do primeiro `Ok`, `refresh`, requisição compartilhada, chave `jaja:vitrine:loja`).
- [x] 2.7 Testes em `test/infra/store/api_store_repository_test.dart` com `FakeHttpClientAdapter`: `GET /storefront/stores` sem `Authorization`; segunda chamada sem requisição; `refresh: true` faz nova; falha não é guardada; duas chamadas simultâneas fazem uma requisição; `200` sem `slug` → `UnexpectedFailure`.
- [x] 2.8 Testes da lembrança no mesmo arquivo: grava e lê o slug na chave `jaja:vitrine:loja`; `"  "` → `null`; com `FakeKeyValueStore` falhando, leitura `null` e gravação sem exceção.

## 3. ViewModel do seletor

- [x] 3.1 Criar `test/modules/store/support/fake_store_repository.dart`: respostas enfileiradas (ou `Completer` para segurar o carregamento), contagem de `fetchStores` com o valor de `refresh`, slug lembrado em memória.
- [x] 3.2 Criar `lib/ui/modules/store/view_models/store_selector_view_model.dart` (Decisão 6).
- [x] 3.3 Testes em `test/ui/modules/store/view_models/store_selector_view_model_test.dart`: antes do `load`, `loading` é verdadeiro; `load` com lembrança `loja-rio-branco` → `current` Rio Branco; sem lembrança → primeira; lembrança desconhecida → primeira, sem gravar.
- [x] 3.4 Testes de falha e recarga: `load` com falha guarda `failure` e lista vazia; `reload` chama `fetchStores(refresh: true)` e limpa a falha no `Ok`; lista vazia → `current` nulo sem falha.
- [x] 3.5 Testes de `select`: troca `current`, notifica e lembra o slug; slug atual ou fora da lista não grava nem notifica.

## 4. Seletor, bottom sheet e aba Início

- [x] 4.1 Acrescentar `bottomSheetTheme` em `AppTheme.light()` (Decisão 7) e teste em `test/ui/shared/theme/app_theme_test.dart` (fundo `card`, alça visível, cor da alça `line`).
- [x] 4.2 Criar `lib/ui/modules/store/widgets/store_pill.dart` (Decisão 7); se faltar estilo na escala, acrescentar em `AppTextStyles`.
- [x] 4.3 Criar `lib/ui/modules/store/widgets/store_picker_sheet.dart` (`StorePickerSheet` e `showStorePickerSheet`).
- [x] 4.4 Criar `lib/ui/modules/store/widgets/store_selector.dart` com os estados carregando, falha, vazio e pílula.
- [x] 4.5 Transformar `lib/ui/modules/catalog/pages/home_page.dart` em `WatchingStatefulWidget` com `storeSelectorViewModelFactory` (Decisão 7), importando `watch_it` com `show`; abrir o sheet só com duas ou mais lojas e chamar `select` com o slug devolvido.
- [x] 4.6 Widget tests em `test/ui/modules/store/widgets/` (com `themed`): pílula com "Loja Paulista" e "São Paulo/SP"; sem `place`, só o nome; estática sem chevron e sem `onTap`; sheet com "Comprar na loja", ordem da lista, `Icons.check` só na atual e o slug tocado devolvido.

## 5. DI, rota e testes da página

- [x] 5.1 Em `lib/infra/di/service_locator.dart`, registrar `KeyValueStore`, `StoreRepository` e criar `registerViewModels()` com `StoreSelectorViewModel` em `registerFactory` (Decisão 8).
- [x] 5.2 Em `lib/app/router/app_router.dart`, passar `storeSelectorViewModelFactory: () => getIt<StoreSelectorViewModel>()` à `HomePage`.
- [x] 5.3 Criar `test/app/support/fake_dependencies.dart` (registra um `FakeStoreRepository` e chama `registerViewModels()`) e usá-lo em `app_test.dart` e `app_router_test.dart`, com `tearDown(resetDependencies)`; os testes existentes continuam passando.
- [x] 5.4 Ajustar `test/app/bootstrap_test.dart` (`SharedPreferences.setMockInitialValues({})` e `FakeHttpClientAdapter` com `[]` no `Dio` registrado antes do `pump`) e acrescentar em `test/infra/di/service_locator_test.dart`: `StoreRepository` é singleton e `StoreSelectorViewModel` é uma instância nova a cada pedido.
- [x] 5.5 Widget tests em `test/ui/modules/catalog/pages/home_page_test.dart` com `FakeStoreRepository`: skeleton enquanto o `Completer` não completa; banner "Não foi possível carregar as lojas." com a mensagem de rede e "Tentar de novo" levando à pílula; vazio "Nenhuma loja disponível" com "Atualizar" pedindo `refresh: true`.
- [x] 5.6 Widget tests de troca na mesma página: tocar na pílula, escolher "Loja Rio Branco" → sheet fecha, pílula mostra Rio Branco e o fake guarda `loja-rio-branco`; com uma loja, o toque não abre o sheet; lembrança `loja-rio-branco` abre já em Rio Branco.

## 6. Barreira (regra E) e CLAUDE.md

- [x] 6.1 Em `test/core/support/import_rules.dart`, acrescentar `ImportRule.bindingConfinement` (Decisão 9), passando os combinadores da diretiva para a verificação.
- [x] 6.2 Em `architecture_test.dart`, teste real da regra E sobre `lib`, exigindo ao menos um arquivo que importe `watch_it`.
- [x] 6.3 Testes sintéticos da regra E: `show WatchingWidget, watchPropertyValue` em `lib/ui/modules/store/pages/x.dart` aceito; sem `show`, com `show di` e com `hide` em `ui/` violam; em `lib/infra/store/x.dart` viola; em `lib/app/router/x.dart` aceito.
- [x] 6.4 Provar que a regra morde: trocar temporariamente o import de `watch_it` da `HomePage` por um sem `show`, ver `flutter test test/core/architecture_test.dart` falhar com arquivo e linha, e desfazer.
- [x] 6.5 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 10 pede, sem apagar regra existente.

## 7. Verificação final

- [x] 7.1 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso e o `store_entity.freezed.dart` está atualizado.
- [x] 7.2 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [x] 7.3 `cd apps/mobile && flutter test` com todos os testes passando.
- [x] 7.4 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
