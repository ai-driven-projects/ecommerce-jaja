import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/product_summary_entity.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_rail.dart';
import 'package:mobile/ui/shared/widgets/product_card.dart';
import 'package:mobile/ui/shared/widgets/skeleton_box.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../shared/support/fake_image_loads.dart';
import '../../../shared/support/themed.dart';

Widget _rail({
  List<ProductSummary>? items,
  ValueChanged<String>? onOpenProduct,
  double cardWidth = ProductRail.featuredCardWidth,
}) => themed(
  ProductRail(
    products: items ?? products,
    onOpenProduct: onOpenProduct ?? (_) {},
    cardWidth: cardWidth,
  ),
);

void main() {
  testWidgets('um card por produto, com nome, preços e selos', (tester) async {
    holdImageLoad(brushDuo.thumbUrl!);
    await tester.pumpWidget(_rail());
    await tester.pumpAndSettle();

    expect(find.byType(ProductCard), findsNWidgets(3));
    for (final product in products) {
      expect(find.text(product.name), findsOneWidget);
    }
    expect(find.text('R\$ 7,50'), findsOneWidget);
    expect(find.text('R\$ 34,90'), findsOneWidget);
    expect(find.text('R\$ 49,90'), findsOneWidget);
    expect(find.text('−30%'), findsOneWidget);
    expect(find.text('−20%'), findsOneWidget);
    expect(find.text('Destaque'), findsOneWidget);
    expect(find.text('unidade'), findsNWidgets(3));
  });

  testWidgets('a reserva é o 🎨 da raiz; a foto do brushDuo é pedida', (
    tester,
  ) async {
    holdImageLoad(brushDuo.thumbUrl!);
    await tester.pumpWidget(_rail());
    await tester.pumpAndSettle();

    expect(find.text('🎨'), findsNWidgets(2));
    expect(find.text('🛒'), findsNothing);
    expect(find.byType(CachedNetworkImage), findsOneWidget);
  });

  testWidgets('o toque no card chama onOpenProduct com o slug', (tester) async {
    holdImageLoad(brushDuo.thumbUrl!);
    final opened = <String>[];
    await tester.pumpWidget(_rail(onOpenProduct: opened.add));
    await tester.pumpAndSettle();

    await tester.tap(find.text(finePen.name));
    expect(opened, [finePen.slug]);
  });

  testWidgets('os cards têm a largura pedida e a mesma altura', (tester) async {
    holdImageLoad(brushDuo.thumbUrl!);
    await tester.pumpWidget(_rail(cardWidth: ProductRail.offersCardWidth));
    await tester.pumpAndSettle();

    final sizes = find.byType(ProductCard).evaluate().map((e) => e.size!);
    expect(sizes.map((size) => size.width), everyElement(220.0));
    expect(sizes.map((size) => size.height).toSet(), hasLength(1));
  });

  testWidgets('skeleton com skeletonCount blocos do tamanho do card', (
    tester,
  ) async {
    await tester.pumpWidget(themed(const ProductRailSkeleton(count: 4)));

    expect(find.byType(SkeletonBox), findsNWidgets(4));
    expect(find.byType(ProductCard), findsNothing);
    for (final element in find.byType(SkeletonBox).evaluate()) {
      expect(element.size, const Size(180, ProductRail.skeletonHeight));
    }
  });
}
