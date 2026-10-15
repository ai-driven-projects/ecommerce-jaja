import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/product_listing.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/modules/catalog/model/product_query_params.dart';

void main() {
  group('effectiveSort', () {
    test('sem ordem escolhida, é relevância com busca e destaques sem', () {
      expect(
        effectiveSort(const ProductQuery(search: 'caneta')),
        ProductSort.relevance,
      );
      expect(effectiveSort(const ProductQuery()), ProductSort.featured);
    });

    test('a ordem escolhida vale com ou sem busca', () {
      expect(
        effectiveSort(
          const ProductQuery(search: 'caneta', sort: ProductSort.priceAsc),
        ),
        ProductSort.priceAsc,
      );
      expect(
        effectiveSort(const ProductQuery(sort: ProductSort.name)),
        ProductSort.name,
      );
    });
  });

  group('listingSorts', () {
    test('com busca, as seis ordens na ordem do web', () {
      expect(listingSorts(const ProductQuery(search: 'caneta')), [
        ProductSort.relevance,
        ProductSort.featured,
        ProductSort.priceAsc,
        ProductSort.priceDesc,
        ProductSort.name,
        ProductSort.discount,
      ]);
    });

    test('sem busca, sem "Mais relevantes"', () {
      expect(listingSorts(const ProductQuery()), [
        ProductSort.featured,
        ProductSort.priceAsc,
        ProductSort.priceDesc,
        ProductSort.name,
        ProductSort.discount,
      ]);
    });
  });

  group('normalizeListingQuery', () {
    test('zera a página e o tamanho e apara a busca', () {
      final query = normalizeListingQuery(
        const ProductQuery(page: 3, pageSize: 48, search: '  caneta  '),
      );

      expect(query, const ProductQuery(search: 'caneta'));
    });

    test('busca só com espaços vira nula', () {
      expect(
        normalizeListingQuery(const ProductQuery(search: '   ')).search,
        isNull,
      );
    });

    test('remove marcas vazias e repetidas e corta em 20', () {
      final brands = [
        'hp',
        '',
        'hp',
        'bic',
        for (var i = 0; i < 30; i++) 'marca-$i',
      ];

      final query = normalizeListingQuery(ProductQuery(brandSlugs: brands));

      expect(query.brandSlugs, hasLength(maxBrandSlugs));
      expect(query.brandSlugs.take(3), ['hp', 'bic', 'marca-0']);
      expect(query.brandSlugs.last, 'marca-17');
    });

    test('relevância sem busca volta à ordem padrão', () {
      expect(
        normalizeListingQuery(
          const ProductQuery(search: ' ', sort: ProductSort.relevance),
        ).sort,
        isNull,
      );
      expect(
        normalizeListingQuery(
          const ProductQuery(search: 'toner', sort: ProductSort.relevance),
        ).sort,
        ProductSort.relevance,
      );
    });

    test('mantém os demais filtros e dois filtros iguais se comparam', () {
      const query = ProductQuery(
        categorySlug: 'escolar',
        brandSlugs: ['hp'],
        minPriceCents: 1290,
        maxPriceCents: 30000,
        onSale: true,
        featured: true,
        sort: ProductSort.discount,
      );

      expect(normalizeListingQuery(query), query);
      expect(
        normalizeListingQuery(
          query.copyWith(page: 2, brandSlugs: ['hp', 'hp']),
        ),
        normalizeListingQuery(query),
      );
    });
  });

  group('hasCatalogFilters e clearCatalogFilters', () {
    test('busca e ordem não contam como filtro', () {
      expect(
        hasCatalogFilters(
          const ProductQuery(search: 'caneta', sort: ProductSort.name),
        ),
        isFalse,
      );
    });

    test('categoria, marca, preço, ofertas e destaques contam', () {
      for (final query in const [
        ProductQuery(categorySlug: 'escolar'),
        ProductQuery(brandSlugs: ['hp']),
        ProductQuery(minPriceCents: 100),
        ProductQuery(maxPriceCents: 100),
        ProductQuery(onSale: true),
        ProductQuery(featured: true),
      ]) {
        expect(hasCatalogFilters(query), isTrue, reason: '$query');
      }
    });

    test('limpar tira os cinco filtros e mantém a busca e a ordem', () {
      const query = ProductQuery(
        search: 'caneta',
        sort: ProductSort.priceDesc,
        categorySlug: 'escolar',
        brandSlugs: ['hp'],
        minPriceCents: 1290,
        maxPriceCents: 30000,
        onSale: true,
        featured: true,
      );

      final cleared = clearCatalogFilters(query);

      expect(
        cleared,
        const ProductQuery(search: 'caneta', sort: ProductSort.priceDesc),
      );
      expect(hasCatalogFilters(cleared), isFalse);
    });
  });

  group('listingPageQuery', () {
    test('pede a página com 24 itens', () {
      const query = ProductQuery(categorySlug: 'escolar');

      expect(encodeProductQuery(listingPageQuery(query, 2)), {
        'page': '2',
        'pageSize': '24',
        'category': 'escolar',
      });
    });
  });
}
