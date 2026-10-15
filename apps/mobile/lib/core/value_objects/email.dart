import '../errors/app_failure.dart';
import '../result.dart';

/// E-mail aparado e em minúsculas. Regra de `Email` em
/// `packages/shared/src/vo/email.vo.ts`; mensagem `INVALID_EMAIL` de
/// `apps/frontend/src/shared/i18n/messages.pt.ts`.
final class Email {
  const Email._(this.value);

  static final _pattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  final String value;

  /// Vazio também é "E-mail inválido.", como o formulário web mostra.
  static Result<Email> create(String input) {
    final email = input.trim().toLowerCase();
    if (!_pattern.hasMatch(email)) {
      return const Failure(
        ValidationFailure(message: 'E-mail inválido.', code: EmailCode.invalid),
      );
    }
    return Ok(Email._(email));
  }

  @override
  bool operator ==(Object other) => other is Email && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => 'Email($value)';
}
