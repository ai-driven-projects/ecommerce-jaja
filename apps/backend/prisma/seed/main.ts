import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { seedAuth } from './tasks/auth.seed.js';
import { seedCatalogBrands } from './tasks/catalog-brands.seed.js';
import { seedCatalogCategories } from './tasks/catalog-categories.seed.js';
import { seedCatalogProducts } from './tasks/catalog-products.seed.js';

type SeedTask = {
  name: string;
  run: (prisma: PrismaClient) => Promise<void>;
};

// Products depend on brands and categories, so they run after both.
const seedTasks: SeedTask[] = [
  { name: 'auth', run: seedAuth },
  { name: 'catalog-brands', run: seedCatalogBrands },
  { name: 'catalog-categories', run: seedCatalogCategories },
  { name: 'catalog-products', run: seedCatalogProducts },
];

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? '',
});

const prisma = new PrismaClient({
  adapter,
});

// `npx prisma db seed -- --only=catalog-brands,catalog-products` runs a subset,
// always in the order above; a prefix such as `catalog` selects every
// `catalog-*` task. Without `--only`, every task runs.
function selectTasks(argv: string[]): SeedTask[] {
  const only = argv.find((arg) => arg.startsWith('--only='));
  if (!only) return seedTasks;

  const wanted = only
    .slice('--only='.length)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const matches = (task: SeedTask, name: string) =>
    task.name === name || task.name.startsWith(`${name}-`);

  const unknown = wanted.filter((name) => !seedTasks.some((task) => matches(task, name)));
  if (unknown.length || !wanted.length) {
    throw new Error(
      `[seed] unknown task in --only: "${unknown.join(', ')}". ` +
        `Available: ${seedTasks.map((task) => task.name).join(', ')}`,
    );
  }

  return seedTasks.filter((task) => wanted.some((name) => matches(task, name)));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run prisma/seed/main.ts');
  }

  const tasks = selectTasks(process.argv.slice(2));
  if (tasks.length < seedTasks.length) {
    console.log(`[seed] running only: ${tasks.map((task) => task.name).join(', ')}`);
  }

  for (const task of tasks) {
    await task.run(prisma);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
