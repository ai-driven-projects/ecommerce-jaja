import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/widgets/price_text.dart';
import 'package:mobile/ui/shared/widgets/product_card.dart';

import '../support/fake_image_loads.dart';
import '../support/money.dart';
import '../support/themed.dart';

Widget _card({
  String name = 'Café torrado e moído 500 g',
  int? discountPercent,
  bool featured = false,
  int? previousCents,
  String? imageUrl,
  String? emoji,
  ProductArtTint tint = ProductArtTint.green,
  Widget? action,
  VoidCallback? onTap,
}) => themed(
  Center(
    child: SizedBox(
      width: 180,
      child: ProductCard(
        name: name,
        unit: 'pacote',
        price: money(1290),
        previousPrice: previousCents == null ? null : money(previousCents),
        discountPercent: discountPercent,
        featured: featured,
        imageUrl: imageUrl,
        emoji: emoji,
        tint: tint,
        action: action,
        onTap: onTap ?? () {},
      ),
    ),
  ),
);

int _tintBehind(WidgetTester tester, String emoji) => tester
    .widget<ColoredBox>(
      find
          .ancestor(of: find.text(emoji), matching: find.byType(ColoredBox))
          .first,
    )
    .color
    .toARGB32();

void main() {
  group('selo', () {
    testWidgets('desconto vence o destaque', (tester) async {
      await tester.pumpWidget(
        _card(discountPercent: 19, featured: true, previousCents: 1590),
      );

      expect(find.text('−19%'), findsOneWidget);
      expect(find.text('Destaque'), findsNothing);
      expect(find.text('R\$ 12,90'), findsOneWidget);
      expect(find.text('R\$ 15,90'), findsOneWidget);
    });

    testWidgets('só destaque mostra "Destaque"', (tester) async {
      await tester.pumpWidget(_card(featured: true));

      expect(find.text('Destaque'), findsOneWidget);
      expect(find.textContaining('%'), findsNothing);
    });

    testWidgets('sem desconto nem destaque, nenhum selo', (tester) async {
      await tester.pumpWidget(_card());

      expect(find.text('Destaque'), findsNothing);
      expect(find.textContaining('%'), findsNothing);
    });
  });

  group('área de imagem', () {
    testWidgets('sem foto e sem emoji mostra 🛒 sobre o verde', (tester) async {
      await tester.pumpWidget(_card());

      expect(find.text('🛒'), findsOneWidget);
      expect(_tintBehind(tester, '🛒'), 0xFFF0F7EA);
    });

    testWidgets('emoji ☕ sobre o tom pêssego', (tester) async {
      await tester.pumpWidget(_card(emoji: '☕', tint: ProductArtTint.peach));

      expect(find.text('☕'), findsOneWidget);
      expect(find.text('🛒'), findsNothing);
      expect(_tintBehind(tester, '☕'), 0xFFFFF1E6);
    });

    testWidgets('foto que falha cai na reserva', (tester) async {
      failImageLoad('https://cdn.jaja.test/cafe.png');
      await tester.pumpWidget(
        _card(
          imageUrl: 'https://cdn.jaja.test/cafe.png',
          emoji: '☕',
          tint: ProductArtTint.peach,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(CachedNetworkImage), findsOneWidget);
      expect(find.text('☕'), findsOneWidget);
      expect(_tintBehind(tester, '☕'), 0xFFFFF1E6);
    });

    testWidgets('enquanto a foto chega, área branca sem emoji', (tester) async {
      holdImageLoad('https://cdn.jaja.test/cafe.png');
      await tester.pumpWidget(
        _card(imageUrl: 'https://cdn.jaja.test/cafe.png', emoji: '☕'),
      );
      await tester.pumpAndSettle();

      expect(find.text('☕'), findsNothing);
      final area = tester.widget<ColoredBox>(
        find.descendant(
          of: find.byType(CachedNetworkImage),
          matching: find.byType(ColoredBox),
        ),
      );
      expect(area.color.toARGB32(), 0xFFFFFFFF);
    });
  });

  testWidgets('nome longo em até 3 linhas, completo para leitores de tela', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    const longName =
        'Papel sulfite A4 75 g/m² branco, caixa com 10 pacotes de 500 '
        'folhas, ideal para impressoras jato de tinta e laser';
    await tester.pumpWidget(_card(name: longName));

    final text = tester.widget<Text>(find.text(longName));
    expect(text.maxLines, 3);
    expect(text.overflow, TextOverflow.ellipsis);
    expect(find.bySemanticsLabel(longName), findsOneWidget);
    handle.dispose();
  });

  testWidgets('sem action, nada ao lado do preço', (tester) async {
    await tester.pumpWidget(_card());

    final row = tester.widget<Row>(
      find.ancestor(of: find.byType(PriceText), matching: find.byType(Row)),
    );
    expect(row.children, hasLength(1));
  });

  testWidgets('com action, ela aparece ao lado do preço', (tester) async {
    await tester.pumpWidget(
      _card(action: const SizedBox(key: Key('acao'), width: 36, height: 36)),
    );

    expect(
      find.descendant(
        of: find.ancestor(
          of: find.byType(PriceText),
          matching: find.byType(Row),
        ),
        matching: find.byKey(const Key('acao')),
      ),
      findsOneWidget,
    );
  });

  testWidgets('o toque chama onTap', (tester) async {
    var taps = 0;
    await tester.pumpWidget(_card(onTap: () => taps++));

    await tester.tap(find.byType(ProductCard));
    expect(taps, 1);
  });
}
