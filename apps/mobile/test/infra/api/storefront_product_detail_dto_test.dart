import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/api/storefront_product_detail_dto.dart';

import '../../modules/catalog/support/catalog_fixtures.dart';
import '../../ui/shared/support/money.dart';
import 'support/storefront_product_detail_json.dart';

void main() {
  group('parseStorefrontProductDetail', () {
    test('lê o toner com as fotos ordenadas e a trilha na ordem recebida', () {
      final decoded = jsonDecode(jsonEncode(tonerDetailJson));

      final product = parseStorefrontProductDetail(decoded);

      expect(product, tonerDetail);
      expect(product.price, money(3490));
      expect(product.listPrice, money(4990));
      expect(product.images.map((image) => image.order), [0, 1, 2]);
      expect(product.categories.map((category) => category.slug), [
        'cartuchos-toners',
        'toners-hp',
      ]);
      expect(product.brand?.name, 'HP');
    });

    test('marca, sku, descrição e "De:" nulos viram ausentes', () {
      final product = parseStorefrontProductDetail(plainDetailJson);

      expect(product, plainDetail);
      expect(product.brand, isNull);
      expect(product.sku, isNull);
      expect(product.description, isNull);
      expect(product.listPrice, isNull);
    });

    test('as listas da entidade não podem ser alteradas', () {
      final product = parseStorefrontProductDetail(tonerDetailJson);

      expect(() => product.images.clear(), throwsUnsupportedError);
      expect(() => product.categories.clear(), throwsUnsupportedError);
    });

    test('priceCents: -1 lança FormatException', () {
      expect(
        () => parseStorefrontProductDetail({
          ...tonerDetailJson,
          'priceCents': -1,
        }),
        throwsA(isA<FormatException>()),
      );
    });

    test('listPriceCents negativo lança FormatException', () {
      expect(
        () => parseStorefrontProductDetail({
          ...tonerDetailJson,
          'listPriceCents': -1,
        }),
        throwsA(isA<FormatException>()),
      );
    });

    test('imagem sem largeUrl lança', () {
      final broken = Map<String, Object?>.of(tonerImage0Json)
        ..remove('largeUrl');

      expect(
        () => parseStorefrontProductDetail({
          ...tonerDetailJson,
          'images': [broken],
        }),
        throwsA(isA<TypeError>()),
      );
    });

    test('corpo sem slug lança', () {
      final json = Map<String, Object?>.of(plainDetailJson)..remove('slug');

      expect(
        () => parseStorefrontProductDetail(json),
        throwsA(isA<TypeError>()),
      );
    });

    test('corpo que não é mapa lança', () {
      expect(
        () => parseStorefrontProductDetail([plainDetailJson]),
        throwsA(isA<TypeError>()),
      );
      expect(
        () => parseStorefrontProductDetail(null),
        throwsA(isA<TypeError>()),
      );
    });
  });
}
