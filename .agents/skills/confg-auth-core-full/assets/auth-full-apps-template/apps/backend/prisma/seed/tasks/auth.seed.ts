import * as bcrypt from 'bcrypt';
import type { PrismaClient } from '@prisma/client';

const DEFAULT_ADMIN = {
  name: 'Admin Formacao',
  email: 'admin@formacao.dev',
  password: '#Senha123',
};

export async function seedAuthDefaultUsers(prisma: PrismaClient): Promise<void> {
  const email = DEFAULT_ADMIN.email.trim().toLowerCase();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: DEFAULT_ADMIN.name,
      deletedAt: null,
    },
    create: {
      name: DEFAULT_ADMIN.name,
      email,
    },
  });

  const role = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {
      description: 'Administrador do sistema',
      deletedAt: null,
    },
    create: {
      name: 'Admin',
      description: 'Administrador do sistema',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  const activePassword = await prisma.password.findFirst({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const samePassword = activePassword
    ? await bcrypt.compare(DEFAULT_ADMIN.password, activePassword.content)
    : false;

  if (!samePassword) {
    if (activePassword) {
      await prisma.password.update({
        where: { id: activePassword.id },
        data: { deletedAt: new Date() },
      });
    }

    await prisma.password.create({
      data: {
        userId: user.id,
        content: await bcrypt.hash(DEFAULT_ADMIN.password, 10),
      },
    });
  }
}
