import 'package:mobile/modules/catalog/model/category_entity.dart';
import 'package:mobile/modules/catalog/model/product_summary_entity.dart';

import '../../../ui/shared/support/money.dart';

// Nomes, slugs e pais de `apps/backend/prisma/seed/data/categories.json`.
// `productCount` é calculado pela API a partir dos produtos visíveis, então o
// seed não o fixa: os valores aqui são de exemplo, consistentes entre pai e
// filhas. A ordem da árvore é a que os testes da Início precisam.

const adesivos = Category(
  slug: 'adesivos',
  name: 'Adesivos Stickers',
  level: 2,
  parentSlug: 'artes-pintura',
  isHighlighted: true,
  productCount: 9,
  children: [],
);

const pinceisETrinchas = Category(
  slug: 'pinceis-e-trinchas',
  name: 'Pincéis e Trinchas',
  level: 2,
  parentSlug: 'artes-pintura',
  isHighlighted: true,
  productCount: 14,
  children: [],
);

const artesPintura = Category(
  slug: 'artes-pintura',
  name: 'Artes & Pintura',
  level: 1,
  parentSlug: null,
  isHighlighted: false,
  productCount: 23,
  children: [adesivos, pinceisETrinchas],
);

const tonersHp = Category(
  slug: 'toners-hp',
  name: 'Toners HP',
  level: 2,
  parentSlug: 'cartuchos-toners',
  isHighlighted: true,
  productCount: 12,
  children: [],
);

const cartuchosToners = Category(
  slug: 'cartuchos-toners',
  name: 'Cartuchos & Toners',
  level: 1,
  parentSlug: null,
  isHighlighted: false,
  productCount: 12,
  children: [tonersHp],
);

const escolar = Category(
  slug: 'escolar',
  name: 'Escolar',
  level: 1,
  parentSlug: null,
  isHighlighted: false,
  productCount: 31,
  children: [],
);

/// Árvore inteira, na ordem em que a API a devolve nos testes.
const categoryTree = [artesPintura, cartuchosToners, escolar];

/// Raízes da árvore, na mesma ordem.
const rootCategories = [artesPintura, cartuchosToners, escolar];

// Nomes, slugs, preços e unidades de
// `apps/backend/prisma/seed/data/products.json` (o seed não fixa o id). A
// raiz `artes-pintura` é a da ilustração de reserva 🎨 que os testes da Início
// esperam; `discountPercent` é o que a API calcula para esses preços.

final finePen = ProductSummary(
  id: '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e01',
  slug: 'caneta-hidrografica-fine-pen-0-4mm-preto-fpbprzf-faber-castell-1-un',
  name: 'Caneta hidrográfica Fine Pen 0,4mm preto FPBPRZF Faber Castell 1 UN',
  brandName: 'Faber-Castell',
  categoryName: 'Canetas Hidrográficas 0.4',
  rootCategorySlug: 'artes-pintura',
  price: money(750),
  listPrice: null,
  discountPercent: null,
  unit: 'unidade',
  thumbUrl: null,
  isFeatured: true,
);

final brushDuo = ProductSummary(
  id: '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e02',
  slug: 'caneta-pincel-brush-duo-acrilico-12-cores-oapgatc-master-un-1-un',
  name: 'Caneta pincel Brush duo acrílico, 12 cores, OAPGATC, Master - UN 1 UN',
  brandName: 'Master',
  categoryName: 'Canetas Hidrográficas Brush Pen',
  rootCategorySlug: 'artes-pintura',
  price: money(3490),
  listPrice: money(4990),
  discountPercent: 30,
  unit: 'unidade',
  thumbUrl: 'https://img.kalunga.com.br/fotosdeprodutos/167231d.jpg',
  isFeatured: false,
);

final brushSupersoft = ProductSummary(
  id: '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e03',
  slug: 'caneta-pincel-brush-supersoft-20-cores-faber-castell-bt-20-un',
  name: 'Caneta pincel Brush supersoft, 20 cores, Faber-Castell - BT 20 UN',
  brandName: 'Faber-Castell',
  categoryName: 'Canetas Hidrográficas Brush Pen',
  rootCategorySlug: 'artes-pintura',
  price: money(8100),
  listPrice: money(10180),
  discountPercent: 20,
  unit: 'unidade',
  thumbUrl: null,
  isFeatured: false,
);

/// Os três produtos, na ordem em que a API os devolve nos testes.
final products = [finePen, brushDuo, brushSupersoft];
