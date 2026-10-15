import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/category_entity.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/ui/modules/catalog/widgets/category_chips_row.dart';
import 'package:mobile/ui/shared/widgets/app_chip.dart';
import 'package:mobile/ui/shared/widgets/skeleton_box.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../shared/support/themed.dart';

Widget _row({
  List<Category> roots = rootCategories,
  ValueChanged<ProductQuery>? onSelect,
  bool loading = false,
}) => themed(
  CategoryChipsRow(
    roots: roots,
    onSelect: onSelect ?? (_) {},
    loading: loading,
  ),
);

Iterable<AppChip> _chips(WidgetTester tester) =>
    tester.widgetList<AppChip>(find.byType(AppChip));

void main() {
  testWidgets('"Tudo" e as raízes na ordem da API, com o emoji da raiz', (
    tester,
  ) async {
    await tester.pumpWidget(_row());

    expect(_chips(tester).map((chip) => chip.label), [
      'Tudo',
      'Artes & Pintura',
      'Cartuchos & Toners',
      'Escolar',
    ]);
    expect(_chips(tester).map((chip) => chip.emoji), ['🛒', '🎨', '🖨️', '🎒']);
    expect(_chips(tester).every((chip) => !chip.selected), isTrue);
    expect(find.text('🖨️'), findsOneWidget);
  });

  testWidgets('toque em "Escolar" devolve a consulta da categoria', (
    tester,
  ) async {
    final selected = <ProductQuery>[];
    await tester.pumpWidget(_row(onSelect: selected.add));

    await tester.tap(find.text('Escolar'));
    expect(selected, [const ProductQuery(categorySlug: 'escolar')]);
  });

  testWidgets('toque em "Tudo" devolve a consulta vazia', (tester) async {
    final selected = <ProductQuery>[];
    await tester.pumpWidget(_row(onSelect: selected.add));

    await tester.tap(find.text('Tudo'));
    expect(selected, [const ProductQuery()]);
  });

  testWidgets('carregando: nove blocos em pílula e nenhum chip', (
    tester,
  ) async {
    await tester.pumpWidget(_row(loading: true));

    expect(find.byType(SkeletonBox), findsNWidgets(9));
    expect(find.byType(AppChip), findsNothing);
    expect(find.text('Tudo'), findsNothing);
  });
}
