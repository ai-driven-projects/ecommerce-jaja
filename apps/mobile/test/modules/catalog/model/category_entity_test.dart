import 'package:flutter_test/flutter_test.dart';

import '../support/catalog_fixtures.dart';

void main() {
  group('Category', () {
    test('é igual por valor, inclusive pelas filhas', () {
      expect(artesPintura.copyWith(), artesPintura);
      expect(artesPintura.copyWith().hashCode, artesPintura.hashCode);
      expect(
        artesPintura.copyWith(children: [adesivos, pinceisETrinchas]),
        artesPintura,
      );
      expect(artesPintura.copyWith(children: [adesivos]), isNot(artesPintura));
      expect(artesPintura.copyWith(productCount: 1), isNot(artesPintura));
      expect(artesPintura, isNot(cartuchosToners));
    });

    test('raiz tem nível 1 e sem pai; filha aponta para a raiz', () {
      expect(artesPintura.level, 1);
      expect(artesPintura.parentSlug, isNull);
      expect(adesivos.level, 2);
      expect(adesivos.parentSlug, 'artes-pintura');
      expect(artesPintura.children, [adesivos, pinceisETrinchas]);
    });
  });
}
