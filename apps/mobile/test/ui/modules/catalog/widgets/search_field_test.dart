import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/modules/catalog/widgets/search_field.dart';

import '../../../shared/support/themed.dart';

Widget _field(
  TextEditingController controller, {
  ValueChanged<String>? onChanged,
  ValueChanged<String>? onSubmitted,
  VoidCallback? onClear,
}) => themed(
  SearchField(
    controller: controller,
    onChanged: onChanged ?? (_) {},
    onSubmitted: onSubmitted ?? (_) {},
    onClear: onClear ?? () {},
  ),
);

void main() {
  late TextEditingController controller;

  setUp(() => controller = TextEditingController());
  tearDown(() => controller.dispose());

  testWidgets('mostra a dica "Buscar produtos" com o campo vazio', (
    tester,
  ) async {
    await tester.pumpWidget(_field(controller));

    expect(find.text('Buscar produtos'), findsOneWidget);
    expect(find.byIcon(Icons.search), findsOneWidget);
  });

  testWidgets('"Limpar busca" só aparece com texto e chama o callback', (
    tester,
  ) async {
    final changes = <String>[];
    var clears = 0;
    await tester.pumpWidget(
      _field(controller, onChanged: changes.add, onClear: () => clears++),
    );

    expect(find.byTooltip('Limpar busca'), findsNothing);

    await tester.enterText(find.byType(TextField), 'caneta');
    await tester.pump();

    expect(changes, ['caneta']);
    expect(find.byTooltip('Limpar busca'), findsOneWidget);

    await tester.tap(find.byTooltip('Limpar busca'));
    expect(clears, 1);

    controller.clear();
    await tester.pump();
    expect(find.byTooltip('Limpar busca'), findsNothing);
  });

  testWidgets('confirmar pelo teclado chama onSubmitted com o texto', (
    tester,
  ) async {
    final submitted = <String>[];
    await tester.pumpWidget(_field(controller, onSubmitted: submitted.add));

    await tester.enterText(find.byType(TextField), 'toner');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pump();

    expect(submitted, ['toner']);
    expect(
      tester.widget<TextField>(find.byType(TextField)).textInputAction,
      TextInputAction.search,
    );
  });
}
