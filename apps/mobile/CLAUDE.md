# mobile — App do cliente Jajá

App mobile em Flutter (Android/iOS) do cliente da Jajá. Leva para o celular a experiência de compra da
vitrine web (`apps/frontend`, grupo `(public)`): escolher a loja, navegar e buscar no catálogo, ver o
produto, montar o carrinho, entrar ou criar conta, informar os dados de entrega, fechar o pedido e
acompanhá-lo ao vivo. Nada de admin. O app fala **só** com o backend NestJS existente (`apps/backend`,
porta 4000) e não altera o backend, os módulos nem o web.

**Este arquivo é a fonte inegociável das regras do app.** Leia-o no início de toda sessão. Etapas
intermediárias podem acrescentar decisões e regras novas, nunca afrouxá-las; só a última etapa do plano o
reescreve para refletir o estado final.

**Estado atual:** fundação. Existem o projeto Flutter (só Android e iOS, org `br.com.jaja`, nome exibido
"Jajá"), um `lib/main.dart` mínimo com um `MaterialApp` vazio, e `lib/core` em construção (`Result`,
`Command`, `AppFailure`; `Money` e ambiente a seguir). Ainda não há tema, rotas, DI, HTTP nem domínio.
Etapa 2: já existem o tema claro da marca (`lib/ui/shared/theme/`, com as fontes em `assets/fonts/`), o
`formatMoney` e os componentes base em `lib/ui/shared/widgets/`; o `main.dart` mínimo usa `AppTheme.light()`.
Etapa 3: já existem o cliente HTTP com falhas tipadas (`lib/infra/http/`), a DI com `get_it`
(`lib/infra/di/`), os entrypoints `lib/main_dev.dart`/`lib/main_prod.dart` (o `main.dart` foi apagado), o
bootstrap e o `JajaApp` em `lib/app/`, e o shell de quatro abas com páginas provisórias.
Etapa 4: já existem o primeiro domínio (`lib/modules/store/`, com `Store` em `freezed` e `pickCurrentStore`),
o value object `CityState` em `core/value_objects/`, o DTO de `GET /storefront/stores` (`lib/infra/api/`), o
`KeyValueStore` sobre `shared_preferences` (`lib/infra/storage/`), o `ApiStoreRepository` (`lib/infra/store/`),
o primeiro ViewModel com `watch_it` e o seletor de loja no topo da aba Início (`lib/ui/modules/store/`), o
`registerViewModels()` na DI e a regra E da barreira.
Etapa 5: já existem o domínio do catálogo (`lib/modules/catalog/`: `Category`, `ProductSummary`,
`ProductPage`, `ProductQuery`/`ProductSort` em `freezed`, `encodeProductQuery`/`decodeProductQuery`, as
consultas da Início em `home_catalog.dart` e o contrato `CatalogRepository`), os DTOs de
`GET /storefront/categories` e `GET /storefront/products` (`lib/infra/api/`), o `ApiCatalogRepository`
(`lib/infra/catalog/`), a aba Início completa (`HomeViewModel`, `BlockState` e `categoryArtOf` em
`lib/ui/modules/catalog/view_models/`, os widgets de `lib/ui/modules/catalog/widgets/`), as rotas
`/home/product/:slug` (com a `ProductPage` provisória, widget homônimo da entidade; a etapa 7 a substitui) e
`/search?…` com o filtro decodificado, o `ProductArt` com `cached_network_image` e a regra F da barreira.
Etapa 6: já existem as regras puras da listagem (`product_listing.dart` e `category_tree.dart` em
`lib/modules/catalog/model/`), o `parseReaisToCents`/`formatCentsAsReais` e o `SearchViewModel` em
`lib/ui/modules/catalog/view_models/`, a aba Buscar completa (campo com espera de 300 ms, painéis inferiores
de filtros e de ordenação, pílulas, grade de duas colunas com paginação infinita), o filtro espelhado na rota
`/search?…` e a rota `/search/product/:slug` (mesma `ProductPage` provisória, na pilha da aba Buscar).
Etapa 7: já existem o detalhe do produto no domínio (`ProductDetail`, `CatalogRef` e `ProductImage` em
`freezed`; `relatedProductsQuery`/`relatedProducts`/`rootCategorySlugOf` em `product_detail.dart`; o contrato
`fetchProduct(slug)`), o DTO de `GET /storefront/products/:slug` (`lib/infra/api/`), o
`ProductDetailViewModel` e a `ProductDetailPage` (galeria, descrição recolhível, ficha, trilha de categorias,
"Mais de <categoria>" e o rodapé "Adicionar ao carrinho") nas rotas `/home/product/:slug` e
`/search/product/:slug`, no lugar da `ProductPage` provisória (apagada), e as peças `ProductArtSize` e
`ProductBadge` em `lib/ui/shared/widgets/`.
Etapa 8: já existem a sessão por e-mail e senha (`Email`, `PersonName` e `StrongPassword` em
`core/value_objects/`; `AuthUser`, `AuthRepository` e `AuthErrorCode` em `lib/modules/auth/`; `Session`,
`SessionStatus`, `SessionStorage`/`SecureSessionStorage` e o `SessionRepository` em `lib/infra/auth/`; o DTO
`auth_dto.dart` e o `AuthInterceptor`), a guarda de rotas (`resolveSessionRedirect` em
`lib/app/router/session_redirect.dart`), o `SplashPage`, as telas cheias "Entrar" (`/login`) e "Criar conta"
(`/register`) com os ViewModels, e a aba Conta real (convite sem sessão; "Olá, <primeiro nome>" e "Sair"
com sessão), no lugar da `AccountPage` provisória.
Etapa 9: já existem o carrinho do visitante no domínio (`lib/modules/cart/`: `CartItem`, `CartLine` e
`CartDetail` em `freezed`, as regras e constantes de `cart_rules.dart`, o `CartState`, `CartErrorCode` e o
contrato `CartRepository`), o `GuestCartStorage` e o `GuestCartRepository` (`lib/infra/cart/`), o DTO de
`POST /cart/preview` (`lib/infra/api/cart_dto.dart`), o `KeyValueStore.remove`, a aba Carrinho real
(`CartPage`, `CartViewModel`, `CartLineTile`, `CartSummary` e o `CartNavigationShell` com o badge na aba),
a rota `/cart/product/:slug`, o `QuantityStepper` em `lib/ui/shared/widgets/` e o rodapé ligado do detalhe
do produto (quantidade, "Adicionar · <total>", "Você já tem N no carrinho." e o cartão de entrega). O
`PlaceholderBody` foi apagado (não sobrou consumidor).
Etapa 10: já existem o carrinho da conta (`GET/POST/PUT/DELETE /me/cart`, `POST /me/cart/merge`) pelo
`AccountCartApi` com `mapCartFailure` e o `SessionCartRepository` (`lib/infra/cart/`), que é o
`CartRepository` do app e escolhe a fonte pela sessão; `accountCartItems` (`lib/modules/cart/model/`),
`cartErrorFromCodes` e `CartErrorCode.productUnavailable`, o `mergeFailure` no `CartState`, `remove` com
`Result` e `clear()` no contrato, e na aba Carrinho o banner de falha da carga e o aviso da mescla.

