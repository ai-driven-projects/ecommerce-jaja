import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/cart/errors/cart_errors.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';
import 'package:mobile/modules/cart/model/cart_state.dart';
import 'package:mobile/modules/catalog/model/product_detail.dart';
import 'package:mobile/modules/catalog/model/product_detail_entity.dart';
import 'package:mobile/modules/catalog/model/product_summary_entity.dart';
import 'package:mobile/ui/modules/catalog/view_models/block_state.dart';
import 'package:mobile/ui/modules/catalog/view_models/product_detail_view_model.dart';
import 'package:mobile/ui/shared/formatters/money_formatter.dart';

import '../../../../modules/cart/support/fake_cart_repository.dart';
import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../../modules/catalog/support/fake_catalog_repository.dart';
import '../../../shared/support/money.dart';

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

final _quantityExceeded = ValidationFailure(
  message: CartErrorCode.quantityExceeded.message,
  code: CartErrorCode.quantityExceeded,
);

/// Caneta de R$ 12,90, para as contas do rodapé.
final _pen = plainDetail.copyWith(price: money(1290));

void main() {
  late FakeCatalogRepository repository;
  late FakeCartRepository cart;
  late ProductDetailViewModel viewModel;

  setUp(() {
    repository = FakeCatalogRepository();
    cart = FakeCartRepository();
    viewModel = ProductDetailViewModel(repository, cart);
  });

  tearDown(() {
    viewModel.dispose();
    cart.dispose();
  });

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

  group('carrinho', () {
    Future<void> startWithPen() async {
      repository.enqueueProduct(Ok(_pen));
      await viewModel.start(_pen.slug);
    }

    test('quantity começa em 1 e não desce abaixo dele', () {
      expect(viewModel.quantity, 1);

      viewModel.decrement();

      expect(viewModel.quantity, 1);
      expect(viewModel.canDecrement, isFalse);
    });

    test('increment e decrement mudam a quantidade e avisam', () {
      var notifications = 0;
      viewModel.addListener(() => notifications++);

      viewModel
        ..increment()
        ..increment()
        ..decrement();

      expect(viewModel.quantity, 2);
      expect(notifications, 3);
    });

    test('quantity para em 99', () {
      for (var i = 0; i < 120; i++) {
        viewModel.increment();
      }

      expect(viewModel.quantity, 99);
      expect(viewModel.canIncrement, isFalse);
    });

    test('total é o preço vezes a quantidade; null antes do produto', () async {
      expect(viewModel.total, isNull);
      await startWithPen();

      viewModel
        ..increment()
        ..increment();

      expect(viewModel.total, money(3870));
    });

    test(
      'addToCart chama add(id, 3) e devolve a quantidade e o total',
      () async {
        await startWithPen();
        viewModel
          ..increment()
          ..increment();

        await viewModel.addToCart.execute();

        expect(cart.addCalls, [(productId: _pen.id, quantity: 3)]);
        expect(
          viewModel.addToCart.result,
          isA<Ok<AddedToCart>>().having((result) => result.value, 'value', (
            quantity: 3,
            total: money(3870),
          )),
        );
        final added = (viewModel.addToCart.result! as Ok<AddedToCart>).value;
        expect(formatMoney(added.total), r'R$ 38,70');
      },
    );

    test('sucesso volta a quantidade a 1', () async {
      await startWithPen();
      viewModel.increment();

      await viewModel.addToCart.execute();

      expect(viewModel.quantity, 1);
    });

    test('falha mantém a quantidade e devolve a falha', () async {
      await startWithPen();
      viewModel
        ..increment()
        ..increment();
      cart.enqueueAdd(Failure(_quantityExceeded));

      await viewModel.addToCart.execute();

      expect(viewModel.quantity, 3);
      expect(
        viewModel.addToCart.result,
        isA<Failure<AddedToCart>>().having(
          (result) => result.failure.message,
          'message',
          'Limite de 99 unidades por produto.',
        ),
      );
    });

    test('addToCart roda enquanto o carrinho não responde', () async {
      await startWithPen();
      final gate = cart.holdAdd();

      final adding = viewModel.addToCart.execute();
      expect(viewModel.addToCart.running, isTrue);

      gate.complete(const Ok(null));
      await adding;

      expect(viewModel.addToCart.running, isFalse);
    });

    test(
      'addToCart sem produto carregado falha sem chamar o carrinho',
      () async {
        await viewModel.addToCart.execute();

        expect(cart.addCalls, isEmpty);
        expect(viewModel.addToCart.result, isA<Failure<AddedToCart>>());
      },
    );

    test('inCart começa com o carrinho e muda quando ele emite', () async {
      cart.emit(CartState(items: [CartItem(productId: _pen.id, quantity: 2)]));
      await startWithPen();
      expect(viewModel.inCart, 2);
      var notifications = 0;
      viewModel.addListener(() => notifications++);

      cart.emit(CartState(items: [CartItem(productId: _pen.id, quantity: 5)]));
      await pumpEventQueue();

      expect(viewModel.inCart, 5);
      expect(notifications, 1);
    });

    test('inCart é 0 antes do produto e soma depois do addToCart', () async {
      expect(viewModel.inCart, 0);
      await startWithPen();
      viewModel
        ..increment()
        ..increment();

      await viewModel.addToCart.execute();
      await pumpEventQueue();

      expect(viewModel.inCart, 3);
    });
  });
}
