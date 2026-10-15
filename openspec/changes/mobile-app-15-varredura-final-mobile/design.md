## Context

O app está completo (etapas 1 a 14). A varredura feita ao escrever esta change achou:

- **Código morto:** quase nada. Nenhum arquivo de `lib/` deixou de ser importado e nenhum símbolo público de primeiro nível ficou sem consumidor, tirando extensões (usadas sem citar o nome) e os passos da escala `AppSpacing` (`s28`…`s48`). Os comentários de `lib/ui/shared/widgets/product_card.dart` (linhas 14 e 18) e `empty_state.dart` (linha 10) citam etapas. `CartRepository.clear()` não tem consumidor na UI, mas a spec `mobile-cart` ("esvaziar MUST enviar `DELETE /me/cart`") o exige.
- **Placeholders:** nenhuma página provisória sobrou (o `PlaceholderBody` saiu na etapa 9). Ainda falam em provisório o README ("as quatro abas mostram páginas provisórias"), o `CLAUDE.md` (seção "Página provisória" e o histórico por etapa) e as specs `mobile-navigation` ("Shell de abas") e `mobile-architecture` ("Projeto do app mobile", "UI mínima, sem telas de produto").
- **Cor literal:** só em `lib/ui/shared/theme/app_colors.dart` (o resto do tema usa `AppColors.*` e `Colors.transparent`). A regra C só olha `pages/`/`widgets/` de `lib/ui`.
- **Textos repetidos** (literal igual em mais de um arquivo de `lib/`):
  - "Algo deu errado. Tente novamente.": `core/command.dart`, `infra/http/http_failure_mapper.dart`, `infra/http/run_request.dart`, `order_tracking_view_model.dart`, `search_view_model.dart`, `product_detail_view_model.dart`;
  - carrinho: "Seu carrinho está vazio.", "Adicione itens para o escritório!", "Não foi possível carregar o carrinho." (`CartPage` e `CheckoutSummary`), "Entrega de bike" (`CartSummary` e `OrderItemsCard`);
  - catálogo: "Limpar filtros" (`SearchPage`, `ActiveFilterPills`, `FiltersSheet`), "Não foi possível carregar as categorias." (`HomePage`, `FiltersSheet`), "Nada por aqui. Já já." (`HomePage`, `SearchPage`);
  - cadastro: "Não foi possível carregar seus dados." (`DeliveryStep`, `DeliveryDetailsPage`), "Endereço de entrega" (`CheckoutPage`, `DeliveryDetailsPage`), "Dados de entrega" (`AccountPage`, `DeliveryDetailsPage`);
  - pedido: "Voltar para a loja" (`OrderTrackingPage`, `CheckoutSummary`), "Instruções para o entregador" (`OrderNoteFields`, `OrderInstructionsCard`).
- **DI:** `service_locator_test.dart` confere cada registro um a um, mas nenhum teste garante que **todo** tipo pedido pelos `builder` de `app_router.dart` e pelo `bootstrap.dart` sai da DI real, nem que todo `registerFactory` devolve instância nova.
- **Rotas:** `app_router_test.dart` cobre os fluxos, mas não abre cada caminho de `AppRoutes` diretamente, não varre `sessionRequiredPaths` sem sessão (só `/account/delivery` e `/cart/orders/:id`) e não testa o toque na aba já selecionada; `splashLocation` não tem teste.
- **Lacunas:** nenhuma etapa registrou lacuna; `docs/` não existe.

## Goals / Non-Goals

**Goals:** cada item da etapa 15 do plano, verificado por teste quando dá: código morto e marcas de etapa fora; textos e cor centralizados com barreira; barreira cobrindo todas as pastas; DI e rotas varridas; README, lacunas e `CLAUDE.md` finais.

**Non-Goals:**
- Nenhuma funcionalidade nova, nenhum texto de tela alterado, nenhuma mudança visual.
- Etapa 15 é a última: não fica nada para outra etapa. Continua fora (seção "Fora do escopo" do plano): admin, mapa e geolocalização, login social e recuperação de senha, lista "Meus pedidos", pagamento real, push, offline, favoritos, avaliações, cupons, deep links, Firebase, flavors, publicação e CI, `flutter run`/build/emulador.

## Decisions

### 1. Falha inesperada única (`mobile-core`)
- Em `lib/core/errors/app_failure.dart`: `const String unexpectedFailureMessage = 'Algo deu errado. Tente novamente.';` e `const UnexpectedFailure unspecifiedFailure` (`GenericFailureCode.unspecified`).
- `command.dart` e os três ViewModels passam a usar `unspecifiedFailure`; `run_request.dart` e `http_failure_mapper.dart` usam a mensagem com o próprio `HttpFailureCode.unexpected` (o código não muda).
- Os testes existentes que comparam o texto continuam passando; um teste novo em `test/core/errors/app_failure_test.dart` fixa o texto da constante.

