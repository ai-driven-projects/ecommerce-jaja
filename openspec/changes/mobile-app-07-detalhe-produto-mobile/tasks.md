> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive "Dependências da etapa anterior") e as specs `mobile/mobile-product`, `mobile/mobile-catalog` e `mobile/mobile-navigation` desta change. Referência de comportamento (só leitura): os arquivos do web citados no Context do design.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; nenhuma dependência nova; nada de `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`. Decisão nova durante a aplicação vai para "Decisões tomadas sem consulta" do `design.md`, prefixada com o lote.

## 1. Domínio do detalhe

- [x] 1.1 Conferir no código as dependências da etapa 6 listadas no design; registrar no `design.md` qualquer nome diferente e seguir com o nome entregue. (Conferido na revisão da proposta, depois de a etapa 6 ser arquivada: todos os nomes batem.)
- [ ] 1.2 Criar `lib/modules/catalog/model/product_detail_entity.dart` (Decisão 1, `freezed` v3) e rodar `dart run build_runner build --delete-conflicting-outputs`; o `.freezed.dart` fica no repositório.
- [ ] 1.3 Criar `lib/modules/catalog/model/product_detail.dart` (Decisão 1, origem no comentário).
- [ ] 1.4 Em `test/modules/catalog/support/catalog_fixtures.dart`, criar `tonerDetail` e `plainDetail` (Decisão 6).
- [ ] 1.5 Testes em `test/modules/catalog/model/product_detail_test.dart`: `relatedProductsQuery(tonerDetail)` codifica `category=toners-hp&sort=featured&pageSize=5`; sem categorias → `null`; `relatedProducts` tira o próprio e corta em 4; `rootCategorySlugOf` → `cartuchos-toners` e `''` sem categorias; igualdade por valor de `ProductDetail`.

## 2. DTO e repositório

- [ ] 2.1 Criar `test/infra/api/support/storefront_product_detail_json.dart` (Decisão 6): o JSON de `tonerDetail` com imagens de `order` 2, 0, 1 e um campo extra, e o de `plainDetail` com `brand`, `sku`, `description` e `listPriceCents` nulos.
- [ ] 2.2 Criar `lib/infra/api/storefront_product_detail_dto.dart` (Decisão 2).
- [ ] 2.3 Testes em `test/infra/api/storefront_product_detail_dto_test.dart`: JSON → `tonerDetail` com imagens ordenadas por `order` e trilha na ordem recebida; JSON nulo → `plainDetail`; `priceCents: -1`, imagem sem `largeUrl` e corpo que não é mapa lançam.
- [ ] 2.4 Acrescentar `fetchProduct(String slug)` ao `CatalogRepository` e implementá-lo no `ApiCatalogRepository` (Decisão 2) e no `FakeCatalogRepository` (fila `enqueueProduct`, `holdProduct()`, `productSlugs`, padrão `plainDetail`); `flutter analyze` sem erros.
- [ ] 2.5 Testes em `test/infra/catalog/api_catalog_repository_test.dart` com `FakeHttpClientAdapter`: `GET /storefront/products/<slug>` sem `Authorization`; slug `caneta x` sai como `caneta%20x`; duas chamadas fazem duas requisições; `404` → `NotFoundFailure`; `500` → `ServerFailure`; `200` com `priceCents: -1` → `UnexpectedFailure`.

## 3. ViewModel do detalhe

- [ ] 3.1 Criar `lib/ui/modules/catalog/view_models/product_detail_view_model.dart` (Decisão 3).
- [ ] 3.2 Testes em `test/ui/modules/catalog/view_models/product_detail_view_model_test.dart` (produto): antes de `start`, `BlockLoading`; `start('toner')` pede o slug e passa a `BlockLoaded`; falha `404` → `isNotFound`; falha `500` → `BlockFailed` sem `isNotFound`; `load.execute()` de novo pede o produto e passa por `BlockLoading`.
- [ ] 3.3 Testes de relacionados no mesmo arquivo: com `tonerDetail`, pede `relatedProductsQuery` só depois do produto; página com o próprio produto e mais 4 → `related` com 4, sem ele; falha dos relacionados deixa `related` vazio e `product` carregado; `plainDetail` sem categorias não pede relacionados.

## 4. Peças compartilhadas do tema

