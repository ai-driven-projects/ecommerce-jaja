import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/api/storefront_store_dto.dart';

import '../../modules/store/support/store_fixtures.dart';
import 'support/storefront_store_json.dart';

void main() {
  group('StorefrontStoreDto', () {
    test('converte os campos da Loja Paulista do seed', () {
      final dto = StorefrontStoreDto.fromJson(paulistaJson);

      expect(dto.id, '0d4e5a52-7a4f-4c1b-9f43-2d1c0b6a1001');
      expect(dto.name, 'Loja Paulista');
      expect(dto.slug, 'loja-paulista');
      expect(
        dto.address,
        'Avenida Paulista, 2073 – Conjunto Nacional, Bela Vista, São Paulo/SP',
      );
      expect(dto.latitude, -23.558131);
      expect(dto.longitude, -46.660232);
      expect(dto.deliveryRadiusMeters, 2500);
      expect(dto.toEntity(), paulista);
    });

    test('coordenadas inteiras no JSON viram double', () {
      final dto = StorefrontStoreDto.fromJson({
        ...rioBrancoJson,
        'latitude': -22,
        'longitude': -43,
      });

      expect(dto.latitude, -22.0);
      expect(dto.longitude, -43.0);
      expect(dto.toEntity(), rioBranco.copyWith(latitude: -22, longitude: -43));
    });

    test('address nulo é aceito', () {
      final dto = StorefrontStoreDto.fromJson({
        ...rioBrancoJson,
        'address': null,
      });

      expect(dto.address, isNull);
      expect(dto.toEntity(), rioBranco.copyWith(address: null));
    });

    test('campos a mais são ignorados', () {
      final dto = StorefrontStoreDto.fromJson({
        ...paulistaJson,
        'phone': '1130001001',
        'isActive': true,
      });

      expect(dto.toEntity(), paulista);
    });

    test('item sem slug lança', () {
      final json = Map<String, Object?>.of(paulistaJson)..remove('slug');

      expect(
        () => StorefrontStoreDto.fromJson(json),
        throwsA(isA<TypeError>()),
      );
    });

    test('campo de outro tipo lança', () {
      expect(
        () => StorefrontStoreDto.fromJson({...paulistaJson, 'latitude': 'x'}),
        throwsA(isA<TypeError>()),
      );
    });
  });

  group('parseStorefrontStores', () {
    test('lê as duas lojas do seed na ordem da API', () {
      final decoded = jsonDecode(jsonEncode(storefrontStoresJson));

      expect(parseStorefrontStores(decoded), [paulista, rioBranco]);
    });

    test('lista vazia vira lista vazia', () {
      expect(parseStorefrontStores(const <Object?>[]), isEmpty);
    });

    test('item sem slug lança', () {
      final json = Map<String, Object?>.of(rioBrancoJson)..remove('slug');

      expect(
        () => parseStorefrontStores([paulistaJson, json]),
        throwsA(isA<TypeError>()),
      );
    });

    test('corpo que não é lista lança', () {
      expect(
        () => parseStorefrontStores(paulistaJson),
        throwsA(isA<TypeError>()),
      );
      expect(() => parseStorefrontStores(null), throwsA(isA<TypeError>()));
      expect(() => parseStorefrontStores('lojas'), throwsA(isA<TypeError>()));
    });
  });
}
