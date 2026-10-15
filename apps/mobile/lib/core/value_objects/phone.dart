import '../errors/app_failure.dart';
import '../result.dart';

/// Telefone guardado só com os dígitos (8 a 15). Regras de `Phone` em
/// `packages/shared/src/vo/phone.vo.ts`, na mesma ordem; mensagens `PHONE_*`
/// de `apps/frontend/src/shared/i18n/messages.pt.ts` (todas "Telefone
/// inválido.").
final class Phone {
  const Phone._(this.value);

  static const minDigits = 8;
  static const maxDigits = 15;

  static final _acceptedChars = RegExp(r'^\+?[0-9.\-/ ()]+$');
  static final _nonDigit = RegExp(r'\D');

  final String value;

  static Result<Phone> create(String input) {
    final text = input.trim();
    if (!_acceptedChars.hasMatch(text)) {
      return _invalid(PhoneCode.invalidFormat);
    }

    final digits = text.replaceAll(_nonDigit, '');
    if (digits.length < minDigits || digits.length > maxDigits) {
      return _invalid(PhoneCode.invalidLength);
    }

    return Ok(Phone._(digits));
  }

  static Failure<Phone> _invalid(PhoneCode code) =>
      Failure(ValidationFailure(message: 'Telefone inválido.', code: code));

  @override
  bool operator ==(Object other) => other is Phone && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => 'Phone($value)';
}
