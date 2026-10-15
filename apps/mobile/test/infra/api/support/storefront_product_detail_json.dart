// JSON de `GET /storefront/products/:slug` para `tonerDetail` e
// `plainDetail` de `test/modules/catalog/support/catalog_fixtures.dart`, com os
// mesmos valores, para `toEntity()` ser comparável às fixtures. As imagens do
// toner chegam fora de ordem (`order` 2, 0, 1) e há um campo a mais
// (`createdAt`), que o app ignora.

import '../../../modules/catalog/support/catalog_fixtures.dart';

const tonerImage0Json = <String, Object?>{
  'thumbUrl': 'https://img.kalunga.com.br/fotosdeprodutos/796915d.jpg',
  'largeUrl': 'https://img.kalunga.com.br/fotosdeprodutos/796915z.jpg',
  'order': 0,
};

const tonerImage1Json = <String, Object?>{
  'thumbUrl': 'https://img.kalunga.com.br/fotosdeprodutos/796915d_1.jpg',
  'largeUrl': 'https://img.kalunga.com.br/fotosdeprodutos/796915z_1.jpg',
  'order': 1,
};

const tonerImage2Json = <String, Object?>{
  'thumbUrl': 'https://img.kalunga.com.br/fotosdeprodutos/796915d_2.jpg',
  'largeUrl': 'https://img.kalunga.com.br/fotosdeprodutos/796915z_2.jpg',
  'order': 2,
};

final tonerDetailJson = <String, Object?>{
  'id': '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e10',
  'slug':
      'toner-hp-230x-amarelo-laserjet-original-w2302x-para-hp-laserjet-pro-'
      '4203cdn-4203dn-4203dw-4303dw-4303fdn-4303fdw-cx-1-un',
  'name':
      'Toner HP 230x, Amarelo, Laserjet Original (W2302X), Para HP LaserJet '
      'Pro 4203cdn, 4203dn, 4203dw, 4303dw, 4303fdn, 4303fdw, CX 1 UN',
  'sku': '796915',
  'description': tonerDescription,
  'priceCents': 3490,
  'listPriceCents': 4990,
  'discountPercent': 30,
  'unit': 'caixa com 1',
  'isFeatured': true,
  'brand': <String, Object?>{'slug': 'hp', 'name': 'HP'},
  'categories': <Object?>[
    <String, Object?>{'slug': 'cartuchos-toners', 'name': 'Cartuchos & Toners'},
    <String, Object?>{'slug': 'toners-hp', 'name': 'Toners HP'},
  ],
  'images': <Object?>[tonerImage2Json, tonerImage0Json, tonerImage1Json],
  'createdAt': '2026-01-10T12:00:00.000Z',
};

const plainDetailJson = <String, Object?>{
  'id': '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e11',
  'slug': 'caneta-x',
  'name': 'Caneta X',
  'sku': null,
  'description': null,
  'priceCents': 750,
  'listPriceCents': null,
  'discountPercent': null,
  'unit': 'unidade',
  'isFeatured': false,
  'brand': null,
  'categories': <Object?>[],
  'images': <Object?>[],
};
