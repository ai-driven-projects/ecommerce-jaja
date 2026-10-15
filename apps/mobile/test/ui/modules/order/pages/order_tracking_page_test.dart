import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/order/model/order_entity.dart';
import 'package:mobile/modules/order/model/order_status.dart';
import 'package:mobile/modules/order/usecase/live_order_feed.dart';
import 'package:mobile/ui/modules/order/pages/order_tracking_page.dart';
import 'package:mobile/ui/modules/order/view_models/order_formatters.dart';
import 'package:mobile/ui/modules/order/view_models/order_tracking_view_model.dart';
import 'package:mobile/ui/modules/order/widgets/order_header.dart';
import 'package:mobile/ui/modules/order/widgets/order_instructions_card.dart';
import 'package:mobile/ui/modules/order/widgets/order_items_card.dart';
import 'package:mobile/ui/modules/order/widgets/order_status_badge.dart';
import 'package:mobile/ui/modules/order/widgets/order_timeline.dart';
import 'package:mobile/ui/modules/order/widgets/order_tracking_skeleton.dart';
import 'package:mobile/ui/shared/formatters/money_formatter.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/state_error_banner.dart';

import '../../../../modules/order/support/fake_order_live_source.dart';
import '../../../../modules/order/support/fake_order_repository.dart';
import '../../../../modules/order/support/order_fixtures.dart';
import '../../../shared/support/money.dart';

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

// A página rola; o viewport cresce para os cartões serem montados e visíveis
// sem rolar (a `ListView` só monta o que está à vista).
const _surface = Size(800, 2400);

const _pullToRefresh = Offset(0, 900);

/// "Agora" dos testes: o mesmo instante do pedido, no fuso da máquina.
final _now = fakeOrderPlacedAt.toLocal();

final _approvedAt = DateTime.utc(2026, 10, 15, 12, 1, 30);
final _pickingAt = DateTime.utc(2026, 10, 15, 12, 5);
final _outAt = DateTime.utc(2026, 10, 15, 12, 20);
final _deliveredAt = DateTime.utc(2026, 10, 15, 12, 41, 7);

/// Monta a página como a rota faz: a fábrica cria o ViewModel de verdade
/// sobre o [FakeOrderRepository], com o relógio em [_now]. [prepare] enfileira
/// as respostas antes da primeira leitura.
Future<FakeOrderRepository> _pumpPage(
  WidgetTester tester, {
  void Function(FakeOrderRepository orders)? prepare,
  VoidCallback? onBackToStore,
  bool settle = true,
}) async {
  tester.view.physicalSize = _surface;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final orders = FakeOrderRepository();
  prepare?.call(orders);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: OrderTrackingPage(
        orderTrackingViewModelFactory: () => OrderTrackingViewModel(
          orders,
          LiveOrderFeed(FakeOrderLiveSource()),
          now: () => _now,
        ),
        orderId: fakePlacedOrderId,
        onBackToStore: onBackToStore ?? () {},
      ),
    ),
  );
  if (settle) await tester.pumpAndSettle();
  return orders;
}

Finder _inBadge(String label) => find.descendant(
  of: find.byType(OrderStatusBadge),
  matching: find.text(label),
);

