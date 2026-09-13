import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

type UserSeedItem = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  admin: boolean;
  password: string;
};

const SEED_PASSWORD = '#Senha123';
const SALT_ROUNDS = 10;

function loadUsers(): UserSeedItem[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = resolve(here, '../data/users.json');
  return JSON.parse(readFileSync(file, 'utf8')) as UserSeedItem[];
}

export async function seedAuth(prisma: PrismaClient): Promise<void> {
  const users = loadUsers();
  // One hash for every user: all seed users share the same password.
  const hash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

  for (const user of users) {
    const email = user.email.trim().toLowerCase();

    await prisma.user.upsert({
      where: { email },
      create: {
        id: user.id,
        name: user.name,
        email,
        avatarUrl: user.avatarUrl,
        admin: user.admin,
        password: { create: { value: hash } },
      },
      update: {
        name: user.name,
        avatarUrl: user.avatarUrl,
        admin: user.admin,
        password: {
          upsert: {
            create: { value: hash },
            update: { value: hash },
          },
        },
      },
    });
  }

  console.log(`[seed] auth: ${users.length} users upserted`);
}
