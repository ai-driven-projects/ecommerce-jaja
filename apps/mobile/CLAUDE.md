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
| `app/` | Flutter, `go_router`, `get_it` (só nos `builder` das rotas), `ui/`, `infra/di/`. |

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
- **Carrinho:** anônimo guardado em `shared_preferences` e precificado por `POST /cart/preview`; com sessão,
  `/me/cart`; no login, `POST /me/cart/merge` e limpeza do local, como o web (`cart.context.tsx`,
  `guest-cart-storage.util.ts`). Preço **sempre em centavos** (`Money`), formatado só na UI com `intl` pt-BR.
- **Loja:** lista de `GET /storefront/stores`, escolha lembrada em `shared_preferences`; espelhe exatamente o
  efeito que a escolha tem no web, sem inventar parâmetro de API.
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