## Arquitetura

Camadas do **guia oficial de arquitetura do Flutter** (View → ViewModel → Repository), com o domínio
separado da UI e da infraestrutura. A organização de pastas é a mesma dos outros apps da equipe.

```
lib/
  main_dev.dart   # entrypoint de desenvolvimento (etapa 3; até lá, main.dart mínimo)
  main_prod.dart  # entrypoint de produção (etapa 3)
  app/            # bootstrap, app e rotas (go_router). Sem lógica, sem layout.
  core/           # base compartilhada — Dart PURO, sem Flutter
                  #   result.dart (sealed Ok/Failure), command.dart, errors/app_failure.dart,
                  #   value_objects/ (Money em centavos, …), env/ (API_URL)
  modules/        # DOMÍNIO — Dart PURO. Um módulo por domínio: catalog, store, cart, auth,
                  #   customer, order. Cada um com model/ (entidades), provider/ (só
                  #   interfaces), usecase/ e errors/
  infra/          # implementações do que provider/ declara: http/ (dio), api/ (DTOs à mão),
                  #   armazenamento, sessão, carrinho, di/ (get_it)
  ui/
    modules/      # UI espelhando os domínios: pages/, widgets/, view_models/
    shared/       # theme/ e widgets/ base, sem domínio
test/             # espelha lib/ (nunca teste ao lado do código)
```

### O que cada camada pode importar

| Camada | Pode importar |
|---|---|
| `core/` | `dart:core`, `dart:async`, `dart:collection`, `dart:convert`, `dart:math`, `dart:typed_data`; `meta`, `collection`, `freezed_annotation`, `json_annotation`; o próprio `core/`. **Nunca** `modules/`. |
| `modules/` | O mesmo que `core/`, mais `core/` e `modules/`. |
| `infra/` | Tudo acima, mais `dio`, `flutter_secure_storage`, `shared_preferences`, `get_it`. **Só aqui** entram `dio`, `flutter_secure_storage` e `shared_preferences`. |
| `ui/` | Flutter, `watch_it`, `cached_network_image`, `intl`, `core/`, `modules/`. Nunca os pacotes de HTTP e armazenamento. |
| `app/` | Flutter, `go_router`, `get_it` (só nos `builder` das rotas), `ui/`, `infra/di/`, `infra/auth/` (só o estado da sessão — `Session`, `SessionStatus` — para a guarda e o `refreshListenable`). |

### Regras (não negociáveis)

1. **`core/` e `modules/` são Dart puro.** Não importam `package:flutter`, `dart:io`, `dart:ui` nem pacotes
   de infraestrutura, e `core/` não importa `modules/`. Verificado por `test/core/architecture_test.dart`
   (lendo os imports e exports com o `analyzer`) — não é convenção, é barreira.
2. **`provider/` só tem interface.** A implementação vive em `infra/`. Só entra em `modules/*/provider/` o
   contrato cujo **tipo transportado é de domínio** — a assinatura decide, não o nome. Contrato que
   transporta estado técnico é infra pura e mora em `infra/`, ao lado da implementação: o caso deste app é a
   sessão JWT (token, estados `unknown`/`authenticated`/`anonymous`), em `lib/infra/auth/`.
3. **Erro é valor, não exceção.** Repositórios e casos de uso devolvem `Result<T>` (`sealed class`), para o
   `switch` exaustivo obrigar o tratamento. O erro é tipado (`sealed class AppFailure` com enum de código),
   nunca uma `DioException` crua. O `catch` do `Command` é a única fronteira de exceção do app.
4. **Use case só quando se paga:** quando junta mais de um repositório, quando é complexo ou quando é
   reusado por vários ViewModels. Caso contrário, o ViewModel chama o repositório direto.
5. **A UI consome as entidades do domínio** (Dart puro, imutáveis) — nunca o DTO da API. Formato só de tela
   (juntar entidades, campo derivado) nasce como classe de apresentação em
   `ui/modules/<dominio>/view_models/`, quando o consumidor existe.
6. **Injeção por construtor sempre.** `getIt<T>()` só aparece em `infra/di/` e no `builder` da rota — dentro
   de um ViewModel vira service locator.
7. **ViewModel é sempre `registerFactory`, nunca singleton.** Singleton devolveria, ao voltar à tela, o
   mesmo `ChangeNotifier` já descartado no `dispose()`.
