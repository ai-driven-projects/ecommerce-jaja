## Context

As etapas 1 a 3 (arquivadas) deixaram `lib/core` (`Result`, `Command0/1`, `AppFailure`, `Money`, env), o tema e os componentes base em `lib/ui/shared/`, o cliente `dio` com `runRequest`/`mapHttpFailure`, a DI (`getIt`, `configureDependencies`, `resetDependencies`), o `JajaApp`, o `buildAppRouter` com quatro abas e páginas provisórias, e a barreira com as regras A, B, C e D. `lib/modules/` só tem `.gitkeep`; esta é a primeira entidade, o primeiro repositório e o primeiro ViewModel.

Referência de comportamento no web (só leitura): `apps/frontend/src/modules/stores/data/{storefront-store.api.ts,use-storefront-stores.hook.ts,store-address.util.ts}`, `modules/catalog/data/use-storefront.hook.ts` (resolução da loja em vigor e `setStore`), `shared/components/store/store-picker.component.tsx` (pílula e menu "Comprar na loja") e `apps/frontend/DESIGN.md` (seletor de lojas). Contrato: `StorefrontStoreController` (`GET /storefront/stores`, público; falha de leitura é `400`) e `StorefrontStoreDTO` em `modules/stores/src/store/dto/storefront-store.dto.ts`.

**Efeito da escolha no web**, que é o que o app espelha: a loja em vigor aparece no seletor do cabeçalho, é lembrada no navegador (`jaja:vitrine:loja`, só o slug) e fornece cidade/UF para pré-preencher os formulários de entrega ("Minha conta" e checkout). Ela **não** é enviada à API e não muda catálogo, preços nem disponibilidade (spec `catalog/storefront`, "Escolher a loja MUST NOT mudar o catálogo"). O `?loja=` da URL não tem equivalente no app (deep links estão fora do escopo).

## Goals / Non-Goals

**Goals:** domínio `store` com entidade, regra da loja em vigor e contrato; DTO e repositório com lembrança local; seletor na aba Início com os três estados; `watch_it`, `freezed` e `shared_preferences` instalados, com a barreira estendida (regra E); padrão de registro de ViewModels na DI.

**Non-Goals (ficam para outras etapas):**
- Conteúdo da aba Início (categorias, destaques, ofertas) — etapa 5; ela mantém o seletor no topo da página.
- Pré-preencher cidade/UF dos dados de entrega com a loja em vigor — etapas 11 e 12, consumindo `StoreRepository` + `pickCurrentStore` desta etapa.
- Seletor em outras abas (o web o mostra no cabeçalho de todas as páginas públicas) — o app o mantém só no topo de Início; nenhuma etapa do plano pede outro lugar.
- Mapa, ponto e raio de entrega da loja — fora do escopo do plano; `latitude`, `longitude` e `deliveryRadiusMeters` são lidos e guardados na entidade, mas não exibidos.
- `json_serializable` — sem consumidor (DTOs são escritos à mão).

## Decisions

### 1. Domínio `store` (Dart puro)
- `lib/modules/store/model/store_entity.dart`: `Store` com `freezed` (sintaxe v3, `abstract class … with _$Store`, `const Store._()` para o getter): `id`, `name`, `slug`, `String? address`, `double latitude`, `double longitude`, `int deliveryRadiusMeters`, e `CityState? get place => CityState.fromAddressTail(address)`.
- `lib/modules/store/model/current_store.dart`: função pura `Store? pickCurrentStore(List<Store> stores, String? rememberedSlug)` — loja com o slug lembrado; senão `stores.firstOrNull`; slug nulo ou vazio é ausência. Não é use case (regra 4: não junta repositórios), é regra de modelo reusada pelas etapas 11 e 12.
- `lib/modules/store/provider/store_repository.dart`: `abstract interface class StoreRepository` com `Future<Result<List<Store>>> fetchStores({bool refresh = false})`, `Future<String?> readChosenSlug()` e `Future<void> rememberChosenSlug(String slug)`. A leitura da lembrança não falha (indisponível vira `null`) e a gravação não lança (falha é engolida na infra): a spec manda tratar memória ilegível como ausente, e a troca de loja na tela não pode depender do disco.

