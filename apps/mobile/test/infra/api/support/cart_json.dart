// JSON de `POST /cart/preview` (`CartDetailDTO` em
// `modules/orders/src/cart/dto/cart.dto.ts`): uma caneta disponível (2 × R$
// 12,90) e um caderno indisponível (`lineTotalCents: null`, `thumbUrl:
// null`), com entrega cobrada. Há um campo a mais (`currency`), que o app
// ignora. As variantes inválidas partem destes mapas.

const canetaLineJson = <String, Object?>{
  'productId': '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e20',
  'slug': 'caneta-esferografica-azul',
  'name': 'Caneta Esferográfica Azul',
  'unit': 'unidade',
  'rootCategorySlug': 'escrita',
  'thumbUrl': 'https://img.kalunga.com.br/fotosdeprodutos/caneta-d.jpg',
  'priceCents': 1290,
  'listPriceCents': 1590,
  'quantity': 2,
  'isAvailable': true,
  'lineTotalCents': 2580,
};

const unavailableLineJson = <String, Object?>{
  'productId': '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e21',
  'slug': 'caderno-universitario',
  'name': 'Caderno Universitário',
  'unit': 'unidade',
  'rootCategorySlug': 'papelaria',
  'thumbUrl': null,
  'priceCents': 2190,
  'listPriceCents': null,
  'quantity': 1,
  'isAvailable': false,
  'lineTotalCents': null,
};

const cartPreviewJson = <String, Object?>{
  'lines': <Object?>[canetaLineJson, unavailableLineJson],
  'itemCount': 3,
  'subtotalCents': 2580,
  'deliveryFeeCents': 490,
  'totalCents': 3070,
  'freeDeliveryThresholdCents': 7900,
  'missingForFreeDeliveryCents': 5320,
  'hasUnavailableItems': true,
  'currency': 'BRL',
};

const emptyCartPreviewJson = <String, Object?>{
  'lines': <Object?>[],
  'itemCount': 0,
  'subtotalCents': 0,
  'deliveryFeeCents': 0,
  'totalCents': 0,
  'freeDeliveryThresholdCents': 7900,
  'missingForFreeDeliveryCents': 0,
  'hasUnavailableItems': false,
};

/// Prévia só com a [line] informada, com os totais coerentes com ela.
Map<String, Object?> previewWithLine(Map<String, Object?> line) {
  final total = line['lineTotalCents'] as int? ?? 0;
  final fee = total == 0 || total >= 7900 ? 0 : 490;
  return {
    'lines': <Object?>[line],
    'itemCount': line['quantity'],
    'subtotalCents': total,
    'deliveryFeeCents': fee,
    'totalCents': total + fee,
    'freeDeliveryThresholdCents': 7900,
    'missingForFreeDeliveryCents': fee == 0 ? 0 : 7900 - total,
    'hasUnavailableItems': line['isAvailable'] == false,
  };
}

/// Prévia válida com o [field] do topo trocado por [value].
Map<String, Object?> previewWith(String field, Object? value) => {
  ...cartPreviewJson,
  field: value,
};

/// Prévia válida sem o [field] do topo.
Map<String, Object?> previewWithout(String field) =>
    Map.of(cartPreviewJson)..remove(field);

/// Prévia cuja linha da caneta tem o [field] trocado por [value].
Map<String, Object?> previewWithLineField(String field, Object? value) =>
    previewWith('lines', <Object?>[
      {...canetaLineJson, field: value},
      unavailableLineJson,
    ]);

/// Prévia cuja linha da caneta não tem o [field].
Map<String, Object?> previewWithoutLineField(String field) => previewWith(
  'lines',
  <Object?>[Map.of(canetaLineJson)..remove(field), unavailableLineJson],
);
