import 'package:mobile/core/value_objects/money.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';
import 'package:mobile/modules/cart/model/cart_rules.dart' as rules;
import 'package:mobile/modules/cart/model/cart_state.dart';

import '../../../ui/shared/support/money.dart';

// Linhas do carrinho com ids em minúsculas, como a API devolve, e sem foto
// (`thumbUrl: null`): uma foto de verdade acionaria o cache do aparelho nos
// widget tests (ver `test/ui/shared/support/fake_image_loads.dart`).

/// Caneta disponível: 2 × R$ 12,90.
final canetaLine = CartLine(
  productId: '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e20',
  slug: 'caneta-esferografica-azul',
  name: 'Caneta Esferográfica Azul',
  unit: 'unidade',
  rootCategorySlug: 'escrita',
  thumbUrl: null,
  price: money(1290),
  listPrice: null,
  quantity: 2,
  isAvailable: true,
  lineTotal: money(2580),
);

/// Toner disponível com "De:": 1 × R$ 34,90 (de R$ 49,90).
final tonerLine = CartLine(
  productId: '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e10',
  slug: 'toner-hp-230x-amarelo',
  name: 'Toner HP 230x Amarelo',
  unit: 'caixa com 1',
  rootCategorySlug: 'informatica',
  thumbUrl: null,
  price: money(3490),
  listPrice: money(4990),
  quantity: 1,
  isAvailable: true,
  lineTotal: money(3490),
);

/// Caderno indisponível: 1 × R$ 21,90, sem total.
final unavailableLine = CartLine(
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
);

/// Prévia coerente com [lines]: subtotal das disponíveis, entrega de R$ 4,90
/// abaixo de R$ 79,00 (grátis a partir dele, ou sem itens) e o que falta.
CartDetail detailOf(List<CartLine> lines) {
  final subtotal = Money.sum([
    for (final line in lines)
      if (line.lineTotal case final Money total) total,
  ]);
  final isFree = lines.isEmpty || subtotal >= rules.freeDeliveryThreshold;
  final deliveryFee = isFree ? Money.zero : rules.deliveryFee;
  return CartDetail(
    lines: List.unmodifiable(lines),
    itemCount: lines.fold(0, (sum, line) => sum + line.quantity),
    subtotal: subtotal,
    deliveryFee: deliveryFee,
    total: subtotal + deliveryFee,
    freeDeliveryThreshold: rules.freeDeliveryThreshold,
    missingForFreeDelivery: isFree
        ? Money.zero
        : money(rules.freeDeliveryThreshold.cents - subtotal.cents),
    hasUnavailableItems: lines.any((line) => !line.isAvailable),
  );
}

/// Estado em dia com a prévia de [lines]: os itens são as linhas com as
/// mesmas quantidades.
CartState stateOf(List<CartLine> lines) => CartState(
  items: [
    for (final line in lines)
      CartItem(productId: line.productId, quantity: line.quantity),
  ],
  detail: detailOf(lines),
);
