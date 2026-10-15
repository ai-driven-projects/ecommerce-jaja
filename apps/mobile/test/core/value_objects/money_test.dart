import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/money.dart';

Money money(int cents) => switch (Money.fromCents(cents)) {
  Ok(:final value) => value,
  Failure(:final failure) => throw StateError(failure.message),
};

void main() {
  group('Money', () {
    test('soma e multiplicação exatas: 1290 × 2 + 490 = 3070', () {
      expect((money(1290).times(2) + money(490)).cents, 3070);
    });

    test('centavos negativos resultam em falha de validação', () {
      final result = Money.fromCents(-1);

      switch (result) {
        case Ok():
          fail('esperava falha');
        case Failure(:final failure):
          expect(failure, isA<ValidationFailure>());
          expect(failure.code, MoneyCode.negativeCents);
          expect(failure.message, isNotEmpty);
      }
    });

    test('zero é aceito por fromCents e igual a Money.zero', () {
      expect(money(0), Money.zero);
    });

    test('sum de coleção vazia é zero', () {
      expect(Money.sum(const []), Money.zero);
    });

    test('sum soma todos os valores', () {
      expect(Money.sum([money(1290), money(490), money(100)]).cents, 1880);
    });

    test('igualdade e hashCode por centavos', () {
      expect(money(7900), money(7900));
      expect(money(7900).hashCode, money(7900).hashCode);
      expect(money(7900), isNot(money(490)));
    });

    test('ordem: 7900 é maior que 490', () {
      final a = money(7900);
      final b = money(7900);
      final small = money(490);

      expect(a > small, isTrue);
      expect(b >= small, isTrue);
      expect(small < a, isTrue);
      expect(small <= b, isTrue);
      expect(a <= b && a >= b, isTrue);
      expect(a.compareTo(small), greaterThan(0));
      expect([a, small]..sort(), [small, a]);
    });

    test('times(0) é zero', () {
      expect(money(1290).times(0), Money.zero);
    });

    test('times(-1) lança ArgumentError', () {
      expect(() => money(1290).times(-1), throwsArgumentError);
    });
  });
}
