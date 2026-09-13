import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

// The user is referenced by email, since user ids may differ between databases.
// CPF, phone and CEP are already stored as digits, as the domain normalizes them.
type CustomerSeedItem = {
  userEmail: string;
  cpf: string;
  phone: string;
  address: {
    zipCode: string;
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
  };
};

function loadCustomers(): CustomerSeedItem[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = resolve(here, '../data/customers.json');

  if (!existsSync(file)) {
    throw new Error(`[seed] customers: customers file not found. Expected at: ${file}`);
  }

  return JSON.parse(readFileSync(file, 'utf8')) as CustomerSeedItem[];
}

async function loadUserIds(prisma: PrismaClient): Promise<Map<string, string>> {
  const rows = await prisma.user.findMany({ select: { id: true, email: true } });
  return new Map(rows.map((row) => [row.email.trim().toLowerCase(), row.id]));
}

// Runs after `auth`. Upserts by `userId` with `update: {}`: it only inserts, so
// running it again neither duplicates customers nor overwrites the changes made
// by the customer or by the administration (e.g. a deactivated customer).
export async function seedCustomers(prisma: PrismaClient): Promise<void> {
  const items = loadCustomers();
  const userIds = await loadUserIds(prisma);
  let skipped = 0;

  for (const item of items) {
    const email = item.userEmail.trim().toLowerCase();
    const userId = userIds.get(email);
    if (!userId) {
      console.warn(`[seed] customers: user "${email}" not found, customer skipped`);
      skipped += 1;
      continue;
    }

    await prisma.customer.upsert({
      where: { userId },
      create: {
        id: randomUUID(),
        userId,
        cpf: item.cpf,
        phone: item.phone,
        zipCode: item.address.zipCode,
        street: item.address.street,
        number: item.address.number,
        complement: item.address.complement,
        neighborhood: item.address.neighborhood,
        city: item.address.city,
        state: item.address.state,
      },
      update: {},
    });
  }

  console.log(
    `[seed] customers: ${items.length - skipped} customers upserted, ${skipped} skipped`,
  );
}
