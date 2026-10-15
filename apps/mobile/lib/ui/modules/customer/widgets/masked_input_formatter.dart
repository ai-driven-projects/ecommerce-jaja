import 'package:flutter/services.dart';

/// Aplica uma máscara de `customer_masks.dart` a cada digitação e põe o
/// cursor no fim do texto, o que basta para digitar e apagar no fim do campo.
class MaskedInputFormatter extends TextInputFormatter {
  const MaskedInputFormatter(this.format);

  /// Máscara sobre o texto parcial (ex.: `formatCpfInput`).
  final String Function(String value) format;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final text = format(newValue.text);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
