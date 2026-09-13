import { Injectable } from '@nestjs/common';
import { Result, TransactionContext } from '@mentoria-360/shared';
import { User, UserRepository } from '@jaja/auth';
import { Prisma, User as UserRow } from '@prisma/client';
import {
  PrismaService,
  PrismaTransactionContext,
} from '../../db/prisma.service.js';

@Injectable()
export class UserPrisma implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      await this.clientFor(tx).user.create({ data: this.fromDomain(user) });
    });
  }

  async update(user: User, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      await this.clientFor(tx).user.update({
        where: { id: user.id },
        data: this.fromDomain(user),
      });
    });
  }

  async findById(id: string): Promise<Result<User>> {
    return Result.tryAsync(async () => {
      const row = await this.prisma.client.user.findUnique({ where: { id } });
      if (!row) return Result.fail<User>('USER_NOT_FOUND');
      return this.toDomain(row);
    });
  }

  async findByEmail(email: string): Promise<Result<User | null>> {
    return Result.tryAsync(async () => {
      const row = await this.prisma.client.user.findUnique({
        where: { email: String(email ?? '').trim().toLowerCase() },
      });
      if (!row) return Result.ok<User | null>(null);
      return this.toDomain(row);
    });
  }

  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      await this.clientFor(tx).user.delete({ where: { id } });
    });
  }

  private clientFor(tx?: TransactionContext) {
    return (tx as PrismaTransactionContext | undefined)?.client ?? this.prisma.client;
  }

  private toDomain(row: UserRow): Result<User> {
    return User.tryCreate({
      id: row.id,
      name: row.name,
      email: row.email,
      avatarUrl: row.avatarUrl,
      admin: row.admin,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private fromDomain(user: User): Prisma.UserUncheckedCreateInput {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      admin: user.isAdmin,
    };
  }
}
