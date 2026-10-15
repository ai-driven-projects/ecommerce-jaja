> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive "Dependências da etapa anterior") e as specs `mobile/mobile-search` e `mobile/mobile-navigation` desta change. Referência de comportamento (só leitura): os arquivos do web citados no Context do design.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; nenhuma dependência nova; nada de `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`. Decisão nova durante a aplicação vai para "Decisões tomadas sem consulta" do `design.md`, prefixada com o lote.

## 1. Regras puras da listagem

- [x] 1.1 Conferir no código as dependências da etapa 5 listadas no design; registrar no `design.md` qualquer nome diferente e seguir com o nome entregue.
- [x] 1.2 Criar `lib/modules/catalog/model/product_listing.dart` (Decisão 1, origem no comentário).
- [x] 1.3 Testes em `test/modules/catalog/model/product_listing_test.dart`: `effectiveSort` com e sem busca; `listingSorts` sem `relevance` sem busca; `normalizeListingQuery` zera página, apara busca, remove marcas repetidas e corta em 20, e `relevance` sem busca vira `null`; `clearCatalogFilters` mantém `search` e `sort`; `listingPageQuery(q, 2)` codifica `page=2&pageSize=24`.
- [x] 1.4 Criar `lib/modules/catalog/model/category_tree.dart` (Decisão 1) e testes em `test/modules/catalog/model/category_tree_test.dart` com `categoryTree`: trilha de `toners-hp` é `[cartuchos-toners, toners-hp]`; slug desconhecido → vazia; achatada em pré-ordem.
- [x] 1.5 Criar `lib/ui/modules/catalog/view_models/price_input.dart` (Decisão 2) e testes em `test/ui/modules/catalog/view_models/price_input_test.dart`: `12,90`, `12.90`, `1.290,90`, `R$ 300` → centavos; `12,999`, `-5`, `abc` e vazio → `null`; `30000` → `300`, `1290` → `12,90`.

## 2. ViewModel da Buscar

- [x] 2.1 Em `test/modules/catalog/support/`, acrescentar `manyProducts` e `hpFacet` às fixtures e parâmetros nomeados opcionais ao `pageOf` (Decisão 7); os testes existentes continuam passando.
- [x] 2.2 Criar `lib/ui/modules/catalog/view_models/search_view_model.dart` (Decisão 3).
- [x] 2.3 Testes em `test/ui/modules/catalog/view_models/search_view_model_test.dart` (carga e filtros): `start(ProductQuery(categorySlug: 'escolar'))` pede `page=1&pageSize=24&category=escolar`; `results` passa de `BlockLoading` a `BlockLoaded`; `filteredCategory` resolve `toners-hp`; aplicar filtro igual não pede de novo; `clearFilters` mantém busca e ordem.
- [x] 2.4 Testes de espera da busca no mesmo arquivo (com `testWidgets` e `tester.pump`): digitar duas vezes em menos de 300 ms faz um pedido só, depois dos 300 ms; `submitSearch` pede na hora e o timer não repete; `clearSearch` com `relevance` pede sem `search` e sem `sort`.
- [x] 2.5 Testes de paginação no mesmo arquivo: `loadMore` pede `page=2` e acrescenta os itens; item com `id` repetido é pulado; na última página `loadMore` não pede nada; falha da página 2 mantém os itens, preenche `loadMoreFailure`, e o "Tentar de novo" pede a página 2 de novo.
- [x] 2.6 Testes de descarte no mesmo arquivo (com `holdProducts()`): resposta de "caneta" que chega depois da de "toner" é ignorada; resposta da página 2 de um filtro antigo é ignorada; `refresh()` pede categorias com `refresh: true` e a página 1.

## 3. Widgets da Buscar