### 2. Cidade/UF como value object
Regra 8 do `CLAUDE.md`: a leitura de `<Cidade>/<UF>` é lógica sobre um valor e vira `lib/core/value_objects/city_state.dart` — `CityState({required city, required state})` (construtor público, molde de "estado degradado válido"), `static CityState? fromAddressTail(String? address)` e `String get label` (`"São Paulo/SP"`). A expressão é a `PLACE_PATTERN` de `store-address.util.ts` (copiada, com a origem no comentário e o aviso de paliativo do web): UF de duas letras convertida para maiúsculas, cidade sem espaços nas pontas, `null` para endereço nulo, vazio, cidade vazia ou fora do formato. As etapas 11/12 reaproveitam o VO no pré-preenchimento.

### 3. DTO
`lib/infra/api/storefront_store_dto.dart`: `StorefrontStoreDto.fromJson(Map<String, Object?>)` com casts estritos (`id`/`name`/`slug` `String`; `address` `String?`; `latitude`/`longitude` `num` → `toDouble()`; `deliveryRadiusMeters` `int`), `toEntity()` e `List<Store> parseStorefrontStores(Object? data)` (lista de mapas; qualquer outra forma lança `TypeError`/`FormatException`, que o `runRequest` converte em `UnexpectedFailure`). Campos extras são ignorados. JSON de exemplo nos testes: as duas lojas do seed com os endereços de `store-address.util.ts`.

### 4. Armazenamento chave-valor
- `lib/infra/storage/key_value_store.dart`: contrato técnico (regra 2: transporta texto, não entidade) `abstract interface class KeyValueStore { Future<String?> readString(String key); Future<void> writeString(String key, String value); }`.
- `lib/infra/storage/shared_preferences_key_value_store.dart`: implementação com `SharedPreferences.getInstance()` obtido na primeira chamada e guardado (sem `await` no bootstrap, que continua síncrono). Qualquer erro na leitura → `null`; na gravação → ignorado. O carrinho anônimo (etapa 9) reusa o mesmo contrato.
- Teste da implementação com `SharedPreferences.setMockInitialValues` (API do próprio pacote, sem mock de terceiros); os demais testes usam `FakeKeyValueStore` em memória com opção de falhar na leitura e na gravação.

### 5. Repositório
`lib/infra/store/api_store_repository.dart`: `ApiStoreRepository(Dio, KeyValueStore)`.
- `fetchStores` chama `runRequest(() => dio.get<Object?>('/storefront/stores'), parseStorefrontStores)`. Guarda a lista do primeiro `Ok` e a devolve nas chamadas seguintes; `refresh: true` ignora a guarda. Chamadas simultâneas compartilham a requisição em andamento (como o `pendingStores` do web). `Failure` não é guardada.
- Lembrança na chave `jaja:vitrine:loja` (a mesma do web, com a origem no comentário), texto puro; leitura com `trim` e vazio → `null`.
- Registrado como `registerLazySingleton<StoreRepository>` — a guarda vale para o app inteiro, como a carga única por aba do web.

### 6. ViewModel
`lib/ui/modules/store/view_models/store_selector_view_model.dart`: `StoreSelectorViewModel extends ChangeNotifier` recebendo `StoreRepository`.
- Campos próprios (o `result` do `Command` é limpo a cada execução): `List<Store> stores` (não modificável), `Store? current`, `AppFailure? failure`, `bool hasLoadedOnce`.
- `Command0<void> load` → `fetchStores()`; `Command0<void> reload` → `fetchStores(refresh: true)`, usado por "Tentar de novo" e por "Atualizar". Os dois, no `Ok`, leem `readChosenSlug()`, aplicam `pickCurrentStore`, limpam `failure` e marcam `hasLoadedOnce`; no `Failure`, guardam a falha e esvaziam a lista. `bool get loading => load.running || reload.running || !hasLoadedOnce`.
- `Command1<void, String> select` → se o slug é o atual ou não está na lista, nada; senão troca `current`, notifica e chama `rememberChosenSlug`. A página dispara `load.execute()` no `initState`.

