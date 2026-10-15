# Loop `app-mobile` · objetivo

Criar com:

```bash
npm run cli -- loops:new --nome=app-mobile
```

e colar o texto abaixo (da linha `---` em diante) como objetivo.

---

Criar o app Flutter do cliente da Jajá em `apps/mobile`, levando para o celular a experiência de compra que hoje existe
na vitrine web (`apps/frontend`, grupo `(public)`): escolher a loja, navegar e buscar no catálogo, ver o produto, montar
o carrinho, entrar ou criar conta, informar os dados de entrega, fechar o pedido e acompanhar o pedido ao vivo. Nada de
admin. O app fala só com o backend NestJS que já existe (`apps/backend`) e **não altera o backend, os módulos nem o
web**. Uma change OpenSpec por etapa, do início ao fim sem participação humana; o loop termina quando a última etapa é
arquivada.

## Referências

- **Comportamento:** `apps/frontend/src/modules/{catalog,orders,customers,auth,stores}` (páginas, `data/*.api.ts`,
  `cart.context.tsx`, `guest-cart-storage.util.ts`, `use-my-order.hook.ts`, `event-stream.util.ts`) e as specs
  `openspec/specs/{storefront,storefront-api,storefront-stores,storefront-access,storefront-cart,cart,checkout-access,order-placement,order-tracking,my-account,customer-registration,user-authentication,user-registration}`.
  Espelhe o comportamento e os casos de teste; regras de negócio (limites do carrinho, taxa de entrega, status do
  pedido, limites de campos) vêm de `modules/orders/src` e `modules/customers/src`, sem reinventar.
- **Contrato da API:** os controllers em `apps/backend/src/modules/**` (`storefront.controller.ts`,
  `storefront-store.controller.ts`, `cart.controller.ts`, `my-cart.controller.ts`, `my-customer.controller.ts`,
  `my-order.controller.ts`, `auth.controller.ts`) e os DTOs em `modules/*/src/**/dto`. Os DTOs Dart são escritos à mão
  em `lib/infra/api/`, com teste de parsing a partir de JSON de exemplo.
- **Arquitetura Flutter:** o app `/Users/leonardomleitao/Desktop/1-projetos/git/formacaodev/plataforma/apps/mobile`
  (feito pelo loop `mobile-mvp` daquele repositório) é o modelo. Leia o `CLAUDE.md`, o `pubspec.yaml`, `lib/core`,
  `lib/infra/{http,di,auth}`, `lib/app/router` e `test/core/architecture_test.dart` dele e reproduza o mesmo desenho,
  adaptado a este domínio. Não copie nada de Firebase, Firestore, player ou do domínio de cursos.
- **Visual:** `apps/frontend/DESIGN.md`, os tokens de `apps/frontend/src/app/globals.css` e os mockups
  `openspec/extras/design/{Home,Produto,Checkout,Rastreamento}.dc.html`. Copie os valores (cores, raios, espaçamentos,
  fontes Manrope e Bricolage Grotesque), não invente. É a mesma marca, com padrões de interação de app: uma ação
  principal por tela, carrinho como aba/tela própria em vez de drawer, filtros em bottom sheet.

## Regras do loop

- **Primeira etapa cria `apps/mobile/CLAUDE.md`** com as regras de arquitetura abaixo (adaptadas do `CLAUDE.md` da
  plataforma). Dali em diante ele é a fonte e é inegociável; a última etapa o atualiza.
- **Camadas (guia oficial do Flutter, View → ViewModel → Repository):** `lib/core` (Dart puro: `Result<T>` selado
  Ok/Failure, `Command`, falhas tipadas, value objects como `Money` em centavos, env), `lib/modules/<domínio>/{model,provider,usecase,errors}`
  (Dart puro; `provider/` só interfaces), `lib/infra` (implementações com dio, armazenamento, DI), `lib/ui/modules/<domínio>/{pages,widgets,view_models}`
  e `lib/ui/shared/{theme,widgets}`, `lib/app` (bootstrap, app, router). Domínios: `catalog`, `store`, `cart`, `auth`,
  `customer`, `order`.
- **Stack:** `ChangeNotifier` + `Command` com `watch_it` na UI, `get_it` só em `infra/di` e nos builders de rota
  (ViewModels com `registerFactory`), `go_router` com guarda de sessão por estado (desconhecido/autenticado/anônimo),
  `dio`, `freezed` + `json_serializable` + `build_runner`. Sem exceções atravessando camadas: tudo é `Result`.
- **Pacotes permitidos** (só via `flutter pub add`, sem `pub upgrade`): os da stack acima, `flutter_secure_storage`
  (token), `shared_preferences` (carrinho anônimo e loja escolhida), `cached_network_image` (fotos do catálogo),
  `intl` (moeda pt-BR), `collection`; dev: `flutter_lints`, `analyzer` (testes de arquitetura). Nada de mocktail ou
  mockito: fakes escritos à mão em `test/**/support/`. Fontes em `assets/fonts/`, nunca baixadas em tempo de execução.
- **Barreira de arquitetura testada** (`test/core/architecture_test.dart`, com `analyzer`): `core` e `modules` não
  importam Flutter, `dio` e os pacotes de armazenamento ficam só em `infra`, nenhuma cor ou estilo literal em `pages`
  e `widgets` (tudo vem do tema e de um `ThemeExtension` de tokens da marca).