- [x] 3.1 Extrair a montagem do card para `lib/ui/modules/catalog/widgets/product_summary_card.dart` e usá-la no `ProductRail` (Decisão 4); os testes do trilho continuam passando sem mudança.
- [x] 3.2 Criar `search_field.dart` e testes em `test/ui/modules/catalog/widgets/search_field_test.dart`: dica "Buscar produtos"; "Limpar busca" só com texto e chama o callback; confirmar pelo teclado chama `onSubmitted`.
- [x] 3.3 Criar `product_grid.dart` (grade em linhas e `ProductGridSkeleton`) e testes: cinco produtos → três linhas, o último sozinho; toque chama `onOpenProduct(slug)`; skeleton com seis blocos.
- [x] 3.4 Criar `active_filter_pills.dart` e testes: rótulos de categoria, marca (faceta e slug), os três formatos de preço, "Só ofertas", "Só destaques"; toque numa pílula chama a remoção dela; "Limpar filtros" chama o callback.
- [x] 3.5 Criar `sort_sheet.dart` e testes: sem busca não há "Mais relevantes"; a ordem atual aparece marcada; escolher "Menor preço" fecha e devolve `ProductSort.priceAsc`.
- [x] 3.6 Criar `filters_sheet.dart` (Decisão 4) e testes com o ViewModel e o fake: grupos na ordem da spec; escolher "Toners HP" pede `category=toners-hp`; marcar uma marca pede `brand`; "Ver todas (N)" com mais de oito marcas; marca escolhida fora das facetas aparece no topo.
- [x] 3.7 Testes de preço e rodapé do painel no mesmo arquivo: máximo `300` + "Aplicar" pede `maxPriceCents=30000`; `12,999` mostra "Use valores em reais, como 12,90." sem pedido; rodapé "Ver 12 produtos" fecha o painel; falha das categorias mostra o banner só no grupo Categoria.

## 4. Página Buscar

- [x] 4.1 Reescrever `lib/ui/modules/catalog/pages/search_page.dart` (Decisões 4 e 5); a Buscar deixa de usar `PlaceholderBody`.
- [x] 4.2 Widget tests em `test/ui/modules/catalog/pages/search_page_test.dart` (cabeçalho): títulos da Decisão 5 (busca, categoria, "…", destaque, ofertas, "Produtos"), contagem "12 produtos", "Filtros (2)" com marca e preço, botão de ordem mostrando "Destaques" sem busca.
- [x] 4.3 Testes de estados na mesma página: skeleton enquanto o `Completer` não completa; falha mostra "Não deu para carregar os produtos." e "Tentar de novo" pede a página 1; vazio com termo mostra "Limpar busca", com filtro "Limpar filtros", sem nada "Atualizar".
- [x] 4.4 Testes de interação na mesma página: digitar e esperar 300 ms pede a busca; tocar numa pílula remove o filtro; abrir "Filtros (n)" mostra o painel; escolher uma ordem pede `sort`; toque num card chama `onOpenProduct`; `onQueryChanged` recebe o filtro novo a cada mudança.
- [x] 4.5 Testes de paginação na mesma página: rolar até o fim pede a página 2 e mostra os itens; na última página não pede mais; falha da página 2 mostra "Não foi possível carregar mais produtos." no rodapé com os itens mantidos; lista curta com mais páginas pede a seguinte sem rolar; trocar filtro volta a rolagem ao topo.
- [x] 4.6 Testes de entrada pela rota na mesma página: `initialQuery` novo no `didUpdateWidget` aplica o filtro e iguala o campo de busca; o mesmo `initialQuery` não pede de novo; puxar para baixo pede categorias com `refresh: true` e a página 1.

## 5. Rotas e DI

- [x] 5.1 Em `app_routes.dart`, acrescentar `searchProduct`, `searchProductSegment` e `searchProductLocation(slug)`; em `app_router.dart`, passar à `SearchPage` a fábrica e os callbacks da Decisão 6 e criar a rota filha de `/search` com a `ProductPage` provisória.
- [x] 5.2 Em `service_locator.dart`, registrar `SearchViewModel` em `registerViewModels()`; em `test/infra/di/service_locator_test.dart`, testar que cada `getIt<SearchViewModel>()` é instância nova.
- [x] 5.3 Atualizar `test/app/router/app_router_test.dart`: `/search?category=escolar&sort=aleatorio` pede `category=escolar` sem `sort` (em vez de esperar "Buscar" provisório); marcar "Só ofertas" deixa a localização `/search?onSale=true`, a fábrica do ViewModel é chamada uma vez, e voltar à aba depois da Início não faz nova requisição.
- [x] 5.4 No mesmo arquivo: toque num card da Buscar abre "Produto" com a aba Buscar selecionada e voltar mostra a listagem sem nova requisição; `AppRoutes.searchProductLocation('caneta x')` codifica o slug.
- [x] 5.5 Rodar `test/app/app_test.dart` e `test/app/bootstrap_test.dart` e ajustar só o que a Buscar real mudou (requisições a mais ao abrir a aba), sem afrouxar expectativas.

## 6. CLAUDE.md e verificação final

- [x] 6.1 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 8 pede, sem apagar regra existente.
- [x] 6.2 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso e os `.freezed.dart` estão em dia.
- [x] 6.3 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [x] 6.4 `cd apps/mobile && flutter test` com todos os testes passando, inclusive `test/core/architecture_test.dart`.
- [x] 6.5 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
