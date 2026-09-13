import {
  FindAllRolesInDTO,
  FindAllRolesOutDTO,
  FindAllRolesQuery,
  Role,
  RoleDTO,
  RoleRepository,
  RolesExistence,
} from '__AUTH_PACKAGE_NAME__';
import { Result, TransactionContext } from '__SHARED_PACKAGE_NAME__';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/db/prisma.service';
import {
  PrismaExecutor,
  resolvePrismaExecutor,
} from 'src/db/prisma-transaction.context';
import { RoleErrors } from 'src/errors';

type RolePayload = Prisma.RoleGetPayload<{
  include: {
    permissions: {
      include: {
        permission: {
          select: {
            id: true;
            name: true;
            alias: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class RolePrisma implements RoleRepository, RolesExistence {
  constructor(private readonly prisma: PrismaService) {}

  readonly findAllRolesQuery: FindAllRolesQuery = {
    execute: async ({
      page,
      pageSize,
      all,
    }: FindAllRolesInDTO): Promise<Result<FindAllRolesOutDTO>> => {
      try {
        const safePageSize = Math.min(
          Math.max(Math.floor(pageSize || 10), 1),
          100,
        );
        const safeRequestedPage = Math.max(Math.floor(page || 1), 1);
        const total = await this.prisma.client.role.count();
        const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);
        const safePage =
          totalPages === 0 ? 1 : Math.min(safeRequestedPage, totalPages);
        const skip = (safePage - 1) * safePageSize;

        const results = all
          ? await this.prisma.client.role.findMany({
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            })
          : await this.prisma.client.role.findMany({
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
              skip,
              take: safePageSize,
              orderBy: { createdAt: 'desc' },
            });

        const data: RoleDTO[] = results.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          permissions: r.permissions.map((p) => ({
            id: p.permission.id,
            name: p.permission.name,
            alias: p.permission.alias,
          })),
        }));

        return Result.ok({
          data,
          meta: {
            page: all ? 1 : safePage,
            pageSize: all ? total : safePageSize,
            total,
            totalPages: all ? (total > 0 ? 1 : 0) : totalPages,
          },
        });
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  async create(entity: Role, tx?: TransactionContext): Promise<Result<void>> {
    try {
      const { permissionIds, ...data } = this.fromDomain(entity);
      const uniquePermissionIds = Array.from(new Set(permissionIds));
      const executor = resolvePrismaExecutor(tx, this.prisma.client);

      await this.createRoleWithPermissions(executor, data, uniquePermissionIds);

      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }
  async update(entity: Role, tx?: TransactionContext): Promise<Result<void>> {
    try {
      const { permissionIds, ...data } = this.fromDomain(entity);
      const uniquePermissionIds = Array.from(new Set(permissionIds));
      const executor = resolvePrismaExecutor(tx, this.prisma.client);

      await this.updateRoleWithPermissions(
        executor,
        entity.id,
        data,
        uniquePermissionIds,
      );

      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }
  async findByName(name: string): Promise<Result<Role>> {
    try {
      const r = await this.prisma.client.role.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          deletedAt: null,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
      if (!r) return Result.fail(RoleErrors.NOT_FOUND);

      return Result.ok(this.toDomain(r)!);
    } catch (error) {
      return Result.fail(error);
    }
  }

  async findById(id: string): Promise<Result<Role>> {
    try {
      const r = await this.prisma.client.role.findUnique({
        where: { id },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
      if (!r) return Result.fail(RoleErrors.NOT_FOUND);
      return Result.ok(this.toDomain(r)!);
    } catch (error) {
      return Result.fail(error);
    }
  }

  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    const client = resolvePrismaExecutor(tx, this.prisma.client);
    try {
      await client.role.delete({
        where: { id },
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }

  async exists(ids: string[]): Promise<Result<boolean>> {
    try {
      if (ids.length === 0) {
        return Result.ok(true);
      }

      const uniqueIds = Array.from(new Set(ids));

      const count = await this.prisma.client.role.count({
        where: {
          id: { in: uniqueIds },
        },
      });

      return Result.ok(count === uniqueIds.length);
    } catch (error) {
      return Result.fail(error);
    }
  }

  private toDomain(r: RolePayload): Role | null {
    if (!r) return null;

    const permissionIds =
      r.permissions?.map((p) => {
        return p.permissionId;
      }) ?? [];

    const role = Role.create({
      id: r.id,
      name: r.name,
      description: r.description,
      permissionIds,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });

    return role;
  }

  private fromDomain(r: Role) {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
      permissionIds: r.permissionIds,
    };
  }

  private async createRoleWithPermissions(
    executor: PrismaExecutor,
    data: Omit<ReturnType<RolePrisma['fromDomain']>, 'permissionIds'>,
    permissionIds: string[],
  ): Promise<void> {
    const persist = async (client: PrismaExecutor) => {
      const createdRole = await client.role.create({
        data,
        select: { id: true },
      });

      if (permissionIds.length > 0) {
        await client.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: createdRole.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }
    };

    if (executor === this.prisma.client) {
      await this.prisma.client.$transaction((client) => persist(client));
      return;
    }

    await persist(executor);
  }

  private async updateRoleWithPermissions(
    executor: PrismaExecutor,
    roleId: string,
    data: Omit<ReturnType<RolePrisma['fromDomain']>, 'permissionIds'>,
    permissionIds: string[],
  ): Promise<void> {
    const persist = async (client: PrismaExecutor) => {
      await client.role.update({
        where: { id: roleId },
        data: { ...data },
      });

      await client.rolePermission.deleteMany({
        where: { roleId },
      });

      if (permissionIds.length > 0) {
        await client.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }
    };

    if (executor === this.prisma.client) {
      await this.prisma.client.$transaction((client) => persist(client));
      return;
    }

    await persist(executor);
  }
}
