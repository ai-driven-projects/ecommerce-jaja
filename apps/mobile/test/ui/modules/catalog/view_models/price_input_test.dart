import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/modules/catalog/view_models/price_input.dart';

void main() {
  group('parseReaisToCents', () {
    test('aceita vírgula, ponto, milhar e o símbolo', () {
      expect(parseReaisToCents('12,90'), 1290);
      expect(parseReaisToCents('12.90'), 1290);
      expect(parseReaisToCents('1.290,90'), 129090);
      expect(parseReaisToCents(r'R$ 300'), 30000);
      expect(parseReaisToCents(' 0,5 '), 50);
    });

    test('vazio, negativo, texto ou mais de duas casas viram nulo', () {
      for (final text in ['12,999', '-5', 'abc', '', '   ', r'R$', '9' * 400]) {
        expect(parseReaisToCents(text), isNull, reason: '"$text"');
      }
    });
  });

  group('formatCentsAsReais', () {
    test('reais inteiros sem casas e centavos com vírgula', () {
      expect(formatCentsAsReais(30000), '300');
      expect(formatCentsAsReais(1290), '12,90');
      expect(formatCentsAsReais(105), '1,05');
      expect(formatCentsAsReais(0), '0');
    });

    test('a volta pelo parser dá os mesmos centavos', () {
      for (final cents in [0, 5, 1290, 30000, 129090]) {
        expect(parseReaisToCents(formatCentsAsReais(cents)), cents);
      }
    });
  });
}
