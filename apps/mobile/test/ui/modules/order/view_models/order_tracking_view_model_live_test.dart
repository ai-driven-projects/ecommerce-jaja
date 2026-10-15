import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/order/model/order_entity.dart';
import 'package:mobile/modules/order/model/order_live_status.dart';
import 'package:mobile/modules/order/model/order_status.dart';
import 'package:mobile/modules/order/usecase/live_order_feed.dart';
import 'package:mobile/ui/modules/order/view_models/order_tracking_view_model.dart';
import 'package:mobile/ui/shared/view_models/block_state.dart';

import '../../../../modules/order/support/fake_delay.dart';
import '../../../../modules/order/support/fake_order_live_source.dart';
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

final _approved = fakeOrderDetail(
  id: fakePlacedOrderId,
  status: OrderStatus.paymentApproved,
  paymentApprovedAt: DateTime.utc(2026, 10, 15, 12, 1, 30),
);

final _picking = fakeOrderDetail(
  id: fakePlacedOrderId,
  status: OrderStatus.picking,
  paymentApprovedAt: DateTime.utc(2026, 10, 15, 12, 1, 30),
  pickingStartedAt: DateTime.utc(2026, 10, 15, 12, 5),
);

final _delivered = fakeOrderDetail(
  id: fakePlacedOrderId,
  status: OrderStatus.delivered,
  paymentApprovedAt: DateTime.utc(2026, 10, 15, 12, 1, 30),
  pickingStartedAt: DateTime.utc(2026, 10, 15, 12, 5),
  outForDeliveryAt: DateTime.utc(2026, 10, 15, 12, 20),
  deliveredAt: DateTime.utc(2026, 10, 15, 12, 41, 7),
);

Matcher _loadedWith(OrderDetail value) => isA<BlockLoaded<OrderDetail>>()
    .having((block) => block.value, 'value', value);

