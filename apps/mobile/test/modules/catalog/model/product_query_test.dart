import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';

void main() {
  group('ProductSort', () {
    test('apiValue é o valor que a API aceita', () {
      expect(ProductSort.values.map((sort) => sort.apiValue), [
        'relevance',
        'featured',
        'price-asc',
        'price-desc',
        'name',
        'discount',
      ]);
    });

    test('fromApiValue reconhece os valores da API', () {
      expect(ProductSort.fromApiValue('price-asc'), ProductSort.priceAsc);
      expect(ProductSort.fromApiValue('discount'), ProductSort.discount);
    });

    test('fromApiValue devolve null para desconhecido ou ausente', () {
      expect(ProductSort.fromApiValue('aleatorio'), isNull);
      expect(ProductSort.fromApiValue('priceAsc'), isNull);
      expect(ProductSort.fromApiValue(''), isNull);
      expect(ProductSort.fromApiValue(null), isNull);
    });
  });

  group('ProductQuery', () {
    test('sem argumentos, nada está definido', () {
      const query = ProductQuery();

      expect(query.page, isNull);
      expect(query.search, isNull);
      expect(query.brandSlugs, isEmpty);
      expect(query.onSale, isFalse);
      expect(query.featured, isFalse);
      expect(query.sort, isNull);
    });

    test('é igual por valor, inclusive pelas marcas', () {
      const query = ProductQuery(brandSlugs: ['master'], onSale: true);

      expect(query.copyWith(), query);
      expect(const ProductQuery(brandSlugs: ['master'], onSale: true), query);
      expect(query.copyWith(brandSlugs: []), isNot(query));
    });
  });
}