- [ ] 4.1 Acrescentar a `AppTextStyles` (`lib/ui/shared/theme/app_typography.dart`) `productTitle`, `priceLarge`, `sectionSmall`, `descriptionBody`, `artEmojiLarge` e `artEmojiThumb` (Decisão 4, origem no comentário).
- [ ] 4.2 Em `lib/ui/shared/widgets/product_art.dart`, acrescentar `ProductArtSize` (Decisão 4) com padrão `card`; os testes atuais do card continuam passando sem mudança.
- [ ] 4.3 Testes em `test/ui/shared/widgets/product_art_test.dart`: `gallery` dentro de um `SizedBox` 300×300 ocupa 300×300 e mostra o emoji com `artEmojiLarge`; `thumb` em 64×64 usa `artEmojiThumb`; `card` continua com altura 120.
- [ ] 4.4 Extrair o `_Badge` do `ProductCard` para `lib/ui/shared/widgets/product_badge.dart` (`ProductBadge`, variantes da marca e sólida) e usá-lo no card; testes em `test/ui/shared/widgets/product_badge_test.dart` (texto e `labelSmall`) e os do card sem mudança.

## 5. Widgets do detalhe

- [ ] 5.1 Criar `lib/ui/modules/catalog/widgets/product_gallery.dart` (Decisão 4).
- [ ] 5.2 Testes em `test/ui/modules/catalog/widgets/product_gallery_test.dart` (com `holdImageLoad` para as seis URLs): três imagens mostram "1/3" e três miniaturas; tocar na terceira → "3/3" e ela `selected`; `tester.fling` para a esquerda → "2/3"; uma imagem sem contador nem miniaturas; sem imagens mostra 🖨️ para a raiz `cartuchos-toners`.
- [ ] 5.3 Criar `widgets/product_description.dart` e testes: 700 caracteres mostram "Ler mais" e `maxLines` 8; tocar → texto inteiro e "Ler menos"; 600 caracteres sem botão; quebras de linha preservadas.
- [ ] 5.4 Criar `widgets/product_specs.dart` e `widgets/category_trail.dart` (Decisão 4) com testes: ficha de `tonerDetail` com "Marca · HP", "Categoria · Cartuchos & Toners / Toners HP", "Código" e "Unidade"; `plainDetail` sem "Marca" e "Código"; tocar em "Toners HP" na trilha chama o callback com `toners-hp`.

## 6. Página, rotas e DI

- [ ] 6.1 Criar `lib/ui/modules/catalog/pages/product_detail_page.dart` (Decisão 4) e apagar `pages/product_page.dart`.
- [ ] 6.2 Em `app_router.dart`, montar `ProductDetailPage` nas rotas filhas de `/home` e `/search` (Decisão 5); em `service_locator.dart`, registrar `ProductDetailViewModel` e testar em `test/infra/di/service_locator_test.dart` que cada `getIt` devolve instância nova.
- [ ] 6.3 Widget tests em `test/ui/modules/catalog/pages/product_detail_page_test.dart` (conteúdo, viewport 800×2400 e `holdImageLoad`): `tonerDetail` mostra "Em destaque", "−30%", "HP", o nome, "· Cód.", `R$ 34,90` com `R$ 49,90`, "Sobre o produto" e a ficha; "Adicionar ao carrinho" no rodapé, desabilitado.
- [ ] 6.4 Testes de estados na mesma página: skeleton enquanto `holdProduct()`; `500` mostra "Não foi possível carregar o produto." e "Tentar de novo" pede o produto de novo; `404` mostra "Produto não encontrado" e "Voltar ao catálogo" chama `onOpenSearch(ProductQuery())`; nenhum estado mostra o botão do rodapé fora do carregado.
- [ ] 6.5 Testes de navegação e relacionados na mesma página: marca chama `onOpenSearch` com `brandSlugs: ['hp']`; trilha com `categorySlug`; "Mais de Toners HP" com 4 cards e toque chamando `onOpenProduct(slug)`; sem outros produtos a seção não aparece; voltar chama `onBack`.
- [ ] 6.6 Atualizar `test/app/router/app_router_test.dart`: `/home/product/caneta-x` monta a `ProductDetailPage` com a barra de abas e pede `caneta-x`; produto aberto na Buscar fica com a aba Buscar e voltar mostra a listagem sem nova requisição; "Voltar ao catálogo" leva a `/search`; nenhuma referência ao `ProductPage` provisório.
- [ ] 6.7 Rodar `test/app/app_test.dart` e `test/app/bootstrap_test.dart` e ajustar só o que a troca da página mudou, sem afrouxar expectativas.

## 7. CLAUDE.md e verificação final

- [ ] 7.1 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 7 pede, sem apagar regra existente.
- [ ] 7.2 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso e os `.freezed.dart` estão em dia.
- [ ] 7.3 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [ ] 7.4 `cd apps/mobile && flutter test` com todos os testes passando, inclusive `test/core/architecture_test.dart`.
- [ ] 7.5 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
