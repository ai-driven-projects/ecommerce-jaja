import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/api/cart_dto.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';

import '../../ui/shared/support/money.dart';
import 'support/cart_json.dart';

Matcher throwsFormatExceptionNaming(String field) => throwsA(
  isA<FormatException>().having(
    (error) => error.message,
    'message',
    contains(field),
  ),
);

void main() {
  group('parseCartDetail', () {
    test('converte a prévia completa em Money', () {
      final decoded = jsonDecode(jsonEncode(cartPreviewJson));

      final detail = parseCartDetail(decoded);

      expect(
        detail,
        CartDetail(
          lines: [
            CartLine(
              productId: '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e20',
              slug: 'caneta-esferografica-azul',
              name: 'Caneta Esferográfica Azul',
              unit: 'unidade',
              rootCategorySlug: 'escrita',
              thumbUrl:
                  'https://img.kalunga.com.br/fotosdeprodutos/caneta-d.jpg',
              price: money(1290),
              listPrice: money(1590),
              quantity: 2,
              isAvailable: true,
              lineTotal: money(2580),
            ),
            CartLine(
              productId: '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e21',
              slug: 'caderno-universitario',
              name: 'Caderno Universitário',
              unit: 'unidade',
              rootCategorySlug: 'papelaria',
              thumbUrl: null,
              price: money(2190),
              listPrice: null,
              quantity: 1,
              isAvailable: false,
              lineTotal: null,
            ),
          ],
          itemCount: 3,
          subtotal: money(2580),
          deliveryFee: money(490),
          total: money(3070),
          freeDeliveryThreshold: money(7900),
          missingForFreeDelivery: money(5320),
          hasUnavailableItems: true,
        ),
      );
    });

    test('linha indisponível chega sem total e sem foto', () {
      final line = parseCartDetail(cartPreviewJson).lines.last;

      expect(line.isAvailable, isFalse);
      expect(line.lineTotal, isNull);
      expect(line.thumbUrl, isNull);
      expect(line.listPrice, isNull);
    });

    test('prévia vazia é igual ao CartDetail.empty()', () {
      expect(parseCartDetail(emptyCartPreviewJson), CartDetail.empty());
    });

    test('as linhas mantêm a ordem recebida e não podem ser alteradas', () {
      final detail = parseCartDetail(cartPreviewJson);

      expect(detail.lines.map((line) => line.slug), [
        'caneta-esferografica-azul',
        'caderno-universitario',
      ]);
      expect(() => detail.lines.clear(), throwsUnsupportedError);
    });

    test('priceCents negativo lança FormatException com o campo', () {
      expect(
        () => parseCartDetail(previewWithLineField('priceCents', -1)),
        throwsFormatExceptionNaming('priceCents'),
      );
    });

    test('totalCents negativo lança FormatException com o campo', () {
      expect(
        () => parseCartDetail(previewWith('totalCents', -1)),
        throwsFormatExceptionNaming('totalCents'),
      );
    });

    test('linha sem slug lança FormatException com o campo', () {
      expect(
        () => parseCartDetail(previewWithoutLineField('slug')),
        throwsFormatExceptionNaming('slug'),
      );
    });

    test('linha sem thumbUrl lança FormatException com o campo', () {
      expect(
        () => parseCartDetail(previewWithoutLineField('thumbUrl')),
        throwsFormatExceptionNaming('thumbUrl'),
      );
    });

    test('prévia sem subtotalCents lança FormatException com o campo', () {
      expect(
        () => parseCartDetail(previewWithout('subtotalCents')),
        throwsFormatExceptionNaming('subtotalCents'),
      );
    });

    test('campo de outro tipo lança FormatException com o campo', () {
      expect(
        () => parseCartDetail(previewWithLineField('quantity', '2')),
        throwsFormatExceptionNaming('quantity'),
      );
      expect(
        () => parseCartDetail(previewWith('hasUnavailableItems', 'sim')),
        throwsFormatExceptionNaming('hasUnavailableItems'),
      );
    });

    test('linha que não é mapa lança FormatException', () {
      expect(
        () => parseCartDetail(previewWith('lines', <Object?>['caneta'])),
        throwsFormatExceptionNaming('lines'),
      );
    });

    test('corpo que não é mapa lança FormatException', () {
      expect(
        () => parseCartDetail([cartPreviewJson]),
        throwsA(isA<FormatException>()),
      );
      expect(() => parseCartDetail(null), throwsA(isA<FormatException>()));
    });
  });

  group('encodeCartItems', () {
    test('monta {"items": [...]} na ordem do carrinho', () {
      final body = encodeCartItems(const [
        CartItem(productId: 'b', quantity: 2),
        CartItem(productId: 'a', quantity: 1),
      ]);

      expect(jsonDecode(jsonEncode(body)), {
        'items': [
          {'productId': 'b', 'quantity': 2},
          {'productId': 'a', 'quantity': 1},
        ],
      });
    });

    test('carrinho vazio vira lista vazia', () {
      expect(encodeCartItems(const []), {'items': <Object?>[]});
    });
  });
}
