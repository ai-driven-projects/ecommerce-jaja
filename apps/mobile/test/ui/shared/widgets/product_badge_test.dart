import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/theme/brand_tokens.dart';
import 'package:mobile/ui/shared/widgets/product_badge.dart';

import '../support/themed.dart';

Text _label(WidgetTester tester, String label) =>
    tester.widget<Text>(find.text(label));

ShapeDecoration _decoration(WidgetTester tester) =>
    tester
            .widget<DecoratedBox>(
              find.descendant(
                of: find.byType(ProductBadge),
                matching: find.byType(DecoratedBox),
              ),
            )
            .decoration
        as ShapeDecoration;

void main() {
  testWidgets('variante da marca: texto da marca sobre branco', (tester) async {
    await tester.pumpWidget(themed(const ProductBadge(label: 'Em destaque')));

    final context = tester.element(find.byType(ProductBadge));
    final tokens = context.tokens;
    final style = _label(tester, 'Em destaque').style!;
    expect(
      style,
      Theme.of(context).textTheme.labelSmall!.copyWith(color: tokens.brand),
    );
    expect(_decoration(tester).color, tokens.card);
    expect(_decoration(tester).shadows, tokens.shadowBadge);
  });

  testWidgets('variante sólida: texto claro sobre a marca', (tester) async {
    await tester.pumpWidget(
      themed(
        const ProductBadge(label: '−30%', variant: ProductBadgeVariant.solid),
      ),
    );

    final context = tester.element(find.byType(ProductBadge));
    final tokens = context.tokens;
    expect(
      _label(tester, '−30%').style,
      Theme.of(context).textTheme.labelSmall!.copyWith(color: tokens.onBrand),
    );
    expect(_decoration(tester).color, tokens.brand);
    expect(_decoration(tester).shadows, isNull);
  });
}
