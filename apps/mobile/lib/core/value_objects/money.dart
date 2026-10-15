import '../errors/app_failure.dart';
import '../result.dart';

/// Valor monetário em centavos inteiros, como o backend os envia (preços e
/// limites de `modules/orders/src/cart/errors.ts`). Formatação fica fora do
/// núcleo.
final class Money implements Comparable<Money> {
  const Money._(this.cents);

  static const zero = Money._(0);

  final int cents;

  static Result<Money> fromCents(int cents) {
    if (cents < 0) {
      return const Failure(
        ValidationFailure(
          message: 'O valor não pode ser negativo.',
          code: MoneyCode.negativeCents,
        ),
      );
    }
    return Ok(Money._(cents));
  }

  static Money sum(Iterable<Money> values) =>
      values.fold(zero, (total, value) => total + value);

  Money operator +(Money other) => Money._(cents + other.cents);

  /// Quantidade negativa é erro de programação: a quantidade do carrinho já
  /// chega validada (1..99).
  Money times(int quantity) {
    if (quantity < 0) {
      throw ArgumentError.value(quantity, 'quantity', 'não pode ser negativa');
    }
    return Money._(cents * quantity);
  }

  @override
  int compareTo(Money other) => cents.compareTo(other.cents);

  bool operator <(Money other) => cents < other.cents;
  bool operator <=(Money other) => cents <= other.cents;
  bool operator >(Money other) => cents > other.cents;
  bool operator >=(Money other) => cents >= other.cents;

  @override
  bool operator ==(Object other) => other is Money && other.cents == cents;

  @override
  int get hashCode => cents.hashCode;

  @override
  String toString() => 'Money($cents)';
}
