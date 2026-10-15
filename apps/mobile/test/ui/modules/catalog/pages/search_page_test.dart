import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/catalog/model/product_page_entity.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/modules/catalog/model/product_query_params.dart';
import 'package:mobile/ui/modules/catalog/pages/search_page.dart';
import 'package:mobile/ui/modules/catalog/view_models/search_view_model.dart';
import 'package:mobile/ui/modules/catalog/widgets/filters_sheet.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_grid.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/empty_state.dart';
import 'package:mobile/ui/shared/widgets/product_card.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../../modules/catalog/support/fake_catalog_repository.dart';
import '../../../shared/support/fake_image_loads.dart';

const _serverFailure = ServerFailure(
  message:
      'O servidor está indisponível no momento. Tente novamente em instantes.',
  code: HttpFailureCode.server,
);

const _networkFailure = NetworkFailure(
  message: 'Não foi possível falar com o servidor. Tente novamente.',
  code: HttpFailureCode.noConnection,
);

// Viewport alto: cabeçalho, pílulas e a grade curta cabem sem rolar.
const _tallSurface = Size(800, 2400);

// O `RefreshIndicator` só arma depois de cerca de um terço da altura da
// rolagem em sobrepasso.
const _pullToRefresh = Offset(0, 600);

/// O que a página entregou para fora e o repositório por trás dela.
class _Harness {
  _Harness(this.repository);

  final FakeCatalogRepository repository;
  final List<ProductQuery> changedQueries = [];
  final List<String> openedSlugs = [];
  int factoryCalls = 0;

  Widget app(ProductQuery initialQuery) => MaterialApp(
    theme: AppTheme.light(),
    home: SearchPage(
      searchViewModelFactory: () {
        factoryCalls++;
        return SearchViewModel(repository);
      },
      initialQuery: initialQuery,
      onQueryChanged: changedQueries.add,
      onOpenProduct: openedSlugs.add,
    ),
  );

  /// Parâmetros do último pedido de produtos, como saem para a API.
  Map<String, String> get lastParams =>
      encodeProductQuery(repository.productQueries.last);
}

/// Monta a página como a rota faz, com o ViewModel de verdade sobre o
/// repositório fake, e espera tudo assentar (salvo com [settle] falso). A
/// foto de `brushDuo` fica presa no placeholder.
Future<_Harness> _pumpSearch(
  WidgetTester tester, {
  ProductQuery initialQuery = const ProductQuery(),
  void Function(FakeCatalogRepository repository)? prepare,
  Size? surface = _tallSurface,
  bool settle = true,
}) async {
  if (surface != null) {
    tester.view.physicalSize = surface;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }
  holdImageLoad(brushDuo.thumbUrl!);

  final harness = _Harness(FakeCatalogRepository());
  prepare?.call(harness.repository);
  await tester.pumpWidget(harness.app(initialQuery));
  if (settle) await tester.pumpAndSettle();
  return harness;
}

Finder _inEmptyState(String text) =>
    find.descendant(of: find.byType(EmptyState), matching: find.text(text));

int _gridLength(WidgetTester tester) =>
    tester.widget<ProductGrid>(find.byType(ProductGrid)).products.length;

double _scrollOffset(WidgetTester tester) => tester
    .widget<CustomScrollView>(find.byType(CustomScrollView))
    .controller!
    .offset;

/// Leva a rolagem ao fim do conteúdo atual, sem embalo que passe para os
/// itens que chegarem depois.
Future<void> _scrollToEnd(WidgetTester tester) async {
  final controller = tester
      .widget<CustomScrollView>(find.byType(CustomScrollView))
      .controller!;
  controller.jumpTo(controller.position.maxScrollExtent);
  await tester.pumpAndSettle();
}

