import '../errors/app_failure.dart';
import '../result.dart';

/// Sigla de uma das 27 unidades federativas, aparada e em maiúsculas. Regra de
/// `StateCode` em `modules/customers/src/customer/model/state-code.vo.ts`;
/// mensagem `CUSTOMER_STATE_INVALID` de
/// `apps/frontend/src/shared/i18n/messages.pt.ts`.
final class StateCode {
  const StateCode._(this.value);

  /// Cópia de `BRAZILIAN_STATE_CODES`, em ordem alfabética.
  static const codes = [
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', //
    'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', //
    'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO', //
  ];

  final String value;

  static Result<StateCode> create(String input) {
    final code = input.trim().toUpperCase();
    if (!codes.contains(code)) {
      return const Failure(
        ValidationFailure(message: 'UF inválida.', code: StateCodeCode.invalid),
      );
    }
    return Ok(StateCode._(code));
  }

  @override
  bool operator ==(Object other) => other is StateCode && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => 'StateCode($value)';
}
