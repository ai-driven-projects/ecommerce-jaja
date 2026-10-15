import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/home_catalog.dart';
import 'package:mobile/ui/modules/catalog/widgets/highlighted_categories_grid.dart';
import 'package:mobile/ui/shared/widgets/skeleton_box.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../shared/support/themed.dart';

// `adesivos` e `pinceis-e-trinchas` (raiz 🎨) e `toners-hp` (raiz 🖨️).
final _highlighted = highlightedCategories(categoryTree, 12);

Widget _grid({ValueChanged<String>? onOpenCategory}) => themed(
  HighlightedCategoriesGrid(
    categories: _highlighted,
    onOpenCategory: onOpenCategory ?? (_) {},
  ),
);

void main() {
  testWidgets('cada cartão tem o nome, "N produtos" e o emoji da raiz', (
    tester,
  ) async {
    await tester.pumpWidget(_grid());

    expect(find.text('Toners HP'), findsOneWidget);
    expect(find.text('12 produtos'), findsOneWidget);
    expect(find.text('🖨️'), findsOneWidget);
    expect(find.text('Adesivos Stickers'), findsOneWidget);
    expect(find.text('9 produtos'), findsOneWidget);
    expect(find.text('Pincéis e Trinchas'), findsOneWidget);
    expect(find.text('14 produtos'), findsOneWidget);
    expect(find.text('🎨'), findsNWidgets(2));
  });

  testWidgets('o cartão é um botão que anuncia nome e contagem', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(_grid());

    expect(
      tester.getSemantics(find.bySemanticsLabel('Toners HP, 12 produtos')),
      isSemantics(label: 'Toners HP, 12 produtos', isButton: true),
    );
    handle.dispose();
  });

  testWidgets('o toque chama onOpenCategory com o slug', (tester) async {
    final opened = <String>[];
    await tester.pumpWidget(_grid(onOpenCategory: opened.add));

    await tester.tap(find.text('Toners HP'));
    expect(opened, ['toners-hp']);
  });

  testWidgets('duas colunas; a terceira fica sozinha na segunda linha', (
    tester,
  ) async {
    await tester.pumpWidget(_grid());

    final adesivos = tester.getTopLeft(find.text('Adesivos Stickers'));
    final pinceis = tester.getTopLeft(find.text('Pincéis e Trinchas'));
    final toners = tester.getTopLeft(find.text('Toners HP'));
    expect(adesivos.dy, pinceis.dy);
    expect(pinceis.dx, greaterThan(adesivos.dx));
    expect(toners.dx, adesivos.dx);
    expect(toners.dy, greaterThan(adesivos.dy));
  });

  testWidgets('skeleton com seis blocos de 74', (tester) async {
    await tester.pumpWidget(themed(const HighlightedCategoriesGridSkeleton()));

    expect(find.byType(SkeletonBox), findsNWidgets(6));
    for (final element in find.byType(SkeletonBox).evaluate()) {
      expect(element.size!.height, HighlightedCategoriesGrid.tileHeight);
    }
  });
}
