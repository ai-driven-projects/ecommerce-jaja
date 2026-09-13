import { Injectable } from '@nestjs/common';
import { Result, TransactionContext } from '@mentoria-360/shared';
import { Password, PasswordRepository } from '@jaja/auth';
import { Password as PasswordRow, Prisma } from '@prisma/client';
import {
  PrismaService,
  PrismaTransactionContext,
} from '../../db/prisma.service.js';

@Injectable()
export class PasswordPrisma implements PasswordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    password: Password,
    tx?: TransactionContext,
  ): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      await this.clientFor(tx).password.create({
        data: this.fromDomain(password),
      });
    });
  }

  async findByUserId(userId: string): Promise<Result<Password | null>> {
    return Result.tryAsync(async () => {
      const row = await this.prisma.client.password.findUnique({
        where: { userId },
      });
      if (!row) return Result.ok<Password | null>(null);
      return this.toDomain(row);
    });
  }

  private clientFor(tx?: TransactionContext) {
    return (tx as PrismaTransactionContext | undefined)?.client ?? this.prisma.client;
  }

  private toDomain(row: PasswordRow): Result<Password> {
    return Password.tryCreate({
      id: row.id,
      userId: row.userId,
      value: row.value,
      createdAt: row.createdAt,
    });
  }

  private fromDomain(password: Password): Prisma.PasswordUncheckedCreateInput {
    return {
      id: password.id,
      userId: password.userId,
      value: password.value,
    };
  }
}
