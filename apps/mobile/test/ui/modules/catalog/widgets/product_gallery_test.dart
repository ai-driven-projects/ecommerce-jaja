import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/catalog/model/product_detail_entity.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_gallery.dart';
import 'package:mobile/ui/shared/theme/brand_tokens.dart';
import 'package:mobile/ui/shared/widgets/product_art.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../shared/support/fake_image_loads.dart';
import '../../../shared/support/themed.dart';

Widget _gallery(ProductDetail product) =>
    themed(SingleChildScrollView(child: ProductGallery(product: product)));

/// As seis fotos de `tonerDetail` nunca chegam: nada aciona o cache do
/// aparelho.
void _holdTonerImages() {
  for (final image in tonerDetail.images) {
    holdImageLoad(image.largeUrl);
    holdImageLoad(image.thumbUrl);
  }
}

/// Tela de celular: a galeria (quadrada na largura) e a faixa cabem nela.
void _phoneView(WidgetTester tester) {
  tester.view.physicalSize = const Size(400, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Finder _thumb(int number, int total) =>
    find.bySemanticsLabel(ProductGallery.thumbLabel(number, total));

void main() {
  testWidgets('três imagens: contador "1/3" e três miniaturas', (tester) async {
    _holdTonerImages();
    _phoneView(tester);
    await tester.pumpWidget(_gallery(tonerDetail));

    expect(find.text('1/3'), findsOneWidget);
    for (var number = 1; number <= 3; number++) {
      expect(_thumb(number, 3), findsOneWidget);
    }
    expect(
      tester.getSemantics(_thumb(1, 3)),
      isSemantics(isButton: true, isSelected: true),
    );
    expect(
      tester.getSemantics(_thumb(2, 3)),
      isSemantics(isButton: true, isSelected: false),
    );
  });

  testWidgets('tocar na terceira miniatura mostra "3/3" e a destaca', (
    tester,
  ) async {
    _holdTonerImages();
    _phoneView(tester);
    await tester.pumpWidget(_gallery(tonerDetail));

    await tester.tap(_thumb(3, 3));
    await tester.pumpAndSettle();

    expect(find.text('3/3'), findsOneWidget);
    expect(
      tester.getSemantics(_thumb(3, 3)),
      isSemantics(isSelected: true),
    );
    expect(
      tester.getSemantics(_thumb(1, 3)),
      isSemantics(isSelected: false),
    );
    expect(tester.widget<PageView>(find.byType(PageView)).controller!.page, 2);
  });

  testWidgets('deslizar para a esquerda passa para "2/3"', (tester) async {
    _holdTonerImages();
    _phoneView(tester);
    await tester.pumpWidget(_gallery(tonerDetail));

    await tester.fling(find.byType(PageView), const Offset(-300, 0), 1000);
    await tester.pumpAndSettle();

    expect(find.text('2/3'), findsOneWidget);
    expect(
      tester.getSemantics(_thumb(2, 3)),
      isSemantics(isSelected: true),
    );
  });

  testWidgets('uma imagem: sem contador nem miniaturas', (tester) async {
    final image = tonerDetail.images.first;
    holdImageLoad(image.largeUrl);
    holdImageLoad(image.thumbUrl);
    _phoneView(tester);
    await tester.pumpWidget(_gallery(tonerDetail.copyWith(images: [image])));

    expect(find.byType(ProductArt), findsOneWidget);
    expect(find.text('1/1'), findsNothing);
    expect(_thumb(1, 1), findsNothing);
  });

  testWidgets('sem imagens: 🖨️ sobre o tom azul da raiz cartuchos-toners', (
    tester,
  ) async {
    _phoneView(tester);
    await tester.pumpWidget(_gallery(tonerDetail.copyWith(images: const [])));

    final art = tester.widget<ProductArt>(find.byType(ProductArt));
    expect(art.size, ProductArtSize.gallery);
    expect(art.imageUrl, isNull);
    expect(art.tint, ProductArtTint.blue);
    expect(find.text('🖨️'), findsOneWidget);
    expect(find.byType(PageView), findsNothing);
    expect(find.textContaining('/'), findsNothing);

    final context = tester.element(find.byType(ProductGallery));
    final area = tester.widget<ColoredBox>(
      find
          .ancestor(of: find.text('🖨️'), matching: find.byType(ColoredBox))
          .first,
    );
    expect(area.color, context.tokens.tintBlue);
  });

  testWidgets('a galeria é quadrada na largura disponível', (tester) async {
    _phoneView(tester);
    await tester.pumpWidget(_gallery(plainDetail));

    final size = tester.getSize(find.byType(AspectRatio));
    expect(size.width, size.height);
  });
}
