import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/category_tree.dart';

import '../support/catalog_fixtures.dart';

void main() {
  group('categoryTrail', () {
    test('vai da raiz até a categoria, inclusive', () {
      expect(categoryTrail(categoryTree, 'toners-hp'), [
        cartuchosToners,
        tonersHp,
      ]);
    });

    test('raiz tem trilha de um nó só', () {
      expect(categoryTrail(categoryTree, 'escolar'), [escolar]);
    });

    test('slug desconhecido dá trilha vazia', () {
      expect(categoryTrail(categoryTree, 'nao-existe'), isEmpty);
    });
  });

  group('flattenCategoryTree', () {
    test('achata em pré-ordem, cada raiz antes das filhas', () {
      expect(flattenCategoryTree(categoryTree).map((node) => node.slug), [
        'artes-pintura',
        'adesivos',
        'pinceis-e-trinchas',
        'cartuchos-toners',
        'toners-hp',
        'escolar',
      ]);
    });

    test('árvore vazia dá lista vazia', () {
      expect(flattenCategoryTree(const []), isEmpty);
    });
  });
}
