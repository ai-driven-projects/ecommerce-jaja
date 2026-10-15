import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/api/storefront_category_dto.dart';

import '../../modules/catalog/support/catalog_fixtures.dart';
import 'support/storefront_catalog_json.dart';

void main() {
  group('StorefrontCategoryDto', () {
    test('converte a raiz Cartuchos & Toners com a filha Toners HP', () {
      final dto = StorefrontCategoryDto.fromJson(cartuchosTonersJson);

      expect(dto.slug, 'cartuchos-toners');
      expect(dto.name, 'Cartuchos & Toners');
      expect(dto.level, 1);
      expect(dto.parentSlug, isNull);
      expect(dto.isHighlighted, isFalse);
      expect(dto.productCount, 12);
      expect(dto.children, hasLength(1));
      final child = dto.children.single;
      expect(child.slug, 'toners-hp');
      expect(child.level, 2);
      expect(child.parentSlug, 'cartuchos-toners');
      expect(child.isHighlighted, isTrue);
      expect(child.productCount, 12);
      expect(child.children, isEmpty);
      expect(dto.toEntity(), cartuchosToners);
    });

    test('parentSlug ausente na raiz vale como null', () {
      final json = Map<String, Object?>.of(escolarJson)..remove('parentSlug');

      final dto = StorefrontCategoryDto.fromJson(json);

      expect(dto.parentSlug, isNull);
      expect(dto.toEntity(), escolar);
    });

    test('campos a mais são ignorados', () {
      final dto = StorefrontCategoryDto.fromJson({
        ...artesPinturaJson,
        'id': 'c1a2b3',
        'order': 3,
      });

      expect(dto.toEntity(), artesPintura);
    });

    test('nó sem slug lança', () {
      final json = Map<String, Object?>.of(escolarJson)..remove('slug');

      expect(
        () => StorefrontCategoryDto.fromJson(json),
        throwsA(isA<TypeError>()),
      );
    });

    test('filha sem slug lança', () {
      final child = Map<String, Object?>.of(tonersHpJson)..remove('slug');

      expect(
        () => StorefrontCategoryDto.fromJson({
          ...cartuchosTonersJson,
          'children': [child],
        }),
        throwsA(isA<TypeError>()),
      );
    });

    test('campo de outro tipo lança', () {
      expect(
        () => StorefrontCategoryDto.fromJson({
          ...escolarJson,
          'productCount': '31',
        }),
        throwsA(isA<TypeError>()),
      );
      expect(
        () =>
            StorefrontCategoryDto.fromJson({...escolarJson, 'children': null}),
        throwsA(isA<TypeError>()),
      );
    });
  });

  group('parseStorefrontCategories', () {
    test('lê a árvore do JSON na ordem da API', () {
      final decoded = jsonDecode(jsonEncode(storefrontCategoriesJson));

      expect(parseStorefrontCategories(decoded), categoryTree);
    });

    test('lista vazia vira lista vazia', () {
      expect(parseStorefrontCategories(const <Object?>[]), isEmpty);
    });

    test('nó sem slug lança', () {
      final json = Map<String, Object?>.of(escolarJson)..remove('slug');

      expect(
        () => parseStorefrontCategories([artesPinturaJson, json]),
        throwsA(isA<TypeError>()),
      );
    });

    test('corpo que não é lista lança', () {
      expect(
        () => parseStorefrontCategories(escolarJson),
        throwsA(isA<TypeError>()),
      );
      expect(() => parseStorefrontCategories(null), throwsA(isA<TypeError>()));
      expect(
        () => parseStorefrontCategories('categorias'),
        throwsA(isA<TypeError>()),
      );
    });
  });
}