8. **Regra sobre um valor vira value object em `core/value_objects/`.** Se a lógica cabe num VO e ele não
   existe, crie; se existe e falta o comportamento, acrescente ali — nunca reimplemente no consumidor (ex.:
   conta de dinheiro fora de `Money`).
   - O gatilho é a lógica existir, não a previsão de que vá existir.
   - Dois moldes, escolhidos pelo significado de entrada inválida. Quando é **erro**: construtor privado +
     `static Result<T>` de criação (`Money.fromCents`). Quando é **estado degradado válido**: construtor
     público e getters que devolvem `null`.
   - VO de `core/` não conhece `modules/` (a barreira barra).

## Infraestrutura de HTTP, DI e rotas

- **Toda chamada à API passa por `runRequest`** (`lib/infra/http/run_request.dart`):
  `runRequest(() => dio.get<Object?>(...), parse)` devolve `Result<T>`. `DioException` vira falha por
  `mapHttpFailure` (`http_failure_mapper.dart`); qualquer outro erro, inclusive no `parse`, vira
  `UnexpectedFailure`. Repositório nunca faz `try/catch` de `dio` nem chama `mapHttpFailure` à mão.
- **Status → falha** (código em `HttpFailureCode`, em `core/errors/app_failure.dart`):

  | Situação | Falha | Mensagem |
  |---|---|---|
  | sem conexão, certificado ruim | `NetworkFailure` (`noConnection`) | "Não foi possível falar com o servidor. Tente novamente." |
  | tempo esgotado (conexão, envio, resposta, conversão) | `NetworkFailure` (`timeout`) | idem |
  | 401 | `SessionFailure` (`sessionExpired`) | "Sua sessão expirou. Entre de novo." |
  | 404 | `NotFoundFailure` (`notFound`) | "Não encontramos o que você procurou." |
  | outros 4xx | `BackendRejectionFailure` (`rejected`, `statusCode`, `codes` do `message`) | "Não foi possível concluir. Tente novamente." |
  | ≥ 500 | `ServerFailure` (`server`) | "O servidor está indisponível no momento. Tente novamente em instantes." |
  | cancelado, desconhecido, status ausente ou < 400 | `UnexpectedFailure` (`unexpected`) | "Algo deu errado. Tente novamente." |

  A mensagem nunca lista códigos do backend; texto específico por código é olhando `codes`, na etapa que o
  consome.
- **Cliente:** `createApiClient(Uri)` (`api_client.dart`), registrado como `Dio` lazy singleton em
  `configureDependencies`. Interceptores (Bearer) entram nesse mesmo cliente.
- **Sessão e Bearer:** o `AuthInterceptor` (`lib/infra/http/auth_interceptor.dart`) é ligado ao `Dio` na DI
  com fechamentos que resolvem o `getIt<Session>()` na hora da requisição (sem ciclo `Dio` ↔ sessão): põe
  `Authorization: Bearer <token>` quando a requisição não traz o seu, e o `401` da requisição que levou o
  token atual chama `Session.expire()` (o erro segue para o `runRequest`, que devolve a `SessionFailure`).
  `Session` (`lib/infra/auth/session.dart`: `status`, `token`, `expire()`, `Listenable`) é o contrato
  técnico do router e do interceptor; as telas usam o `AuthRepository` do domínio. Os dois, na DI, são a
  mesma instância do `SessionRepository`, que nasce `unknown` e é restaurado pelo bootstrap sem esperar.
- **Rota nova que exige sessão entra em `AppRoutes.sessionRequiredPaths`** (vale o caminho e o que fica
  abaixo dele); sem sessão, a guarda leva a `/login?from=<destino>`. Nenhuma tela checa a sessão por conta
  própria nem navega depois de entrar: quem conclui o acesso é a guarda (o redirect, e
  `_concludePushedAccess` para o "Entrar" empilhado). "Entrar", "Criar conta" e o splash ficam fora do
  `StatefulShellRoute` (tela cheia, sem a barra). Testes de app e de rotas trocam a sessão com
  `registerFakeDependencies(auth: FakeAuthRepository(...))`.
- **`getIt` só em `lib/infra/di/` e `lib/app/`** (regra D da barreira, `ImportRule.locatorConfinement`):
  qualquer outro arquivo, inclusive os entrypoints na raiz de `lib/`, que importe `get_it` faz o
  `flutter test` falhar. Teste que chama `configureDependencies` faz `tearDown(resetDependencies)`.
- **`watch_it` só em `lib/ui/` e `lib/app/`** (regra E da barreira, `ImportRule.bindingConfinement`). Em
  `lib/ui/` o import **sempre com `show`** listando só o que a tela usa (ex.:
  `show WatchingStatefulWidget, watchPropertyValue`), nunca sem `show`, com `hide` nem trazendo `di`, `sl`
  ou `GetIt`: o `watch_it` reexporta o `get_it`, e sem o `show` o localizador entraria nas telas por fora da
  regra D. Qualquer diretiva fora disso faz o `flutter test` falhar com arquivo, linha e o import.
- **`cached_network_image` só em `lib/ui/`** (regra F da barreira, `ImportRule.imagePackageConfinement`):
  o cache de fotos abre banco e pasta do aparelho por baixo, então repositório e DTO transportam só a URL
  (`thumbUrl`) e quem desenha a foto é o `ProductArt` (`CachedNetworkImage`: placeholder em branco, falha
  cai na reserva com emoji). Qualquer arquivo fora de `lib/ui/` que importe o pacote faz o `flutter test`
  falhar com arquivo, linha e o import. Nos testes nenhuma foto carrega de verdade: todo teste que monta um
  card com `thumbUrl` chama `holdImageLoad(url)`/`failImageLoad(url)`
  (`test/ui/shared/support/fake_image_loads.dart`) antes do `pumpWidget`, ou zera a URL com `copyWith`;
  sem isso o cache do aparelho é acionado e o teste cai com `MissingPluginException` depois de terminar.
