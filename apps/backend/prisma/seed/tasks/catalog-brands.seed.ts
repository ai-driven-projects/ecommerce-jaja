import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

type BrandSeedItem = {
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
};

function loadBrands(): BrandSeedItem[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = resolve(here, '../data/brands.json');

  if (!existsSync(file)) {
    throw new Error(`[seed] catalog: brands file not found. Expected at: ${file}`);
  }

  return JSON.parse(readFileSync(file, 'utf8')) as BrandSeedItem[];
}

export async function seedCatalogBrands(prisma: PrismaClient): Promise<void> {
  const brands = loadBrands();

  for (const brand of brands) {
    // `update: {}` only inserts: it neither overwrites edits made by an
    // administrator nor brings back brands that were deleted.
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      create: {
        id: randomUUID(),
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        logoUrl: brand.logoUrl,
        isActive: brand.isActive,
      },
      update: {},
    });
  }

  console.log(`[seed] catalog: ${brands.length} brands upserted by slug`);
}
