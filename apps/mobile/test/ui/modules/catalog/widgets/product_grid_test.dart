import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/product_summary_entity.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_grid.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_rail.dart';
import 'package:mobile/ui/shared/widgets/product_card.dart';
import 'package:mobile/ui/shared/widgets/skeleton_box.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../shared/support/themed.dart';

// Viewport alto: a grade é preguiçosa e só monta o que está à vista.
const _surface = Size(800, 2400);

void _useTallView(WidgetTester tester) {
  tester.view.physicalSize = _surface;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Future<void> _pumpGrid(
  WidgetTester tester,
  List<ProductSummary> items, {
  ValueChanged<String>? onOpen,
}) async {
  _useTallView(tester);
  await tester.pumpWidget(
    themed(
      CustomScrollView(
        slivers: [
          ProductGrid(products: items, onOpenProduct: onOpen ?? (_) {}),
        ],
      ),
    ),
  );
}

Rect _card(WidgetTester tester, int index) =>
    tester.getRect(find.byType(ProductCard).at(index));

void main() {
  testWidgets('cinco produtos ficam em três linhas, o último sozinho', (
    tester,
  ) async {
    await _pumpGrid(tester, manyProducts(5));

    expect(find.byType(ProductCard), findsNWidgets(5));
    expect(
      find.descendant(
        of: find.byType(ProductGrid),
        matching: find.byType(IntrinsicHeight),
      ),
      findsNWidgets(3),
    );
    final cards = [for (var i = 0; i < 5; i++) _card(tester, i)];
    expect(cards[1].top, cards[0].top);
    expect(cards[1].left, greaterThan(cards[0].right));
    expect(cards[2].top, greaterThan(cards[0].bottom));
    expect(cards[3].top, cards[2].top);
    expect(cards[4].top, greaterThan(cards[2].bottom));
    expect(cards[4].left, cards[0].left);
    expect(cards[4].width, cards[0].width);
  });

  testWidgets('os dois cards de uma linha têm a mesma altura', (tester) async {
    final items = [
      finePen.copyWith(name: 'Curto'),
      brushDuo.copyWith(thumbUrl: null),
    ];
    await _pumpGrid(tester, items);

    final sizes = find.byType(ProductCard).evaluate().map((e) => e.size!);
    expect(sizes.map((size) => size.height).toSet(), hasLength(1));
  });

  testWidgets('o toque num card chama onOpenProduct com o slug', (
    tester,
  ) async {
    final opened = <String>[];
    final items = manyProducts(3);
    await _pumpGrid(tester, items, onOpen: opened.add);

    await tester.tap(find.text(items[2].name));
    expect(opened, [items[2].slug]);
  });

  testWidgets('o skeleton tem seis blocos em três linhas de dois', (
    tester,
  ) async {
    _useTallView(tester);
    await tester.pumpWidget(themed(const ProductGridSkeleton(count: 6)));

    expect(find.byType(SkeletonBox), findsNWidgets(6));
    expect(find.byType(ProductCard), findsNothing);
    final blocks = find.byType(SkeletonBox).evaluate().toList();
    for (final element in blocks) {
      expect(element.size!.height, ProductRail.skeletonHeight);
    }
    final tops = {
      for (final element in blocks)
        (element.renderObject! as RenderBox).localToGlobal(Offset.zero).dy,
    };
    expect(tops, hasLength(3));
  });
}
