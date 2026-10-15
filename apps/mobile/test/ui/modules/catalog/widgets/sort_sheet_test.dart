import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/product_listing.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/ui/modules/catalog/widgets/choice_row.dart';
import 'package:mobile/ui/modules/catalog/widgets/sort_sheet.dart';

import '../../../shared/support/themed.dart';

const _openLabel = 'Abrir';

/// Botão que abre o painel para [query] e entrega a ordem devolvida.
Widget _opener(ProductQuery query, void Function(ProductSort?) onResult) =>
    themed(
      Center(
        child: Builder(
          builder: (context) => TextButton(
            onPressed: () async => onResult(
              await showSortSheet(
                context,
                current: effectiveSort(query),
                options: listingSorts(query),
              ),
            ),
            child: const Text(_openLabel),
          ),
        ),
      ),
    );

Future<void> _open(WidgetTester tester) async {
  await tester.tap(find.text(_openLabel));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('sem busca não oferece "Mais relevantes" e marca "Destaques"', (
    tester,
  ) async {
    await tester.pumpWidget(_opener(const ProductQuery(), (_) {}));
    await _open(tester);

    expect(find.text('Ordenar por'), findsOneWidget);
    expect(find.text('Mais relevantes'), findsNothing);
    expect(
      [
        for (final row in tester.widgetList<ChoiceRow>(find.byType(ChoiceRow)))
          row.label,
      ],
      [
        'Destaques',
        'Menor preço',
        'Maior preço',
        'Nome (A–Z)',
        'Maior desconto',
      ],
    );
    expect(find.byIcon(Icons.check), findsOneWidget);
    expect(
      tester
          .widget<ChoiceRow>(find.widgetWithText(ChoiceRow, 'Destaques'))
          .selected,
      isTrue,
    );
  });

  testWidgets('com busca oferece "Mais relevantes" e marca a ordem atual', (
    tester,
  ) async {
    await tester.pumpWidget(
      _opener(
        const ProductQuery(search: 'toner', sort: ProductSort.name),
        (_) {},
      ),
    );
    await _open(tester);

    expect(find.text('Mais relevantes'), findsOneWidget);
    expect(
      find.ancestor(
        of: find.byIcon(Icons.check),
        matching: find.widgetWithText(ChoiceRow, 'Nome (A–Z)'),
      ),
      findsOneWidget,
    );
    expect(
      tester.getSemantics(find.text('Nome (A–Z)')),
      isSemantics(isSelected: true),
    );
  });

  testWidgets('escolher "Menor preço" fecha e devolve priceAsc', (
    tester,
  ) async {
    final results = <ProductSort?>[];
    await tester.pumpWidget(_opener(const ProductQuery(), results.add));
    await _open(tester);

    await tester.tap(find.text('Menor preço'));
    await tester.pumpAndSettle();

    expect(results, [ProductSort.priceAsc]);
    expect(find.text('Ordenar por'), findsNothing);
  });

  testWidgets('fechar sem escolher devolve null', (tester) async {
    final results = <ProductSort?>[];
    await tester.pumpWidget(_opener(const ProductQuery(), results.add));
    await _open(tester);

    await tester.tapAt(const Offset(20, 20));
    await tester.pumpAndSettle();

    expect(results, [null]);
  });
}
