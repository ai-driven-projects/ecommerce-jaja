import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/modules/catalog/widgets/section_heading.dart';

import '../../../shared/support/themed.dart';

void main() {
  testWidgets('sem ação, só o título', (tester) async {
    await tester.pumpWidget(
      themed(const SectionHeading(title: 'Categorias em destaque')),
    );

    expect(find.text('Categorias em destaque'), findsOneWidget);
    expect(find.text('Ver tudo →'), findsNothing);
  });

  testWidgets('com ação, "Ver tudo →" é botão e o toque chama o callback', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    var taps = 0;
    await tester.pumpWidget(
      themed(SectionHeading(title: 'Em destaque', onSeeAll: () => taps++)),
    );

    expect(find.text('Em destaque'), findsOneWidget);
    expect(
      tester.getSemantics(find.text('Ver tudo →')),
      isSemantics(label: 'Ver tudo →', isButton: true),
    );

    await tester.tap(find.text('Ver tudo →'));
    expect(taps, 1);
    handle.dispose();
  });
}
