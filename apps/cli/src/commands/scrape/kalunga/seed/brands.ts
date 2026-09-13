import { Alias } from '@mentoria-360/shared';
import type { BrandEntry } from '../types.js';
import type { BrandSeedItem } from './types.js';

/**
 * Marcas no formato do seed. O slug segue a regra do domínio (`make-` vira `make`); entradas com o
 * mesmo slug normalizado viram uma marca só, com o nome da primeira ocorrência.
 */
export function buildBrands(entries: BrandEntry[]): BrandSeedItem[] {
  const bySlug = new Map<string, BrandSeedItem>();
  for (const entry of entries) {
    const slug = Alias.format(entry.slug);
    if (!slug || bySlug.has(slug)) continue;
    bySlug.set(slug, { name: entry.name.trim(), slug, description: null, logoUrl: null, isActive: true });
  }
  return [...bySlug.values()];
}
