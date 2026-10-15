import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_specs.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../shared/support/themed.dart';

Finder _row(String text) => find.text(text, findRichText: true);

void main() {
  testWidgets('tonerDetail: marca, categoria, código e unidade', (
    tester,
  ) async {
    await tester.pumpWidget(themed(ProductSpecs(product: tonerDetail)));

    expect(_row('Marca · HP'), findsOneWidget);
    expect(_row('Categoria · Cartuchos & Toners / Toners HP'), findsOneWidget);
    expect(_row('Código · ${tonerDetail.sku}'), findsOneWidget);
    expect(_row('Unidade · ${tonerDetail.unit}'), findsOneWidget);
  });

  test('a ordem é marca, categoria, código e unidade', () {
    expect(ProductSpecs.specsOf(tonerDetail).map((spec) => spec.$1), [
      'Marca',
      'Categoria',
      'Código',
      'Unidade',
    ]);
  });

  testWidgets('plainDetail: sem marca, categoria nem código', (tester) async {
    await tester.pumpWidget(themed(ProductSpecs(product: plainDetail)));

    expect(find.textContaining('Marca', findRichText: true), findsNothing);
    expect(find.textContaining('Código', findRichText: true), findsNothing);
    expect(find.textContaining('Categoria', findRichText: true), findsNothing);
    expect(_row('Unidade · ${plainDetail.unit}'), findsOneWidget);
  });

  testWidgets('sem marca nem código, com categoria: categoria e unidade', (
    tester,
  ) async {
    await tester.pumpWidget(
      themed(
        ProductSpecs(product: tonerDetail.copyWith(brand: null, sku: null)),
      ),
    );

    expect(find.textContaining('Marca', findRichText: true), findsNothing);
    expect(find.textContaining('Código', findRichText: true), findsNothing);
    expect(_row('Categoria · Cartuchos & Toners / Toners HP'), findsOneWidget);
    expect(_row('Unidade · ${tonerDetail.unit}'), findsOneWidget);
  });
}
