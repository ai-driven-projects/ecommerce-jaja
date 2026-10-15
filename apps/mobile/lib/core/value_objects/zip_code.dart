import '../errors/app_failure.dart';
import '../result.dart';

/// CEP guardado com os 8 dígitos. Regra de `ZipCode` em
/// `modules/customers/src/customer/model/zip-code.vo.ts` (`60150-160` ou
/// `60150160`, aparado); mensagem `CUSTOMER_ZIP_CODE_INVALID` de
/// `apps/frontend/src/shared/i18n/messages.pt.ts`.
final class ZipCode {
  const ZipCode._(this.value);

  static final _pattern = RegExp(r'^\d{5}-?\d{3}$');
  static final _nonDigit = RegExp(r'\D');

  final String value;

  /// `60150-160`.
  String get formatted => '${value.substring(0, 5)}-${value.substring(5)}';

  static Result<ZipCode> create(String input) {
    final text = input.trim();
    if (!_pattern.hasMatch(text)) {
      return const Failure(
        ValidationFailure(message: 'CEP inválido.', code: ZipCodeCode.invalid),
      );
    }
    return Ok(ZipCode._(text.replaceAll(_nonDigit, '')));
  }

  @override
  bool operator ==(Object other) => other is ZipCode && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => 'ZipCode($value)';
}
