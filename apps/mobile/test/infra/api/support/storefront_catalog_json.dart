// JSON de `GET /storefront/categories` e de uma página de
// `GET /storefront/products` para as categorias e os três produtos de
// `test/modules/catalog/support/catalog_fixtures.dart`, com os mesmos ids,
// para `toEntity()` ser comparável às fixtures. Os nomes e slugs vêm do seed
// (`apps/backend/prisma/seed/data/{categories,products}.json`).

const adesivosJson = <String, Object?>{
  'slug': 'adesivos',
  'name': 'Adesivos Stickers',
  'level': 2,
  'parentSlug': 'artes-pintura',
  'isHighlighted': true,
  'productCount': 9,
  'children': <Object?>[],
};

const pinceisETrinchasJson = <String, Object?>{
  'slug': 'pinceis-e-trinchas',
  'name': 'Pincéis e Trinchas',
  'level': 2,
  'parentSlug': 'artes-pintura',
  'isHighlighted': true,
  'productCount': 14,
  'children': <Object?>[],
};

const artesPinturaJson = <String, Object?>{
  'slug': 'artes-pintura',
  'name': 'Artes & Pintura',
  'level': 1,
  'parentSlug': null,
  'isHighlighted': false,
  'productCount': 23,
  'children': <Object?>[adesivosJson, pinceisETrinchasJson],
};

const tonersHpJson = <String, Object?>{
  'slug': 'toners-hp',
  'name': 'Toners HP',
  'level': 2,
  'parentSlug': 'cartuchos-toners',
  'isHighlighted': true,
  'productCount': 12,
  'children': <Object?>[],
};

const cartuchosTonersJson = <String, Object?>{
  'slug': 'cartuchos-toners',
  'name': 'Cartuchos & Toners',
  'level': 1,
  'parentSlug': null,
  'isHighlighted': false,
  'productCount': 12,
  'children': <Object?>[tonersHpJson],
};

const escolarJson = <String, Object?>{
  'slug': 'escolar',
  'name': 'Escolar',
  'level': 1,
  'parentSlug': null,
  'isHighlighted': false,
  'productCount': 31,
  'children': <Object?>[],
};

/// Corpo inteiro de `GET /storefront/categories`, na ordem de `categoryTree`.
const storefrontCategoriesJson = <Object?>[
  artesPinturaJson,
  cartuchosTonersJson,
  escolarJson,
];

const finePenJson = <String, Object?>{
  'id': '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e01',
  'slug': 'caneta-hidrografica-fine-pen-0-4mm-preto-fpbprzf-faber-castell-1-un',
  'name': 'Caneta hidrográfica Fine Pen 0,4mm preto FPBPRZF Faber Castell 1 UN',
  'brandName': 'Faber-Castell',
  'categoryName': 'Canetas Hidrográficas 0.4',
  'rootCategorySlug': 'artes-pintura',
  'priceCents': 750,
  'listPriceCents': null,
  'discountPercent': null,
  'unit': 'unidade',
  'thumbUrl': null,
  'isFeatured': true,
};

const brushDuoJson = <String, Object?>{
  'id': '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e02',
  'slug': 'caneta-pincel-brush-duo-acrilico-12-cores-oapgatc-master-un-1-un',
  'name':
      'Caneta pincel Brush duo acrílico, 12 cores, OAPGATC, Master - UN 1 UN',
  'brandName': 'Master',
  'categoryName': 'Canetas Hidrográficas Brush Pen',
  'rootCategorySlug': 'artes-pintura',
  'priceCents': 3490,
  'listPriceCents': 4990,
  'discountPercent': 30,
  'unit': 'unidade',
  'thumbUrl': 'https://img.kalunga.com.br/fotosdeprodutos/167231d.jpg',
  'isFeatured': false,
};

const brushSupersoftJson = <String, Object?>{
  'id': '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e03',
  'slug': 'caneta-pincel-brush-supersoft-20-cores-faber-castell-bt-20-un',
  'name': 'Caneta pincel Brush supersoft, 20 cores, Faber-Castell - BT 20 UN',
  'brandName': 'Faber-Castell',
  'categoryName': 'Canetas Hidrográficas Brush Pen',
  'rootCategorySlug': 'artes-pintura',
  'priceCents': 8100,
  'listPriceCents': 10180,
  'discountPercent': 20,
  'unit': 'unidade',
  'thumbUrl': null,
  'isFeatured': false,
};

const faberCastellFacetJson = <String, Object?>{
  'slug': 'faber-castell',
  'name': 'Faber-Castell',
  'count': 2,
};

const masterFacetJson = <String, Object?>{
  'slug': 'master',
  'name': 'Master',
  'count': 1,
};

/// Uma página de `GET /storefront/products` com os três produtos das fixtures
/// (a contagem total é de exemplo: 96 produtos em 12 páginas de 8).
const storefrontProductPageJson = <String, Object?>{
  'items': <Object?>[finePenJson, brushDuoJson, brushSupersoftJson],
  'total': 96,
  'page': 1,
  'pageSize': 8,
  'totalPages': 12,
  'brandFacets': <Object?>[faberCastellFacetJson, masterFacetJson],
};
