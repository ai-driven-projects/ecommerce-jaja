import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/order/model/order_status.dart';
import 'package:mobile/modules/order/usecase/live_order_feed.dart';
import 'package:mobile/ui/modules/order/pages/order_tracking_page.dart';
import 'package:mobile/ui/modules/order/view_models/order_formatters.dart';
import 'package:mobile/ui/modules/order/view_models/order_tracking_view_model.dart';
import 'package:mobile/ui/modules/order/widgets/order_live_indicator.dart';
import 'package:mobile/ui/modules/order/widgets/order_status_badge.dart';
import 'package:mobile/ui/modules/order/widgets/order_timeline_step.dart';
import 'package:mobile/ui/modules/order/widgets/order_tracking_skeleton.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';

import '../../../../modules/order/support/fake_delay.dart';
import '../../../../modules/order/support/fake_order_live_source.dart';
import '../../../../modules/order/support/fake_order_repository.dart';
import '../../../../modules/order/support/order_fixtures.dart';

// A página rola; o viewport cresce para os cartões serem montados e visíveis
// sem rolar (a `ListView` só monta o que está à vista).
const _surface = Size(800, 2400);

final _approvedAt = DateTime.utc(2026, 10, 15, 12, 1, 30);
final _pickingAt = DateTime.utc(2026, 10, 15, 12, 5);
final _outAt = DateTime.utc(2026, 10, 15, 12, 20);
final _deliveredAt = DateTime.utc(2026, 10, 15, 12, 41, 7);

typedef _Live = ({
  FakeOrderRepository orders,
  FakeOrderLiveSource source,
  FakeDelay delay,
});

