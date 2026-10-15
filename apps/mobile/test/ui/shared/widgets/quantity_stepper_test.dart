import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/widgets/quantity_stepper.dart';

import '../support/themed.dart';

const _name = 'Caneta Azul';

Widget _stepper({
  int quantity = 2,
  VoidCallback? onDecrement,
  VoidCallback? onIncrement,
  QuantityStepperSize size = QuantityStepperSize.compact,
}) => themed(
  Center(
    child: QuantityStepper(
      quantity: quantity,
      itemName: _name,
      onDecrement: onDecrement,
      onIncrement: onIncrement,
      size: size,
    ),
  ),
);

Finder get _decrement =>
    find.bySemanticsLabel(QuantityStepper.decrementLabel(_name));

Finder get _increment =>
    find.bySemanticsLabel(QuantityStepper.incrementLabel(_name));

void main() {
  testWidgets('mostra a quantidade e os rótulos com o nome do item', (
    tester,
  ) async {
    await tester.pumpWidget(_stepper(onDecrement: () {}, onIncrement: () {}));

    expect(find.text('2'), findsOneWidget);
    expect(_decrement, findsOneWidget);
    expect(_increment, findsOneWidget);
    expect(
      QuantityStepper.decrementLabel(_name),
      'Diminuir quantidade de Caneta Azul',
    );
    expect(
      QuantityStepper.incrementLabel(_name),
      'Aumentar quantidade de Caneta Azul',
    );
  });

  testWidgets('cada toque chama o callback do botão', (tester) async {
    final calls = <String>[];
    await tester.pumpWidget(
      _stepper(
        onDecrement: () => calls.add('-'),
        onIncrement: () => calls.add('+'),
      ),
    );

    await tester.tap(_increment);
    await tester.tap(_increment);
    await tester.tap(_decrement);

    expect(calls, ['+', '+', '-']);
  });

  testWidgets('onIncrement null desabilita só o "+"', (tester) async {
    var decrements = 0;
    await tester.pumpWidget(
      _stepper(quantity: 99, onDecrement: () => decrements++),
    );

    expect(
      tester.getSemantics(_increment),
      isSemantics(isButton: true, hasEnabledState: true, isEnabled: false),
    );
    expect(
      tester.getSemantics(_decrement),
      isSemantics(isButton: true, hasEnabledState: true, isEnabled: true),
    );

    await tester.tap(_increment, warnIfMissed: false);
    await tester.tap(_decrement);

    expect(decrements, 1);
    expect(find.text('99'), findsOneWidget);
  });

  testWidgets('os botões têm alvo de toque de pelo menos 44 nos dois '
      'tamanhos', (tester) async {
    for (final size in QuantityStepperSize.values) {
      await tester.pumpWidget(
        _stepper(onDecrement: () {}, onIncrement: () {}, size: size),
      );

      final box = tester.getSize(_increment);
      expect(box.width, greaterThanOrEqualTo(QuantityStepper.minTapTarget));
      expect(box.height, greaterThanOrEqualTo(QuantityStepper.minTapTarget));
    }
  });
}