### 7. Seletor e página
- `HomePage` (`ui/modules/catalog/pages/`) vira `WatchingStatefulWidget` com `storeSelectorViewModelFactory`; materializa o ViewModel no estado, chama `load`, descarta no `dispose` e observa com `watchPropertyValue` (padrão do app modelo). Corpo: `SafeArea` + coluna com o bloco do seletor no topo (padding `AppSpacing.s16`) e o `PlaceholderBody(title: 'Início')` abaixo, que a etapa 5 troca.
- `lib/ui/modules/store/widgets/store_selector.dart` (`StatelessWidget`, recebe estado e callbacks): `loading` → `SkeletonBox` da altura da pílula com raio `pill`; `failure` → `StateErrorBanner(title: 'Não foi possível carregar as lojas.', onRetry: reload)`; lista vazia → `EmptyState(emoji: '🏪', title: 'Nenhuma loja disponível', message: 'No momento nenhuma loja está atendendo.', actionLabel: 'Atualizar')`; senão `StorePill`.
- `store_pill.dart`: pílula no padrão de `DESIGN.md`/`StorePicker` — fundo `tokens.surface`, borda 1 px `tokens.line`, raio `AppRadius.pill`, padding 16×9, ícone `Icons.storefront_outlined` em `tokens.brand`, nome em `labelLarge` com `tokens.brand`, " · Cidade/UF" em `bodyMedium` com `tokens.mutedInk` (só com `place`), `Icons.expand_more` em `mutedInk` quando tocável. `onTap` nulo com menos de duas lojas (pílula estática, sem chevron). `Semantics(button: true, label: 'Loja escolhida: <nome>. Trocar de loja')` quando tocável, como o `aria-label` do web. Se a escala do tema não tiver o peso forte do nome, o estilo entra em `AppTextStyles`, nunca no widget.
- `store_picker_sheet.dart`: `Future<String?> showStorePickerSheet(BuildContext, {required List<Store> stores, required String currentSlug})` com `showModalBottomSheet` e o widget `StorePickerSheet`: título "Comprar na loja" (`titleMedium`), uma linha tocável por loja (nome em `labelLarge`, cidade/UF em `bodySmall`/`mutedInk`, atual em `brand` com `Icons.check`), devolvendo o slug tocado com `Navigator.pop`. A página chama `select` com o resultado não nulo.
- Tema do bottom sheet em `AppTheme.light()` (`bottomSheetTheme`), nascido aqui como a etapa 3 previu: fundo `card`, `surfaceTintColor` transparente, `showDragHandle: true` com `dragHandleColor` `line`, cantos superiores `AppRadius.xl3`. Sem referência no web (que usa menu suspenso) nem nos mockups; valores dos tokens existentes.

### 8. DI e rota
- `service_locator.dart` passa a ter `configureDependencies({required Uri apiBaseUrl})` = infraestrutura (`Dio`, `KeyValueStore` → `SharedPreferencesKeyValueStore`, `StoreRepository` → `ApiStoreRepository`, todos lazy singletons) + `registerViewModels()`. `registerViewModels()` é público e registra `StoreSelectorViewModel` com `registerFactory`; os testes de app e de rotas registram um `FakeStoreRepository` com `getIt.registerSingleton<StoreRepository>` e chamam `registerViewModels()`, sem rede nem disco. As etapas seguintes acrescentam seus ViewModels ali.
- `app_router.dart`: `HomePage(storeSelectorViewModelFactory: () => getIt<StoreSelectorViewModel>())` no `builder` (regra D permite `app/`).

### 9. Barreira: regra E
Em `test/core/support/import_rules.dart`, `ImportRule.bindingConfinement` com `bindingPackage = 'watch_it'`, `bindingAllowedPrefixes = {'ui/', 'app/'}` e `bindingForbiddenNames = {'di', 'sl', 'GetIt'}`: diretiva (import ou export) de `watch_it` fora desses prefixos é violação; em `ui/`, também é violação sem combinador `show`, com `hide`, ou com `show` que inclua um nome proibido. A regra precisa ler os combinadores da diretiva no `analyzer` (hoje `_breaks` só vê o alvo e o caminho). Teste real sobre `lib` exigindo ao menos um arquivo com `watch_it`; testes sintéticos dos cenários da spec; prova temporária de que a regra morde. Regras A e B já barram `watch_it` em `core`/`modules` e `shared_preferences` fora de `infra`.

### 10. `CLAUDE.md`
Só acréscimos: "Estado atual" com a etapa 4; regra E na seção de infraestrutura/DI (import de `watch_it` com `show`, sem `di`); `registerViewModels()` e o padrão `viewModelFactory` nas páginas; `KeyValueStore` como único acesso ao `shared_preferences`; em "Regras de domínio", que a loja em vigor sai de `pickCurrentStore`, a chave é `jaja:vitrine:loja` e a escolha nunca vai para a API.

