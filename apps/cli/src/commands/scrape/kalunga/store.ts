import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrandEntry, BrandsFile, CategoryFile, IndexFile, ScrapedProduct } from './types.js';

/** `apps/cli/data/kalunga`, tanto rodando de `src/` quanto de `dist/`. */
export function dataDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', '..', '..', 'data', 'kalunga');
}

export const CATEGORIES_DIR = 'categories';

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function categoryFilePath(root: string, slug: string): string {
  return path.join(root, CATEGORIES_DIR, `${slug}.json`);
}

export function writeCategory(root: string, file: CategoryFile): string {
  const target = categoryFilePath(root, file.category.slug);
  writeJson(target, file);
  return target;
}

export function readCategories(root: string): CategoryFile[] {
  const dir = path.join(root, CATEGORIES_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson<CategoryFile>(path.join(dir, name)))
    .filter((file): file is CategoryFile => file !== null && file.source === 'kalunga');
}

/** Marcas consolidadas a partir dos produtos de todas as categorias gravadas. */
export function collectBrands(categories: CategoryFile[]): BrandEntry[] {
  const byKey = new Map<string, BrandEntry>();
  for (const category of categories) {
    for (const product of category.products) {
      const brand = product.brand;
      if (!brand || !brand.name) continue;
      const key = brand.id || brand.name.toLowerCase();
      const entry = byKey.get(key) ?? { ...brand, products: 0, categories: [] };
      entry.products += 1;
      if (!entry.categories.includes(category.category.slug)) entry.categories.push(category.category.slug);
      if (!entry.id && brand.id) Object.assign(entry, { id: brand.id, slug: brand.slug, url: brand.url });
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()].sort((a, b) => b.products - a.products || a.name.localeCompare(b.name));
}

/** Regrava `brands.json` e `index.json` a partir do que existe em `categories/`. */
export function rebuildSummaries(root: string): { index: IndexFile; brands: BrandsFile } {
  const categories = readCategories(root);
  const now = new Date().toISOString();
  const brands: BrandsFile = { source: 'kalunga', scrapedAt: now, brands: collectBrands(categories) };
  const index: IndexFile = {
    source: 'kalunga',
    scrapedAt: now,
    categories: categories.map((file) => ({
      id: file.category.id,
      slug: file.category.slug,
      name: file.category.name,
      file: `${CATEGORIES_DIR}/${file.category.slug}.json`,
      products: file.products.length,
      scrapedAt: file.scrapedAt,
    })),
    brands: brands.brands.length,
  };
  writeJson(path.join(root, 'brands.json'), brands);
  writeJson(path.join(root, 'index.json'), index);
  return { index, brands };
}

export function countProducts(products: ScrapedProduct[]): { withBrand: number; withDescription: number; withImages: number } {
  return {
    withBrand: products.filter((product) => product.brand).length,
    withDescription: products.filter((product) => product.description).length,
    withImages: products.filter((product) => product.images.length > 0).length,
  };
}
