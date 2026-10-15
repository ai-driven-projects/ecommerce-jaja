import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/value_objects/city_state.dart';

import '../support/store_fixtures.dart';

void main() {
  group('Store', () {
    test('é igual por valor', () {
      expect(paulista.copyWith(), paulista);
      expect(paulista.copyWith().hashCode, paulista.hashCode);
      expect(paulista.copyWith(deliveryRadiusMeters: 3000), isNot(paulista));
      expect(paulista, isNot(rioBranco));
    });

    test('place lê a cidade/UF do fim do endereço', () {
      expect(paulista.place, const CityState(city: 'São Paulo', state: 'SP'));
      expect(rioBranco.place?.label, 'Rio de Janeiro/RJ');
    });

    test('place é null sem o final Cidade/UF ou sem endereço', () {
      expect(paulista.copyWith(address: 'Rua X, 10').place, isNull);
      expect(paulista.copyWith(address: null).place, isNull);
    });
  });
}
