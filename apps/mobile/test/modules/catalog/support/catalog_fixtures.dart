import 'package:mobile/modules/catalog/model/category_entity.dart';
import 'package:mobile/modules/catalog/model/product_detail_entity.dart';
import 'package:mobile/modules/catalog/model/product_page_entity.dart';
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

/// [count] cópias de [finePen] com `id`, `slug` e `name` únicos
/// (`<prefix>-1`, `<prefix>-2`…), para encher páginas da listagem.
List<ProductSummary> manyProducts(int count, {String prefix = 'produto'}) =>
    List.unmodifiable([
      for (var i = 1; i <= count; i++)
        finePen.copyWith(
          id: '$prefix-id-$i',
          slug: '$prefix-$i',
          name: 'Produto $prefix $i',
        ),
    ]);

/// Faceta da marca HP (`brandSlug` do seed).
const hpFacet = BrandFacet(slug: 'hp', name: 'HP', count: 12);

// Detalhe de um toner HP do seed (nome, slug, `sku` e unidade de
// `products.json`; o seed não fixa o id). Preço, "De:", desconto, destaque,
// descrição e as três fotos são de exemplo, para a página mostrar todos os
// blocos: a descrição tem 700 caracteres, acima do limite de "Ler mais".

/// Texto de 700 caracteres, com quebras de linha, para a descrição recolhível.
final tonerDescription =
    ('Toner HP 230X original, amarelo, rendimento alto para a '
        'LaserJet Pro.\n') *
    10;

final tonerDetail = ProductDetail(
  id: '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e10',
  slug:
      'toner-hp-230x-amarelo-laserjet-original-w2302x-para-hp-laserjet-pro-'
      '4203cdn-4203dn-4203dw-4303dw-4303fdn-4303fdw-cx-1-un',
  name:
      'Toner HP 230x, Amarelo, Laserjet Original (W2302X), Para HP LaserJet '
      'Pro 4203cdn, 4203dn, 4203dw, 4303dw, 4303fdn, 4303fdw, CX 1 UN',
  sku: '796915',
  description: tonerDescription,
  price: money(3490),
  listPrice: money(4990),
  discountPercent: 30,
  unit: 'caixa com 1',
  isFeatured: true,
  brand: const CatalogRef(slug: 'hp', name: 'HP'),
  categories: const [
    CatalogRef(slug: 'cartuchos-toners', name: 'Cartuchos & Toners'),
    CatalogRef(slug: 'toners-hp', name: 'Toners HP'),
  ],
  images: const [
    ProductImage(
      thumbUrl: 'https://img.kalunga.com.br/fotosdeprodutos/796915d.jpg',
      largeUrl: 'https://img.kalunga.com.br/fotosdeprodutos/796915z.jpg',
      order: 0,
    ),
    ProductImage(
      thumbUrl: 'https://img.kalunga.com.br/fotosdeprodutos/796915d_1.jpg',
      largeUrl: 'https://img.kalunga.com.br/fotosdeprodutos/796915z_1.jpg',
      order: 1,
    ),
    ProductImage(
      thumbUrl: 'https://img.kalunga.com.br/fotosdeprodutos/796915d_2.jpg',
      largeUrl: 'https://img.kalunga.com.br/fotosdeprodutos/796915z_2.jpg',
      order: 2,
    ),
  ],
);

/// Detalhe mínimo: sem marca, `sku`, descrição, "De:", desconto, categorias
/// nem fotos. É o padrão do `FakeCatalogRepository`.
final plainDetail = ProductDetail(
  id: '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e11',
  slug: 'caneta-x',
  name: 'Caneta X',
  sku: null,
  description: null,
  price: money(750),
  listPrice: null,
  discountPercent: null,
  unit: 'unidade',
  isFeatured: false,
  brand: null,
  categories: const [],
  images: const [],
);
