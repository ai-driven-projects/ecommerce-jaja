import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/value_objects/city_state.dart';

void main() {
  group('CityState.fromAddressTail', () {
    test('lê São Paulo/SP do endereço da Loja Paulista do seed', () {
      final place = CityState.fromAddressTail(
        'Avenida Paulista, 2073 – Conjunto Nacional, Bela Vista, São Paulo/SP',
      );

      expect(place, const CityState(city: 'São Paulo', state: 'SP'));
      expect(place!.label, 'São Paulo/SP');
    });

    test('lê Rio de Janeiro/RJ do endereço da Loja Rio Branco do seed', () {
      final place = CityState.fromAddressTail(
        'Avenida Rio Branco, 156 – Centro, Rio de Janeiro/RJ',
      );

      expect(place, const CityState(city: 'Rio de Janeiro', state: 'RJ'));
      expect(place!.label, 'Rio de Janeiro/RJ');
    });

    test('UF minúscula vira maiúscula e a cidade perde os espaços', () {
      final place = CityState.fromAddressTail('Rua A, 1,  Campinas / sp  ');

      expect(place, const CityState(city: 'Campinas', state: 'SP'));
    });

    test('endereço nulo, vazio ou fora do formato devolve null', () {
      expect(CityState.fromAddressTail(null), isNull);
      expect(CityState.fromAddressTail(''), isNull);
      expect(CityState.fromAddressTail('   '), isNull);
      expect(CityState.fromAddressTail('Rua X, 10'), isNull);
    });
  });
}
