import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/catalog/model/category_entity.dart';
import 'package:mobile/modules/catalog/model/home_catalog.dart';
import 'package:mobile/modules/catalog/model/product_summary_entity.dart';
import 'package:mobile/ui/modules/catalog/view_models/block_state.dart';
import 'package:mobile/ui/modules/catalog/view_models/home_view_model.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../../modules/catalog/support/fake_catalog_repository.dart';

const _networkFailure = NetworkFailure(
  message: 'Não foi possível falar com o servidor. Tente novamente.',
  code: HttpFailureCode.noConnection,
);

Matcher _loadedWith<T>(Object? value) =>
    isA<BlockLoaded<T>>().having((block) => block.value, 'value', value);

Matcher _failedWith<T>(AppFailure failure) => isA<BlockFailed<T>>().having(
  (block) => block.failure,
  'failure',
  same(failure),
);

/// Uma raiz com [count] filhas em destaque, para passar do limite da Início.
Category _rootWithHighlightedChildren(int count) => Category(
  slug: 'raiz',
  name: 'Raiz',
  level: 1,
  parentSlug: null,
  isHighlighted: false,
  productCount: count,
  children: [
    for (var i = 0; i < count; i++)
      Category(
        slug: 'filha-$i',
        name: 'Filha $i',
        level: 2,
        parentSlug: 'raiz',
        isHighlighted: true,
        productCount: 1,
        children: const [],
      ),
  ],
);