- **ViewModels na DI:** `configureDependencies` registra a infraestrutura (lazy singletons) e termina chamando
  `registerViewModels()`, público, que registra cada ViewModel com `registerFactory`. Etapa nova acrescenta
  o seu ViewModel ali. Testes de app e de rotas registram o repositório fake com
  `getIt.registerSingleton<…>` e chamam só `registerViewModels()` (`test/app/support/fake_dependencies.dart`),
  sem rede nem disco.
- **Página recebe a fábrica do ViewModel pelo construtor** (`xxxViewModelFactory: () => getIt<XxxViewModel>()`
  no `builder` da rota), materializa a instância no `initState`, dispara a carga ali, descarta no `dispose()`
  e observa com `watchPropertyValue(..., target:)` numa `WatchingStatefulWidget`. Nos testes, a fábrica cria
  o ViewModel de verdade sobre o repositório fake.
- **`shared_preferences` só por `KeyValueStore`** (`lib/infra/storage/key_value_store.dart`, contrato
  técnico de texto, implementado por `SharedPreferencesKeyValueStore`): repositório nenhum importa o
  pacote, e leitura ilegível vira `null`, gravação que falha é engolida — o domínio nunca vê exceção do
  disco. Testes usam o `FakeKeyValueStore` de `test/infra/storage/support/`. `remove(key)` apaga a chave
  (também nunca lança; o `FakeKeyValueStore` respeita `failOnWrite`).
- **Entrypoints:** `lib/main_dev.dart` e `lib/main_prod.dart` só chamam `bootstrap(AppEnvironment.x)`; todo
  `flutter run` usa `-t` (o `Makefile` cuida). Endereço não resolvido abre `ConfigurationErrorApp`, sem
  registrar dependências.
- **Rotas:** caminhos em `AppRoutes` (`lib/app/router/app_routes.dart`), nunca string solta; o router é
  `buildAppRouter` com um `StatefulShellBranch` por aba (Início, Buscar, Carrinho, Conta, nessa ordem), `/`
  redirecionado para `/home` e `NotFoundPage` para rota desconhecida. Em `ui/`, só o
  `AppNavigationShell` importa `go_router` (pelo `StatefulNavigationShell`); páginas recebem navegação por
  callback, como a `NotFoundPage`.
- **Filtros de produtos têm uma codificação só:** `encodeProductQuery`/`decodeProductQuery`
  (`lib/modules/catalog/model/product_query_params.dart`), com os nomes de chave que o
  `StorefrontController` aceita (`category`, `brand`, `search`, `onSale`, `featured`, `sort`, `page`,
  `pageSize`, `minPriceCents`, `maxPriceCents`), servem tanto ao `queryParameters` de
  `GET /storefront/products` quanto à rota `/search?…` (`AppRoutes.searchLocation(ProductQuery)` ao ir e
  `decodeProductQuery(state.uri.queryParameters)` no `builder` da rota). Nunca monte query string à mão nem
  invente nome de parâmetro; valor inválido é ignorado em silêncio, como o controller e o web.
- **Página provisória:** `Scaffold` + `SafeArea` + `PlaceholderBody(title:)`, na pasta `pages/` do domínio
  dono da aba (`catalog`, `cart`, `auth`). A etapa da funcionalidade troca a página; o `PlaceholderBody` sai
  quando não sobrar consumidor.

## Estado

Três níveis, sem camada extra entre eles:

- **Efêmero de widget** — `StatefulWidget`/`setState`, para o que só aquele widget conhece (ex.: mostrar a
  senha).
- **De tela** — ViewModel em `ui/modules/<dominio>/view_models/`, um `ChangeNotifier` por tela, com
  `Command0`/`Command1` (de `core/command.dart`) para cada ação, passando `notifyListeners` como
  `onStateChange`. A UI observa com `watch_it`.
- **Global** — a **sessão** e o **carrinho** moram cada um num repositório em `infra/`, exposto como
  `ChangeNotifier`/`Stream`. Não existe camada de "estado de aplicação" além disso.

## Estados de tela remota (padrão único)

Todo bloco que mostra dado buscado da rede segue a mesma regra, sem variação por tela:

- **Carregando** (primeira carga, puxar a tela ou "Tentar de novo"): **skeleton** no lugar do bloco inteiro,
  também quando já havia dado. O valor exibido vive em campo próprio do ViewModel, não no `result` do
  `Command` (que é limpo a cada execução).
- **Falha:** o banner de erro padrão de `ui/shared/widgets/` (título, mensagem da falha, botão
  **"Tentar de novo"**) substitui **só o bloco que dependia da busca**. Nada de skeleton parado nem SnackBar
  para falha de busca.
- **Vazio:** mensagem curta com **uma ação** (ex.: "Ver catálogo").
- "Tentar de novo" refaz só o que falhou; puxar a tela refaz tudo.
- **Forma do bloco no ViewModel:** cada bloco remoto é um `BlockState<T>` (`sealed class` em
  `lib/ui/modules/catalog/view_models/block_state.dart`: `BlockLoading`, `BlockFailed(failure)`,
  `BlockLoaded(value)`), exposto como propriedade própria do ViewModel (não o `result` do `Command`),
  observado com `watchPropertyValue` e consumido por `switch` exaustivo (a `HomeSection` é o molde:
  skeleton, `StateErrorBanner` com "Tentar de novo", nada quando carregado e vazio, conteúdo). Tela nova
  com bloco remoto reusa esse `sealed class`; com o segundo consumidor fora do catálogo, ele sobe para
  `ui/shared/` sem mudar de forma.
- **Listas paginadas (paginação infinita, molde: a Buscar):** o skeleton da grade entra **só na página 1**
  (primeira carga, troca de filtro, "Tentar de novo", puxar a tela); a página seguinte mostra só um skeleton
  curto no rodapé, mantendo os itens. Falha da página seguinte **não** troca a grade: o `StateErrorBanner`
  ("Não foi possível carregar mais produtos.") com "Tentar de novo" aparece **só no rodapé** e refaz a mesma
  página. A próxima página é pedida perto do fim da rolagem e também quando a lista não enche a tela.

