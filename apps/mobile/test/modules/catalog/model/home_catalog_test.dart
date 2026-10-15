import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/home_catalog.dart';

import '../support/catalog_fixtures.dart';

void main() {
  group('highlightedCategories', () {
    test('percorre em pré-ordem até o limite, com a raiz de cada uma', () {
      final result = highlightedCategories(categoryTree, 2);

      expect(result, [
        (category: adesivos, rootSlug: 'artes-pintura'),
        (category: pinceisETrinchas, rootSlug: 'artes-pintura'),
      ]);
    });

    test('sem limite apertado, inclui os destaques de todas as raízes', () {
      final result = highlightedCategories(
        categoryTree,
        homeHighlightedCategoriesLimit,
      );

      expect(result.map((item) => item.category.slug), [
        'adesivos',
        'pinceis-e-trinchas',
        'toners-hp',
      ]);
      expect(result.last.rootSlug, 'cartuchos-toners');
    });

    test('destaque sem produtos fica de fora', () {
      final tree = [
        artesPintura.copyWith(
          children: [adesivos.copyWith(productCount: 0), pinceisETrinchas],
        ),
      ];

      expect(highlightedCategories(tree, 12).map((item) => item.category), [
        pinceisETrinchas,
      ]);
    });

    test('raiz marcada como destaque também entra, antes das filhas', () {
      final tree = [artesPintura.copyWith(isHighlighted: true)];

      expect(
        highlightedCategories(tree, 12).map((item) => item.category.slug),
        ['artes-pintura', 'adesivos', 'pinceis-e-trinchas'],
      );
    });

    test('árvore vazia ou limite zero devolvem lista vazia', () {
      expect(highlightedCategories(const [], 12), isEmpty);
      expect(highlightedCategories(categoryTree, 0), isEmpty);
    });
  });

  group('consultas da Início', () {
    test('destaques pedem 12 em destaque na ordem featured', () {
      expect(homeFeaturedQuery.featured, isTrue);
      expect(homeFeaturedQuery.onSale, isFalse);
      expect(homeFeaturedQuery.pageSize, 12);
      expect(homeFeaturedQuery.page, isNull);
    });

    test('ofertas pedem 8 em oferta do maior para o menor desconto', () {
      expect(homeOffersQuery.onSale, isTrue);
      expect(homeOffersQuery.featured, isFalse);
      expect(homeOffersQuery.pageSize, 8);
    });

    test('limite das categorias em destaque é 12', () {
      expect(homeHighlightedCategoriesLimit, 12);
    });
  });
}
