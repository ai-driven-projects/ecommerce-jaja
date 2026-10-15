# App mobile do cliente Jajá (Flutter)

## Objetivo

Criar o app Flutter do cliente da Jajá em apps/mobile, levando para o celular a experiência de compra que hoje existe na vitrine web (apps/frontend, grupo (public)): escolher a loja, navegar e buscar no catálogo, ver o produto, montar o carrinho, entrar ou criar conta, informar os dados de entrega, fechar o pedido e acompanhar o pedido ao vivo. Nada de admin. O app fala só com o backend NestJS que já existe (apps/backend) e não altera o backend, os módulos nem o web. Uma change OpenSpec por etapa, do início ao fim sem participação humana; o loop termina quando a última etapa é arquivada.

Referências
Comportamento: apps/frontend/src/modules/{catalog,orders,customers,auth,stores} (páginas, data/*.api.ts, cart.context.tsx, guest-cart-storage.util.ts, use-my-order.hook.ts, event-stream.util.ts) e as specs openspec/specs/{storefront,storefront-api,storefront-stores,storefront-access,storefront-cart,cart,checkout-access,order-placement,order-tracking,my-account,customer-registration,user-authentication,user-registration}. Espelhe o comportamento e os casos de teste; regras de negócio (limites do carrinho, taxa de entrega, status do pedido, limites de campos) vêm de modules/orders/src e modules/customers/src, sem reinventar.
Contrato da API: os controllers em apps/backend/src/modules/** (storefront.controller.ts, storefront-store.controller.ts, cart.controller.ts, my-cart.controller.ts, my-customer.controller.ts, my-order.controller.ts, auth.controller.ts) e os DTOs em modules/*/src/**/dto. Os DTOs Dart são escritos à mão em lib/infra/api/, com teste de parsing a partir de JSON de exemplo.
Arquitetura Flutter: o app /Users/leonardomleitao/Desktop/1-projetos/git/formacaodev/plataforma/apps/mobile (feito pelo loop mobile-mvp daquele repositório) é o modelo. Leia o CLAUDE.md, o pubspec.yaml, lib/core, lib/infra/{http,di,auth}, lib/app/router e test/core/architecture_test.dart dele e reproduza o mesmo desenho, adaptado a este domínio. Não copie nada de Firebase, Firestore, player ou do domínio de cursos.
Visual: apps/frontend/DESIGN.md, os tokens de apps/frontend/src/app/globals.css e os mockups openspec/extras/design/{Home,Produto,Checkout,Rastreamento}.dc.html. Copie os valores (cores, raios, espaçamentos, fontes Manrope e Bricolage Grotesque), não invente. É a mesma marca, com padrões de interação de app: uma ação principal por tela, carrinho como aba/tela própria em vez de drawer, filtros em bottom sheet.
Regras do loop
Primeira etapa cria apps/mobile/CLAUDE.md com as regras de arquitetura abaixo (adaptadas do CLAUDE.md da plataforma). Dali em diante ele é a fonte e é inegociável; a última etapa o atualiza.
Camadas (guia oficial do Flutter, View → ViewModel → Repository): lib/core (Dart puro: Result<T> selado Ok/Failure, Command, falhas tipadas, value objects como Money em centavos, env), lib/modules/<domínio>/{model,provider,usecase,errors} (Dart puro; provider/ só interfaces), lib/infra (implementações com dio, armazenamento, DI), lib/ui/modules/<domínio>/{pages,widgets,view_models} e lib/ui/shared/{theme,widgets}, lib/app (bootstrap, app, router). Domínios: catalog, store, cart, auth, customer, order.
Stack: ChangeNotifier + Command com watch_it na UI, get_it só em infra/di e nos builders de rota (ViewModels com registerFactory), go_router com guarda de sessão por estado (desconhecido/autenticado/anônimo), dio, freezed + json_serializable + build_runner. Sem exceções atravessando camadas: tudo é Result.
Pacotes permitidos (só via flutter pub add, sem pub upgrade): os da stack acima, flutter_secure_storage (token), shared_preferences (carrinho anônimo e loja escolhida), cached_network_image (fotos do catálogo), intl (moeda pt-BR), collection; dev: flutter_lints, analyzer (testes de arquitetura). Nada de mocktail ou mockito: fakes escritos à mão em test/**/support/. Fontes em assets/fonts/, nunca baixadas em tempo de execução.
Barreira de arquitetura testada (test/core/architecture_test.dart, com analyzer): core e modules não importam Flutter, dio e os pacotes de armazenamento ficam só em infra, nenhuma cor ou estilo literal em pages e widgets (tudo vem do tema e de um ThemeExtension de tokens da marca).
Sessão: login e cadastro por e-mail e senha (POST /auth/login, POST /auth/register, GET /auth/me). O JWT (7 dias, sem refresh) fica no flutter_secure_storage e vai como Bearer por um interceptor; 401 encerra a sessão e volta para o login preservando o destino (como o ?voltar= do web).
Carrinho: anônimo guardado localmente e precificado por POST /cart/preview; com sessão, /me/cart; no login, POST /me/cart/merge e limpeza do local, como no web. Preços sempre em centavos, formatados só na UI.
Dados de entrega: GET/PUT /me/customer com os campos de endereço em texto, sem mapa. Ao salvar, preserve a location que veio do backend (o cliente pode tê-la marcado no web); cliente novo vai com location: null.
Acompanhamento: GET /me/orders/:id mais o SSE GET /me/orders/:id/stream lido por stream do dio com o Bearer no cabeçalho (nunca token na URL); o evento é só um aviso para buscar o pedido de novo; reconexão com espera crescente de 1 s a 10 s; parar ao sair da tela e ao ir para segundo plano, retomar ao voltar.
Ambiente: lib/main_dev.dart e lib/main_prod.dart, URL da API por --dart-define=API_URL (padrão dev http://localhost:4000, com adb reverse documentado no README e num Makefile). Sem Firebase, sem flavors nativos.
Estados de tela remota uniformes: skeleton, banner de erro com "Tentar de novo", vazio com uma ação.
Código em inglês; textos da UI, comentários (mínimos), specs, propostas e tarefas em português. Capacidades novas do OpenSpec com prefixo mobile-. Testes em apps/mobile/test/ espelhando lib/.
Verificação: os .freezed.dart/.g.dart são commitados, então rode o codegen sempre que uma entidade mudar. Nunca flutter run, nem build de APK/IPA, nem teste que precise de emulador ou do backend no ar: o loop não tem dispositivo. Rede vira fake do dio; verificação visual vira widget test ou fica registrada como fora do escopo.
Não editar nada fora de apps/mobile (exceto os arquivos OpenSpec da change). Se faltar algo no backend, registre a lacuna em apps/mobile/docs/lacunas-da-api.md e contorne no app sem inventar endpoint.
Ordem sugerida das etapas
Fundamentos: scaffold do projeto Flutter (flutter create com org br.com.jaja, Android e iOS), CLAUDE.md, lints, core (Result, Command, falhas, Money), teste de arquitetura; tema da marca e componentes base (botões pill, campo, preço, chip, card de produto, skeleton, banner de erro); cliente HTTP, env, DI e shell de navegação com abas (Início, Buscar, Carrinho, Conta).
Catálogo: lojas e seletor de loja (lista, lembrada localmente); home com categorias, destaques e ofertas; listagem com busca, filtros (categoria, marca, faixa de preço, ofertas, destaques), ordenação e paginação infinita; detalhe do produto com galeria e "Adicionar ao carrinho".
Conta e carrinho: sessão (login, cadastro, guarda de rota, retorno ao destino, sair); carrinho anônimo e da conta com merge no login, quantidades, remoção, limites, subtotal, taxa de entrega e frete grátis.
Pedido: dados de entrega (Minha conta, sem mapa); checkout (destinatário, instruções, pagamento simulado, resumo, confirmação e erros do backend mapeados para mensagens); acompanhamento ao vivo com a linha do tempo dos status PLACED → PAYMENT_APPROVED → PICKING → OUT_FOR_DELIVERY → DELIVERED.
Fechamento: varredura final (código morto, literais de cor e de texto repetidos, testes de DI e de rotas, README de como rodar no emulador e no aparelho, docs/lacunas-da-api.md preenchido, CLAUDE.md atualizado).
Pode ajustar a divisão para que cada etapa caiba numa change, mas mantenha a ordem de dependência.

Verificações (em apps/mobile)
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter test
Comandos exigidos no PATH: flutter e dart. Escopo dos commits: apps/mobile. Prefixo: feat(mobile). Ferramentas proibidas: flutter pub publish, dart pub publish, flutter upgrade, flutter channel, flutter pub upgrade.

Fora do escopo
Tudo de admin; mapa (escolha do ponto no mapa, raio de entrega, mapa do entregador); geolocalização do aparelho; login com Google ou outros provedores; lista "Meus pedidos" (o backend não tem GET /me/orders); pagamento real (PIX, cartão); push notifications; modo offline; favoritos, avaliações e cupons; deep links; publicação nas lojas, assinatura e CI; qualquer mudança em apps/backend, apps/frontend, modules/* ou packages/*.

## Regras

## Ponto de partida
- `apps/mobile` **não existe**: a 1ª etapa cria o projeto (`flutter create --org br.com.jaja --platforms android,ios --project-name mobile apps/mobile`). Flutter 3.44 estável no PATH.
- O backend NestJS (`apps/backend`, porta padrão 4000) já expõe tudo de que o app precisa: `GET /storefront/categories`, `GET /storefront/products` (page, pageSize, search, category, brand, minPriceCents, maxPriceCents, onSale, featured, sort ∈ `STOREFRONT_PRODUCT_SORTS`), `GET /storefront/products/:slug`, `GET /storefront/stores`, `POST /cart/preview`, `/me/cart` (GET, POST items, PUT/DELETE items/:productId, DELETE, POST merge, POST orders), `GET/PUT /me/customer`, `GET /me/orders/:id`, SSE `GET /me/orders/:id/stream`, `POST /auth/login`, `POST /auth/register`, `GET /auth/me`. Antes de escrever um DTO, leia o controller e o DTO em `modules/*/src/**/dto` — o contrato vem dali, não da memória.
- Existe uma change não relacionada aberta (`openspec/changes/aws-ephemeral-environment`): não mexa nela.

## Referências (só leitura)
- **Comportamento:** `apps/frontend/src/modules/{catalog,orders,customers,auth,stores}` (páginas, `data/*.api.ts`, `cart.context.tsx`, `guest-cart-storage.util.ts`, `use-my-order.hook.ts`, `event-stream.util.ts`, `order-status.util.ts`) e as rotas de `apps/frontend/src/app/(public)`. Specs em `openspec/specs/<domínio>/<capacidade>/spec.md`: catalog/{storefront,storefront-api}, stores/storefront-stores, auth/{storefront-access,user-authentication,user-registration}, orders/{storefront-cart,cart,checkout-access,order-placement,order-tracking}, customers/{my-account,customer-registration}. Espelhe comportamento e cenários de teste.
- **Regras de negócio** (limites do carrinho, taxa de entrega, frete grátis, status do pedido, limites de campos): copie de `modules/orders/src` e `modules/customers/src`, citando a origem num comentário curto. Não reinvente valores.
- **Arquitetura Flutter:** o modelo é `/Users/leonardomleitao/Desktop/1-projetos/git/formacaodev/plataforma/apps/mobile` — leia `CLAUDE.md`, `pubspec.yaml`, `analysis_options.yaml`, `Makefile`, `lib/core`, `lib/infra/{http,di,auth}`, `lib/app/router` e `test/core/architecture_test.dart` (+ `test/core/support`). Reproduza o desenho adaptado ao domínio. **Não copie** nada de Firebase, Firestore, player, url_launcher, flavors nativos nem do domínio de cursos.
- **Visual:** `apps/frontend/DESIGN.md`, tokens de `apps/frontend/src/app/globals.css`, spec `openspec/specs/shared/design-system` e mockups `openspec/extras/design/{Home,Produto,Checkout,Rastreamento}.dc.html`. Copie valores (cores, raios, espaçamentos, Manrope e Bricolage Grotesque); `color-mix`/oklab entra já resolvido, com a origem no comentário. Padrões de app: uma ação principal por tela, carrinho como aba própria (não drawer), filtros em bottom sheet.

## apps/mobile/CLAUDE.md
- Criado na 1ª etapa (adaptado do CLAUDE.md da plataforma) e, dali em diante, **fonte inegociável**: leia-o no início de toda sessão. Só a última etapa o reescreve para refletir o estado final; etapas intermediárias podem acrescentar decisões novas, nunca afrouxar regras.

## Arquitetura (View → ViewModel → Repository)
- `lib/core` — Dart puro: `Result<T>` selado (`Ok`/`Failure`) escrito à mão, `Command` escrito à mão, `AppFailure` tipada (sealed), value objects (ex.: `Money` em centavos, `Email`, `Password`), env (`API_URL`).
- `lib/modules/<domínio>/{model,provider,usecase,errors}` — Dart puro; `provider/` só interfaces. Domínios: `catalog`, `store`, `cart`, `auth`, `customer`, `order`. Use case só quando se paga (junta repositórios, é complexo ou é reusado).
- `lib/infra` — implementações (dio, armazenamento), DTOs Dart em `lib/infra/api/` escritos à mão com teste de parsing a partir de JSON de exemplo, mapeador de falhas HTTP → `AppFailure`, DI em `lib/infra/di/`.
- `lib/ui/modules/<domínio>/{pages,widgets,view_models}` e `lib/ui/shared/{theme,widgets}`; `lib/app` (bootstrap, app, router). Página é composição; widget sobe para `shared/` só com o segundo consumidor.
- Estado: `ChangeNotifier` + `Command`, `watch_it` na UI; `get_it` **só** em `infra/di` e nos builders de rota; ViewModels com `registerFactory`. Estado global de sessão e carrinho mora num repositório em `infra/`.
- `go_router` com guarda de sessão por estado (`unknown`/`authenticated`/`anonymous`), splash enquanto `unknown`.
- `freezed` (sintaxe v3) + `json_serializable` + `build_runner` nas entidades; `.freezed.dart`/`.g.dart` são commitados — rode o codegen sempre que uma entidade mudar.
- Nenhuma exceção atravessa camadas: repositórios e casos de uso devolvem `Result`.

## Barreira de arquitetura (test/core/architecture_test.dart, com `analyzer`)
- `core/` e `modules/` não importam `package:flutter`, dio nem pacotes de armazenamento.
- `dio`, `flutter_secure_storage` e `shared_preferences` só em `lib/infra/`.
- Nenhuma cor (`Color(...)`, `Colors.*`) ou `TextStyle`/raio literal em `pages/` e `widgets/`: tudo do `ThemeData` e de um `ThemeExtension` de tokens da marca.
- Cada etapa que cria pasta ou dependência nova estende a barreira, nunca a afrouxa.

## Pacotes permitidos (só `flutter pub add`, nunca `pub upgrade`)
go_router, get_it, watch_it, dio, freezed_annotation, json_annotation, flutter_secure_storage, shared_preferences, cached_network_image, intl, collection; dev: build_runner, freezed, json_serializable, flutter_lints, analyzer. Nada de mocktail/mockito: fakes à mão em `test/**/support/` (inclusive `HttpClientAdapter` fake do dio). Fontes em `assets/fonts/` (arquivos .ttf commitados, licença OFL junto); nunca `google_fonts` nem download em tempo de execução.

## Regras de domínio do app
- **Sessão:** e-mail e senha (`/auth/login`, `/auth/register`, `/auth/me`). JWT (7 dias, sem refresh) no `flutter_secure_storage`, enviado como Bearer por interceptor; 401 encerra a sessão e volta ao login preservando o destino (como `?voltar=` do web). Mensagem de credencial inválida é genérica.
- **Carrinho:** anônimo em `shared_preferences`, precificado por `POST /cart/preview`; com sessão, `/me/cart`; no login, `POST /me/cart/merge` e limpeza do local, como o web. Preço sempre em centavos (`Money`), formatado só na UI com `intl` pt-BR.
- **Loja:** lista de `/storefront/stores`, escolha lembrada em `shared_preferences`; espelhe exatamente o efeito que a escolha tem no web (não invente parâmetro de API).
- **Dados de entrega:** `GET/PUT /me/customer` com endereço em texto, sem mapa; ao salvar, preserve a `location` vinda do backend; cliente novo vai com `location: null`.
- **Acompanhamento:** `GET /me/orders/:id` + SSE `/me/orders/:id/stream` lido por stream do dio com Bearer no cabeçalho (nunca token na URL). O evento só avisa para buscar o pedido de novo; reconexão com espera crescente de 1 s a 10 s; para ao sair da tela e em segundo plano, retoma ao voltar. Status: PLACED → PAYMENT_APPROVED → PICKING → OUT_FOR_DELIVERY → DELIVERED (rótulos copiados do web).
- **Estados de tela remota uniformes:** skeleton na carga, banner de erro com "Tentar de novo" que substitui só o bloco, vazio com uma ação.
- **Ambiente:** `lib/main_dev.dart` e `lib/main_prod.dart`, URL por `--dart-define=API_URL` (padrão dev `http://localhost:4000`), `adb reverse tcp:4000 tcp:4000` documentado no README e num Makefile. Sem Firebase, sem flavors nativos.

## Convenções
- Código em inglês; textos da UI, comentários (mínimos), specs, propostas e tarefas em português.
- Capacidades OpenSpec novas com prefixo `mobile-`, sob `openspec/specs/mobile/mobile-<nome>/` (o repositório agrupa specs por domínio). Não altere specs existentes de outros domínios.
- Testes em `apps/mobile/test/` espelhando `lib/` (nunca ao lado do código): unidade para core/modules/infra (DTO parsing, mapeador de falha, repositórios com dio fake), widget test para páginas e estados.
- Arquivos `snake_case` com sufixo de tipo (`_repository`, `_view_model`, `_page`, `_dto`).

## Verificação e limites
- Nunca `flutter run`, build de APK/IPA, `integration_test` ou teste que precise de emulador ou do backend no ar. Rede vira fake do dio; verificação visual vira widget test ou fica registrada como fora do escopo na change.
- Não edite nada fora de `apps/mobile` e dos arquivos OpenSpec da change (e das specs `mobile-*` no arquivamento). Se faltar algo no backend, registre em `apps/mobile/docs/lacunas-da-api.md` e contorne no app sem inventar endpoint.
- Não commite `build/`, `.dart_tool/` nem arquivos locais de IDE (o `.gitignore` do `flutter create` cuida disso).

## Fase 1 · Fundamentos

1. **Projeto, regras e core** · `mobile-app-01-fundacao-app-mobile` — Cria apps/mobile com flutter create (org br.com.jaja, android e ios), apps/mobile/CLAUDE.md adaptado do CLAUDE.md da plataforma com as regras do loop, analysis_options com flutter_lints, e lib/core: Result<T> selado, Command, AppFailure tipada, Money em centavos e env (API_URL). Entrega test/core/architecture_test.dart com analyzer (core/modules sem Flutter; dio e armazenamento só em infra) e testes de Result, Command e Money. Sem UI além do mínimo para compilar.
2. **Tema da marca e componentes base** · `mobile-app-02-tema-marca-mobile` — Fontes Manrope e Bricolage Grotesque em assets/fonts, ThemeData Material 3 e ThemeExtension de tokens copiados de apps/frontend/DESIGN.md, globals.css e da spec shared/design-system. Componentes em lib/ui/shared/widgets: botões pill, campo de texto, preço (Money formatado com intl pt-BR), chip, card de produto, skeleton, banner de erro com "Tentar de novo" e estado vazio com ação. Estende a barreira para proibir cor e estilo literal em pages/widgets; widget tests de cada peça.
3. **HTTP, DI e shell de navegação** · `mobile-app-03-infra-navegacao-mobile` — Cliente dio em lib/infra/http com mapeador de falhas para AppFailure (rede, 4xx com mensagem do backend, 5xx), DI com get_it em lib/infra/di, main_dev.dart e main_prod.dart com --dart-define=API_URL, bootstrap e go_router com shell de abas (Início, Buscar, Carrinho, Conta) e páginas placeholder. Makefile e README com adb reverse. Testes do mapeador com adapter fake do dio, do registro de DI e das rotas.

## Fase 2 · Catálogo

4. **Lojas e seletor de loja** · `mobile-app-04-seletor-loja-mobile` — Domínio store: GET /storefront/stores com DTO à mão e teste de parsing, repositório que lembra a loja escolhida em shared_preferences e seletor em bottom sheet. Espelha storefront-stores e o efeito que a escolha tem no web (apps/frontend/src/modules/stores), sem inventar parâmetro de API. Estados de carregamento, erro e vazio com widget tests.
5. **Home da vitrine** · `mobile-app-05-home-vitrine-mobile` — Domínio catalog (categorias e produtos): DTOs de /storefront/categories e /storefront/products com testes de parsing, repositório e a aba Início com categorias, destaques (featured) e ofertas (onSale), seguindo o mockup Home.dc.html e as specs catalog/storefront e storefront-api. Fotos com cached_network_image. Toque em categoria abre a busca filtrada; toque em produto abre o detalhe (rota pode ser placeholder até a etapa seguinte).
6. **Busca, filtros e paginação** · `mobile-app-06-busca-catalogo-mobile` — Aba Buscar: campo de busca, filtros em bottom sheet (categoria, marca, faixa de preço, ofertas, destaques), ordenação pelos valores de STOREFRONT_PRODUCT_SORTS e paginação infinita por page/pageSize. Espelha storefront-query.util.ts e use-storefront-products.hook.ts do web. ViewModel testado com repositório fake (debounce, troca de filtro reinicia a página, fim da lista) e widget tests dos estados.
7. **Detalhe do produto** · `mobile-app-07-detalhe-produto-mobile` — Página do produto por slug (GET /storefront/products/:slug) com galeria de fotos, preço, preço de oferta e descrição, seguindo Produto.dc.html e a página p/[slug] do web. Produto inexistente mostra estado vazio com ação de voltar ao catálogo. O botão principal "Adicionar ao carrinho" fica visível mas é ligado ao carrinho na fase seguinte.

## Fase 3 · Conta e carrinho

8. **Sessão: login e cadastro** · `mobile-app-08-sessao-mobile` — Domínio auth: POST /auth/login, POST /auth/register e GET /auth/me; JWT no flutter_secure_storage, interceptor Bearer, 401 encerra a sessão. Repositório de sessão com estados unknown/authenticated/anonymous, splash, guarda do go_router que preserva o destino (como ?voltar=), telas de entrar e criar conta com validações e limites de campo de modules/auth e specs auth/*, aba Conta com sair. Testes do repositório, do interceptor, do redirect e das telas.
9. **Carrinho anônimo** · `mobile-app-09-carrinho-anonimo-mobile` — Domínio cart: carrinho local em shared_preferences espelhando guest-cart-storage.util.ts e cart.context.tsx, precificado por POST /cart/preview. Aba Carrinho com quantidades, remoção, limites, subtotal, taxa de entrega e frete grátis (regras de modules/orders/src/cart), badge na aba e "Adicionar ao carrinho" do detalhe ligado. Testes de storage, do repositório e da tela, incluindo itens que somem ou mudam de preço.
10. **Carrinho da conta e merge** · `mobile-app-10-carrinho-conta-mobile` — Com sessão, o carrinho passa a /me/cart (GET, POST items, PUT/DELETE items/:productId, DELETE); no login, POST /me/cart/merge e limpeza do carrinho local, como o web; no logout volta ao anônimo vazio. Um repositório único escolhe a fonte pelo estado da sessão. Erros do backend (limite, produto indisponível) mapeados para mensagens. Testes da troca de fonte, do merge e de falha no merge.

## Fase 4 · Pedido

11. **Dados de entrega** · `mobile-app-11-dados-entrega-mobile` — Domínio customer: GET/PUT /me/customer na aba Conta (Minha conta), com nome, telefone e endereço em texto, sem mapa, limites de campos de modules/customers/src. Ao salvar preserva a location vinda do backend; cliente novo vai com location: null. Espelha a spec customers/my-account e a página minha-conta do web; testes de DTO, repositório (preservação da location) e formulário.
12. **Checkout** · `mobile-app-12-checkout-mobile` — Tela de fechamento a partir do carrinho, com sessão obrigatória (checkout-access) e dados de entrega exigidos: destinatário, instruções, pagamento simulado, resumo com subtotal, taxa e total, e POST /me/cart/orders. Erros do backend mapeados para mensagens (spec order-placement, mockup Checkout.dc.html). Sucesso limpa o carrinho e navega ao acompanhamento do pedido. Testes do ViewModel e da tela.
13. **Detalhe do pedido** · `mobile-app-13-pedido-detalhe-mobile` — Domínio order: GET /me/orders/:id com DTO e teste de parsing, tela de acompanhamento com linha do tempo PLACED → PAYMENT_APPROVED → PICKING → OUT_FOR_DELIVERY → DELIVERED (rótulos de order-status.util.ts e regras de modules/orders/src/order), itens, totais e endereço, seguindo Rastreamento.dc.html. Puxar para atualizar; pedido de outra conta ou inexistente mostra o estado adequado. Sem SSE ainda.
14. **Acompanhamento ao vivo** · `mobile-app-14-pedido-ao-vivo-mobile` — SSE GET /me/orders/:id/stream lido por stream do dio com Bearer no cabeçalho, parser de eventos espelhando event-stream.util.ts e use-my-order.hook.ts; cada evento order dispara nova busca do pedido, ping é ignorado. Reconexão com espera crescente de 1 s a 10 s, parada ao sair da tela e em segundo plano (AppLifecycleListener), retomada ao voltar, encerramento em status final. Testes com stream fake e relógio controlado.

## Fase 5 · Fechamento

15. **Varredura final** · `mobile-app-15-varredura-final-mobile` — Remove código morto e placeholders, centraliza literais de cor e textos repetidos, completa testes de DI e de rotas, garante que a barreira cobre todas as pastas. README de como rodar no emulador e no aparelho (adb reverse, API_URL, Makefile), apps/mobile/docs/lacunas-da-api.md preenchido e apps/mobile/CLAUDE.md atualizado com o estado final do app.

## Fora do escopo

- Qualquer mudança em `apps/backend`, `apps/frontend`, `apps/cli`, `apps/infra`, `modules/*` ou `packages/*` — lacunas vão para `apps/mobile/docs/lacunas-da-api.md`.
- Tudo de admin (catálogo, lojas, pedidos, monitor, teste de carga, dev tools).
- Mapa: escolha do ponto no mapa, raio de entrega, mapa do entregador; geocodificação; geolocalização do aparelho.
- Login com Google ou outros provedores; recuperação/troca de senha.
- Lista "Meus pedidos" (o backend não tem `GET /me/orders`).
- Pagamento real (PIX, cartão) — só o pagamento simulado que o backend aceita.
- Push notifications, modo offline, favoritos, avaliações, cupons, deep links.
- Firebase, flavors nativos, publicação nas lojas, assinatura, CI.
- `flutter run`, build de APK/IPA, testes de integração em emulador/aparelho e qualquer teste que precise do backend no ar.