## Convenções

- **Código em inglês; textos da UI, comentários, specs, propostas e tarefas em português.**
- Arquivos em `snake_case`, com sufixo de tipo: `_entity`, `_repository`, `_use_case`, `_dto`, `_page`,
  `_view_model`. Widget não leva sufixo.
- **Página é composição, não layout.** A `_page` materializa o ViewModel, observa o estado e decide
  navegação; os pedaços visuais moram em `ui/modules/<dominio>/widgets/`, um arquivo por widget.
- **Estado local desce junto com o widget** extraído (vira `StatefulWidget` e leva o estado).
- **`ui/shared/widgets/` só com o segundo consumidor** — e sobe sem conhecimento de domínio. Exceção: os
  componentes base da marca da etapa 2 (botões pill, campo, preço, chip, card de produto, skeleton, banner
  de erro, vazio), que o plano define como base compartilhada.
- **Testes em `test/` espelhando `lib/`:** unidade para `core`, `modules` e `infra` (parsing de DTO a partir
  de JSON de exemplo, mapeador de falhas, repositórios com dio fake); widget test para páginas e estados.
  **Nada de mocktail nem mockito:** fakes escritos à mão em `test/**/support/` (inclusive o
  `HttpClientAdapter` fake do dio).
- **Comentário só quando o código não se explica** (invariante, restrição, origem de um valor copiado). Não
  redizer a assinatura nem citar número de decisão no código.
- **Regras de negócio copiadas, nunca inventadas:** limites do carrinho, taxa de entrega, frete grátis,
  status do pedido e limites de campos vêm de `modules/orders/src` e `modules/customers/src`, com a origem
  num comentário curto.
- Capacidades OpenSpec novas com prefixo `mobile-`, sob `openspec/specs/mobile/mobile-<nome>/`.
- **Ao notar algo fora do padrão deste arquivo**, registre e corrija pela regra, sem seguir calado.

## Design visual

É a mesma marca da vitrine web, com padrões de app. Fontes de valor (só leitura, nunca alteração):

- `apps/frontend/DESIGN.md` — a direção visual e quais tokens cada peça usa.
- `apps/frontend/src/app/globals.css` — os tokens (cores, raios, espaçamentos).
- `openspec/specs/shared/design-system/spec.md` — os requisitos do design system.
- `openspec/extras/design/{Home,Produto,Checkout,Rastreamento}.dc.html` — os mockups.

**Copie valores; não invente.** Fontes **Manrope** (texto) e **Bricolage Grotesque** (títulos de destaque),
em arquivos `.ttf` em `assets/fonts/` com a licença OFL junto — nunca `google_fonts` nem download em tempo
de execução. Cor obtida por `color-mix(…)`/oklab no web entra no app **já resolvida**, com o `color-mix` de
origem no comentário (`Color.lerp` é sRGB e daria outro resultado).

Material 3 com tudo resolvido no `ThemeData` e num `ThemeExtension` de tokens da marca: **nenhuma cor
(`Color(...)`, `Colors.*`), `TextStyle` ou raio literal em `pages/` e `widgets/`** (a barreira passa a
verificar na etapa 2).

**Regra C ativa** (`test/core/support/inline_style_rules.dart`, lida pelo `analyzer`): em arquivos sob
`lib/ui` com uma pasta `pages/` ou `widgets/` no caminho, `flutter test` falha com arquivo, linha, trecho e
remédio diante de `Color(...)`/`Color.fromARGB|fromRGBO|from`, `Colors.*` (exceto `Colors.transparent`),
`TextStyle(...)`, argumento `fontSize:`, `Radius.circular`/`BorderRadius.circular` com número e qualquer
`*.styleFrom(...)`. `lib/ui/shared/theme/` fica fora: é onde os literais moram. Espaçamento literal é
permitido. Comentário e string não contam.

Onde fica cada coisa do tema (`lib/ui/shared/theme/`):

- **Cores e sombras:** `AppColors.<token>` (nome do token do `globals.css` em camelCase: `paper`, `ink`,
  `inkSoft`, `brand`, `tintPeach`…) e o `ThemeExtension` `BrandTokens` com as mesmas cores e as sombras
  `shadowCard`/`shadowBrand`/`shadowFloat`/`shadowBadge`. Nas telas, **sempre `context.tokens.<token>`**
  (extensão de `brand_tokens.dart`) ou o `ColorScheme` — `AppColors` só no tema.
- **Raios:** `AppRadius` com os nomes do `@theme` do web (`xs` 6, `sm` 8, `md` 10, `lg` 12, `xl` 14,
  `xl2` 18, `xl3` 20, `xl4` 24, `pill` 999; no web `rounded-xl` = 14 e `rounded-2xl` = 18). Campo e área de
  imagem 14, card 18. **Espaços:** `AppSpacing.s4`…`s48` (múltiplos de 4) mais `s10`, `s14`, `s18`.
- **Tipografia:** `Theme.of(context).textTheme` (Manrope; títulos `displaySmall`/`headlineSmall`/
  `titleLarge` em Bricolage 800). Tamanho fora da escala entra na extensão `AppTextStyles` de
  `app_typography.dart`, nunca no widget; o widget só aplica `copyWith(color:)`. Fonte variável: todo estilo
  passa `fontVariations` com o eixo `wght`.
- **Botões:** `AppButtonStyles.of(variant:, size:, …)` e o widget `AppButton`; nada de `styleFrom`.
- **Tema:** só claro (`AppTheme.light()`, `themeMode: ThemeMode.light`, sem `darkTheme`), como o web.
- **Preço:** `formatMoney(Money)` em `lib/ui/shared/formatters/` → `R$ 1.290,90`, idêntico ao
  `formatPrice` do web (espaço comum, nunca U+00A0). Nunca formate preço em `core/` nem à mão.