void main() {
  late FakeOrderRepository orders;
  late FakeOrderLiveSource source;
  late FakeDelay delay;
  late OrderTrackingViewModel viewModel;

  setUp(() {
    orders = FakeOrderRepository();
    source = FakeOrderLiveSource();
    delay = FakeDelay();
    viewModel = OrderTrackingViewModel(
      orders,
      LiveOrderFeed(source, wait: delay.call),
    );
  });

  tearDown(() => viewModel.dispose());

  /// Abre a tela com o pedido [initial] e conecta o stream, com a releitura
  /// da conexão respondendo [initial] de novo.
  Future<FakeOrderConnection> startLive([OrderDetail? initial]) async {
    final detail = initial ?? fakeOrderDetail(id: fakePlacedOrderId);
    orders
      ..enqueueFind(Ok(detail))
      ..enqueueFind(Ok(detail));
    await viewModel.start(fakePlacedOrderId);
    final connection = source.last..opened();
    await pumpEventQueue();
    return connection;
  }

  group('abertura do stream', () {
    test('pedido não entregue abre o stream do id', () async {
      await viewModel.start(fakePlacedOrderId);

      expect(source.connections, hasLength(1));
      expect(source.last.orderId, fakePlacedOrderId);
      expect(viewModel.live, OrderLiveStatus.connecting);
    });

    test('pedido DELIVERED não abre o stream e live fica off', () async {
      orders.enqueueFind(Ok(_delivered));

      await viewModel.start(fakePlacedOrderId);

      expect(source.connections, isEmpty);
      expect(viewModel.live, OrderLiveStatus.off);
    });

    test('falha na primeira leitura não abre o stream', () async {
      orders.enqueueFind(const Failure(_serverDown));

      await viewModel.start(fakePlacedOrderId);

      expect(source.connections, isEmpty);
      expect(viewModel.live, OrderLiveStatus.off);
    });
  });

  group('releitura silenciosa', () {
    test('Opened deixa live e relê o pedido sem BlockLoading', () async {
      await viewModel.start(fakePlacedOrderId);
      final states = <BlockState<OrderDetail>>[];
      viewModel.addListener(() => states.add(viewModel.order));

      source.last.opened();
      await pumpEventQueue();

      expect(viewModel.live, OrderLiveStatus.live);
      expect(orders.findCalls, hasLength(2));
      expect(states, everyElement(isA<BlockLoaded<OrderDetail>>()));
    });

    test('Notice com o pedido em PICKING atualiza o order', () async {
      final connection = await startLive();
      orders.enqueueFind(Ok(_picking));

      connection.notice();
      await pumpEventQueue();

      expect(orders.findCalls, hasLength(3));
      expect(viewModel.order, _loadedWith(_picking));
    });

    test(
      'três Notice com uma leitura presa geram só mais uma leitura',
      () async {
        final connection = await startLive();
        final hold = orders.holdFind();

        connection
          ..notice()
          ..notice()
          ..notice();
        await pumpEventQueue();
        expect(orders.findCalls, hasLength(3));

        hold.complete(Ok(fakeOrderDetail(id: fakePlacedOrderId)));
        await pumpEventQueue();

        expect(orders.findCalls, hasLength(4));
      },
    );

    test('releitura com DELIVERED fecha o stream', () async {
      final connection = await startLive();
      orders.enqueueFind(Ok(_delivered));

      connection.notice();
      await pumpEventQueue();

      expect(viewModel.order, _loadedWith(_delivered));
      expect(connection.isCancelled, isTrue);
      expect(viewModel.live, OrderLiveStatus.off);
    });

    test('releitura com 404 vira isNotFound e fecha o stream', () async {
      final connection = await startLive();
      orders.enqueueFind(const Failure(_notFound));

      connection.notice();
      await pumpEventQueue();

      expect(viewModel.isNotFound, isTrue);
      expect(connection.isCancelled, isTrue);
      expect(viewModel.live, OrderLiveStatus.off);
    });

    test('releitura com 500 mantém o pedido e o stream', () async {
      final connection = await startLive(_approved);
      orders.enqueueFind(const Failure(_serverDown));

      connection.notice();
      await pumpEventQueue();

      expect(viewModel.order, _loadedWith(_approved));
      expect(connection.isCancelled, isFalse);
      expect(viewModel.live, OrderLiveStatus.live);
    });
  });

  group('setActive, recusa e dispose', () {
    test('setActive(false) fecha o stream e live fica off', () async {
      final connection = await startLive();

      viewModel.setActive(false);

      expect(connection.isCancelled, isTrue);
      expect(viewModel.live, OrderLiveStatus.off);
    });

    test('setActive(true) reabre com a espera de volta a 1 s', () async {
      await viewModel.start(fakePlacedOrderId);
      source.last.drop();
      await pumpEventQueue();
      delay.elapse();
      await pumpEventQueue();
      source.last.drop();
      await pumpEventQueue();
      expect(delay.requested, const [
        Duration(seconds: 1),
        Duration(seconds: 2),
      ]);

      viewModel
        ..setActive(false)
        ..setActive(true);
      final reopened = source.last;
      reopened.drop();
      await pumpEventQueue();

      expect(source.connections, hasLength(3));
      expect(viewModel.live, OrderLiveStatus.reconnecting);
      expect(delay.requested.last, const Duration(seconds: 1));
    });

    test('Refused deixa closed sem reabrir até a próxima ativação', () async {
      final connection = await startLive();

      connection.refuse(_notFound);
      await pumpEventQueue();
      expect(viewModel.live, OrderLiveStatus.closed);
      expect(delay.requested, isEmpty);

      await viewModel.refresh();
      expect(source.connections, hasLength(1));
      expect(viewModel.live, OrderLiveStatus.closed);

      viewModel
        ..setActive(false)
        ..setActive(true);
      expect(source.connections, hasLength(2));
      expect(viewModel.live, OrderLiveStatus.connecting);
    });

    test('dispose fecha o stream e ignora respostas pendentes', () async {
      final connection = await startLive();
      final hold = orders.holdFind();
      connection.notice();
      await pumpEventQueue();
      final disposed = viewModel;
      var notifications = 0;
      disposed.addListener(() => notifications++);
      viewModel = OrderTrackingViewModel(
        orders,
        LiveOrderFeed(FakeOrderLiveSource()),
      );

      disposed.dispose();
      hold.complete(Ok(_picking));
      await pumpEventQueue();

      expect(connection.isCancelled, isTrue);
      expect(notifications, 0);
    });
  });

  group('destaque', () {
    test('isHighlighted só para o passo concluído com a tela aberta', () async {
      final connection = await startLive(_approved);
      expect(viewModel.openedStatus, OrderStatus.paymentApproved);
      expect(viewModel.isHighlighted(OrderStatus.placed), isFalse);
      expect(viewModel.isHighlighted(OrderStatus.paymentApproved), isFalse);
      orders.enqueueFind(Ok(_picking));

      connection.notice();
      await pumpEventQueue();

      expect(viewModel.isHighlighted(OrderStatus.placed), isFalse);
      expect(viewModel.isHighlighted(OrderStatus.paymentApproved), isFalse);
      expect(viewModel.isHighlighted(OrderStatus.picking), isTrue);
      expect(viewModel.isHighlighted(OrderStatus.outForDelivery), isFalse);
    });

    test('puxar a tela não muda openedStatus', () async {
      await startLive(_approved);
      orders.enqueueFind(Ok(_picking));

      await viewModel.refresh();

      expect(viewModel.order, _loadedWith(_picking));
      expect(viewModel.openedStatus, OrderStatus.paymentApproved);
      expect(viewModel.isHighlighted(OrderStatus.picking), isTrue);
    });
  });
}
