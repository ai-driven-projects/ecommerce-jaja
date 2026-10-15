import 'package:flutter/material.dart';

import '../../../../modules/customer/errors/customer_errors.dart';
import '../../../../modules/customer/model/customer_rules.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../view_models/customer_masks.dart';
import 'customer_field_bindings.dart';
import 'masked_input_formatter.dart';

/// Campos do endereço de entrega em uma coluna, com os rótulos e exemplos de
/// `customer-address-fields.component.tsx`: CEP com máscara, logradouro,
/// número, complemento (opcional), bairro, cidade e UF (duas letras, em
/// maiúsculas). Os textos têm `maxLength` pelos limites da API.
class AddressFields extends StatelessWidget {
  const AddressFields({super.key, required this.bindings});

  static const String zipCodeLabel = 'CEP';
  static const String zipCodeHint = '00000-000';
  static const String streetLabel = 'Logradouro';
  static const String streetHint = 'Ex.: Av. Santos Dumont';
  static const String numberLabel = 'Número';
  static const String numberHint = '1500 ou S/N';
  static const String complementLabel = 'Complemento';
  static const String complementHint =
      'Opcional · Ex.: Torre B · 12º andar · sala 1204';
  static const String neighborhoodLabel = 'Bairro';
  static const String neighborhoodHint = 'Ex.: Bela Vista';
  static const String cityLabel = 'Cidade';
  static const String cityHint = 'Ex.: São Paulo';
  static const String stateLabel = 'UF';
  static const String stateHint = 'Ex.: SP';

  final CustomerFieldBindings bindings;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _field(
          CustomerField.zipCode,
          label: zipCodeLabel,
          hint: zipCodeHint,
          keyboardType: TextInputType.number,
          inputFormatters: const [MaskedInputFormatter(formatZipCodeInput)],
          autofillHints: const [AutofillHints.postalCode],
        ),
        _field(
          CustomerField.street,
          label: streetLabel,
          hint: streetHint,
          maxLength: customerStreetLength.max,
          autofillHints: const [AutofillHints.streetAddressLine1],
        ),
        _field(
          CustomerField.number,
          label: numberLabel,
          hint: numberHint,
          maxLength: customerNumberLength.max,
        ),
        _field(
          CustomerField.complement,
          label: complementLabel,
          hint: complementHint,
          maxLength: customerComplementLength.max,
        ),
        _field(
          CustomerField.neighborhood,
          label: neighborhoodLabel,
          hint: neighborhoodHint,
          maxLength: customerNeighborhoodLength.max,
        ),
        _field(
          CustomerField.city,
          label: cityLabel,
          hint: cityHint,
          maxLength: customerCityLength.max,
          autofillHints: const [AutofillHints.addressCity],
        ),
        _field(
          CustomerField.state,
          label: stateLabel,
          hint: stateHint,
          maxLength: 2,
          textCapitalization: TextCapitalization.characters,
          inputFormatters: const [MaskedInputFormatter(_upperCase)],
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.addressState],
          last: true,
        ),
      ],
    );
  }

  Widget _field(
    CustomerField field, {
    required String label,
    required String hint,
    TextInputType? keyboardType,
    int? maxLength,
    TextCapitalization textCapitalization = TextCapitalization.sentences,
    List<MaskedInputFormatter>? inputFormatters,
    TextInputAction textInputAction = TextInputAction.next,
    Iterable<String>? autofillHints,
    bool last = false,
  }) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : AppSpacing.s16),
      child: AppTextField(
        label: label,
        hintText: hint,
        controller: bindings.controllerOf(field),
        onChanged: (value) => bindings.onChanged(field, value),
        errorText: bindings.errorOf(field),
        keyboardType: keyboardType,
        textInputAction: textInputAction,
        maxLength: maxLength,
        textCapitalization: textCapitalization,
        inputFormatters: inputFormatters,
        enabled: bindings.enabled,
        autofillHints: autofillHints,
      ),
    );
  }
}

String _upperCase(String value) => value.toUpperCase();