- **Sessão:** login e cadastro por e-mail e senha (`POST /auth/login`, `POST /auth/register`, `GET /auth/me`). O JWT
  (7 dias, sem refresh) fica no `flutter_secure_storage` e vai como `Bearer` por um interceptor; 401 encerra a sessão
  e volta para o login preservando o destino (como o `?voltar=` do web).
- **Carrinho:** anônimo guardado localmente e precificado por `POST /cart/preview`; com sessão, `/me/cart`; no login,
  `POST /me/cart/merge` e limpeza do local, como no web. Preços sempre em centavos, formatados só na UI.
- **Dados de entrega:** `GET/PUT /me/customer` com os campos de endereço em texto, **sem mapa**. Ao salvar, preserve a
  `location` que veio do backend (o cliente pode tê-la marcado no web); cliente novo vai com `location: null`.
- **Acompanhamento:** `GET /me/orders/:id` mais o SSE `GET /me/orders/:id/stream` lido por stream do dio com o
  `Bearer` no cabeçalho (nunca token na URL); o evento é só um aviso para buscar o pedido de novo; reconexão com espera
  crescente de 1 s a 10 s; parar ao sair da tela e ao ir para segundo plano, retomar ao voltar.
- **Ambiente:** `lib/main_dev.dart` e `lib/main_prod.dart`, URL da API por `--dart-define=API_URL` (padrão dev
  `http://localhost:4000`, com `adb reverse` documentado no README e num `Makefile`). Sem Firebase, sem flavors nativos.
- **Estados de tela remota** uniformes: skeleton, banner de erro com "Tentar de novo", vazio com uma ação.
- Código em inglês; textos da UI, comentários (mínimos), specs, propostas e tarefas em português. Capacidades novas do
  OpenSpec com prefixo `mobile-`. Testes em `apps/mobile/test/` espelhando `lib/`.
- **Verificação:** os `.freezed.dart`/`.g.dart` são commitados, então rode o codegen sempre que uma entidade mudar.
  Nunca `flutter run`, nem build de APK/IPA, nem teste que precise de emulador ou do backend no ar: o loop não tem
  dispositivo. Rede vira fake do dio; verificação visual vira widget test ou fica registrada como fora do escopo.
- Não editar nada fora de `apps/mobile` (exceto os arquivos OpenSpec da change). Se faltar algo no backend, registre a
  lacuna em `apps/mobile/docs/lacunas-da-api.md` e contorne no app sem inventar endpoint.

## Ordem sugerida das etapas

1. **Fundamentos:** scaffold do projeto Flutter (`flutter create` com org `br.com.jaja`, Android e iOS), `CLAUDE.md`,
   lints, `core` (Result, Command, falhas, Money), teste de arquitetura; tema da marca e componentes base (botões
   pill, campo, preço, chip, card de produto, skeleton, banner de erro); cliente HTTP, env, DI e shell de navegação
   com abas (Início, Buscar, Carrinho, Conta).
2. **Catálogo:** lojas e seletor de loja (lista, lembrada localmente); home com categorias, destaques e ofertas;
   listagem com busca, filtros (categoria, marca, faixa de preço, ofertas, destaques), ordenação e paginação infinita;
   detalhe do produto com galeria e "Adicionar ao carrinho".
3. **Conta e carrinho:** sessão (login, cadastro, guarda de rota, retorno ao destino, sair); carrinho anônimo e da
   conta com merge no login, quantidades, remoção, limites, subtotal, taxa de entrega e frete grátis.
4. **Pedido:** dados de entrega (Minha conta, sem mapa); checkout (destinatário, instruções, pagamento simulado,
   resumo, confirmação e erros do backend mapeados para mensagens); acompanhamento ao vivo com a linha do tempo dos
   status `PLACED → PAYMENT_APPROVED → PICKING → OUT_FOR_DELIVERY → DELIVERED`.
5. **Fechamento:** varredura final (código morto, literais de cor e de texto repetidos, testes de DI e de rotas,
   README de como rodar no emulador e no aparelho, `docs/lacunas-da-api.md` preenchido, `CLAUDE.md` atualizado).

Pode ajustar a divisão para que cada etapa caiba numa change, mas mantenha a ordem de dependência.

## Verificações (em `apps/mobile`)

- `dart run build_runner build --delete-conflicting-outputs`
- `flutter analyze`
- `flutter test`

Comandos exigidos no PATH: `flutter` e `dart`. Escopo dos commits: `apps/mobile`. Prefixo: `feat(mobile)`.
Ferramentas proibidas: `flutter pub publish`, `dart pub publish`, `flutter upgrade`, `flutter channel`,
`flutter pub upgrade`.

## Fora do escopo

Tudo de admin; mapa (escolha do ponto no mapa, raio de entrega, mapa do entregador); geolocalização do aparelho;
login com Google ou outros provedores; lista "Meus pedidos" (o backend não tem `GET /me/orders`); pagamento real (PIX,
cartão); push notifications; modo offline; favoritos, avaliações e cupons; deep links; publicação nas lojas,
assinatura e CI; qualquer mudança em `apps/backend`, `apps/frontend`, `modules/*` ou `packages/*`.
