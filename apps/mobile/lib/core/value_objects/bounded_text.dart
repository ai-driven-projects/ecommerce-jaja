import '../errors/app_failure.dart';
import '../result.dart';

/// Texto aparado com tamanho entre [min] e [max]. Regra de `Text` em
/// `packages/shared/src/vo/text.vo.ts`; mensagens `TEXT_TOO_SHORT` e
/// `TEXT_TOO_LONG` de `apps/frontend/src/shared/i18n/messages.pt.ts`.
final class BoundedText {
  const BoundedText._(this.value);

  final String value;

  static Result<BoundedText> create(
    String input, {
    required int min,
    required int max,
  }) {
    final text = input.trim();
    if (text.length < min) {
      return const Failure(
        ValidationFailure(
          message: 'O texto não atingiu o tamanho mínimo permitido.',
          code: TextCode.tooShort,
        ),
      );
    }
    if (text.length > max) {
      return const Failure(
        ValidationFailure(
          message: 'O texto passou do tamanho máximo permitido.',
          code: TextCode.tooLong,
        ),
      );
    }
    return Ok(BoundedText._(text));
  }

  @override
  bool operator ==(Object other) =>
      other is BoundedText && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => 'BoundedText($value)';
}
