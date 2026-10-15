import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/product_detail.dart';
import 'package:mobile/modules/catalog/model/product_detail_entity.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/modules/catalog/model/product_query_params.dart';

import '../support/catalog_fixtures.dart';

void main() {
  test('a descrição de exemplo do toner tem 700 caracteres', () {
    expect(tonerDescription.length, 700);
  });

  group('relatedProductsQuery', () {
    test('pede a última categoria da trilha, em destaque, com 5 itens', () {
      final query = relatedProductsQuery(tonerDetail);

      expect(
        query,
        const ProductQuery(
          categorySlug: 'toners-hp',
          sort: ProductSort.featured,
          pageSize: 5,
        ),
      );
      expect(encodeProductQuery(query!), {
        'category': 'toners-hp',
        'sort': 'featured',
        'pageSize': '5',
      });
    });

    test('sem categorias não há consulta', () {
      expect(relatedProductsQuery(plainDetail), isNull);
    });
  });

  group('relatedProducts', () {
    test('tira o próprio produto e corta no limite', () {
      final others = manyProducts(5);
      final own = others[1];

      final result = relatedProducts(others, own.id);

      expect(result, hasLength(relatedProductsLimit));
      expect(result, isNot(contains(own)));
      expect(result, [others[0], others[2], others[3], others[4]]);
    });

    test('lista curta passa inteira, sem o próprio', () {
      final result = relatedProducts(products, finePen.id);

      expect(result, [brushDuo, brushSupersoft]);
    });
  });

  group('rootCategorySlugOf', () {
    test('é o slug da primeira categoria da trilha', () {
      expect(rootCategorySlugOf(tonerDetail), 'cartuchos-toners');
    });

    test('sem categorias é vazio', () {
      expect(rootCategorySlugOf(plainDetail), '');
    });
  });

  group('ProductDetail', () {
    test('é igual por valor, inclusive nas listas', () {
      final copy = tonerDetail.copyWith(
        categories: List.of(tonerDetail.categories),
        images: List.of(tonerDetail.images),
      );

      expect(copy, tonerDetail);
      expect(copy.hashCode, tonerDetail.hashCode);
    });

    test('muda quando um campo muda', () {
      expect(tonerDetail.copyWith(sku: null), isNot(tonerDetail));
      expect(
        tonerDetail.copyWith(
          brand: const CatalogRef(slug: 'hp', name: 'H.P.'),
        ),
        isNot(tonerDetail),
      );
      expect(
        tonerDetail.copyWith(images: tonerDetail.images.reversed.toList()),
        isNot(tonerDetail),
      );
    });
  });
}
