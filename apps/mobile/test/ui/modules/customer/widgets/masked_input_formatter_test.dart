import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/modules/customer/view_models/customer_masks.dart';
import 'package:mobile/ui/modules/customer/widgets/masked_input_formatter.dart';
import 'package:mobile/ui/shared/widgets/app_text_field.dart';

import '../../../shared/support/themed.dart';

TextEditingValue _type(String text, {int? cursor}) =>
    const MaskedInputFormatter(formatCpfInput).formatEditUpdate(
      TextEditingValue.empty,
      TextEditingValue(
        text: text,
        selection: TextSelection.collapsed(offset: cursor ?? text.length),
      ),
    );

void main() {
  test('aplica a máscara e põe o cursor no fim', () {
    final value = _type('5299822');

    expect(value.text, '529.982.2');
    expect(value.selection, const TextSelection.collapsed(offset: 9));
  });

  test('cursor no meio também vai para o fim', () {
    final value = _type('52998224725', cursor: 3);

    expect(value.text, '529.982.247-25');
    expect(value.selection, const TextSelection.collapsed(offset: 14));
  });

  testWidgets('no AppTextField, digitar entrega o texto mascarado', (
    tester,
  ) async {
    final typed = <String>[];
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      themed(
        AppTextField(
          label: 'Telefone',
          controller: controller,
          onChanged: typed.add,
          inputFormatters: const [MaskedInputFormatter(formatPhoneInput)],
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), '85999998888');

    expect(typed.last, '(85) 99999-8888');
    expect(controller.selection, const TextSelection.collapsed(offset: 15));
  });
}
