import '../errors/app_failure.dart';
import '../result.dart';

/// Senha forte, guardada como digitada (sem aparar). Regra de
/// `StrongPassword.isStrong` em `packages/shared/src/vo/strong-password.vo.ts`;
/// mensagem `STRONG_PASSWORD_TOO_WEAK` de
/// `apps/frontend/src/shared/i18n/messages.pt.ts`.
final class StrongPassword {
  const StrongPassword._(this.value);

  static const minLength = 8;

  static final _upper = RegExp('[A-Z]');
  static final _lower = RegExp('[a-z]');
  static final _digit = RegExp('[0-9]');
  static final _symbol = RegExp('[^A-Za-z0-9]');

  final String value;

  static Result<StrongPassword> create(String input) {
    final strong =
        input.length >= minLength &&
        _upper.hasMatch(input) &&
        _lower.hasMatch(input) &&
        _digit.hasMatch(input) &&
        _symbol.hasMatch(input);
    if (!strong) {
      return const Failure(
        ValidationFailure(
          message:
              'A senha precisa ter ao menos 8 caracteres, com maiúscula, '
              'minúscula, número e símbolo.',
          code: PasswordCode.tooWeak,
        ),
      );
    }
    return Ok(StrongPassword._(input));
  }

  @override
  bool operator ==(Object other) =>
      other is StrongPassword && other.value == value;

  @override
  int get hashCode => value.hashCode;

  /// Nunca expõe a senha em log ou mensagem de teste.
  @override
  String toString() => 'StrongPassword(***)';
}
