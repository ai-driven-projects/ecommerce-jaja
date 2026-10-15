import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/store/model/current_store.dart';

import '../support/store_fixtures.dart';

void main() {
  group('pickCurrentStore', () {
    const stores = [paulista, rioBranco];

    test('lembrada e ainda ativa vale', () {
      expect(pickCurrentStore(stores, 'loja-rio-branco'), rioBranco);
    });

    test('lembrada que saiu da vitrine cai na primeira ativa', () {
      expect(pickCurrentStore(const [paulista], 'loja-rio-branco'), paulista);
    });

    test('sem lembrança (nula ou vazia) vale a primeira ativa', () {
      expect(pickCurrentStore(stores, null), paulista);
      expect(pickCurrentStore(stores, ''), paulista);
    });

    test('sem lojas ativas não há loja em vigor', () {
      expect(pickCurrentStore(const [], 'loja-paulista'), isNull);
      expect(pickCurrentStore(const [], null), isNull);
    });
  });
}
