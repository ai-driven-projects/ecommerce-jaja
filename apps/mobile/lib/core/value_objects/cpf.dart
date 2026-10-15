import '../errors/app_failure.dart';
import '../result.dart';

/// CPF guardado só com os 11 dígitos. Regras de `Cpf` em
/// `packages/shared/src/vo/cpf.vo.ts`, na mesma ordem; mensagens `CPF_*` de
/// `apps/frontend/src/shared/i18n/messages.pt.ts` (todas "CPF inválido.").
final class Cpf {
  const Cpf._(this.value);

  static const _digitCount = 11;
  static const _mod11Base = 11;

  static final _acceptedChars = RegExp(r'^[0-9.\- ]+$');
  static final _nonDigit = RegExp(r'\D');

  final String value;

  /// `529.982.247-25`.
  String get formatted =>
      '${value.substring(0, 3)}.${value.substring(3, 6)}.'
      '${value.substring(6, 9)}-${value.substring(9, 11)}';

  static Result<Cpf> create(String input) {
    final text = input.trim();
    if (!_acceptedChars.hasMatch(text)) {
      return _invalid(CpfCode.invalidFormat);
    }

    final digits = text.replaceAll(_nonDigit, '');
    if (digits.length != _digitCount) return _invalid(CpfCode.invalidLength);

    if (digits.split('').toSet().length == 1) {
      return _invalid(CpfCode.repeatedSequence);
    }

    final first = _checkDigit(digits, 9);
    final second = _checkDigit(digits, 10);
    if (first != int.parse(digits[9]) || second != int.parse(digits[10])) {
      return _invalid(CpfCode.invalidCheckDigit);
    }

    return Ok(Cpf._(digits));
  }

  static int _checkDigit(String digits, int length) {
    var sum = 0;
    for (var i = 0; i < length; i++) {
      sum += int.parse(digits[i]) * (length + 1 - i);
    }
    final rest = (sum * 10) % _mod11Base;
    return rest == 10 ? 0 : rest;
  }

  static Failure<Cpf> _invalid(CpfCode code) =>
      Failure(ValidationFailure(message: 'CPF inválido.', code: code));

  @override
  bool operator ==(Object other) => other is Cpf && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => 'Cpf($value)';
}
