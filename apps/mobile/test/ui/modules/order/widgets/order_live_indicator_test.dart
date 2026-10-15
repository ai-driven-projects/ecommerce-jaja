import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/order/model/order_live_status.dart';
import 'package:mobile/ui/modules/order/widgets/order_live_indicator.dart';
import 'package:mobile/ui/shared/theme/brand_tokens.dart';

import '../../../shared/support/themed.dart';

Future<BrandTokens> _pump(WidgetTester tester, OrderLiveStatus status) async {
  await tester.pumpWidget(themed(OrderLiveIndicator(status: status)));
  return tester.element(find.byType(OrderLiveIndicator)).tokens;
}

Color? _dotColor(WidgetTester tester) {
  final dot = tester.widget<Container>(
    find.descendant(
      of: find.byType(OrderLiveIndicator),
      matching: find.byType(Container),
    ),
  );
  return (dot.decoration! as BoxDecoration).color;
}

void main() {
  testWidgets('live: "Ao vivo" com o ponto e o texto verdes', (tester) async {
    final tokens = await _pump(tester, OrderLiveStatus.live);

    expect(find.text('Ao vivo'), findsOneWidget);
    expect(find.text(OrderLiveIndicator.reconnectingLabel), findsNothing);
    expect(
      tester.widget<Text>(find.text('Ao vivo')).style!.color,
      tokens.success,
    );
    expect(_dotColor(tester), tokens.success);
  });

  for (final status in [
    OrderLiveStatus.connecting,
    OrderLiveStatus.reconnecting,
  ]) {
    testWidgets('${status.name}: "Reconectando…" com o ponto neutro', (
      tester,
    ) async {
      final tokens = await _pump(tester, status);

      expect(find.text('Reconectando…'), findsOneWidget);
      expect(find.text(OrderLiveIndicator.liveLabel), findsNothing);
      expect(
        tester.widget<Text>(find.text('Reconectando…')).style!.color,
        tokens.mutedInk,
      );
      expect(_dotColor(tester), tokens.placeholder);
    });
  }

  for (final status in [OrderLiveStatus.off, OrderLiveStatus.closed]) {
    testWidgets('${status.name}: nada aparece', (tester) async {
      await _pump(tester, status);

      expect(find.text(OrderLiveIndicator.liveLabel), findsNothing);
      expect(find.text(OrderLiveIndicator.reconnectingLabel), findsNothing);
      expect(
        find.descendant(
          of: find.byType(OrderLiveIndicator),
          matching: find.byType(Container),
        ),
        findsNothing,
      );
    });
  }
}
