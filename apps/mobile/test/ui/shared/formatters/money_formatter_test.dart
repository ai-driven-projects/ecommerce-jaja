import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/formatters/money_formatter.dart';

import '../support/money.dart';

void main() {
  const cases = {
    1290: r'R$ 12,90',
    50: r'R$ 0,50',
    0: r'R$ 0,00',
    129090: r'R$ 1.290,90',
    10000000: r'R$ 100.000,00',
  };

  for (final MapEntry(key: cents, value: expected) in cases.entries) {
    test('$cents centavos viram "$expected"', () {
      expect(formatMoney(money(cents)), expected);
    });
  }

  test('nenhum resultado contém o espaço não separável (U+00A0)', () {
    for (final cents in cases.keys) {
      expect(formatMoney(money(cents)), isNot(contains(' ')));
    }
  });
}
