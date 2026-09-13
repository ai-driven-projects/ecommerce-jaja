import {
  FindPasswordHashQuery,
  Password,
  PasswordRepository,
} from '__AUTH_PACKAGE_NAME__';
import { Result, TransactionContext } from '__SHARED_PACKAGE_NAME__';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/db/prisma.service';
import { resolvePrismaExecutor } from 'src/db/prisma-transaction.context';
import { UserErrors } from 'src/errors';

type PasswordPayload = Prisma.PasswordGetPayload<{}>;

@Injectable()
export class PasswordPrisma implements PasswordRepository {
  constructor(private readonly prisma: PrismaService) {}

  readonly findPasswordHashQuery: FindPasswordHashQuery = {
    execute: async (userId): Promise<Result<{ hash: string }>> => {
      try {
        const p = await this.prisma.client.password.findFirst({
          where: { userId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        });
        if (!p) return Result.fail(UserErrors.NOT_FOUND);
        return Result.ok({ hash: p.content });
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  async create(
    entity: Password,
    userId: string,
    tx?: TransactionContext,
  ): Promise<Result<void>> {
    const client = resolvePrismaExecutor(tx, this.prisma.client);
    try {
      await client.password.create({
        data: {
          id: entity.id,
          content: entity.content,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
          deletedAt: entity.deletedAt,
          userId,
        },
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }

  async update(
    entity: Password,
    tx?: TransactionContext,
  ): Promise<Result<void>> {
    const client = resolvePrismaExecutor(tx, this.prisma.client);
    try {
      await client.password.update({
        where: { id: entity.id },
        data: this.fromDomain(entity),
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }

  async findByUserId(id: string): Promise<Result<Password>> {
    try {
      const p = await this.prisma.client.password.findFirst({
        where: { userId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (!p) return Result.fail(UserErrors.NOT_FOUND);
      return Result.ok(this.toDomain(p)!);
    } catch (error) {
      return Result.fail(error);
    }
  }

  async findActiveByUserId(id: string): Promise<Result<Password>> {
    return this.findByUserId(id);
  }

  async findRecentByUserId(
    id: string,
    limit: number,
  ): Promise<Result<Password[]>> {
    try {
      const results = await this.prisma.client.password.findMany({
        where: { userId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      if (results.length === 0) {
        return Result.ok([]);
      }
      return Result.ok(results.map((p) => this.toDomain(p)!));
    } catch (error) {
      return Result.fail(error);
    }
  }

  async findById(id: string): Promise<Result<Password>> {
    try {
      const p = await this.prisma.client.password.findUnique({
        where: { id },
      });
      if (!p) return Result.fail(UserErrors.NOT_FOUND);
      return Result.ok(this.toDomain(p)!);
    } catch (error) {
      return Result.fail(error);
    }
  }

  async findAll(): Promise<Result<Password[]>> {
    try {
      const results = await this.prisma.client.password.findMany();
      if (results.length === 0) return Result.ok([]);
      return Result.ok(results.map((p) => this.toDomain(p)!));
    } catch (error) {
      return Result.fail(error);
    }
  }

  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    const client = resolvePrismaExecutor(tx, this.prisma.client);
    try {
      await client.password.delete({
        where: { id },
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }

  private toDomain(p: PasswordPayload): Password | null {
    if (!p) return null;
    return Password.create({
      id: p.id,
      content: p.content,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
    });
  }

  private fromDomain(p: Password) {
    return {
      id: p.id,
      content: p.content,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
    };
  }
}
