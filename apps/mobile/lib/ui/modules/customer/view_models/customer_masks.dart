// Máscaras de digitação dos dados de entrega, cópias de `formatCpf`,
// `formatZipCode` (`apps/frontend/src/modules/customers/data/customer.util.ts`)
// e `formatPhone` (`apps/frontend/src/shared/util/phone.util.ts`). Aceitam
// texto parcial e ignoram tudo que não é dígito. As regras de validade ficam
// nos value objects, que aceitam o texto com ou sem máscara.

String _onlyDigits(String value) => value.replaceAll(RegExp(r'\D'), '');

/// CPF no formato `000.000.000-00`, ignorando o que passar de 11 dígitos.
String formatCpfInput(String value) {
  final digits = _onlyDigits(value);
  final cpf = digits.length > 11 ? digits.substring(0, 11) : digits;
  if (cpf.length <= 3) return cpf;
  if (cpf.length <= 6) return '${cpf.substring(0, 3)}.${cpf.substring(3)}';
  if (cpf.length <= 9) {
    return '${cpf.substring(0, 3)}.${cpf.substring(3, 6)}.${cpf.substring(6)}';
  }
  return '${cpf.substring(0, 3)}.${cpf.substring(3, 6)}.'
      '${cpf.substring(6, 9)}-${cpf.substring(9)}';
}

/// Telefone com DDD: `(11) 99999-9999` com 11 dígitos e `(11) 9999-9999` com
/// 10. Acima de 11 dígitos (a API aceita até 15), só os dígitos, sem máscara.
String formatPhoneInput(String value) {
  final digits = _onlyDigits(value);
  if (digits.length > 11) return digits;
  if (digits.isEmpty) return '';
  if (digits.length <= 2) return '($digits';

  final areaCode = digits.substring(0, 2);
  final number = digits.substring(2);
  if (number.length <= 4) return '($areaCode) $number';

  final split = number.length == 9 ? 5 : 4;
  return '($areaCode) ${number.substring(0, split)}-${number.substring(split)}';
}

/// CEP no formato `60150-160`, ignorando o que passar de 8 dígitos.
String formatZipCodeInput(String value) {
  final digits = _onlyDigits(value);
  final zipCode = digits.length > 8 ? digits.substring(0, 8) : digits;
  if (zipCode.length <= 5) return zipCode;
  return '${zipCode.substring(0, 5)}-${zipCode.substring(5)}';
}