- **Emoji e tom de categoria:** só por `categoryArtOf(rootSlug)`
  (`lib/ui/modules/catalog/view_models/category_art.dart`, cópia de `category-art.ts` do web, chaveada pelo
  slug da **raiz**), que devolve `CategoryArt(emoji, tint: ProductArtTint)` e `defaultCategoryArt`
  (🛒/verde) para raiz desconhecida. Chips de categoria, reserva do card sem foto e cartões de categoria
  passam por ela; nenhum widget mapeia slug para emoji ou cor por conta própria, e os tons continuam sendo
  os `ProductArtTint` do tema (regra C).
- **Arte e selo do produto:** `ProductArt(size: ProductArtSize.card | gallery | thumb)` (padrão `card`, com
  altura 120; `gallery` e `thumb` ocupam o espaço que quem usa dá) e `ProductBadge(label, variant:
  ProductBadgeVariant.brand | solid)` (`brand`: o "Destaque"/"Em destaque" do card e do detalhe; `solid`: o
  `−N%`), ambos em `lib/ui/shared/widgets/`. Nenhum widget redesenha foto, reserva com emoji ou selo de
  produto por conta própria.
- **Quantidade:** `QuantityStepper(quantity, itemName, onDecrement, onIncrement, size:
  QuantityStepperSize.compact | large)` em `lib/ui/shared/widgets/` (linha do carrinho e rodapé do produto),
  com alvos de 44 e os rótulos "Diminuir/Aumentar quantidade de <nome>"; `null` desabilita o botão e quem
  usa decide os limites. Nenhum widget redesenha o "− n +".

**Conflito conhecido:** `openspec/specs/shared/design-system` descreve um visual antigo (vermelho `#ec3013`,
Archivo, IBM Plex Mono, cantos retos) que o web não usa mais. Vale o código do web (`globals.css`,
`DESIGN.md`, componentes); a spec do web não é alterada por este app.

Padrões de app: **uma ação principal por tela**, carrinho como **aba própria** (não drawer), filtros em
**bottom sheet**. Abas: Início, Buscar, Carrinho, Conta.

## Stack

| Camada | Escolha | Cuidado |
|---|---|---|
| Estado | `ChangeNotifier` + `Command` **escrito à mão** (`core/command.dart`) | Nada de `flutter_command`, Riverpod ou Bloc. |
| Binding UI | `watch_it` | Rebuild por propriedade. |
| DI | `get_it` | Só em `infra/di/` e nos `builder` de rota (regras 6 e 7). Sem `injectable`. |
| Rotas | `go_router` | Guarda de sessão por estado (`unknown`/`authenticated`/`anonymous`), splash enquanto `unknown`. |
| HTTP | `dio` | Só em `infra/`. Interceptor injeta o Bearer; falha do dio vira `AppFailure` no mapeador de `infra/http/`. |
| Modelos | `freezed` (sintaxe v3) + `json_serializable` + `build_runner` | `.freezed.dart`/`.g.dart` são **commitados**: rode o codegen sempre que uma entidade mudar. DTOs da API são escritos à mão em `infra/api/`. |
| `Result<T>` | **escrito à mão** (`core/result.dart`) | Para `case Ok(:final value)` funcionar; nada de `result_dart`. |
| Lints | `flutter_lints` | `analysis_options.yaml` sem regras extras. |

### Pacotes permitidos

Só por `flutter pub add` (**nunca** `pub upgrade`, `flutter upgrade` nem `flutter channel`), e só quando
houver consumidor:

- **Dependências:** `go_router`, `get_it`, `watch_it`, `dio`, `freezed_annotation`, `json_annotation`,
  `flutter_secure_storage` (token), `shared_preferences` (carrinho anônimo e loja escolhida),
  `cached_network_image` (fotos do catálogo), `intl` (moeda pt-BR), `collection`.
- **Dev:** `build_runner`, `freezed`, `json_serializable`, `flutter_lints`, `analyzer` (barreira de
  arquitetura).

Qualquer outro pacote está fora. Cada etapa que cria pasta ou acrescenta pacote restrito **estende a
barreira** em `test/core/architecture_test.dart`, nunca a afrouxa.

## Regras de domínio do app

O contrato vem dos controllers em `apps/backend/src/modules/**` e dos DTOs em `modules/*/src/**/dto` — leia
antes de escrever um DTO, não use a memória. O comportamento espelha `apps/frontend/src/modules/*` e as
specs em `openspec/specs/<domínio>/`.

- **Sessão:** e-mail e senha (`POST /auth/login`, `POST /auth/register`, `GET /auth/me`). O JWT (7 dias, sem
  refresh) fica no `flutter_secure_storage` e vai como `Authorization: Bearer` por um interceptor. **401
  encerra a sessão** e volta ao login preservando o destino (como o `?voltar=` do web). Mensagem de
  credencial inválida é genérica ("e-mail ou senha inválidos"), nunca diz qual dos dois errou.
  - Textos de erro (`AuthErrorCode`): "E-mail ou senha inválidos.", "Este e-mail já está cadastrado.",
    "Não foi possível entrar. Tente novamente.", "Não foi possível criar a conta. Tente novamente."; dos
    campos, os dos VOs ("E-mail inválido.", "Informe nome e sobrenome.", …) e "As senhas não conferem." na
    confirmação. O login também exige senha forte, como o `login.schema.ts` do web.
  - O destino vai no parâmetro **`from`** (`AppRoutes.fromParam`, o `voltar` do web), codificado; só vale
    caminho relativo iniciado por `/` (não `//`, sem esquema) e fora de splash, login e cadastro
    (`safeReturnLocation`); senão vai para `/home`.
  - Restauração: a sessão guardada (`{token, user}` na chave `jaja:sessao` do armazenamento seguro) é
    conferida com `GET /auth/me` e o Bearer guardado; `401` apaga e segue sem sessão; sem rede ou servidor
    fora, segue com o usuário guardado até um `401`. Enquanto isso o app mostra o splash.
