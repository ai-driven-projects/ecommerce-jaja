import {
  Permission,
  PermissionDTO,
  FindAllPermissionQuery,
  PermissionRepository,
  PermissionsExistQuery,
  CriticalityLevel,
} from '__AUTH_PACKAGE_NAME__';
import { Result, TransactionContext } from '__SHARED_PACKAGE_NAME__';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/db/prisma.service';
import { resolvePrismaExecutor } from 'src/db/prisma-transaction.context';
import { PermissionErrors } from 'src/errors';

type PermissionPayload = Prisma.PermissionGetPayload<{}>;

@Injectable()
export class PermissionPrisma implements PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  readonly findAllPermissionQuery: FindAllPermissionQuery = {
    execute: async (): Promise<Result<PermissionDTO[]>> => {
      try {
        const results = await this.prisma.client.permission.findMany();
        if (results.length === 0) return Result.ok([]);
        return Result.ok(
          results.map((p) => ({
            id: p.id,
            name: p.name,
            alias: p.alias,
            description: p.description,
            criticality: p.criticality as CriticalityLevel,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            deletedAt: p?.deletedAt ?? null,
          })),
        );
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  readonly permissionsExistQuery: PermissionsExistQuery = {
    execute: async (ids): Promise<Result<boolean>> => {
      try {
        if (ids.length === 0) {
          return Result.ok(true);
        }

        const uniqueIds = Array.from(new Set(ids));

        const count = await this.prisma.client.permission.count({
          where: {
            id: { in: uniqueIds },
          },
        });

        return Result.ok(count === uniqueIds.length);
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  async create(
    entity: Permission,
    tx?: TransactionContext,
  ): Promise<Result<void>> {
    const client = resolvePrismaExecutor(tx, this.prisma.client);
    try {
      await client.permission.create({
        data: this.fromDomain(entity),
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }

  async update(
    entity: Permission,
    tx?: TransactionContext,
  ): Promise<Result<void>> {
    const client = resolvePrismaExecutor(tx, this.prisma.client);
    try {
      await client.permission.update({
        where: { id: entity.id },
        data: this.fromDomain(entity),
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }

  async findById(id: string): Promise<Result<Permission>> {
    try {
      const p = await this.prisma.client.permission.findUnique({
        where: { id },
      });
      if (!p) return Result.fail(PermissionErrors.NOT_FOUND);
      return Result.ok(this.toDomain(p)!);
    } catch (error) {
      return Result.fail(error);
    }
  }

  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    const client = resolvePrismaExecutor(tx, this.prisma.client);
    try {
      await client.permission.delete({
        where: { id },
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }

  private toDomain(p: PermissionPayload): Permission | null {
    if (!p) return null;
    return Permission.create({
      id: p.id,
      name: p.name,
      alias: p.alias,
      description: p.description,
      criticality: p.criticality as CriticalityLevel,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
    });
  }

  private fromDomain(p: Permission) {
    return {
      id: p.id,
      name: p.name,
      alias: p.alias,
      description: p.description,
      criticality: p.criticality,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
    };
  }
}
