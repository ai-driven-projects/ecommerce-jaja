import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/category_entity.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/ui/modules/catalog/widgets/active_filter_pills.dart';
import 'package:mobile/ui/shared/widgets/app_chip.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../shared/support/themed.dart';

/// Monta as pílulas e anota, em [calls], cada remoção pedida.
Widget _pills(ProductQuery query, {Category? category, List<String>? calls}) {
  final log = calls ?? [];
  return themed(
    ActiveFilterPills(
      query: query,
      category: category,
      brandFacets: const [hpFacet],
      onRemoveCategory: () => log.add('category'),
      onRemoveBrand: (slug) => log.add('brand:$slug'),
      onClearPrice: () => log.add('price'),
      onRemoveOnSale: () => log.add('onSale'),
      onRemoveFeatured: () => log.add('featured'),
      onClearFilters: () => log.add('clear'),
    ),
  );
}

List<String> _labels(WidgetTester tester) => [
  for (final chip in tester.widgetList<AppChip>(find.byType(AppChip)))
    chip.label,
];

void main() {
  testWidgets(
    'pílulas na ordem: categoria, marcas, preço, ofertas, destaques',
    (tester) async {
      await tester.pumpWidget(
        _pills(
          const ProductQuery(
            categorySlug: 'toners-hp',
            brandSlugs: ['hp', 'bic'],
            minPriceCents: 1290,
            maxPriceCents: 30000,
            onSale: true,
            featured: true,
          ),
          category: tonersHp,
        ),
      );

      expect(_labels(tester), [
        'Toners HP',
        'HP',
        'bic',
        'R\$ 12,90 a R\$ 300,00',
        'Só ofertas',
        'Só destaques',
      ]);
      expect(find.byIcon(Icons.close), findsNWidgets(6));
      expect(find.text('Limpar filtros'), findsOneWidget);
    },
  );

  testWidgets('categoria sem a árvore aparece pelo slug', (tester) async {
    await tester.pumpWidget(
      _pills(const ProductQuery(categorySlug: 'toners-hp')),
    );

    expect(_labels(tester), ['toners-hp']);
  });

  testWidgets('preço só com mínimo e só com máximo', (tester) async {
    await tester.pumpWidget(_pills(const ProductQuery(minPriceCents: 1290)));
    expect(_labels(tester), ['a partir de R\$ 12,90']);

    await tester.pumpWidget(_pills(const ProductQuery(maxPriceCents: 30000)));
    expect(_labels(tester), ['até R\$ 300,00']);
  });

  testWidgets('sem filtro ativo não mostra nada', (tester) async {
    await tester.pumpWidget(
      _pills(const ProductQuery(search: 'caneta', sort: ProductSort.name)),
    );

    expect(find.byType(AppChip), findsNothing);
    expect(find.text('Limpar filtros'), findsNothing);
  });

  testWidgets('tocar numa pílula pede a remoção só dela', (tester) async {
    final calls = <String>[];
    await tester.pumpWidget(
      _pills(
        const ProductQuery(
          categorySlug: 'escolar',
          brandSlugs: ['hp', 'bic'],
          maxPriceCents: 30000,
          onSale: true,
          featured: true,
        ),
        category: escolar,
        calls: calls,
      ),
    );

    for (final label in [
      'Escolar',
      'bic',
      'HP',
      'até R\$ 300,00',
      'Só ofertas',
      'Só destaques',
    ]) {
      await tester.tap(find.text(label));
    }

    expect(calls, [
      'category',
      'brand:bic',
      'brand:hp',
      'price',
      'onSale',
      'featured',
    ]);
  });

  testWidgets('"Limpar filtros" chama o callback', (tester) async {
    final calls = <String>[];
    await tester.pumpWidget(
      _pills(const ProductQuery(onSale: true), calls: calls),
    );

    await tester.tap(find.text('Limpar filtros'));

    expect(calls, ['clear']);
  });

  test('countOf conta uma pílula por filtro', () {
    expect(ActiveFilterPills.countOf(const ProductQuery(search: 'x')), 0);
    expect(
      ActiveFilterPills.countOf(
        const ProductQuery(
          categorySlug: 'escolar',
          brandSlugs: ['hp', 'bic'],
          minPriceCents: 100,
          maxPriceCents: 200,
          onSale: true,
          featured: true,
        ),
      ),
      6,
    );
  });
}