void main() {
  group('cabeçalho', () {
    testWidgets('número, selo, "Feito hoje", endereço e quem recebe', (
      tester,
    ) async {
      final orders = await _pumpPage(tester);

      expect(orders.findCalls, [fakePlacedOrderId]);
      expect(find.text('Pedido #3F1C9A52'), findsOneWidget);
      expect(_inBadge('Pedido recebido'), findsOneWidget);
      expect(
        find.text(formatOrderPlacedAt(fakeOrderPlacedAt.toLocal(), _now)),
        findsOneWidget,
      );
      expect(find.textContaining('Feito hoje às '), findsOneWidget);
      expect(
        find.text(
          'Avenida Santos Dumont, 1500 · Sala 3 · Aldeota · Fortaleza/CE',
        ),
        findsOneWidget,
      );
      expect(find.text('Quem recebe: Maria Souza'), findsOneWidget);
      expect(
        find.text(OrderHeader.recipientLabel('Maria Souza')),
        findsOneWidget,
      );
    });
  });

  group('linha do tempo', () {
    testWidgets(
      'PAYMENT_APPROVED: as duas horas, "Em andamento…" e dois "Aguardando"',
      (tester) async {
        await _pumpPage(
          tester,
          prepare: (orders) => orders.enqueueFind(
            Ok(
              fakeOrderDetail(
                id: fakePlacedOrderId,
                status: OrderStatus.paymentApproved,
                paymentApprovedAt: _approvedAt,
              ),
            ),
          ),
        );

        expect(find.text(OrderTimeline.title), findsOneWidget);
        expect(
          find.text(formatOrderTimeWithSeconds(fakeOrderPlacedAt.toLocal())),
          findsOneWidget,
        );
        expect(
          find.text(formatOrderTimeWithSeconds(_approvedAt.toLocal())),
          findsOneWidget,
        );
        expect(find.text(OrderTimeline.currentDetail), findsOneWidget);
        expect(find.text('Em andamento…'), findsOneWidget);
        expect(find.text('Aguardando'), findsNWidgets(2));
        expect(_inBadge('Pagamento aprovado'), findsOneWidget);
        expect(find.textContaining('Pedido entregue às'), findsNothing);
      },
    );

    testWidgets('DELIVERED: o aviso de entregue e nenhum "Em andamento…"', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        prepare: (orders) => orders.enqueueFind(
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
        ),
      );

      expect(
        find.text(
          'Pedido entregue às ${formatOrderTime(_deliveredAt.toLocal())}. '
          'Obrigado por comprar no já já!',
        ),
        findsOneWidget,
      );
      expect(find.text('Em andamento…'), findsNothing);
      expect(find.text('Aguardando'), findsNothing);
      expect(_inBadge('Entregue'), findsOneWidget);
      for (final date in [_approvedAt, _pickingAt, _outAt, _deliveredAt]) {
        expect(
          find.text(formatOrderTimeWithSeconds(date.toLocal())),
          findsOneWidget,
        );
      }
    });
  });

  group('itens e totais', () {
    testWidgets('as duas linhas e os totais gravados, sem instruções', (
      tester,
    ) async {
      await _pumpPage(tester);

      expect(find.text(OrderItemsCard.title), findsOneWidget);
      expect(find.text('Banana prata'), findsOneWidget);
      expect(find.text('× 2'), findsOneWidget);
      expect(find.text(formatMoney(money(1398))), findsOneWidget);
      expect(find.text('Leite integral 1 L'), findsOneWidget);
      expect(find.text('× 1'), findsOneWidget);
      expect(find.text(formatMoney(money(549))), findsOneWidget);

      expect(find.text('Subtotal'), findsOneWidget);
      expect(find.text('R\$ 19,47'), findsOneWidget);
      expect(find.text('Entrega de bike'), findsOneWidget);
      expect(find.text('R\$ 7,99'), findsOneWidget);
      expect(find.text('Total'), findsOneWidget);
      expect(find.text('R\$ 27,46'), findsOneWidget);
      expect(find.text('Pagamento simulado'), findsOneWidget);
      expect(find.text(OrderItemsCard.freeLabel), findsNothing);

      expect(find.byType(OrderInstructionsCard), findsNothing);
      expect(find.text(OrderInstructionsCard.title), findsNothing);
    });

    testWidgets('frete 0 mostra "Grátis" e as instruções aparecem', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        prepare: (orders) => orders.enqueueFind(
          Ok(
            fakeOrderDetail(
              id: fakePlacedOrderId,
              deliveryInstructions: 'Deixar na recepção',
            ).copyWith(deliveryFee: money(0), total: money(1947)),
          ),
        ),
      );

      expect(find.text('Grátis'), findsOneWidget);
      expect(find.text('R\$ 7,99'), findsNothing);
      expect(find.text('Instruções para o entregador'), findsOneWidget);
      expect(find.text('Deixar na recepção'), findsOneWidget);
    });
  });

  group('estados', () {
    testWidgets('mostra o skeleton até a primeira resposta', (tester) async {
      late Completer<Result<OrderDetail>> gate;
      await _pumpPage(
        tester,
        prepare: (orders) => gate = orders.holdFind(),
        settle: false,
      );
      await tester.pump();

      expect(find.byType(OrderTrackingSkeleton), findsOneWidget);
      expect(find.byType(OrderHeader), findsNothing);

      gate.complete(Ok(fakeOrderDetail(id: fakePlacedOrderId)));
      await tester.pumpAndSettle();

      expect(find.byType(OrderTrackingSkeleton), findsNothing);
      expect(find.text('Pedido #3F1C9A52'), findsOneWidget);
    });

    testWidgets('404: "Pedido não encontrado." e "Voltar para a loja"', (
      tester,
    ) async {
      var backToStore = 0;
      await _pumpPage(
        tester,
        prepare: (orders) => orders.enqueueFind(const Failure(_notFound)),
        onBackToStore: () => backToStore++,
      );

      expect(find.text(OrderTrackingPage.notFoundTitle), findsOneWidget);
      expect(find.text('Pedido não encontrado.'), findsOneWidget);
      expect(find.byType(StateErrorBanner), findsNothing);

      await tester.tap(find.text('Voltar para a loja'));
      await tester.pump();

      expect(backToStore, 1);
    });

    testWidgets('500: banner e "Tentar de novo" mostra o pedido', (
      tester,
    ) async {
      final orders = await _pumpPage(
        tester,
        prepare: (orders) => orders.enqueueFind(const Failure(_serverDown)),
      );

      expect(find.byType(StateErrorBanner), findsOneWidget);
      expect(find.text(OrderTrackingPage.errorTitle), findsOneWidget);
      expect(find.text(_serverDown.message), findsOneWidget);
      expect(find.text(OrderTrackingPage.notFoundTitle), findsNothing);

      await tester.tap(find.text('Tentar de novo'));
      await tester.pumpAndSettle();

      expect(orders.findCalls, [fakePlacedOrderId, fakePlacedOrderId]);
      expect(find.byType(StateErrorBanner), findsNothing);
      expect(find.text('Pedido #3F1C9A52'), findsOneWidget);
    });

    testWidgets('puxar a tela pede de novo e mostra o status novo', (
      tester,
    ) async {
      final orders = await _pumpPage(tester);
      expect(_inBadge('Pedido recebido'), findsOneWidget);

      orders.enqueueFind(
        Ok(
          fakeOrderDetail(
            id: fakePlacedOrderId,
            status: OrderStatus.picking,
            paymentApprovedAt: _approvedAt,
            pickingStartedAt: _pickingAt,
          ),
        ),
      );
      await tester.fling(find.byType(ListView), _pullToRefresh, 1000);
      await tester.pumpAndSettle();

      expect(orders.findCalls, [fakePlacedOrderId, fakePlacedOrderId]);
      expect(_inBadge('Separando na loja'), findsOneWidget);
      expect(_inBadge('Pedido recebido'), findsNothing);
      expect(find.text('Em andamento…'), findsOneWidget);
      expect(find.text('Aguardando'), findsOneWidget);
    });
  });
}
