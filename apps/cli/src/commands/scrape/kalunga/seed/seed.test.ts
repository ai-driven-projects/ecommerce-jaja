import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { CategoryFile, KalungaGroup, ProductBrand, ScrapedProduct } from '../types.js';
import { buildBrands } from './brands.js';
import { buildSeedData, SEED_FILES, writeSeedData } from './index.js';
import { unitFromName } from './products.js';

function group(id: number, departmentId: number, name: string, slug: string): KalungaGroup {
  return { id, departmentId, departmentSlug: '', slug, name, url: '', highlighted: false };
}

function brand(id: string, name: string): ProductBrand {
  return { id, name, slug: name.toLowerCase(), url: '' };
}

function product(id: string, path: [string, string | null, string | null], overrides: Partial<ScrapedProduct> = {}): ScrapedProduct {
  return {
    id,
    slug: `produto-${id}`,
    url: '',
    name: `Produto ${id}`,
    brand: brand('1', 'Acme'),
    category: { department: path[0], group: path[1], subgroup: path[2], path: path.filter(Boolean).join('/') },
    price: { current: 19.9, list: null, installments: null, currency: 'BRL' },
    images: [{ thumb: `https://img/${id}d.jpg`, large: `https://img/${id}z.jpg` }],
    description: { html: '', text: ` Descrição ${id} ` },
    rating: null,
    available: true,
    scrapedAt: '',
    ...overrides,
  };
}

function file(id: number, slug: string, name: string, groups: KalungaGroup[], products: ScrapedProduct[]): CategoryFile {
  return {
    source: 'kalunga',
    scrapedAt: '',
    category: { id, menuId: id, slug, name, shortName: name, url: '', order: id, groups },
    sampling: { requested: '', target: 0, groupsSampled: 0, perGroup: 0 },
    products,
  };
}

describe('buildBrands', () => {
  it('normaliza o slug e junta entradas com o mesmo slug, mantendo o nome da primeira', () => {
    const brands = buildBrands([
      { ...brand('1', ' Make+ '), slug: 'make-', products: 3, categories: [] },
      { ...brand('2', 'Make'), slug: 'make', products: 1, categories: [] },
    ]);
    assert.deepEqual(brands, [{ name: 'Make+', slug: 'make', description: null, logoUrl: null, isActive: true }]);
  });
});

describe('buildSeedData', () => {
  // O menu do Escolar também lista o "Livros" do departamento 2, que não entra na árvore do Escolar.
  const escolar = file(1, 'escolar', 'Escolar', [group(10, 1, 'Livros', 'livros'), group(12, 1, 'Borrachas', 'borrachas'), group(11, 1, 'Papel Sulfite (Chamequinho)', 'papel-sulfite-chamequinho-'), group(20, 2, 'Livros', 'livros')], [
    product('001', ['Escolar', 'Livros', 'Livros Técnicos']),
    product('002', ['Escolar', null, null], { slug: 'produto-001' }),
  ]);
  const escritorio = file(2, 'escritorio', 'Suprimentos para Escritório', [group(20, 2, 'Livros', 'livros')], [
    product('003', ['Escolar', 'Borrachas', 'Borrachas Técnicas'], { brand: brand('1', 'Dover') }),
    product('004', ['Embalagens', 'Tesouras', 'Tesouras Escolares'], { name: 'TESOURA CX 12 UN', price: { current: 10, list: 12.5, installments: null, currency: 'BRL' } }),
    product('002', ['Escolar', null, null]),
  ]);
  const seed = buildSeedData([escolar, escritorio]);
  const categoryBySlug = new Map(seed.data.categories.map((category) => [category.slug, category]));
  const productBySku = new Map(seed.data.products.map((item) => [item.sku, item]));

  it('monta a árvore com slugs únicos e as pais antes das filhas', () => {
    assert.deepEqual(seed.categoryCounts, { roots: 2, listedGroups: 4, createdGroups: 1, subgroups: 3 });
    assert.equal(categoryBySlug.get('livros')?.parentSlug, 'escolar');
    assert.equal(categoryBySlug.get('escritorio-livros')?.parentSlug, 'escritorio');
    assert.ok(categoryBySlug.has('papel-sulfite-chamequinho'));
    // Grupo que nenhuma raiz possui: criado sob a raiz do arquivo, depois dos listados.
    assert.deepEqual([categoryBySlug.get('tesouras')?.parentSlug, categoryBySlug.get('tesouras')?.order], ['escritorio', 1]);
    // Subgrupo de outro departamento fica sob o grupo da raiz que o possui.
    assert.equal(categoryBySlug.get('borrachas-tecnicas')?.parentSlug, 'borrachas');
    assert.equal(productBySku.get('003')?.categorySlug, 'borrachas-tecnicas');
    const position = new Map(seed.data.categories.map((category, index) => [category.slug, index]));
    for (const category of seed.data.categories) {
      if (category.parentSlug) assert.ok((position.get(category.parentSlug) ?? Infinity) < (position.get(category.slug) ?? -1), category.slug);
    }
  });

  it('gera produtos únicos por código, com slug, marca, categoria, preços, unidade e imagens no formato do banco', () => {
    assert.deepEqual([...productBySku.keys()], ['001', '002', '003', '004']);
    assert.equal(seed.productStats.entries, 5);
    assert.deepEqual(productBySku.get('001'), {
      sku: '001',
      name: 'Produto 001',
      slug: 'produto-001',
      brandSlug: 'acme',
      categorySlug: 'livros-tecnicos',
      description: 'Descrição 001',
      priceCents: 1990,
      listPriceCents: null,
      unit: 'unidade',
      images: [{ thumbUrl: 'https://img/001d.jpg', largeUrl: 'https://img/001z.jpg', order: 0 }],
      isActive: true,
    });
    assert.equal(productBySku.get('002')?.slug, 'produto-001-002');
    assert.equal(productBySku.get('002')?.categorySlug, 'escolar');
    // Marca com o mesmo CNPJ de outra: fica fora de brands.json e o produto sem marca.
    assert.equal(productBySku.get('003')?.brandSlug, null);
    assert.deepEqual([productBySku.get('004')?.unit, productBySku.get('004')?.listPriceCents], ['caixa com 12', 1250]);
    assert.equal(seed.productStats.fallbacks, 1);
  });

  it('completa imagens com um só tamanho e respeita o limite de imagens', () => {
    const images = Array.from({ length: 12 }, (_, index) => ({ thumb: `https://img/${index}d.jpg`, large: index === 0 ? null : `https://img/${index}z.jpg` }));
    const { data } = buildSeedData([file(1, 'escolar', 'Escolar', [], [product('010', ['Escolar', null, null], { images })])]);
    const [item] = data.products;
    assert.equal(item?.images.length, 10);
    assert.deepEqual(item?.images[0], { thumbUrl: 'https://img/0d.jpg', largeUrl: 'https://img/0d.jpg', order: 0 });
    assert.equal(item?.images[9]?.order, 9);
  });

  it('grava os três arquivos do seed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaja-cli-seed-'));
    const written = writeSeedData(dir, seed.data);
    assert.deepEqual(written.map((target) => path.basename(target)), Object.values(SEED_FILES));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'products.json'), 'utf8')).length, 4);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('unitFromName', () => {
  it('lê caixa e pacote do fim do nome', () => {
    assert.equal(unitFromName('CANETA CX 12 UN'), 'caixa com 12');
    assert.equal(unitFromName('PAPEL PT 100 UN '), 'pacote com 100');
    assert.equal(unitFromName('COLA BT 1 UN'), 'unidade');
  });
});