### 2. Textos de UI: uma declaração por texto
- A regra é: o texto fica numa constante `static const` do **dono** (a classe que primeiro o exibe, como o `CartPage.emptyTitle` que já existe) e o outro consumidor a reusa. Quando os consumidores são de domínios diferentes da UI ou nenhum é dono natural, o texto vai para uma classe de textos do domínio em `lib/ui/modules/<domínio>/view_models/<domínio>_texts.dart` (`abstract final class CartTexts { static const … }`), que é apresentação e cabe em `view_models/`.
- Aplicação concreta: `CartTexts` (vazio, mensagem do vazio, falha da carga, "Entrega de bike"), `CatalogTexts` ("Limpar filtros", falha das categorias, "Nada por aqui. Já já."), `CustomerTexts` (falha do cadastro, "Endereço de entrega", "Dados de entrega"), `OrderTexts` ("Voltar para a loja", "Instruções para o entregador"). As constantes públicas que os testes já usam (`CartPage.emptyTitle`, `CheckoutSummary.errorTitle`…) continuam existindo, apontando para a classe de textos, para não reescrever testes.
- Importar `view_models/` de outro domínio da UI é permitido (o checkout já usa `formatDeliveryAddress` do `customer`).
- `'Seu carrinho está vazio.'` de `lib/modules/order/errors/order_errors.dart` fica: é a mensagem de `ORDER_CART_EMPTY` copiada do web, outro significado e outra camada (a barreira de texto só olha `lib/ui` e `lib/app`).

### 3. Barreira (`test/core/`)
- **Regra G — estrutura** (`test/core/support/structure_rules.dart`, sem `analyzer`, só `dart:io`): listas fechadas do spec (`lib/`, domínios, subpastas de `modules/<d>` e `ui/modules/<d>`); `lib/ui/shared/` só com `theme`, `widgets`, `view_models`, `formatters` e `pages` (as que existem); nenhum `*_test.dart` em `lib/`; cada pasta de `test/` com `*_test.dart` tem a pasta equivalente em `lib/` (exceto `test/core/support`, qualquer `support/` e a própria raiz `test/core` que espelha `lib/core`). Funções puras sobre listas de caminhos, para os testes de exemplo não tocarem o disco; um teste "sobre o código real" chama sobre `lib/` e `test/`.
- **Regra C estendida:** o escopo de `isInlineStyleScoped` passa a incluir todo `lib/app/`. **Regra C2 — cor confinada:** nova verificação na mesma `inline_style_rules.dart`, sobre todo `lib/`, que aceita cor literal só em `lib/ui/shared/theme/app_colors.dart` (mesmos padrões de cor da regra C, `Colors.transparent` aceito, comentário e string ignorados).
- **Regra H — texto repetido** (`test/core/support/ui_text_rules.dart`, com `analyzer`): coleta os literais de `lib/ui` e `lib/app` (`SimpleStringLiteral` e o valor juntado de `AdjacentStrings`, sem interpolação, iniciando por letra maiúscula, com 12+ caracteres), ignora diretivas `import`/`export` e anotações, e acusa o texto que aparece em mais de um arquivo, listando os arquivos. Repetição no mesmo arquivo não é acusada (é assunto de revisão, não de barreira).
- Cada regra nova: testes com fontes/caminhos de exemplo (violação, aceito, caso de borda) e um teste sobre o código real que falha se não verificou nada, como as regras A–F.

### 4. Testes de DI
- `configureDependencies(apiBaseUrl:)` é síncrono e só registra lazy singletons; os testes atuais o chamam direto. Resolver os tipos cria os objetos reais sem rede (nenhuma requisição sai sem chamada explícita). Se alguma resolução tocar plugin (preferências ou armazenamento seguro), o teste usa `TestWidgetsFlutterBinding.ensureInitialized()` e `SharedPreferences.setMockInitialValues({})` e registra a escolha em "Decisões tomadas sem consulta"; nada de pacote novo.
- Teste novo "resolve tudo o que o app pede": lista de tipos copiada dos `getIt<…>()` de `app_router.dart` e `bootstrap.dart` (`Session`, `SessionRepository`, `GuestCartRepository`, `SessionCartRepository` e os 11 ViewModels), resolvidos depois de `configureDependencies`. Um teste irmão lê `app_router.dart` e `bootstrap.dart` como texto, extrai os `getIt<T>` e confere que a lista do teste contém todos, para a lista não envelhecer.
- Teste tabelado: cada ViewModel, `LoadDeliveryDetails` e `LiveOrderFeed` devolvem instâncias diferentes em dois pedidos; cada repositório e `Dio`, `KeyValueStore`, `SessionStorage` devolvem a mesma.