## Dependências da etapa anterior

Conferido no código entregue pela etapa 3 (se algo mudar até a aplicação, adaptar esta change sem renomear o código existente):
- `lib/infra/http/run_request.dart` (`runRequest<T>(send, parse)`), `api_client.dart` (`createApiClient`) e `test/infra/http/support/fake_http_client_adapter.dart` (`FakeHttpClientAdapter` com `requests`, `enqueueResponse({statusCode, body, headers})` e `enqueueError(DioExceptionType)`).
- `lib/infra/di/service_locator.dart` com `getIt`, `configureDependencies({required Uri apiBaseUrl})` (só `Dio`) e `resetDependencies()`.
- `buildAppRouter({initialLocation})` com `HomePage()` constante no ramo Início; `test/app/app_test.dart`, `test/app/router/app_router_test.dart` e `test/app/bootstrap_test.dart` montam o app sem registrar dependências além do `Dio` — os três passam a registrar o repositório fake (ou, no bootstrap, a usar `SharedPreferences.setMockInitialValues({})` e trocar o adapter do `Dio` registrado por um `FakeHttpClientAdapter` antes do `pump`).
- `StateErrorBanner({failure, onRetry, title})`, `EmptyState({title, message, actionLabel, onAction, emoji})`, `SkeletonBox({width, height, radius})`, `PlaceholderBody(title:)`, `themed(child)` em `test/ui/shared/support/themed.dart`, `context.tokens` com `surface`, `line`, `brand`, `mutedInk`, `card`.
- `import_rules.dart` com `ImportRule { purity, infraConfinement, locatorConfinement }`, `_breaks(fromLayer, fromLib, target)` e `scanSource`/`scanDirectory` usando `ImportRule.values` por padrão.
- `pubspec.yaml` com `intl`, `dio`, `get_it`, `go_router`; dev `build_runner`, `analyzer`, `flutter_lints`.

## Decisões tomadas sem consulta

- O seletor fica só no topo da aba Início (não em todas as abas, como o cabeçalho do web) e o menu suspenso do web vira bottom sheet (padrão de app do plano).
- Pílula estática com uma loja só, como o web; o "Escolha a loja" do web enquanto carrega vira skeleton (padrão único de tela remota do app).
- Sem nenhuma loja ativa, estado vazio com a ação "Atualizar" (o web mostra a pílula vazia); textos do banner e do vazio são novos, o web não os tem.
- Chave `jaja:vitrine:loja` igual à do web; fallback para a primeira loja não grava nada, como o web.
- Lista de lojas guardada em memória durante a vida do app (o web guarda por aba); "Tentar de novo" e "Atualizar" ignoram a guarda.
- `CityState` em `core/value_objects` (regra 8), reaproveitável nos dados de entrega.
- `KeyValueStore` como contrato técnico em `infra/storage`, testado com `SharedPreferences.setMockInitialValues`; leitura e gravação nunca falham para o domínio.
- Regra E exige `show` no import de `watch_it` em `ui/` para impedir o uso de `di` (o `watch_it` reexporta o `get_it`).
- `registerViewModels()` público para os testes de app/rotas registrarem fakes sem rede.
- `freezed` entra agora (primeira entidade); `json_serializable` fica para quando houver consumidor.
- Nenhuma lacuna de API encontrada: `apps/mobile/docs/lacunas-da-api.md` não é criado nesta etapa.

## Risks / Trade-offs

- [`watch_it` com `show` explícito é mais verboso] → a lista é curta (`WatchingStatefulWidget`, `watchPropertyValue`) e o ganho é a regra 6 garantida pela barreira.
- [Lista guardada pode envelhecer com o app aberto por muito tempo] → loja desativada só some ao reabrir o app ou ao tocar em "Atualizar"; o backend continua validando o pedido.
- [Versões de `watch_it`/`freezed`/`shared_preferences` incompatíveis com o SDK] → `flutter pub add` resolve; nunca `pub upgrade`; versões resolvidas registradas aqui na aplicação.
- [Bootstrap test agora monta o seletor] → `setMockInitialValues` e adapter fake antes do `pump`, sem rede nem canal de plataforma reais.