/// Monta a página como a rota faz, com o ViewModel de verdade sobre o
/// [FakeOrderRepository] e um [LiveOrderFeed] sobre o [FakeOrderLiveSource],
/// com as esperas da reconexão no [FakeDelay]. Sem resposta enfileirada, o
/// pedido vem em `PLACED`.
Future<_Live> _pumpPage(WidgetTester tester) async {
  tester.view.physicalSize = _surface;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final orders = FakeOrderRepository();
  final source = FakeOrderLiveSource();
  final delay = FakeDelay();
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: OrderTrackingPage(
        orderTrackingViewModelFactory: () => OrderTrackingViewModel(
          orders,
          LiveOrderFeed(source, wait: delay.call),
          now: () => fakeOrderPlacedAt.toLocal(),
        ),
        orderId: fakePlacedOrderId,
        onBackToStore: () {},
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (orders: orders, source: source, delay: delay);
}

Finder _inBadge(String label) => find.descendant(
  of: find.byType(OrderStatusBadge),
  matching: find.text(label),
);

/// O fundo do destaque dentro do passo de título [title].
Finder _highlightOf(String title) => find.descendant(
  of: find.ancestor(
    of: find.text(title),
    matching: find.byType(OrderTimelineStep),
  ),
  matching: find.byKey(OrderTimelineStep.highlightKey),
);

/// Leva o app de `resumed` a [target] (ou de volta), passando pelos estados
/// intermediários como a plataforma faz: o binding de teste não os gera e o
/// `AppLifecycleListener` recusa transição que pula estado.
void _goTo(WidgetTester tester, AppLifecycleState target) {
  const order = [
    AppLifecycleState.resumed,
    AppLifecycleState.inactive,
    AppLifecycleState.hidden,
    AppLifecycleState.paused,
  ];
  final current = tester.binding.lifecycleState;
  if (current == null) {
    tester.binding.handleAppLifecycleStateChanged(target);
    return;
  }
  var index = order.indexOf(current);
  final end = order.indexOf(target);
  while (index != end) {
    index += index < end ? 1 : -1;
    tester.binding.handleAppLifecycleStateChanged(order[index]);
  }
}

void _expectNoIndicator() {
  expect(find.text(OrderLiveIndicator.liveLabel), findsNothing);
  expect(find.text(OrderLiveIndicator.reconnectingLabel), findsNothing);
}

void main() {
  group('avisos ao vivo', () {
    testWidgets('"Reconectando…" ao abrir e "Ao vivo" depois de Opened', (
      tester,
    ) async {
      final live = await _pumpPage(tester);

      expect(live.source.connections, hasLength(1));
      expect(live.source.last.orderId, fakePlacedOrderId);
      expect(find.text('Reconectando…'), findsOneWidget);

      live.source.last.opened();
      await tester.pumpAndSettle();

      expect(find.text('Ao vivo'), findsOneWidget);
      expect(find.text(OrderLiveIndicator.reconnectingLabel), findsNothing);
      // A conexão relê o pedido.
      expect(live.orders.findCalls, [fakePlacedOrderId, fakePlacedOrderId]);
    });

    testWidgets('Notice com o pedido em PICKING: "Separando na loja" sem '
        'skeleton', (tester) async {
      final live = await _pumpPage(tester);
      live.source.last.opened();
      await tester.pumpAndSettle();

      final gate = live.orders.holdFind();
      live.source.last.notice();
      await tester.pump();

      expect(live.orders.findCalls, hasLength(3));
      expect(find.byType(OrderTrackingSkeleton), findsNothing);
      expect(_inBadge('Pedido recebido'), findsOneWidget);

      gate.complete(
        Ok(
          fakeOrderDetail(
            id: fakePlacedOrderId,
            status: OrderStatus.picking,
            paymentApprovedAt: _approvedAt,
            pickingStartedAt: _pickingAt,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(OrderTrackingSkeleton), findsNothing);
      expect(_inBadge('Separando na loja'), findsOneWidget);
      expect(find.text('Em andamento…'), findsOneWidget);
      expect(find.text('Ao vivo'), findsOneWidget);
    });

    testWidgets('queda mostra "Reconectando…" e agenda nova tentativa', (
      tester,
    ) async {
      final live = await _pumpPage(tester);
      live.source.last.opened();
      await tester.pumpAndSettle();
      expect(find.text('Ao vivo'), findsOneWidget);

      live.source.last.drop();
      await tester.pumpAndSettle();

      expect(find.text('Reconectando…'), findsOneWidget);
      expect(find.text(OrderLiveIndicator.liveLabel), findsNothing);
      expect(live.delay.requested, [const Duration(seconds: 1)]);
    });
  });

  group('entregue e destaque', () {
    testWidgets('Notice que leva a DELIVERED mostra o aviso de entregue, '
        'esconde o indicador e cancela a conexão', (tester) async {
      final live = await _pumpPage(tester);
      final connection = live.source.last;
      connection.opened();
      await tester.pumpAndSettle();

      live.orders.enqueueFind(
        Ok(
          fakeOrderDetail(
            id: fakePlacedOrderId,
            status: OrderStatus.delivered,
            paymentApprovedAt: _approvedAt,
            pickingStartedAt: _pickingAt,
            outForDeliveryAt: _outAt,
            deliveredAt: _deliveredAt,
          ),
        ),
      );
      connection.notice();
      await tester.pumpAndSettle();

      expect(
        find.text(
          'Pedido entregue às ${formatOrderTime(_deliveredAt.toLocal())}. '
          'Obrigado por comprar no já já!',
        ),
        findsOneWidget,
      );
      _expectNoIndicator();
      expect(connection.isCancelled, isTrue);
      expect(live.source.connections, hasLength(1));
      expect(live.delay.requested, isEmpty);
    });

    testWidgets('o passo concluído com a tela aberta tem o destaque; os que '
        'já estavam concluídos, não', (tester) async {
      final live = await _pumpPage(tester);
      live.source.last.opened();
      await tester.pumpAndSettle();
      expect(find.byKey(OrderTimelineStep.highlightKey), findsNothing);

      live.orders.enqueueFind(
        Ok(
          fakeOrderDetail(
            id: fakePlacedOrderId,
            status: OrderStatus.paymentApproved,
            paymentApprovedAt: _approvedAt,
          ),
        ),
      );
      live.source.last.notice();
      await tester.pump();
      await tester.pump();

      expect(_inBadge('Pagamento aprovado'), findsOneWidget);
      expect(_highlightOf('Pagamento aprovado'), findsOneWidget);
      expect(_highlightOf('Pedido recebido'), findsNothing);
      expect(find.byKey(OrderTimelineStep.highlightKey), findsOneWidget);

      // O fundo some até o fim da animação.
      await tester.pump(OrderTimelineStep.highlightDuration);
      final box = tester.widget<DecoratedBox>(
        find.byKey(OrderTimelineStep.highlightKey),
      );
      expect((box.decoration as BoxDecoration).color!.a, 0);
    });

    testWidgets('com as animações desligadas, o destaque não aparece', (
      tester,
    ) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(
        tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );

      final live = await _pumpPage(tester);
      live.source.last.opened();
      await tester.pumpAndSettle();

      live.orders.enqueueFind(
        Ok(
          fakeOrderDetail(
            id: fakePlacedOrderId,
            status: OrderStatus.paymentApproved,
            paymentApprovedAt: _approvedAt,
          ),
        ),
      );
      live.source.last.notice();
      await tester.pump();
      await tester.pump();

      expect(_inBadge('Pagamento aprovado'), findsOneWidget);
      expect(find.byKey(OrderTimelineStep.highlightKey), findsNothing);
    });
  });

  group('ciclo de vida', () {
    testWidgets('segundo plano cancela a conexão e esconde o indicador; a '
        'volta abre outra e relê o pedido', (tester) async {
      _goTo(tester, AppLifecycleState.resumed);
      addTearDown(() => _goTo(tester, AppLifecycleState.resumed));
      final live = await _pumpPage(tester);
      final first = live.source.last;
      first.opened();
      await tester.pumpAndSettle();
      expect(find.text('Ao vivo'), findsOneWidget);
      final readsBefore = live.orders.findCalls.length;

      _goTo(tester, AppLifecycleState.paused);
      // Em segundo plano o binding não agenda quadros; força um para ver o
      // que a tela desenharia.
      tester.binding.scheduleForcedFrame();
      await tester.pump();

      expect(first.isCancelled, isTrue);
      _expectNoIndicator();
      expect(live.source.connections, hasLength(1));
      expect(live.orders.findCalls, hasLength(readsBefore));

      _goTo(tester, AppLifecycleState.resumed);
      await tester.pumpAndSettle();

      expect(live.source.connections, hasLength(2));
      expect(live.source.last.isCancelled, isFalse);
      expect(find.text('Reconectando…'), findsOneWidget);

      live.source.last.opened();
      await tester.pumpAndSettle();

      expect(find.text('Ao vivo'), findsOneWidget);
      expect(live.orders.findCalls, hasLength(readsBefore + 1));
      expect(live.delay.requested, isEmpty);
    });

    testWidgets('desmontar a página cancela a conexão', (tester) async {
      final live = await _pumpPage(tester);
      final connection = live.source.last;
      connection.opened();
      await tester.pumpAndSettle();

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();

      expect(connection.isCancelled, isTrue);
      expect(live.source.connections, hasLength(1));
    });
  });
}
