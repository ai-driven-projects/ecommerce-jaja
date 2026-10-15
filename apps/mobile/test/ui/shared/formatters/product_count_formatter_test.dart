import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/formatters/product_count_formatter.dart';

void main() {
  const cases = {1: '1 produto', 24: '24 produtos', 0: '0 produtos'};

  for (final MapEntry(key: count, value: expected) in cases.entries) {
    test('$count vira "$expected"', () {
      expect(formatProductCount(count), expected);
    });
  }
}