void main() {
  late FakeCatalogRepository repository;
  late HomeViewModel viewModel;

  setUp(() {
    repository = FakeCatalogRepository();
    viewModel = HomeViewModel(repository);
  });

  tearDown(() => viewModel.dispose());

  group('loadAll', () {
    test('antes do loadAll os três blocos estão carregando', () {
      expect(viewModel.categories, isA<BlockLoading<List<Category>>>());
      expect(viewModel.featured, isA<BlockLoading<List<ProductSummary>>>());
      expect(viewModel.offers, isA<BlockLoading<List<ProductSummary>>>());
      expect(viewModel.highlighted, isEmpty);
      expect(viewModel.isEverythingEmpty, isFalse);
    });

    test('carrega as raízes na ordem da API, sem refresh', () async {
      await viewModel.loadAll();

      expect(repository.categoryCalls, [false]);
      expect(viewModel.categories, _loadedWith<List<Category>>(rootCategories));
    });

    test('pede os destaques e as ofertas com as consultas da Início', () async {
      await viewModel.loadAll();

      expect(repository.productQueries, [homeFeaturedQuery, homeOffersQuery]);
      expect(viewModel.featured, _loadedWith<List<ProductSummary>>(products));
      expect(viewModel.offers, _loadedWith<List<ProductSummary>>(products));
    });

    test('as listas expostas não podem ser alteradas pela tela', () async {
      await viewModel.loadAll();

      final categories = viewModel.categories as BlockLoaded<List<Category>>;
      final featured = viewModel.featured as BlockLoaded<List<ProductSummary>>;
      expect(() => categories.value.add(escolar), throwsUnsupportedError);
      expect(() => featured.value.add(finePen), throwsUnsupportedError);
    });

    test('segue carregando enquanto a API não responde', () async {
      final categoriesGate = repository.holdCategories();

      final loading = viewModel.loadAll();
      expect(viewModel.categories, isA<BlockLoading<List<Category>>>());

      categoriesGate.complete(const Ok(categoryTree));
      await loading;

      expect(viewModel.categories, _loadedWith<List<Category>>(categoryTree));
    });
  });

  group('highlighted', () {
    test('são as categorias em destaque da árvore, em pré-ordem', () async {
      await viewModel.loadAll();

      expect(viewModel.highlighted, [
        (category: adesivos, rootSlug: 'artes-pintura'),
        (category: pinceisETrinchas, rootSlug: 'artes-pintura'),
        (category: tonersHp, rootSlug: 'cartuchos-toners'),
      ]);
    });

    test('para no limite de 12 da Início', () async {
      repository.categories = [_rootWithHighlightedChildren(15)];

      await viewModel.loadAll();

      expect(viewModel.highlighted, hasLength(homeHighlightedCategoriesLimit));
      expect(viewModel.highlighted.last.category.slug, 'filha-11');
    });

    test('é vazia com as categorias em falha', () async {
      repository.enqueueCategories(const Failure(_networkFailure));

      await viewModel.loadAll();

      expect(viewModel.highlighted, isEmpty);
    });
  });

  group('isEverythingEmpty', () {
    test('é verdadeiro só com os três blocos carregados e vazios', () async {
      repository.categories = [];
      repository.products = [];

      await viewModel.loadAll();

      expect(viewModel.isEverythingEmpty, isTrue);
    });

    test('é falso quando só um bloco tem itens', () async {
      repository.categories = [];
      repository.enqueueProducts(Ok(pageOf(const [])));
      repository.enqueueProducts(Ok(pageOf([brushDuo])));

      await viewModel.loadAll();

      expect(viewModel.isEverythingEmpty, isFalse);
    });

    test('é falso quando um bloco vazio e outro em falha', () async {
      repository.categories = [];
      repository.products = [];
      repository.enqueueProducts(const Failure(_networkFailure));

      await viewModel.loadAll();

      expect(viewModel.isEverythingEmpty, isFalse);
    });
  });

  group('falha e recarga', () {
    test('falha só nas ofertas deixa os outros blocos carregados', () async {
      repository.enqueueProducts(Ok(pageOf(products)));
      repository.enqueueProducts(const Failure(_networkFailure));

      await viewModel.loadAll();

      expect(viewModel.categories, _loadedWith<List<Category>>(rootCategories));
      expect(viewModel.featured, _loadedWith<List<ProductSummary>>(products));
      expect(
        viewModel.offers,
        _failedWith<List<ProductSummary>>(_networkFailure),
      );
    });

    test('tentar de novo refaz só as ofertas', () async {
      repository.enqueueProducts(Ok(pageOf(products)));
      repository.enqueueProducts(const Failure(_networkFailure));
      await viewModel.loadAll();

      await viewModel.loadOffers.execute();

      expect(repository.categoryCalls, [false]);
      expect(repository.productQueries, [
        homeFeaturedQuery,
        homeOffersQuery,
        homeOffersQuery,
      ]);
      expect(viewModel.offers, _loadedWith<List<ProductSummary>>(products));
    });

    test(
      'refresh pede as categorias com refresh e as duas consultas',
      () async {
        await viewModel.loadAll();

        await viewModel.refresh();

        expect(repository.categoryCalls, [false, true]);
        expect(repository.productQueries, [
          homeFeaturedQuery,
          homeOffersQuery,
          homeFeaturedQuery,
          homeOffersQuery,
        ]);
      },
    );

    test('o tentar de novo depois de um refresh não pede refresh', () async {
      await viewModel.refresh();

      await viewModel.loadCategories.execute();

      expect(repository.categoryCalls, [true, false]);
    });

    test('durante a recarga o bloco volta a carregar', () async {
      await viewModel.loadAll();
      final gate = repository.holdProducts();

      final reloading = viewModel.loadOffers.execute();
      expect(viewModel.offers, isA<BlockLoading<List<ProductSummary>>>());
      expect(viewModel.featured, _loadedWith<List<ProductSummary>>(products));

      gate.complete(Ok(pageOf([brushDuo])));
      await reloading;

      expect(viewModel.offers, _loadedWith<List<ProductSummary>>([brushDuo]));
    });

    test('recarga que falha de novo mantém a falha', () async {
      repository.enqueueProducts(Ok(pageOf(products)));
      repository.enqueueProducts(const Failure(_networkFailure));
      await viewModel.loadAll();
      repository.enqueueProducts(const Failure(_networkFailure));

      await viewModel.loadOffers.execute();

      expect(
        viewModel.offers,
        _failedWith<List<ProductSummary>>(_networkFailure),
      );
    });

    test('avisa a tela ao começar e ao terminar cada bloco', () async {
      var notifications = 0;
      viewModel.addListener(() => notifications++);

      await viewModel.loadAll();

      // Três commands, cada um avisa ao começar e ao terminar.
      expect(notifications, 6);
    });
  });
}
