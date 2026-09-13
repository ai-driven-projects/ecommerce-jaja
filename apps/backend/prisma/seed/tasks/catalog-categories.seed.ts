import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

// Parents come before their children in the file.
type CategorySeedItem = {
  name: string;
  slug: string;
  parentSlug: string | null;
  description: string | null;
  order: number;
  isHighlighted: boolean;
  imageUrl: string | null;
  isActive: boolean;
};

function loadCategories(): CategorySeedItem[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = resolve(here, '../data/categories.json');

  if (!existsSync(file)) {
    throw new Error(`[seed] catalog: categories file not found. Expected at: ${file}`);
  }

  return JSON.parse(readFileSync(file, 'utf8')) as CategorySeedItem[];
}

// A parent saved earlier in this run comes from `savedIds`; one outside the
// file must already be in the database.
async function resolveParentId(
  prisma: PrismaClient,
  category: CategorySeedItem,
  savedIds: Map<string, string>,
): Promise<string | null> {
  if (!category.parentSlug) return null;

  const savedId = savedIds.get(category.parentSlug);
  if (savedId) return savedId;

  const stored = await prisma.category.findUnique({
    where: { slug: category.parentSlug },
    select: { id: true },
  });
  if (!stored) {
    throw new Error(
      `[seed] catalog: parent "${category.parentSlug}" of category "${category.slug}" not found ` +
        '(parents must come before their children in categories.json)',
    );
  }
  return stored.id;
}

export async function seedCatalogCategories(prisma: PrismaClient): Promise<void> {
  const categories = loadCategories();
  const savedIds = new Map<string, string>();
  const levels = new Map<string, number>();

  for (const category of categories) {
    const parentId = await resolveParentId(prisma, category, savedIds);

    // Upsert by slug keeps ids stable across runs, but overwrites name, parent,
    // order and highlight of seeded categories edited by an administrator.
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        id: randomUUID(),
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId,
        order: category.order,
        isHighlighted: category.isHighlighted,
        imageUrl: category.imageUrl,
        isActive: category.isActive,
      },
      update: {
        name: category.name,
        parentId,
        order: category.order,
        isHighlighted: category.isHighlighted,
      },
      select: { id: true },
    });

    savedIds.set(category.slug, saved.id);
    const parentLevel = category.parentSlug ? (levels.get(category.parentSlug) ?? 1) : 0;
    levels.set(category.slug, parentLevel + 1);
  }

  const perLevel = [1, 2, 3].map(
    (level) => [...levels.values()].filter((value) => value === level).length,
  );
  console.log(
    `[seed] catalog: ${categories.length} categories upserted by slug — level 1: ${perLevel[0]}, ` +
      `level 2: ${perLevel[1]}, level 3: ${perLevel[2]} ` +
      '(re-running overwrites name, parent, order and highlight of seeded categories)',
  );
}
