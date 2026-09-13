import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

type StoreSeedItem = {
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  deliveryRadiusMeters: number;
};

function loadStores(): StoreSeedItem[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = resolve(here, '../data/stores.json');

  if (!existsSync(file)) {
    throw new Error(`[seed] stores: stores file not found. Expected at: ${file}`);
  }

  return JSON.parse(readFileSync(file, 'utf8')) as StoreSeedItem[];
}

export async function seedStoresStores(prisma: PrismaClient): Promise<void> {
  const stores = loadStores();

  for (const store of stores) {
    // `update: {}` only inserts: it neither overwrites edits made by an
    // administrator nor brings back stores that were deleted.
    await prisma.store.upsert({
      where: { slug: store.slug },
      create: {
        id: randomUUID(),
        name: store.name,
        slug: store.slug,
        phone: store.phone,
        address: store.address,
        latitude: store.latitude,
        longitude: store.longitude,
        deliveryRadiusMeters: store.deliveryRadiusMeters,
      },
      update: {},
    });
  }

  console.log(`[seed] stores: ${stores.length} stores upserted by slug`);
}
