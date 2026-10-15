import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/api/storefront_product_dto.dart';
import 'package:mobile/modules/catalog/model/product_page_entity.dart';

import '../../modules/catalog/support/catalog_fixtures.dart';
import '../../ui/shared/support/money.dart';
import 'support/storefront_catalog_json.dart';

void main() {
  group('StorefrontProductListItemDto', () {
    test('converte o item do seed com preço, "De:" e desconto', () {
      final dto = StorefrontProductListItemDto.fromJson(brushDuoJson);

      expect(dto.id, '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e02');
      expect(
        dto.slug,
        'caneta-pincel-brush-duo-acrilico-12-cores-oapgatc-master-un-1-un',
      );
      expect(dto.brandName, 'Master');
      expect(dto.categoryName, 'Canetas Hidrográficas Brush Pen');
      expect(dto.rootCategorySlug, 'artes-pintura');
      expect(dto.priceCents, 3490);
      expect(dto.listPriceCents, 4990);
      expect(dto.discountPercent, 30);
      expect(dto.unit, 'unidade');
      expect(
        dto.thumbUrl,
        'https://img.kalunga.com.br/fotosdeprodutos/167231d.jpg',
      );
      expect(dto.isFeatured, isFalse);

      final entity = dto.toEntity();
      expect(entity, brushDuo);
      expect(entity.price, money(3490));
      expect(entity.listPrice, money(4990));
    });

    test('listPriceCents, discountPercent, thumbUrl e brandName nulos', () {
      final dto = StorefrontProductListItemDto.fromJson({
        ...finePenJson,
        'brandName': null,
      });

      expect(dto.listPriceCents, isNull);
      expect(dto.discountPercent, isNull);
      expect(dto.thumbUrl, isNull);
      expect(dto.brandName, isNull);
      expect(dto.toEntity(), finePen.copyWith(brandName: null));
    });

    test('campos a mais são ignorados', () {
      final dto = StorefrontProductListItemDto.fromJson({
        ...finePenJson,
        'sku': 'FPBPRZF',
        'description': 'Caneta fine pen.',
      });

      expect(dto.toEntity(), finePen);
    });

    test('priceCents negativo lança FormatException', () {
      final dto = StorefrontProductListItemDto.fromJson({
        ...finePenJson,
        'priceCents': -1,
      });

      expect(dto.toEntity, throwsA(isA<FormatException>()));
    });

    test('listPriceCents negativo lança FormatException', () {
      final dto = StorefrontProductListItemDto.fromJson({
        ...brushDuoJson,
        'listPriceCents': -1,
      });

      expect(dto.toEntity, throwsA(isA<FormatException>()));
    });

    test('item sem slug lança', () {
      final json = Map<String, Object?>.of(finePenJson)..remove('slug');

      expect(
        () => StorefrontProductListItemDto.fromJson(json),
        throwsA(isA<TypeError>()),
      );
    });

    test('campo de outro tipo lança', () {
      expect(
        () => StorefrontProductListItemDto.fromJson({
          ...finePenJson,
          'priceCents': '750',
        }),
        throwsA(isA<TypeError>()),
      );
    });
  });

  group('StorefrontBrandFacetDto', () {
    test('converte a faceta', () {
      final dto = StorefrontBrandFacetDto.fromJson(faberCastellFacetJson);

      expect(
        dto.toEntity(),
        const BrandFacet(
          slug: 'faber-castell',
          name: 'Faber-Castell',
          count: 2,
        ),
      );
    });

    test('faceta sem count lança', () {
      final json = Map<String, Object?>.of(masterFacetJson)..remove('count');

      expect(
        () => StorefrontBrandFacetDto.fromJson(json),
        throwsA(isA<TypeError>()),
      );
    });
  });

  group('parseStorefrontProductPage', () {
    test('lê a página do JSON com as fixtures e as facetas', () {
      final decoded = jsonDecode(jsonEncode(storefrontProductPageJson));

      final page = parseStorefrontProductPage(decoded);

      expect(page.items, products);
      expect(page.total, 96);
      expect(page.page, 1);
      expect(page.pageSize, 8);
      expect(page.totalPages, 12);
      expect(page.brandFacets, const [
        BrandFacet(slug: 'faber-castell', name: 'Faber-Castell', count: 2),
        BrandFacet(slug: 'master', name: 'Master', count: 1),
      ]);
    });

    test('página sem itens vira página vazia', () {
      final page = parseStorefrontProductPage(const <String, Object?>{
        'items': <Object?>[],
        'total': 0,
        'page': 1,
        'pageSize': 8,
        'totalPages': 0,
        'brandFacets': <Object?>[],
      });

      expect(page.items, isEmpty);
      expect(page.brandFacets, isEmpty);
      expect(page.total, 0);
    });

    test('priceCents: -1 lança FormatException', () {
      expect(
        () => parseStorefrontProductPage({
          ...storefrontProductPageJson,
          'items': [
            {...finePenJson, 'priceCents': -1},
          ],
        }),
        throwsA(isA<FormatException>()),
      );
    });

    test('item sem slug lança', () {
      final broken = Map<String, Object?>.of(brushDuoJson)..remove('slug');

      expect(
        () => parseStorefrontProductPage({
          ...storefrontProductPageJson,
          'items': [finePenJson, broken],
        }),
        throwsA(isA<TypeError>()),
      );
    });

    test('corpo sem items lança', () {
      final json = Map<String, Object?>.of(storefrontProductPageJson)
        ..remove('items');

      expect(() => parseStorefrontProductPage(json), throwsA(isA<TypeError>()));
    });

    test('corpo que não é mapa lança', () {
      expect(
        () => parseStorefrontProductPage([finePenJson]),
        throwsA(isA<TypeError>()),
      );
      expect(() => parseStorefrontProductPage(null), throwsA(isA<TypeError>()));
    });
  });
}
