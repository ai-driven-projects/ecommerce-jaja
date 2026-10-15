import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/order/model/order_entity.dart';
import 'package:mobile/modules/order/model/order_status.dart';
import 'package:mobile/ui/modules/order/view_models/order_tracking_view_model.dart';
import 'package:mobile/ui/shared/view_models/block_state.dart';

import '../../../../modules/order/support/fake_order_repository.dart';
import '../../../../modules/order/support/order_fixtures.dart';

const _notFound = NotFoundFailure(
  message: 'Não encontramos o que você procurou.',
  code: HttpFailureCode.notFound,
);

const _serverDown = ServerFailure(
  message:
      'O servidor está indisponível no momento. Tente novamente em '
      'instantes.',
  code: HttpFailureCode.server,
);

Matcher _loadedWith(OrderDetail value) => isA<BlockLoaded<OrderDetail>>()
    .having((block) => block.value, 'value', value);

void main() {
  late FakeOrderRepository orders;
  late OrderTrackingViewModel viewModel;

  setUp(() {
    orders = FakeOrderRepository();
    viewModel = OrderTrackingViewModel(orders);
  });

  tearDown(() => viewModel.dispose());

  group('start', () {
    test(
      'pede o pedido do id e passa por BlockLoading até BlockLoaded',
      () async {
        final hold = orders.holdFind();

        final started = viewModel.start(fakePlacedOrderId);

        expect(orders.findCalls, [fakePlacedOrderId]);
        expect(viewModel.order, isA<BlockLoading<OrderDetail>>());
        expect(viewModel.isNotFound, isFalse);

        hold.complete(Ok(fakeOrderDetail(id: fakePlacedOrderId)));
        await started;

        expect(
          viewModel.order,
          _loadedWith(fakeOrderDetail(id: fakePlacedOrderId)),
        );
        expect(viewModel.isNotFound, isFalse);
      },
    );

    test('avisa os ouvintes ao começar e ao terminar', () async {
      var notifications = 0;
      viewModel.addListener(() => notifications++);

      await viewModel.start(fakePlacedOrderId);

      expect(notifications, 2);
    });

    test('404 vira isNotFound', () async {
      orders.enqueueFind(const Failure(_notFound));

      await viewModel.start(fakePlacedOrderId);

      expect(viewModel.order, isA<BlockFailed<OrderDetail>>());
      expect(viewModel.isNotFound, isTrue);
    });

    test('500 vira BlockFailed sem isNotFound', () async {
      orders.enqueueFind(const Failure(_serverDown));

      await viewModel.start(fakePlacedOrderId);

      expect(
        viewModel.order,
        isA<BlockFailed<OrderDetail>>().having(
          (block) => block.failure,
          'failure',
          _serverDown,
        ),
      );
      expect(viewModel.isNotFound, isFalse);
    });

    test('"Tentar de novo" (load) pede o mesmo id e mostra o pedido', () async {
      orders.enqueueFind(const Failure(_serverDown));
      await viewModel.start(fakePlacedOrderId);

      await viewModel.load();

      expect(orders.findCalls, [fakePlacedOrderId, fakePlacedOrderId]);
      expect(
        viewModel.order,
        _loadedWith(fakeOrderDetail(id: fakePlacedOrderId)),
      );
    });
  });

  group('refresh', () {
    test('pede de novo e mostra o status novo', () async {
      await viewModel.start(fakePlacedOrderId);
      final approved = fakeOrderDetail(
        id: fakePlacedOrderId,
        status: OrderStatus.paymentApproved,
        paymentApprovedAt: DateTime.utc(2026, 10, 15, 12, 1, 30),
      );
      final hold = orders.holdFind();

      final refreshed = viewModel.refresh();

      expect(viewModel.order, isA<BlockLoading<OrderDetail>>());
      hold.complete(Ok(approved));
      await refreshed;

      expect(orders.findCalls, [fakePlacedOrderId, fakePlacedOrderId]);
      expect(viewModel.order, _loadedWith(approved));
    });

    test(
      'resposta de uma leitura anterior que chega depois é descartada',
      () async {
        final slow = orders.holdFind();
        final picking = fakeOrderDetail(
          id: fakePlacedOrderId,
          status: OrderStatus.picking,
        );
        orders.enqueueFind(Ok(picking));

        final first = viewModel.start(fakePlacedOrderId);
        await viewModel.refresh();
        slow.complete(Ok(fakeOrderDetail(id: fakePlacedOrderId)));
        await first;

        expect(orders.findCalls, hasLength(2));
        expect(viewModel.order, _loadedWith(picking));
      },
    );

    test('resposta que chega depois do dispose não avisa ninguém', () async {
      final hold = orders.holdFind();
      final disposed = OrderTrackingViewModel(orders);
      var notifications = 0;
      final started = disposed.start(fakePlacedOrderId);
      disposed
        ..addListener(() => notifications++)
        ..dispose();

      hold.complete(Ok(fakeOrderDetail(id: fakePlacedOrderId)));
      await started;

      expect(notifications, 0);
    });
  });

  group('now', () {
    test('usa o relógio injetado', () {
      final clock = DateTime(2026, 10, 15, 9, 3);
      final withClock = OrderTrackingViewModel(orders, now: () => clock);
      addTearDown(withClock.dispose);

      expect(withClock.now(), clock);
    });

    test('sem relógio injetado usa a hora do aparelho', () {
      final before = DateTime.now();
      final now = viewModel.now();

      expect(now.isBefore(before), isFalse);
      expect(now.difference(before), lessThan(const Duration(seconds: 5)));
    });
  });
}
