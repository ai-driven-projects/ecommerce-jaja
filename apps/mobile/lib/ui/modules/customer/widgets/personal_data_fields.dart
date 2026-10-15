import 'package:flutter/material.dart';

import '../../../../modules/customer/errors/customer_errors.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../view_models/customer_masks.dart';
import 'customer_field_bindings.dart';
import 'masked_input_formatter.dart';

/// CPF e telefone, com as máscaras e os exemplos do "Minha conta" do web.
class PersonalDataFields extends StatelessWidget {
  const PersonalDataFields({super.key, required this.bindings});

  static const String cpfLabel = 'CPF';
  static const String cpfHint = '000.000.000-00';
  static const String phoneLabel = 'Telefone';
  static const String phoneHint = '(11) 99999-9999';

  final CustomerFieldBindings bindings;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _field(
          CustomerField.cpf,
          label: cpfLabel,
          hint: cpfHint,
          keyboardType: TextInputType.number,
          format: formatCpfInput,
        ),
        const SizedBox(height: AppSpacing.s16),
        _field(
          CustomerField.phone,
          label: phoneLabel,
          hint: phoneHint,
          keyboardType: TextInputType.phone,
          format: formatPhoneInput,
          autofillHints: const [AutofillHints.telephoneNumberNational],
        ),
      ],
    );
  }

  Widget _field(
    CustomerField field, {
    required String label,
    required String hint,
    required TextInputType keyboardType,
    required String Function(String value) format,
    Iterable<String>? autofillHints,
  }) {
    return AppTextField(
      label: label,
      hintText: hint,
      controller: bindings.controllerOf(field),
      onChanged: (value) => bindings.onChanged(field, value),
      errorText: bindings.errorOf(field),
      keyboardType: keyboardType,
      textInputAction: TextInputAction.next,
      inputFormatters: [MaskedInputFormatter(format)],
      enabled: bindings.enabled,
      autofillHints: autofillHints,
    );
  }
}