### 5. Testes de rotas
- Em `app_router_test.dart`, com `registerFakeDependencies` e a sessão da `ana`: teste tabelado que abre cada caminho por `initialLocation` e confere a página (`find.byType`) e a aba selecionada: `/home`, `/search`, `/cart`, `/account`, `/home/product/<slug>`, `/search/product/<slug>`, `/cart/product/<slug>`, `/cart/checkout`, `/cart/checkout/delivery`, `/cart/orders/<id>`, `/account/delivery`; e, sem sessão, `/login`, `/register` e `/splash` (com sessão desconhecida).
- Teste tabelado sem sessão para cada item de `AppRoutes.sessionRequiredPaths` e para `/cart/checkout/delivery`: termina em "Entrar" com `from` igual ao destino.
- Toque na aba já selecionada (Início, com um produto aberto) volta à raiz. Se o comportamento já estiver coberto em `app_navigation_shell_test.dart`, este teste fica só no nível do router.
- `splashLocation` com e sem `from` em `session_redirect_test.dart`, junto dos outros construtores de caminho.

### 6. Documentação
- **README:** reescrito para o app pronto: o que o app faz, pré-requisitos, pontos de entrada, e uma seção por alvo — emulador Android (`adb reverse`), aparelho Android (USB, `adb devices`, `adb reverse`; alternativa `API_URL=http://<IP da máquina>:4000` na mesma rede), simulador iOS (`localhost` direto) e aparelho iOS (sem `adb`; `API_URL` com o IP da máquina, assinatura de desenvolvimento pelo Xcode fora do escopo do repositório). Makefile, verificação e um parágrafo de problemas comuns (túnel caído ao reiniciar o emulador, `http` em produção). O `Makefile` não muda (já tem `tunnel`, `run-dev`, `run-dev-tunnel`, `run-prod`, `check`); se faltar alvo citado no README, o README se ajusta ao Makefile.
- **`docs/lacunas-da-api.md`:** um item por lacuna, cada um com "O que falta", "Onde foi conferido" (controller/DTO), "Efeito no app" e "Contorno". Candidatas, a conferir no código antes de escrever (só entra o que o controller confirmar): sem `GET /me/orders` (o pedido só é aberto logo depois do checkout; não há como reabrir pedido antigo); sem recuperação nem troca de senha em `auth.controller.ts`; JWT sem renovação (7 dias, depois o `401` leva ao login); catálogo e preço não dependem da loja (`/storefront/products` sem parâmetro de loja: a escolha só alimenta cidade/UF). Uma seção curta "Divergências do plano, não lacunas" registra o `POST /me/orders` em vez de `/me/cart/orders` e que a `location` não é exigida pelo pedido (conferido em `place-order.use-case.ts`), então cliente novo sem mapa consegue comprar.
- **`CLAUDE.md`:** reescrito com o estado final (é a única etapa que pode reescrevê-lo). Sai o histórico "Etapa N" (vira um parágrafo curto "Estado atual: app completo", com a lista das funcionalidades), sai a seção "Página provisória", sai "(etapa 3; até lá, main.dart mínimo)" da árvore; entram as regras G, C2 e H na barreira, a regra dos textos (Decisão 2) e a falha inesperada única. Nenhuma regra é afrouxada: cada regra atual continua, só sem a referência à etapa.

## Decisões tomadas sem consulta

- **`CartRepository.clear()` fica**, embora sem consumidor na UI: a spec `mobile-cart` o exige e ele é testado. Não é código morto pelo critério da etapa ("salvo o que uma spec exige").
- **Passos da escala `AppSpacing` sem uso ficam**: são a escala do `globals.css` copiada inteira, como os raios; apagar passos soltos quebraria a correspondência com o web.
- **Barreira de texto com limiar de 12 caracteres e letra maiúscula inicial**: pega frases e títulos e deixa de fora chaves, nomes de rota, rótulos curtos ("Sair", "Entrar") e formatos. Texto curto repetido não é acusado.
- **Barreira de texto só em `lib/ui` e `lib/app`**: mensagens de domínio (`modules/*/errors`) e de infraestrutura têm outro dono e outro significado.
- **Classes de textos em `view_models/`**, e não numa pasta nova `texts/`: a estrutura fechada da regra G não ganha pasta por conveniência.
- **Constantes públicas antigas mantidas como apelidos** das classes de textos, para os testes existentes continuarem válidos sem reescrita.
- **Lacunas conferidas no código, não na memória**: o design lista candidatas; o apply só registra o que o controller confirmar e registra aqui o que descartar.
- **Aparelho iOS documentado sem passo a passo de assinatura**: depende de conta Apple e do Xcode, fora do repositório e do loop.

## Risks / Trade-offs

- [Barreira de texto acusar falso positivo em textos legítimos iguais] → limiar e escopo restritos; se um caso legítimo aparecer, o texto vai para uma constante, que é exatamente o que a regra pede.
- [Lista de tipos do teste de DI envelhecer] → o teste irmão extrai os `getIt<T>` do router e do bootstrap e compara.
- [Reescrever o `CLAUDE.md` perder uma regra] → tarefa de conferência que compara as regras numeradas e os subitens de domínio antes e depois (`git diff`), registrando aqui qualquer mudança de sentido.
- [Teste tabelado de rotas lento] → um `pumpWidget` por caminho, sem `pumpAndSettle` com animação contínua (o indicador ao vivo não pulsa).