- **Carrinho:** anônimo guardado em `shared_preferences` e precificado por `POST /cart/preview`; com sessão,
  `/me/cart`; no login, `POST /me/cart/merge` e limpeza do local, como o web (`cart.context.tsx`,
  `guest-cart-storage.util.ts`). Preço **sempre em centavos** (`Money`), formatado só na UI com `intl` pt-BR.
  - Visitante: a chave é **`jaja.guest-cart`** (a do web), com `[{"productId","quantity"}]`, normalizada na
    leitura por `normalizeCartItems`; carrinho vazio apaga a chave. Limites e entrega só pelas constantes de
    `cart_rules.dart` (copiadas de `modules/orders/src/cart/errors.ts`: 99 unidades, 50 produtos, taxa
    R$ 4,90, grátis a partir de R$ 79,00); toda mudança passa por `addCartItem`/`setCartItemQuantity`/
    `removeCartItem`, e a falha de regra devolve `ValidationFailure` sem mudar nada.
  - O estado do visitante é o `GuestCartRepository` (registrado na DI como fonte do `SessionCartRepository`),
    restaurado pelo bootstrap sem esperar; as ações esperam o `restore`. Quantidade e badge mudam na hora
    (soma local); a prévia (`POST /cart/preview`) é pedida **250 ms depois da última mudança**, cada pedido abre uma
    **geração** e resposta de geração antiga (ou depois do `dispose`) é descartada. Produto que a prévia
    **não devolve sai** do carrinho e do armazenamento, em silêncio. Falha da prévia vira o banner "Não
    foi possível carregar o carrinho." com "Tentar de novo" (`refresh()`).
  - A UI depende **só** do `CartRepository`, que é o `SessionCartRepository` (lazy singleton; o bootstrap
    chama `start()` logo depois do `restore()` do visitante). A fonte é escolhida pelo **token** da sessão
    (`authenticated ? token : null`): sem token (`unknown`/`anonymous`), tudo é delegado ao visitante e os
    avisos dele são repassados; aviso da sessão sem troca de token é ignorado. Cada troca de token abre uma
    **geração** e uma fila nova; tarefa ou resposta de geração antiga é descartada e não envia nada.
  - Na conta, os itens exibidos saem de `accountCartItems(detail, overrides)`. Todo comando (`add`,
    `setQuantity`, `remove`, `clear`) passa antes pelas mesmas regras puras de `cart_rules.dart` (falha de
    regra devolve `ValidationFailure` sem requisição), grava o **override** da quantidade nova (badge e
    quantidade mudam na hora) e entra numa **fila única** (um comando só sai depois da resposta do anterior;
    `setQuantity(id, 0)` vira `DELETE`). A resposta vira o `detail`; na falha, ela volta a quem chamou e,
    salvo `SessionFailure`, um `GET /me/cart` entra na fila. Os overrides só somem quando a fila esvazia.
  - **Entrar** (token novo): com itens do visitante, `POST /me/cart/merge`; o armazenamento do visitante só é
    apagado (`guest.clear()`) **no sucesso**. Na falha, `mergeFailure` mostra o aviso "Não foi possível
    juntar o carrinho deste aparelho à sua conta." (`CartPage.mergeErrorTitle`, no topo da aba, fora do
    skeleton) e vem `GET /me/cart`; a nova tentativa acontece pelo "Tentar de novo" (`refresh()` remescla
    enquanto há itens locais) ou na próxima entrada. Sem itens locais, só `GET /me/cart`; falha da carga vira `previewFailure` (o banner "Não foi possível carregar o
    carrinho." aparece antes do vazio).
  - **Sair** (token nulo): volta ao carrinho do visitante como está no aparelho, descartando o estado da
    conta; **nada** apaga o carrinho do servidor.
  - Recusas do backend nos comandos são traduzidas por `mapCartFailure` com `CartErrorCode`
    (`cartErrorFromCodes`, primeiro código conhecido): `CART_ITEM_QUANTITY_EXCEEDED`,
    `CART_ITEMS_LIMIT_EXCEEDED`, `CART_ITEM_QUANTITY_INVALID` com os textos das regras, e `404` →
    "Produto indisponível."; recusa sem código conhecido mantém "Não foi possível concluir. Tente
    novamente."; `load` e `merge` não traduzem. As mensagens chegam à UI pelo `failure.message`.
  - "Finalizar pedido · <total>" aparece **desabilitado** até a etapa 12 ligar o checkout.
  - No detalhe do produto, o rodapé tem o `QuantityStepper` (1 a 99) e "Adicionar · <total>"
    ("Adicionando…" enquanto inclui); o sucesso mostra o aviso "Adicionado ao carrinho" com "Ver carrinho"
    (abre a aba Carrinho) e volta a quantidade a 1. Isso substitui o botão desabilitado da etapa 7.
- **Loja:** lista de `GET /storefront/stores`, escolha lembrada em `shared_preferences`; espelhe exatamente o
  efeito que a escolha tem no web, sem inventar parâmetro de API. A loja em vigor sai **sempre** de
  `pickCurrentStore(stores, rememberedSlug)` (`lib/modules/store/model/current_store.dart`: a lembrada se
  ainda estiver ativa, senão a primeira; fallback não grava). O slug fica na chave **`jaja:vitrine:loja`**
  (a mesma do web) via `StoreRepository.readChosenSlug`/`rememberChosenSlug`. A escolha **nunca vai para a
  API** — não muda catálogo, preço nem disponibilidade; só alimenta o seletor e a cidade/UF (`Store.place`,
  `CityState`) dos dados de entrega.
- **Catálogo:** árvore de `GET /storefront/categories` e páginas de `GET /storefront/products` (públicos,
  sem token), só pelo `CatalogRepository`. A Início usa exatamente as consultas do `StorefrontHome` do web
  (`lib/modules/catalog/model/home_catalog.dart`): `homeFeaturedQuery` (`featured=true&sort=featured&
  pageSize=12`), `homeOffersQuery` (`onSale=true&sort=discount&pageSize=8`) e até 12 categorias em destaque
  por `highlightedCategories` (destaque com `productCount > 0`, em pré-ordem). Seção carregada e vazia
  **some** (sem título nem "Ver tudo →"); só com os três blocos vazios entra o `EmptyState` "Nada por aqui.
  Já já." com "Ver catálogo". A árvore de categorias do primeiro sucesso fica guardada **enquanto o app
  está aberto** (`fetchCategories(refresh: true)` só ao puxar a tela; falha não é guardada); páginas de
  produtos **nunca** são guardadas. Chip e cartão de categoria abrem a Buscar filtrada
  (`onOpenSearch(ProductQuery)`), card de produto abre `/home/product/:slug` (`onOpenProduct(slug)`) — a
  página só navega por callback.
- **Listagem da Buscar:** `lib/modules/catalog/model/product_listing.dart` (cópia de
  `storefront-query.util.ts`): **24 itens por página** (`listingPageSize`), ordem efetiva = a escolhida, senão
  `relevance` com busca e `featured` sem (`effectiveSort`; "Mais relevantes" só aparece com busca). Todo filtro
  que entra no `SearchViewModel` (rota, painel, campo, pílula) passa por **`normalizeListingQuery`**, a porta
  única: zera `page`/`pageSize`, apara a busca, marcas sem repetição e no máximo 20, `relevance` sem busca vira
  `null`; filtro normalizado igual ao em vigor não pede nada. O filtro em vigor é **espelhado na rota da aba**
  (`context.go(AppRoutes.searchLocation(q))`, sem `page`/`pageSize`; o `go` reconstrói a mesma página e o
  mesmo ViewModel), e o filtro que chega pela rota entra por `applyQuery`. Cada pedido (página 1 ou seguinte)
  leva a **geração** do filtro; resposta de geração antiga é **descartada**. A primeira página não usa
  `Command` (troca de filtro no meio do pedido precisa valer); a seguinte é `Command0` e item de `id`
  repetido entre páginas é pulado. Card da Buscar abre `/search/product/:slug`, na pilha da aba.
- **Detalhe do produto:** `GET /storefront/products/:slug` (público, slug com `Uri.encodeComponent`) só por
  `CatalogRepository.fetchProduct`, **nunca guardado** (cada abertura e cada "Tentar de novo" pedem de
  novo). `404` (`NotFoundFailure`) vira o estado vazio "Produto não encontrado" com "Voltar ao catálogo"
  (Buscar sem filtros); outra falha, o banner com "Tentar de novo". "Mais de <categoria>" usa
  `relatedProductsQuery` (última categoria da trilha, `sort=featured&pageSize=5`) e `relatedProducts` (sem o
  próprio, no máximo 4), pedido só depois do produto e fora do `load`: falha ou lista vazia **some** em
  silêncio, sem banner. Marca e trilha abrem a Buscar filtrada pela página (`onOpenSearch`); outro produto
  empilha na mesma aba. O botão "Adicionar ao carrinho" fica fixo no rodapé, **visível e desabilitado**
  (`onAddToCart: null`) até a etapa 9 ligar o carrinho; sem stepper, total nem entrega antes disso.
- **Dados de entrega:** `GET/PUT /me/customer` com endereço em texto, **sem mapa**. Ao salvar, preserve a
  `location` vinda do backend; cliente novo vai com `location: null`.
- **Acompanhamento:** `GET /me/orders/:id` + SSE `GET /me/orders/:id/stream` lido por stream do dio com o
  Bearer no cabeçalho (**nunca token na URL**). O evento só avisa para buscar o pedido de novo; `ping` é
  ignorado; reconexão com espera crescente de 1 s a 10 s; para ao sair da tela e em segundo plano, retoma ao
  voltar. Status: `PLACED → PAYMENT_APPROVED → PICKING → OUT_FOR_DELIVERY → DELIVERED`, com os rótulos do web.
- **Ambiente:** `lib/main_dev.dart` e `lib/main_prod.dart`, URL da API por `--dart-define=API_URL` (padrão de
  dev `http://localhost:4000`; produção sem `API_URL` é falha de configuração), resolvida em
  `core/env/`. `adb reverse tcp:4000 tcp:4000` documentado no README e no Makefile. Sem Firebase e sem
  flavors nativos.
- **Fora do app:** admin, mapa e geolocalização, login social, recuperação de senha, lista "Meus pedidos",
  pagamento real (só o simulado), push, offline, favoritos, avaliações, cupons e deep links.

## Verificação e limites

Os três comandos, em `apps/mobile`, todos sem dispositivo e sem backend no ar:

```bash
dart run build_runner build --delete-conflicting-outputs
flutter analyze        # sem erros, avisos nem infos
flutter test           # inclui a barreira de arquitetura
```

- **Nunca** `flutter run`, build de APK/IPA, `integration_test`, emulador ou teste que precise do backend no
  ar. Rede vira fake do dio; verificação visual vira widget test ou fica registrada como fora do escopo.
- Não edite nada fora de `apps/mobile` (exceto os arquivos OpenSpec da change e as specs `mobile-*` no
  arquivamento). Se faltar algo no backend, registre em `apps/mobile/docs/lacunas-da-api.md` e contorne no
  app **sem inventar endpoint**.
- Não versione `build/`, `.dart_tool/` nem arquivos locais de IDE (o `.gitignore` gerado cuida disso).
