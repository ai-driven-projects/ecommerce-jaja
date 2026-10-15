import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/modules/catalog/model/product_query_params.dart';
import 'package:mobile/modules/catalog/model/product_summary_entity.dart';
import 'package:mobile/ui/shared/view_models/block_state.dart';
import 'package:mobile/ui/modules/catalog/view_models/search_view_model.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../../modules/catalog/support/fake_catalog_repository.dart';

const _networkFailure = NetworkFailure(
  message: 'Não foi possível falar com o servidor. Tente novamente.',
  code: HttpFailureCode.noConnection,
);

Matcher _loadedWith(Object? value) => isA<BlockLoaded<List<ProductSummary>>>()
    .having((block) => block.value, 'value', value);

/// Os itens carregados, ou vazia fora de [BlockLoaded].
List<ProductSummary> _itemsOf(SearchViewModel viewModel) =>
    switch (viewModel.results) {
      BlockLoaded(:final value) => value,
      BlockLoading() || BlockFailed() => const [],
    };

void main() {
  late FakeCatalogRepository repository;
  late SearchViewModel viewModel;

  /// Parâmetros do último pedido de produtos, como saem para a API.
  Map<String, String> lastParams() =>
      encodeProductQuery(repository.productQueries.last);

  setUp(() {
    repository = FakeCatalogRepository();
    viewModel = SearchViewModel(repository);
  });

  tearDown(() => viewModel.dispose());

  group('carga e filtros', () {
    test('start pede categorias e a página 1 do filtro recebido', () async {
      await viewModel.start(const ProductQuery(categorySlug: 'escolar'));

      expect(repository.categoryCalls, [false]);
      expect(repository.productQueries, hasLength(1));
      expect(lastParams(), {
        'page': '1',
        'pageSize': '24',
        'category': 'escolar',
      });
      expect(viewModel.query, const ProductQuery(categorySlug: 'escolar'));
    });

    test('results passa de BlockLoading a BlockLoaded', () async {
      final gate = repository.holdProducts();

      final loading = viewModel.start(const ProductQuery());
      expect(viewModel.results, isA<BlockLoading<List<ProductSummary>>>());
      expect(viewModel.hasMore, isFalse);

      gate.complete(Ok(pageOf(products, total: 3)));
      await loading;

      expect(viewModel.results, _loadedWith(products));
      expect(viewModel.total, 3);
    });

    test('falha da página 1 vira BlockFailed e retry pede de novo', () async {
      repository.enqueueProducts(const Failure(_networkFailure));

      await viewModel.start(const ProductQuery(search: 'toner'));
      expect(
        viewModel.results,
        isA<BlockFailed<List<ProductSummary>>>().having(
          (block) => block.failure,
          'failure',
          same(_networkFailure),
        ),
      );

      await viewModel.retry();

      expect(repository.productQueries, hasLength(2));
      expect(lastParams(), {'page': '1', 'pageSize': '24', 'search': 'toner'});
      expect(viewModel.results, _loadedWith(products));
    });

    test('filteredCategory resolve uma subcategoria da árvore', () async {
      await viewModel.start(const ProductQuery(categorySlug: 'toners-hp'));

      expect(viewModel.filteredCategory, tonersHp);
    });

    test('filteredCategory é nulo com slug desconhecido', () async {
      await viewModel.start(const ProductQuery(categorySlug: 'nao-existe'));

      expect(viewModel.filteredCategory, isNull);
    });

    test('guarda as facetas de marca da página recebida', () async {
      repository.enqueueProducts(Ok(pageOf(products, brandFacets: [hpFacet])));

      await viewModel.start(const ProductQuery());

      expect(viewModel.brandFacets, [hpFacet]);
    });

    test('aplicar um filtro igual ao em vigor não pede de novo', () async {
      await viewModel.start(const ProductQuery(categorySlug: 'escolar'));

      await viewModel.applyQuery(
        const ProductQuery(categorySlug: 'escolar', page: 3, pageSize: 48),
      );
      await viewModel.setCategory('escolar');
      await viewModel.setOnSale(false);

      expect(repository.productQueries, hasLength(1));
    });

    test('cada filtro do painel pede a página 1 com ele', () async {
      await viewModel.start(const ProductQuery(search: 'toner'));

      await viewModel.toggleBrand('hp', true);
      await viewModel.setPriceRange(null, 30000);

      expect(lastParams(), {
        'page': '1',
        'pageSize': '24',
        'search': 'toner',
        'brand': 'hp',
        'maxPriceCents': '30000',
      });

      await viewModel.removeBrand('hp');
      await viewModel.clearPrice();
      await viewModel.setFeatured(true);
      await viewModel.setSort(ProductSort.priceAsc);

      expect(lastParams(), {
        'page': '1',
        'pageSize': '24',
        'search': 'toner',
        'featured': 'true',
        'sort': 'price-asc',
      });
    });

    test('clearFilters mantém a busca e a ordem', () async {
      await viewModel.start(
        const ProductQuery(
          search: 'caneta',
          sort: ProductSort.priceAsc,
          categorySlug: 'escolar',
          brandSlugs: ['bic'],
        ),
      );

      await viewModel.clearFilters();

      expect(lastParams(), {
        'page': '1',
        'pageSize': '24',
        'search': 'caneta',
        'sort': 'price-asc',
      });
    });
  });

  group('espera da busca', () {
    testWidgets('digitar duas vezes em menos de 300 ms faz um pedido só', (
      tester,
    ) async {
      final viewModel = SearchViewModel(repository);
      addTearDown(viewModel.dispose);
      await viewModel.start(const ProductQuery());
      await tester.pump();

      viewModel.onSearchChanged('cane');
      await tester.pump(const Duration(milliseconds: 100));
      viewModel.onSearchChanged('caneta');
      expect(viewModel.searchText, 'caneta');
      await tester.pump(const Duration(milliseconds: 299));

      expect(repository.productQueries, hasLength(1));

      await tester.pump(const Duration(milliseconds: 1));

      expect(repository.productQueries, hasLength(2));
      expect(lastParams(), {'page': '1', 'pageSize': '24', 'search': 'caneta'});

      await tester.pump(const Duration(seconds: 1));
      expect(repository.productQueries, hasLength(2));
    });

    testWidgets('submitSearch pede na hora e o timer não repete', (
      tester,
    ) async {
      final viewModel = SearchViewModel(repository);
      addTearDown(viewModel.dispose);
      await viewModel.start(const ProductQuery());
      await tester.pump();

      viewModel.onSearchChanged('toner');
      await tester.pump(const Duration(milliseconds: 100));
      await viewModel.submitSearch('toner');

      expect(repository.productQueries, hasLength(2));
      expect(lastParams(), {'page': '1', 'pageSize': '24', 'search': 'toner'});

      await tester.pump(const Duration(milliseconds: 500));
      expect(repository.productQueries, hasLength(2));
    });

    testWidgets('clearSearch com relevance pede sem search e sem sort', (
      tester,
    ) async {
      final viewModel = SearchViewModel(repository);
      addTearDown(viewModel.dispose);
      await viewModel.start(
        const ProductQuery(search: 'toner', sort: ProductSort.relevance),
      );
      await tester.pump();
      expect(viewModel.searchText, 'toner');

      await viewModel.clearSearch();

      expect(viewModel.searchText, isEmpty);
      expect(lastParams(), {'page': '1', 'pageSize': '24'});
      expect(viewModel.query, const ProductQuery());
    });

    testWidgets('filtro da rota cancela a espera e iguala o campo', (
      tester,
    ) async {
      final viewModel = SearchViewModel(repository);
      addTearDown(viewModel.dispose);
      await viewModel.start(const ProductQuery());
      await tester.pump();

      viewModel.onSearchChanged('cane');
      await viewModel.applyQuery(const ProductQuery(search: 'toner'));
      await tester.pump(const Duration(milliseconds: 500));

      expect(viewModel.searchText, 'toner');
      expect(repository.productQueries, hasLength(2));
      expect(lastParams(), {'page': '1', 'pageSize': '24', 'search': 'toner'});
    });
  });

  group('paginação', () {
    test('loadMore pede a página 2 e acrescenta os itens', () async {
      repository
        ..enqueueProducts(
          Ok(pageOf(manyProducts(24, prefix: 'a'), totalPages: 3, total: 72)),
        )
        ..enqueueProducts(
          Ok(
            pageOf(
              manyProducts(24, prefix: 'b'),
              page: 2,
              totalPages: 3,
              total: 72,
            ),
          ),
        );
      await viewModel.start(const ProductQuery());
      expect(viewModel.hasMore, isTrue);

      await viewModel.loadMore.execute();

      expect(lastParams(), {'page': '2', 'pageSize': '24'});
      expect(_itemsOf(viewModel), [
        ...manyProducts(24, prefix: 'a'),
        ...manyProducts(24, prefix: 'b'),
      ]);
      expect(viewModel.hasMore, isTrue);
      expect(viewModel.loadingMore, isFalse);
    });

    test('enquanto a página 2 carrega, loadingMore fica ligado', () async {
      repository.enqueueProducts(
        Ok(pageOf(manyProducts(24), totalPages: 2, total: 30)),
      );
      await viewModel.start(const ProductQuery());
      final gate = repository.holdProducts();

      final loading = viewModel.loadMore.execute();
      expect(viewModel.loadingMore, isTrue);

      gate.complete(
        Ok(pageOf(manyProducts(6, prefix: 'b'), page: 2, totalPages: 2)),
      );
      await loading;

      expect(viewModel.loadingMore, isFalse);
      expect(viewModel.hasMore, isFalse);
      expect(_itemsOf(viewModel), hasLength(30));
    });

    test('item com id repetido na página seguinte é pulado', () async {
      repository
        ..enqueueProducts(
          Ok(pageOf(manyProducts(2, prefix: 'a'), totalPages: 2)),
        )
        ..enqueueProducts(
          Ok(pageOf(manyProducts(3, prefix: 'a'), page: 2, totalPages: 2)),
        );
      await viewModel.start(const ProductQuery());

      await viewModel.loadMore.execute();

      expect(_itemsOf(viewModel), manyProducts(3, prefix: 'a'));
    });

    test('na última página loadMore não pede nada', () async {
      await viewModel.start(const ProductQuery());
      expect(viewModel.hasMore, isFalse);

      await viewModel.loadMore.execute();

      expect(repository.productQueries, hasLength(1));
    });

    test(
      'falha da página 2 mantém os itens e o retry pede a 2 de novo',
      () async {
        repository
          ..enqueueProducts(
            Ok(pageOf(manyProducts(24, prefix: 'a'), totalPages: 2)),
          )
          ..enqueueProducts(const Failure(_networkFailure))
          ..enqueueProducts(
            Ok(pageOf(manyProducts(24, prefix: 'b'), page: 2, totalPages: 2)),
          );
        await viewModel.start(const ProductQuery());

        await viewModel.loadMore.execute();

        expect(viewModel.loadMoreFailure, same(_networkFailure));
        expect(_itemsOf(viewModel), manyProducts(24, prefix: 'a'));

        // Com a falha pendente, só o "Tentar de novo" do rodapé pede de novo.
        await viewModel.loadMore.execute();
        expect(repository.productQueries, hasLength(2));

        await viewModel.retryLoadMore();

        expect(repository.productQueries, hasLength(3));
        expect(lastParams(), {'page': '2', 'pageSize': '24'});
        expect(viewModel.loadMoreFailure, isNull);
        expect(_itemsOf(viewModel), hasLength(48));
      },
    );
  });

  group('descarte de resposta velha', () {
    test(
      'resposta de "caneta" que chega depois da de "toner" é ignorada',
      () async {
        await viewModel.start(const ProductQuery());
        final canetaGate = repository.holdProducts();
        final tonerGate = repository.holdProducts();

        final caneta = viewModel.submitSearch('caneta');
        final toner = viewModel.submitSearch('toner');
        expect(viewModel.results, isA<BlockLoading<List<ProductSummary>>>());

        tonerGate.complete(Ok(pageOf([brushDuo])));
        await toner;
        canetaGate.complete(Ok(pageOf([finePen], total: 40)));
        await caneta;

        expect(viewModel.query, const ProductQuery(search: 'toner'));
        expect(viewModel.results, _loadedWith([brushDuo]));
        expect(viewModel.total, 1);
      },
    );

    test('resposta da página 2 de um filtro antigo é ignorada', () async {
      repository.enqueueProducts(
        Ok(pageOf(manyProducts(24, prefix: 'a'), totalPages: 2)),
      );
      await viewModel.start(const ProductQuery());
      final pageTwoGate = repository.holdProducts();

      final more = viewModel.loadMore.execute();
      await viewModel.setOnSale(true);

      expect(lastParams(), {'page': '1', 'pageSize': '24', 'onSale': 'true'});
      expect(viewModel.results, _loadedWith(products));

      pageTwoGate.complete(
        Ok(pageOf(manyProducts(24, prefix: 'b'), page: 2, totalPages: 2)),
      );
      await more;

      expect(viewModel.results, _loadedWith(products));
      expect(viewModel.hasMore, isFalse);
    });

    test('refresh pede categorias com refresh e a página 1', () async {
      repository.enqueueProducts(
        Ok(pageOf(manyProducts(24, prefix: 'a'), totalPages: 2)),
      );
      await viewModel.start(const ProductQuery(categorySlug: 'escolar'));
      await viewModel.loadMore.execute();

      await viewModel.refresh();

      expect(repository.categoryCalls, [false, true]);
      expect(repository.productQueries, hasLength(3));
      expect(lastParams(), {
        'page': '1',
        'pageSize': '24',
        'category': 'escolar',
      });
      expect(viewModel.results, _loadedWith(products));
    });
  });
}
