import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/modules/catalog/widgets/category_trail.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../shared/support/themed.dart';

void main() {
  testWidgets('da raiz até a categoria do produto, separadas por "/"', (
    tester,
  ) async {
    await tester.pumpWidget(
      themed(
        CategoryTrail(
          categories: tonerDetail.categories,
          onOpenCategory: (_) {},
        ),
      ),
    );

    expect(find.text('Cartuchos & Toners'), findsOneWidget);
    expect(find.text('Toners HP'), findsOneWidget);
    expect(find.text('/'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('Cartuchos & Toners')).dx,
      lessThan(tester.getTopLeft(find.text('Toners HP')).dx),
    );
  });

  testWidgets('tocar numa categoria chama o callback com o slug', (
    tester,
  ) async {
    final opened = <String>[];
    await tester.pumpWidget(
      themed(
        CategoryTrail(
          categories: tonerDetail.categories,
          onOpenCategory: opened.add,
        ),
      ),
    );

    await tester.tap(find.text('Toners HP'));
    await tester.tap(find.text('Cartuchos & Toners'));

    expect(opened, ['toners-hp', 'cartuchos-toners']);
  });

  testWidgets('o link tem alvo de toque de pelo menos 44', (tester) async {
    await tester.pumpWidget(themed(CatalogLink(label: 'HP', onTap: () {})));

    expect(
      tester.getSize(find.byType(CatalogLink)).height,
      greaterThanOrEqualTo(CatalogLink.minTapHeight),
    );
    expect(
      tester.getSemantics(find.byType(CatalogLink)),
      isSemantics(isLink: true, label: 'HP'),
    );
  });
}
