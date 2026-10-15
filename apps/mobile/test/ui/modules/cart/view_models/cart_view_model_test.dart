import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/cart/errors/cart_errors.dart';
import 'package:mobile/modules/cart/model/cart_state.dart';
import 'package:mobile/ui/modules/cart/view_models/cart_view_model.dart';

import '../../../../modules/cart/support/cart_fixtures.dart';
import '../../../../modules/cart/support/fake_cart_repository.dart';

final _quantityExceeded = ValidationFailure(
  message: CartErrorCode.quantityExceeded.message,
  code: CartErrorCode.quantityExceeded,
);

void main() {
  late FakeCartRepository repository;
  late CartViewModel viewModel;

  setUp(() {
    repository = FakeCartRepository(state: stateOf([canetaLine]));
    viewModel = CartViewModel(repository);
  });

  tearDown(() {
    viewModel.dispose();
    repository.dispose();
  });

  group('state', () {
    test('começa com o estado do repositório', () {
      expect(viewModel.state, same(repository.state));
      expect(viewModel.state.count, 2);
      expect(viewModel.failureMessage, isNull);
    });

    test('acompanha cada mudança emitida e avisa', () async {
      var notifications = 0;
      viewModel.addListener(() => notifications++);
      final next = stateOf([canetaLine, tonerLine]);

      repository.emit(next);
      await pumpEventQueue();

      expect(viewModel.state, same(next));
      expect(viewModel.state.count, 3);
      expect(notifications, 1);
    });
  });

  group('ações', () {
    test(
      'changeQuantity chama setQuantity com o produto e a quantidade',
      () async {
        await viewModel.changeQuantity.execute((
          productId: canetaLine.productId,
          quantity: 5,
        ));
        await pumpEventQueue();

        expect(repository.setQuantityCalls, [
          (productId: canetaLine.productId, quantity: 5),
        ]);
        expect(viewModel.changeQuantity.result, isA<Ok<void>>());
        expect(viewModel.state.quantityOf(canetaLine.productId), 5);
        expect(viewModel.failureMessage, isNull);
      },
    );

    test('remove chama o repositório e tira o produto', () async {
      await viewModel.remove.execute(canetaLine.productId);
      await pumpEventQueue();

      expect(repository.removeCalls, [canetaLine.productId]);
      expect(viewModel.remove.result, isA<Ok<void>>());
      expect(viewModel.state.isEmpty, isTrue);
    });

    test('falha preenche failureMessage e não muda o carrinho', () async {
      repository.enqueueSetQuantity(Failure(_quantityExceeded));

      await viewModel.changeQuantity.execute((
        productId: canetaLine.productId,
        quantity: 100,
      ));

      expect(viewModel.failureMessage, 'Limite de 99 unidades por produto.');
      expect(viewModel.changeQuantity.result, isA<Failure<void>>());
      expect(viewModel.state.quantityOf(canetaLine.productId), 2);
    });

    test('a ação seguinte limpa a falha anterior', () async {
      repository.enqueueSetQuantity(Failure(_quantityExceeded));
      await viewModel.changeQuantity.execute((
        productId: canetaLine.productId,
        quantity: 100,
      ));

      await viewModel.remove.execute(canetaLine.productId);

      expect(viewModel.failureMessage, isNull);
    });

    test('retry chama refresh', () {
      viewModel.retry();

      expect(repository.refreshCalls, 1);
    });
  });

  test('dispose cancela a assinatura: mudanças depois não chegam', () async {
    final before = viewModel.state;
    viewModel.dispose();

    repository.emit(CartState());
    await pumpEventQueue();

    expect(viewModel.state, same(before));
    // O tearDown chama dispose de novo; um ViewModel novo evita o erro.
    viewModel = CartViewModel(repository);
  });
}
