import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/widgets/app_text_field.dart';

import '../support/themed.dart';

void main() {
  testWidgets('o rótulo aparece acima do campo', (tester) async {
    await tester.pumpWidget(themed(const AppTextField(label: 'E-mail')));

    expect(find.text('E-mail'), findsOneWidget);
    expect(
      tester.getBottomLeft(find.text('E-mail')).dy,
      lessThanOrEqualTo(tester.getTopLeft(find.byType(TextField)).dy),
    );
  });

  testWidgets('digitar entrega o texto a onChanged', (tester) async {
    final typed = <String>[];
    await tester.pumpWidget(
      themed(AppTextField(label: 'E-mail', onChanged: typed.add)),
    );

    await tester.enterText(find.byType(TextField), 'ana@jaja.com');
    expect(typed.last, 'ana@jaja.com');
  });

  testWidgets('com erro, mensagem abaixo e borda em #C93A31', (tester) async {
    await tester.pumpWidget(
      themed(
        const AppTextField(
          label: 'E-mail',
          errorText: 'Informe um e-mail válido.',
        ),
      ),
    );

    final message = find.text('Informe um e-mail válido.');
    expect(message, findsOneWidget);
    expect(tester.widget<Text>(message).style!.color!.toARGB32(), 0xFFC93A31);
    expect(
      tester.getTopLeft(message).dy,
      greaterThan(tester.getTopLeft(find.byType(InputDecorator)).dy),
    );

    final decoration = tester
        .widget<InputDecorator>(find.byType(InputDecorator))
        .decoration;
    expect(decoration.errorText, 'Informe um e-mail válido.');
    expect(decoration.errorBorder!.borderSide.color.toARGB32(), 0xFFC93A31);
  });

  testWidgets('obscureText é repassado ao TextField', (tester) async {
    await tester.pumpWidget(
      themed(const AppTextField(label: 'Senha', obscureText: true)),
    );

    expect(
      tester.widget<TextField>(find.byType(TextField)).obscureText,
      isTrue,
    );
  });
}