void main() {
  group('cabeçalho', () {
    testWidgets('busca tem prioridade sobre os filtros no título', (
      tester,
    ) async {
      await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(search: 'caneta', onSale: true),
      );

      expect(find.text('Resultados para “caneta”'), findsOneWidget);
    });

    testWidgets('categoria filtrada: o nome dela e a contagem da API', (
      tester,
    ) async {
      await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(categorySlug: 'toners-hp'),
        prepare: (repository) =>
            repository.enqueueProducts(Ok(pageOf(products, total: 12))),
      );

      expect(find.text('Toners HP'), findsWidgets);
      expect(find.text('12 produtos'), findsOneWidget);
    });

    testWidgets('categoria com a árvore carregando mostra "…"', (tester) async {
      final harness = await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(categorySlug: 'toners-hp'),
        prepare: (repository) => repository.holdCategories(),
      );
      expect(harness.repository.categoryCalls, [false]);

      expect(find.text('…'), findsOneWidget);
      expect(find.text('3 produtos'), findsOneWidget);
      // A pílula mostra o slug enquanto a árvore não chega.
      expect(find.text('toners-hp'), findsOneWidget);
    });

    testWidgets('categoria desconhecida ou com falha da árvore: "Produtos"', (
      tester,
    ) async {
      await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(categorySlug: 'nao-existe'),
      );
      expect(find.text('Produtos'), findsOneWidget);
    });

    testWidgets('falha da árvore com categoria: "Produtos"', (tester) async {
      await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(categorySlug: 'toners-hp'),
        prepare: (repository) =>
            repository.enqueueCategories(const Failure(_networkFailure)),
      );
      expect(find.text('Produtos'), findsOneWidget);
    });

    testWidgets('destaques, ofertas e sem filtro', (tester) async {
      final harness = await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(featured: true),
      );
      expect(find.text('Em destaque'), findsOneWidget);

      await tester.pumpWidget(harness.app(const ProductQuery(onSale: true)));
      await tester.pumpAndSettle();
      expect(find.text('Ofertas'), findsOneWidget);

      await tester.pumpWidget(harness.app(const ProductQuery()));
      await tester.pumpAndSettle();
      expect(find.text('Produtos'), findsOneWidget);
      expect(find.text('3 produtos'), findsOneWidget);
    });

    testWidgets('"Filtros (2)" com marca e preço', (tester) async {
      await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(
          search: 'toner',
          brandSlugs: ['hp'],
          maxPriceCents: 30000,
        ),
        prepare: (repository) => repository.enqueueProducts(
          Ok(pageOf(products, brandFacets: const [hpFacet])),
        ),
      );

      expect(find.text('Filtros (2)'), findsOneWidget);
      expect(find.text('HP'), findsOneWidget);
      expect(find.text('até R\$ 300,00'), findsOneWidget);
    });

    testWidgets('sem filtro, o botão é só "Filtros"', (tester) async {
      await _pumpSearch(tester);

      expect(find.text('Filtros'), findsOneWidget);
      expect(find.textContaining('Filtros ('), findsNothing);
    });

    testWidgets('botão de ordem mostra "Destaques" sem busca e "Mais '
        'relevantes" com busca', (tester) async {
      final harness = await _pumpSearch(tester);
      expect(find.text('Destaques'), findsOneWidget);
      expect(harness.lastParams.containsKey('sort'), isFalse);

      await tester.pumpWidget(
        harness.app(const ProductQuery(search: 'caneta')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Mais relevantes'), findsOneWidget);
      expect(harness.lastParams.containsKey('sort'), isFalse);
    });
  });

  group('estados', () {
    testWidgets('skeleton enquanto a primeira página não chega', (
      tester,
    ) async {
      late Completer<Result<ProductPage>> gate;
      final harness = await _pumpSearch(
        tester,
        prepare: (repository) => gate = repository.holdProducts(),
        settle: false,
      );
      await tester.pump();

      expect(find.byType(ProductGridSkeleton), findsOneWidget);
      expect(find.byType(ProductCard), findsNothing);
      expect(find.text('…'), findsOneWidget);

      gate.complete(Ok(pageOf(products)));
      await tester.pumpAndSettle();

      expect(find.byType(ProductGridSkeleton), findsNothing);
      expect(find.byType(ProductCard), findsNWidgets(3));
      expect(harness.repository.productQueries, hasLength(1));
    });

    testWidgets('falha da primeira página: banner e "Tentar de novo" pede a '
        'página 1 do mesmo filtro', (tester) async {
      final harness = await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(search: 'caneta'),
        prepare: (repository) =>
            repository.enqueueProducts(const Failure(_serverFailure)),
      );

      expect(find.text(SearchPage.errorTitle), findsOneWidget);
      expect(find.text(_serverFailure.message), findsOneWidget);
      expect(find.byType(ProductCard), findsNothing);
      // A contagem some com a falha.
      expect(find.text('…'), findsNothing);

      await tester.tap(find.text('Tentar de novo'));
      await tester.pumpAndSettle();

      expect(harness.repository.productQueries, hasLength(2));
      expect(harness.lastParams, {
        'page': '1',
        'pageSize': '24',
        'search': 'caneta',
      });
      expect(find.byType(ProductCard), findsNWidgets(3));
    });

    testWidgets('vazio com termo: "Limpar busca" esvazia o campo e pede sem '
        'search', (tester) async {
      final harness = await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(search: 'xyzabc'),
        prepare: (repository) => repository.enqueueProducts(Ok(pageOf([]))),
      );

      expect(find.text(SearchPage.emptyTitle), findsOneWidget);
      expect(find.text(SearchPage.emptyMessage), findsOneWidget);
      expect(_inEmptyState('Limpar busca'), findsOneWidget);

      await tester.tap(_inEmptyState('Limpar busca'));
      await tester.pumpAndSettle();

      expect(harness.lastParams, {'page': '1', 'pageSize': '24'});
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        isEmpty,
      );
    });

    testWidgets('vazio com filtro: "Limpar filtros" mantém o termo', (
      tester,
    ) async {
      final harness = await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(search: 'caneta', onSale: true),
        prepare: (repository) => repository.enqueueProducts(Ok(pageOf([]))),
      );

      expect(_inEmptyState('Limpar filtros'), findsOneWidget);
      expect(_inEmptyState('Limpar busca'), findsNothing);

      await tester.tap(_inEmptyState('Limpar filtros'));
      await tester.pumpAndSettle();

      expect(harness.lastParams, {
        'page': '1',
        'pageSize': '24',
        'search': 'caneta',
      });
    });

    testWidgets('vazio sem termo nem filtro: "Atualizar" recarrega tudo', (
      tester,
    ) async {
      final harness = await _pumpSearch(
        tester,
        prepare: (repository) => repository.enqueueProducts(Ok(pageOf([]))),
      );

      expect(_inEmptyState('Atualizar'), findsOneWidget);

      await tester.tap(_inEmptyState('Atualizar'));
      await tester.pumpAndSettle();

      expect(harness.repository.categoryCalls, [false, true]);
      expect(harness.repository.productQueries, hasLength(2));
      expect(harness.lastParams, {'page': '1', 'pageSize': '24'});
    });
  });

  group('interação', () {
    testWidgets('digitar e esperar 300 ms pede a busca', (tester) async {
      final harness = await _pumpSearch(tester);

      await tester.enterText(find.byType(TextField), 'caneta');
      await tester.pump(const Duration(milliseconds: 299));
      expect(harness.repository.productQueries, hasLength(1));

      await tester.pump(const Duration(milliseconds: 1));
      await tester.pumpAndSettle();

      expect(harness.repository.productQueries, hasLength(2));
      expect(harness.lastParams['search'], 'caneta');
      expect(find.text('Resultados para “caneta”'), findsOneWidget);
    });

    testWidgets('tocar numa pílula remove só aquele filtro', (tester) async {
      final harness = await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(brandSlugs: ['hp'], onSale: true),
      );

      await tester.tap(find.text('Só ofertas'));
      await tester.pumpAndSettle();

      expect(harness.lastParams, {
        'page': '1',
        'pageSize': '24',
        'brand': 'hp',
      });
      expect(find.text('Só ofertas'), findsNothing);
      expect(find.text('Filtros (1)'), findsOneWidget);
    });

    testWidgets('"Filtros (n)" abre o painel', (tester) async {
      await _pumpSearch(tester, initialQuery: const ProductQuery(onSale: true));

      await tester.tap(find.text('Filtros (1)'));
      await tester.pumpAndSettle();

      expect(find.byType(FiltersSheet), findsOneWidget);
    });

    testWidgets('escolher "Menor preço" fecha o painel e pede a ordem', (
      tester,
    ) async {
      final harness = await _pumpSearch(tester);

      await tester.tap(find.text('Destaques'));
      await tester.pumpAndSettle();
      expect(find.text('Ordenar por'), findsOneWidget);

      await tester.tap(find.text('Menor preço'));
      await tester.pumpAndSettle();

      expect(find.text('Ordenar por'), findsNothing);
      expect(harness.lastParams['sort'], 'price-asc');
      expect(find.text('Menor preço'), findsOneWidget);
    });

    testWidgets('escolher a ordem que já vale não pede de novo', (
      tester,
    ) async {
      final harness = await _pumpSearch(tester);

      await tester.tap(find.text('Destaques'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Destaques').last);
      await tester.pumpAndSettle();

      expect(harness.repository.productQueries, hasLength(1));
    });

    testWidgets('toque num card chama onOpenProduct com o slug', (
      tester,
    ) async {
      final harness = await _pumpSearch(tester);

      await tester.tap(find.byType(ProductCard).first);
      await tester.pumpAndSettle();

      expect(harness.openedSlugs, [finePen.slug]);
    });

    testWidgets('onQueryChanged recebe o filtro novo a cada mudança, não o '
        'da rota', (tester) async {
      final harness = await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(brandSlugs: ['hp'], onSale: true),
      );
      expect(harness.changedQueries, isEmpty);

      await tester.tap(find.text('Só ofertas'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'toner');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();

      expect(harness.changedQueries, [
        const ProductQuery(brandSlugs: ['hp']),
        const ProductQuery(brandSlugs: ['hp'], search: 'toner'),
      ]);
    });
  });

  group('paginação', () {
    testWidgets('rolar até o fim pede a página 2 e acrescenta os itens', (
      tester,
    ) async {
      final harness = await _pumpSearch(
        tester,
        surface: null,
        prepare: (repository) => repository
          ..enqueueProducts(
            Ok(pageOf(manyProducts(24, prefix: 'p1'), totalPages: 3)),
          )
          ..enqueueProducts(
            Ok(pageOf(manyProducts(24, prefix: 'p2'), page: 2, totalPages: 3)),
          ),
      );
      expect(harness.repository.productQueries, hasLength(1));
      expect(_gridLength(tester), 24);

      await _scrollToEnd(tester);

      expect(harness.repository.productQueries, hasLength(2));
      expect(harness.lastParams, {'page': '2', 'pageSize': '24'});
      expect(_gridLength(tester), 48);
    });

    testWidgets('na última página não pede mais', (tester) async {
      final harness = await _pumpSearch(
        tester,
        surface: null,
        prepare: (repository) =>
            repository.enqueueProducts(Ok(pageOf(manyProducts(24)))),
      );

      await _scrollToEnd(tester);
      await _scrollToEnd(tester);

      expect(harness.repository.productQueries, hasLength(1));
      expect(find.byType(ProductGridSkeleton), findsNothing);
    });

    testWidgets('falha da página 2: itens mantidos, banner no rodapé e '
        '"Tentar de novo" pede a página 2', (tester) async {
      final harness = await _pumpSearch(
        tester,
        surface: null,
        prepare: (repository) => repository
          ..enqueueProducts(Ok(pageOf(manyProducts(24), totalPages: 2)))
          ..enqueueProducts(const Failure(_networkFailure)),
      );

      await _scrollToEnd(tester);

      expect(find.text(SearchPage.loadMoreErrorTitle), findsOneWidget);
      expect(find.text(SearchPage.errorTitle), findsNothing);
      expect(_gridLength(tester), 24);
      expect(harness.repository.productQueries, hasLength(2));

      await tester.tap(find.text('Tentar de novo'));
      await tester.pumpAndSettle();

      expect(harness.repository.productQueries, hasLength(3));
      expect(harness.lastParams, {'page': '2', 'pageSize': '24'});
      expect(find.text(SearchPage.loadMoreErrorTitle), findsNothing);
    });

    testWidgets('lista curta com mais páginas pede a seguinte sem rolar', (
      tester,
    ) async {
      final harness = await _pumpSearch(
        tester,
        surface: null,
        prepare: (repository) => repository
          ..enqueueProducts(Ok(pageOf(products, totalPages: 2, total: 6)))
          ..enqueueProducts(
            Ok(pageOf(manyProducts(3), page: 2, totalPages: 2, total: 6)),
          ),
      );

      expect(harness.repository.productQueries, hasLength(2));
      expect(harness.lastParams, {'page': '2', 'pageSize': '24'});
      expect(_gridLength(tester), 6);
    });

    testWidgets('trocar o filtro volta a rolagem ao topo', (tester) async {
      await _pumpSearch(
        tester,
        surface: null,
        prepare: (repository) => repository
          ..enqueueProducts(Ok(pageOf(manyProducts(24))))
          ..enqueueProducts(Ok(pageOf(manyProducts(24, prefix: 'novo')))),
      );

      await tester.drag(find.byType(CustomScrollView), const Offset(0, -2000));
      await tester.pumpAndSettle();
      expect(_scrollOffset(tester), greaterThan(1000));

      await tester.enterText(find.byType(TextField), 'toner');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();

      expect(_scrollOffset(tester), 0);
      expect(_gridLength(tester), 24);
    });
  });

  group('entrada pela rota', () {
    testWidgets('initialQuery novo aplica o filtro e iguala o campo, com o '
        'mesmo ViewModel', (tester) async {
      final harness = await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(search: 'caneta'),
      );
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'caneta',
      );

      await tester.pumpWidget(
        harness.app(const ProductQuery(search: 'toner', onSale: true)),
      );
      await tester.pumpAndSettle();

      expect(harness.repository.productQueries, hasLength(2));
      expect(harness.lastParams, {
        'page': '1',
        'pageSize': '24',
        'search': 'toner',
        'onSale': 'true',
      });
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'toner',
      );
      expect(harness.factoryCalls, 1);
    });

    testWidgets('o mesmo initialQuery não pede de novo', (tester) async {
      final harness = await _pumpSearch(
        tester,
        initialQuery: const ProductQuery(categorySlug: 'escolar'),
      );

      await tester.pumpWidget(
        harness.app(const ProductQuery(categorySlug: 'escolar')),
      );
      await tester.pumpAndSettle();

      expect(harness.repository.productQueries, hasLength(1));
    });

    testWidgets('a rota ecoando o filtro da página não pede de novo nem '
        'apaga o que foi digitado', (tester) async {
      final harness = await _pumpSearch(tester);

      await tester.tap(find.text('Destaques'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Menor preço'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'ton');
      await tester.pump();

      await tester.pumpWidget(harness.app(harness.changedQueries.last));
      await tester.pump();

      expect(harness.repository.productQueries, hasLength(2));
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'ton',
      );
      await tester.pumpAndSettle();
    });

    testWidgets('puxar para baixo pede categorias com refresh e a página 1', (
      tester,
    ) async {
      final harness = await _pumpSearch(
        tester,
        surface: null,
        initialQuery: const ProductQuery(onSale: true),
      );

      await tester.fling(find.byType(CustomScrollView), _pullToRefresh, 1000);
      await tester.pumpAndSettle();

      expect(harness.repository.categoryCalls, [false, true]);
      expect(harness.repository.productQueries, hasLength(2));
      expect(harness.lastParams, {
        'page': '1',
        'pageSize': '24',
        'onSale': 'true',
      });
    });
  });
}
