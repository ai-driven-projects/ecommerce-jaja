import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/home_catalog.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/modules/catalog/model/product_query_params.dart';

void main() {
  group('encodeProductQuery', () {
    test('emite só os filtros definidos, com os nomes da API', () {
      const query = ProductQuery(
        categorySlug: 'escolar',
        onSale: true,
        sort: ProductSort.discount,
        page: 2,
      );

      expect(encodeProductQuery(query), {
        'category': 'escolar',
        'onSale': 'true',
        'sort': 'discount',
        'page': '2',
      });
    });

    test('consulta vazia não emite nada', () {
      expect(encodeProductQuery(const ProductQuery()), isEmpty);
    });

    test('search sai sem espaços nas pontas e é omitido quando vazio', () {
      expect(encodeProductQuery(const ProductQuery(search: '  caneta  ')), {
        'search': 'caneta',
      });
      expect(encodeProductQuery(const ProductQuery(search: '   ')), isEmpty);
      expect(encodeProductQuery(const ProductQuery(search: '')), isEmpty);
    });

    test('brandSlugs vira brand com vírgula, sem slug vazio', () {
      expect(
        encodeProductQuery(
          const ProductQuery(brandSlugs: ['faber-castell', '', 'master']),
        ),
        {'brand': 'faber-castell,master'},
      );
      expect(encodeProductQuery(const ProductQuery(brandSlugs: [])), isEmpty);
    });

    test('onSale e featured só aparecem quando verdadeiros', () {
      expect(
        encodeProductQuery(const ProductQuery(onSale: false, featured: true)),
        {'featured': 'true'},
      );
    });

    test('centavos e tamanho da página viram texto', () {
      expect(
        encodeProductQuery(
          const ProductQuery(
            minPriceCents: 0,
            maxPriceCents: 5000,
            pageSize: 24,
          ),
        ),
        {'minPriceCents': '0', 'maxPriceCents': '5000', 'pageSize': '24'},
      );
    });
  });

  group('decodeProductQuery', () {
    test('é a inversa da codificação', () {
      const query = ProductQuery(
        categorySlug: 'escolar',
        onSale: true,
        sort: ProductSort.discount,
        page: 2,
      );

      expect(decodeProductQuery(encodeProductQuery(query)), query);
    });

    test('ida e volta preserva todos os filtros', () {
      const query = ProductQuery(
        page: 3,
        pageSize: 24,
        search: 'caneta',
        categorySlug: 'escolar',
        brandSlugs: ['faber-castell', 'master'],
        minPriceCents: 100,
        maxPriceCents: 5000,
        onSale: true,
        featured: true,
        sort: ProductSort.priceAsc,
      );

      expect(decodeProductQuery(encodeProductQuery(query)), query);
    });

    test('mapa vazio vira consulta vazia', () {
      expect(decodeProductQuery(const {}), const ProductQuery());
    });

    test('ignora, sem erro, valores inválidos e chave desconhecida', () {
      final query = decodeProductQuery(const {
        'sort': 'aleatorio',
        'page': '0',
        'featured': '1',
        'minPriceCents': '-5',
        'foo': 'bar',
      });

      expect(query, const ProductQuery());
      expect(query.sort, isNull);
      expect(query.page, isNull);
      expect(query.featured, isFalse);
      expect(query.minPriceCents, isNull);
    });

    test('page e pageSize precisam ser inteiros maiores ou iguais a 1', () {
      expect(decodeProductQuery(const {'page': '1'}).page, 1);
      expect(decodeProductQuery(const {'pageSize': '12'}).pageSize, 12);
      expect(decodeProductQuery(const {'page': '-1'}).page, isNull);
      expect(decodeProductQuery(const {'page': '1.5'}).page, isNull);
      expect(decodeProductQuery(const {'page': 'dois'}).page, isNull);
      expect(decodeProductQuery(const {'pageSize': ''}).pageSize, isNull);
    });

    test('centavos precisam ser inteiros maiores ou iguais a 0', () {
      expect(decodeProductQuery(const {'maxPriceCents': '0'}).maxPriceCents, 0);
      expect(
        decodeProductQuery(const {'maxPriceCents': '9,90'}).maxPriceCents,
        isNull,
      );
      expect(
        decodeProductQuery(const {'maxPriceCents': '-1'}).maxPriceCents,
        isNull,
      );
    });

    test('onSale e featured só ligam com "true"', () {
      expect(decodeProductQuery(const {'onSale': 'true'}).onSale, isTrue);
      expect(decodeProductQuery(const {'onSale': 'TRUE'}).onSale, isFalse);
      expect(decodeProductQuery(const {'onSale': 'false'}).onSale, isFalse);
      expect(decodeProductQuery(const {'featured': 'yes'}).featured, isFalse);
    });

    test('search e category saem aparados e vazios viram ausentes', () {
      final query = decodeProductQuery(const {
        'search': '  lápis ',
        'category': '  ',
      });

      expect(query.search, 'lápis');
      expect(query.categorySlug, isNull);
    });

    test('brand separa por vírgula e descarta vazios', () {
      expect(
        decodeProductQuery(const {
          'brand': 'faber-castell, master,,',
        }).brandSlugs,
        ['faber-castell', 'master'],
      );
    });
  });

  group('consultas da Início', () {
    test('destaques: featured=true, sort=featured e pageSize=12', () {
      expect(encodeProductQuery(homeFeaturedQuery), {
        'featured': 'true',
        'sort': 'featured',
        'pageSize': '12',
      });
    });

    test('ofertas: onSale=true, sort=discount e pageSize=8', () {
      expect(encodeProductQuery(homeOffersQuery), {
        'onSale': 'true',
        'sort': 'discount',
        'pageSize': '8',
      });
    });
  });
}
