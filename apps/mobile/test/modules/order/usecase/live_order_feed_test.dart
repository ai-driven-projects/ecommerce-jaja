import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/modules/order/model/order_live_status.dart';
import 'package:mobile/modules/order/usecase/live_order_feed.dart';

import '../support/fake_delay.dart';
import '../support/fake_order_live_source.dart';

const _orderId = '3f1c9a52-7b1e-4c2d-9e8f-0a1b2c3d4e5f';

const _notFound = NotFoundFailure(
  message: 'Pedido não encontrado.',
  code: GenericFailureCode.unspecified,
);

void main() {
  late FakeOrderLiveSource source;
  late FakeDelay delay;
  late LiveOrderFeed feed;
  late List<OrderLiveStatus> statuses;
  late int notices;

  setUp(() {
    source = FakeOrderLiveSource();
    delay = FakeDelay();
    feed = LiveOrderFeed(source, wait: delay.call);
    statuses = [];
    notices = 0;
  });

  void start() =>
      feed.start(_orderId, onStatus: statuses.add, onNotice: () => notices++);

  group('orderStreamRetryDelay', () {
    test('cresce de 1 s a 10 s e fica em 10 s', () {
      expect(
        [
          for (var attempt = 0; attempt <= 6; attempt++) attempt,
        ].map(orderStreamRetryDelay),
        const [1, 2, 4, 8, 10, 10, 10].map((s) => Duration(seconds: s)),
      );
    });
  });

  group('LiveOrderFeed', () {
    test('start abre uma conexão do pedido e vai a connecting', () {
      start();

      expect(statuses, [OrderLiveStatus.connecting]);
      expect(source.connections, hasLength(1));
      expect(source.last.orderId, _orderId);
    });

    test('Opened leva a live', () async {
      start();
      source.last.opened();
      await pumpEventQueue();

      expect(statuses, [OrderLiveStatus.connecting, OrderLiveStatus.live]);
    });

    test('Notice chama onNotice sem repetir o status', () async {
      start();
      source.last
        ..opened()
        ..notice()
        ..notice();
      await pumpEventQueue();

      expect(notices, 2);
      expect(statuses, [OrderLiveStatus.connecting, OrderLiveStatus.live]);
    });

    test('quedas seguidas esperam 1, 2, 4, 8 e 10 s e reconectam', () async {
      start();

      for (var drop = 1; drop <= 5; drop++) {
        source.last.drop();
        await pumpEventQueue();
        expect(source.connections, hasLength(drop));
        expect(delay.pendingCount, 1);

        delay.elapse();
        await pumpEventQueue();
        expect(source.connections, hasLength(drop + 1));
      }

      expect(
        delay.requested,
        const [1, 2, 4, 8, 10].map((s) => Duration(seconds: s)),
      );
      expect(statuses, [
        OrderLiveStatus.connecting,
        OrderLiveStatus.reconnecting,
      ]);
    });

    test('depois de Opened, a queda seguinte volta a 1 s', () async {
      start();
      source.last.drop();
      await pumpEventQueue();
      delay.elapse();
      await pumpEventQueue();
      source.last.drop();
      await pumpEventQueue();
      delay.elapse();
      await pumpEventQueue();

      source.last.opened();
      await pumpEventQueue();
      source.last.drop();
      await pumpEventQueue();

      expect(delay.requested, const [1, 2, 1].map((s) => Duration(seconds: s)));
      expect(statuses, [
        OrderLiveStatus.connecting,
        OrderLiveStatus.reconnecting,
        OrderLiveStatus.live,
        OrderLiveStatus.reconnecting,
      ]);
    });

    test('Refused leva a closed, sem espera nem nova conexão', () async {
      start();
      source.last.refuse(_notFound);
      await pumpEventQueue();

      expect(statuses, [OrderLiveStatus.connecting, OrderLiveStatus.closed]);
      expect(delay.requested, isEmpty);
      expect(source.connections, hasLength(1));
    });

    test('stop cancela a conexão aberta', () async {
      start();
      source.last.opened();
      await pumpEventQueue();

      feed.stop();
      await pumpEventQueue();

      expect(source.last.isCancelled, isTrue);
    });

    test(
      'espera completada depois do stop não abre conexão nem chama callback',
      () async {
        start();
        source.last.drop();
        await pumpEventQueue();
        final before = List.of(statuses);

        feed.stop();
        delay.elapse();
        await pumpEventQueue();

        expect(source.connections, hasLength(1));
        expect(statuses, before);
        expect(notices, 0);
      },
    );

    test('start depois de stop recomeça em connecting e 1 s', () async {
      start();
      source.last.drop();
      await pumpEventQueue();
      delay.elapse();
      await pumpEventQueue();
      source.last.drop();
      await pumpEventQueue();
      feed.stop();
      statuses.clear();

      start();
      source.last.drop();
      await pumpEventQueue();

      expect(statuses, [
        OrderLiveStatus.connecting,
        OrderLiveStatus.reconnecting,
      ]);
      expect(delay.requested.last, const Duration(seconds: 1));
    });
  });
}
