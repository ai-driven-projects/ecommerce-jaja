import fs from 'node:fs';
import path from 'node:path';
import { collectBrands } from '../store.js';
import type { CategoryFile } from '../types.js';
import { buildBrands } from './brands.js';
import { buildCategories, type CategoryTree } from './categories.js';
import { buildProducts, type ProductBuild } from './products.js';
import type { SeedData } from './types.js';

export type { SeedData } from './types.js';

/** Arquivos que o seed de catálogo do backend lê, em `prisma/seed/data`. */
export const SEED_FILES: Record<keyof SeedData, string> = {
  brands: 'brands.json',
  categories: 'categories.json',
  products: 'products.json',
};

export interface SeedBuild {
  data: SeedData;
  categoryCounts: CategoryTree['counts'];
  productStats: ProductBuild['stats'];
  warnings: string[];
}

/** `apps/backend/prisma/seed/data`: o backend não conhece o CLI, só esses arquivos. */
export function seedDataDir(backendDir: string): string {
  return path.join(backendDir, 'prisma', 'seed', 'data');
}

/** Converte as categorias raspadas nos dados do seed (marcas, árvore de categorias e produtos). */
export function buildSeedData(files: CategoryFile[]): SeedBuild {
  const brands = buildBrands(collectBrands(files));
  const tree = buildCategories(files);
  const products = buildProducts(files, new Set(brands.map((brand) => brand.slug)), tree.lookup);
  return {
    data: { brands, categories: tree.categories, products: products.products },
    categoryCounts: tree.counts,
    productStats: products.stats,
    warnings: products.warnings,
  };
}

/** Grava `brands.json`, `categories.json` e `products.json`; devolve os caminhos gravados. */
export function writeSeedData(dir: string, data: SeedData): string[] {
  fs.mkdirSync(dir, { recursive: true });
  return (Object.keys(SEED_FILES) as (keyof SeedData)[]).map((key) => {
    const file = path.join(dir, SEED_FILES[key]);
    fs.writeFileSync(file, `${JSON.stringify(data[key], null, 2)}\n`, 'utf8');
    return file;
  });
}
