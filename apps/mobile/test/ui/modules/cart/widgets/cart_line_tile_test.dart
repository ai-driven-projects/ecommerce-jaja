import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';
import 'package:mobile/ui/modules/cart/widgets/cart_line_tile.dart';
import 'package:mobile/ui/modules/catalog/view_models/category_art.dart';
import 'package:mobile/ui/shared/widgets/app_button.dart';
import 'package:mobile/ui/shared/widgets/quantity_stepper.dart';

import '../../../../modules/cart/support/cart_fixtures.dart';
import '../../../shared/support/themed.dart';

/// Chamadas recebidas pela linha, na ordem.
class _Calls {
  final List<String> opened = [];
  final List<int> quantities = [];
  int removes = 0;
}

Widget _tile(CartLine line, _Calls calls) => themed(
  Padding(
    padding: const EdgeInsets.all(16),
    child: CartLineTile(
      line: line,
      onOpenProduct: calls.opened.add,
      onChangeQuantity: calls.quantities.add,
      onRemove: () => calls.removes++,
    ),
  ),
);

Finder _increment(CartLine line) =>
    find.bySemanticsLabel(QuantityStepper.incrementLabel(line.name));

Finder _decrement(CartLine line) =>
    find.bySemanticsLabel(QuantityStepper.decrementLabel(line.name));

void main() {
  testWidgets('mostra nome, unidade, preço, quantidade e o total da linha', (
    tester,
  ) async {
    await tester.pumpWidget(_tile(canetaLine, _Calls()));

    expect(find.text('Caneta Esferográfica Azul'), findsOneWidget);
    expect(find.text('unidade'), findsOneWidget);
    expect(find.text('R\$ 12,90'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('R\$ 25,80'), findsOneWidget);
    expect(
      find.text(categoryArtOf(canetaLine.rootCategorySlug).emoji),
      findsOneWidget,
    );
  });

  testWidgets('o total acompanha a quantidade local, não o total da prévia', (
    tester,
  ) async {
    await tester.pumpWidget(_tile(canetaLine.copyWith(quantity: 3), _Calls()));

    expect(find.text('R\$ 38,70'), findsOneWidget);
    expect(find.text('R\$ 25,80'), findsNothing);
  });

  testWidgets('"+" pede a quantidade seguinte e "−" a anterior', (
    tester,
  ) async {
    final calls = _Calls();
    await tester.pumpWidget(_tile(canetaLine, calls));

    await tester.tap(_increment(canetaLine));
    await tester.tap(_decrement(canetaLine));

    expect(calls.quantities, [3, 1]);
  });

  testWidgets('"+" fica desabilitado em 99', (tester) async {
    final line = canetaLine.copyWith(quantity: 99);
    final calls = _Calls();
    await tester.pumpWidget(_tile(line, calls));

    expect(
      tester.getSemantics(_increment(line)),
      isSemantics(hasEnabledState: true, isEnabled: false),
    );

    await tester.tap(_increment(line), warnIfMissed: false);

    expect(calls.quantities, isEmpty);
  });

  testWidgets('"−" em 1 pede quantidade 0', (tester) async {
    final line = canetaLine.copyWith(quantity: 1);
    final calls = _Calls();
    await tester.pumpWidget(_tile(line, calls));

    await tester.tap(_decrement(line));

    expect(calls.quantities, [0]);
  });

  testWidgets('tocar no nome chama onOpenProduct com o slug', (tester) async {
    final calls = _Calls();
    await tester.pumpWidget(_tile(canetaLine, calls));

    await tester.tap(find.text(canetaLine.name));

    expect(calls.opened, ['caneta-esferografica-azul']);
  });

  testWidgets('a lixeira remove o produto', (tester) async {
    final calls = _Calls();
    await tester.pumpWidget(_tile(canetaLine, calls));

    await tester.tap(
      find.byTooltip(CartLineTile.removeTooltip(canetaLine.name)),
    );

    expect(calls.removes, 1);
  });

  testWidgets('indisponível mostra "Indisponível" e "Remover", sem controle '
      'de quantidade nem total', (tester) async {
    final line = unavailableLine.copyWith(quantity: 2);
    final calls = _Calls();
    await tester.pumpWidget(_tile(line, calls));

    expect(find.text(CartLineTile.unavailableLabel), findsOneWidget);
    expect(find.byType(QuantityStepper), findsNothing);
    expect(find.text('R\$ 21,90'), findsOneWidget);
    expect(find.text('R\$ 43,80'), findsNothing);
    expect(find.byTooltip(CartLineTile.removeTooltip(line.name)), findsNothing);

    await tester.tap(find.widgetWithText(AppButton, CartLineTile.removeLabel));

    expect(calls.removes, 1);
  });
}
