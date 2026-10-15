import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/catalog/model/product_detail.dart';
import 'package:mobile/modules/catalog/model/product_detail_entity.dart';
import 'package:mobile/modules/catalog/model/product_summary_entity.dart';
import 'package:mobile/ui/modules/catalog/view_models/block_state.dart';
import 'package:mobile/ui/modules/catalog/view_models/product_detail_view_model.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../../modules/catalog/support/fake_catalog_repository.dart';

const _notFoundFailure = NotFoundFailure(
  message: 'Não encontramos o que você procurou.',
  code: HttpFailureCode.notFound,
);

const _serverFailure = ServerFailure(
  message: 'O servidor não respondeu como esperado. Tente novamente.',
  code: HttpFailureCode.server,
);

Matcher _loadedWith(ProductDetail value) => isA<BlockLoaded<ProductDetail>>()
    .having((block) => block.value, 'value', value);

void main() {
  late FakeCatalogRepository repository;
  late ProductDetailViewModel viewModel;

  setUp(() {
    repository = FakeCatalogRepository();
    viewModel = ProductDetailViewModel(repository);
  });

  tearDown(() => viewModel.dispose());

  group('produto', () {
    test('antes do start está carregando', () {
      expect(viewModel.product, isA<BlockLoading<ProductDetail>>());
      expect(viewModel.isNotFound, isFalse);
      expect(viewModel.related, isEmpty);
    });

    test('start pede o slug e passa a carregado', () async {
      repository.enqueueProduct(Ok(tonerDetail));

      await viewModel.start('toner');

      expect(repository.productSlugs, ['toner']);
      expect(viewModel.product, _loadedWith(tonerDetail));
      expect(viewModel.isNotFound, isFalse);
    });

    test('404 vira não encontrado', () async {
      repository.enqueueProduct(const Failure(_notFoundFailure));

      await viewModel.start('nao-existe');

      expect(
        viewModel.product,
        isA<BlockFailed<ProductDetail>>().having(
          (block) => block.failure,
          'failure',
          same(_notFoundFailure),
        ),
      );
      expect(viewModel.isNotFound, isTrue);
    });

    test('500 é falha, sem não encontrado', () async {
      repository.enqueueProduct(const Failure(_serverFailure));

      await viewModel.start('toner');

      expect(
        viewModel.product,
        isA<BlockFailed<ProductDetail>>().having(
          (block) => block.failure,
          'failure',
          same(_serverFailure),
        ),
      );
      expect(viewModel.isNotFound, isFalse);
    });

    test('load de novo pede o produto e passa por carregando', () async {
      repository.enqueueProduct(const Failure(_serverFailure));
      await viewModel.start('toner');
      final gate = repository.holdProduct();

      final retrying = viewModel.load.execute();
      expect(viewModel.product, isA<BlockLoading<ProductDetail>>());

      gate.complete(Ok(tonerDetail));
      await retrying;

      expect(repository.productSlugs, ['toner', 'toner']);
      expect(viewModel.product, _loadedWith(tonerDetail));
    });
  });

  group('relacionados', () {
    test('pede a consulta da categoria só depois do produto', () async {
      final gate = repository.holdProduct();

      final starting = viewModel.start(tonerDetail.slug);
      await pumpEventQueue();
      expect(repository.productQueries, isEmpty);

      gate.complete(Ok(tonerDetail));
      await starting;
      await pumpEventQueue();

      expect(repository.productQueries, [relatedProductsQuery(tonerDetail)]);
    });

    test('tira o próprio produto e mostra os outros 4', () async {
      final others = manyProducts(4, prefix: 'toner');
      final self = finePen.copyWith(id: tonerDetail.id, slug: tonerDetail.slug);
      repository.enqueueProduct(Ok(tonerDetail));
      repository.enqueueProducts(Ok(pageOf([self, ...others])));

      await viewModel.start(tonerDetail.slug);
      await pumpEventQueue();

      expect(viewModel.related, others);
      expect(
        viewModel.related.map((ProductSummary item) => item.id),
        isNot(contains(tonerDetail.id)),
      );
    });

    test('falha dos relacionados deixa a lista vazia e o produto', () async {
      repository.enqueueProduct(Ok(tonerDetail));
      repository.enqueueProducts(const Failure(_serverFailure));

      await viewModel.start(tonerDetail.slug);
      await pumpEventQueue();

      expect(viewModel.related, isEmpty);
      expect(viewModel.product, _loadedWith(tonerDetail));
    });

    test('produto sem categorias não pede relacionados', () async {
      await viewModel.start(plainDetail.slug);
      await pumpEventQueue();

      expect(viewModel.product, _loadedWith(plainDetail));
      expect(repository.productQueries, isEmpty);
      expect(viewModel.related, isEmpty);
    });

    test('nova carga limpa os relacionados', () async {
      repository.enqueueProduct(Ok(tonerDetail));
      repository.enqueueProducts(Ok(pageOf(manyProducts(4))));
      await viewModel.start(tonerDetail.slug);
      await pumpEventQueue();
      final gate = repository.holdProduct();

      final reloading = viewModel.load.execute();
      expect(viewModel.related, isEmpty);

      gate.complete(const Failure(_serverFailure));
      await reloading;
    });
  });
}
