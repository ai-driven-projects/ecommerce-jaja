import {
  User,
  UserRepository,
  UserErrors,
  UserDTO,
  FindAllUsersInDTO,
  FindAllUsersOutDTO,
  FindUserByIdQuery,
  FindUserByEmailQuery,
  FindAllUsersQuery,
  UserExistsQuery,
} from '__AUTH_PACKAGE_NAME__';
import { Result, TransactionContext } from '__SHARED_PACKAGE_NAME__';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/db/prisma.service';
import {
  PrismaExecutor,
  resolvePrismaExecutor,
} from 'src/db/prisma-transaction.context';

type UserPayload = Prisma.UserGetPayload<{
  include: {
    roles: {
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true;
              };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class UserPrisma implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private userPayload = {
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  };

  readonly findUserByIdQuery: FindUserByIdQuery = {
    execute: async (id): Promise<Result<UserDTO>> => {
      try {
        const user = await this.prisma.client.user.findFirst({
          where: { id, deletedAt: null },
          ...this.userPayload,
        });
        if (!user) return Result.fail(UserErrors.NOT_FOUND);
        return Result.ok(this.toDto(user));
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  readonly findUserByEmailQuery: FindUserByEmailQuery = {
    execute: async (email): Promise<Result<UserDTO>> => {
      try {
        const user = await this.prisma.client.user.findFirst({
          where: { email, deletedAt: null },
          ...this.userPayload,
        });
        if (!user) return Result.fail(UserErrors.NOT_FOUND);
        return Result.ok(this.toDto(user));
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  readonly findAllUsersQuery: FindAllUsersQuery = {
    execute: async ({
      page,
      pageSize,
    }: FindAllUsersInDTO): Promise<Result<FindAllUsersOutDTO>> => {
      try {
        const safePageSize = Math.min(
          Math.max(Math.floor(pageSize || 10), 1),
          100,
        );
        const safeRequestedPage = Math.max(Math.floor(page || 1), 1);
        const total = await this.prisma.client.user.count({
          where: { deletedAt: null },
        });
        const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);
        const safePage =
          totalPages === 0 ? 1 : Math.min(safeRequestedPage, totalPages);
        const skip = (safePage - 1) * safePageSize;

        const results = await this.prisma.client.user.findMany({
          where: { deletedAt: null },
          ...this.userPayload,
          skip,
          take: safePageSize,
          orderBy: { createdAt: 'desc' },
        });

        const data = results.map((user) => this.toDto(user));

        return Result.ok({
          data,
          meta: {
            page: safePage,
            pageSize: safePageSize,
            total,
            totalPages,
          },
        });
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  readonly userExistsQuery: UserExistsQuery = {
    execute: async ({
      id,
      email,
    }: {
      id?: string;
      email?: string;
    }): Promise<Result<boolean>> => {
      try {
        const count = await this.prisma.client.user.count({
          where: {
            deletedAt: null,
            ...(id ? { id } : {}),
            ...(email ? { email } : {}),
          },
        });
        return Result.ok(count > 0);
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  async findByEmail(email: string): Promise<Result<User>> {
    try {
      const u = await this.prisma.client.user.findFirst({
        where: { email, deletedAt: null },
        ...this.userPayload,
      });
      if (!u) return Result.fail(UserErrors.NOT_FOUND);
      return Result.ok(this.toDomain(u)!);
    } catch (error) {
      return Result.fail(error);
    }
  }

  async create(entity: User, tx?: TransactionContext): Promise<Result<void>> {
    try {
      const { roleIds, ...data } = this.fromDomain(entity);
      const uniqueRoleIds = Array.from(new Set(roleIds));
      const executor = resolvePrismaExecutor(tx, this.prisma.client);

      await this.createUserWithRoles(executor, entity.id, data, uniqueRoleIds);

      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }
  async update(entity: User, tx?: TransactionContext): Promise<Result<void>> {
    const { roleIds: _, ...data } = this.fromDomain(entity);
    const client = resolvePrismaExecutor(tx, this.prisma.client);
    try {
      await client.user.update({
        where: { id: entity.id },
        data: {
          ...data,
        },
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }

  async updateRoles(userId: string, roleIds: string[]): Promise<Result<void>> {
    try {
      const uniqueRoleIds = Array.from(new Set(roleIds));

      await this.prisma.client.$transaction(async (tx) => {
        await tx.userRole.deleteMany({
          where: { userId },
        });

        if (uniqueRoleIds.length > 0) {
          await tx.userRole.createMany({
            data: uniqueRoleIds.map((roleId) => ({
              userId,
              roleId,
            })),
            skipDuplicates: true,
          });
        }
      });

      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }
  async findById(id: string): Promise<Result<User>> {
    try {
      const u = await this.prisma.client.user.findFirst({
        where: { id, deletedAt: null },
        ...this.userPayload,
      });
      if (!u) return Result.fail(UserErrors.NOT_FOUND);
      return Result.ok(this.toDomain(u)!);
    } catch (error) {
      return Result.fail(error);
    }
  }

  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    const client = resolvePrismaExecutor(tx, this.prisma.client);
    try {
      const result = await client.user.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      if (result.count === 0) {
        return Result.fail(UserErrors.NOT_FOUND);
      }

      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }

  private toDomain(u: UserPayload): User | null {
    if (!u) return null;

    const roleIds = u.roles.map((userRole) => {
      return userRole.roleId;
    });

    const user = User.create({
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      roleIds,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      deletedAt: u.deletedAt,
    });

    return user;
  }

  private toDto(user: UserPayload): UserDTO {
    const permissionsMap = new Map<
      string,
      { id: string; name: string; alias: string; criticality: string }
    >();

    user.roles.forEach((userRole) => {
      userRole.role.permissions.forEach((rolePermission) => {
        const permission = rolePermission.permission;

        permissionsMap.set(permission.id, {
          id: permission.id,
          name: permission.name,
          alias: permission.alias,
          criticality: permission.criticality,
        });
      });
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      roles: user.roles.map((userRole) => ({
        id: userRole.role.id,
        name: userRole.role.name,
      })),
      permissions: Array.from(permissionsMap.values()),
      admin: user.roles.some((userRole) => /admin/i.test(userRole.role.name)),
    };
  }

  private fromDomain(u: User) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      deletedAt: u.deletedAt,
      roleIds: u.roleIds,
    };
  }

  private async createUserWithRoles(
    executor: PrismaExecutor,
    userId: string,
    data: Omit<ReturnType<UserPrisma['fromDomain']>, 'roleIds'>,
    roleIds: string[],
  ): Promise<void> {
    const persist = async (client: PrismaExecutor) => {
      await client.user.create({ data });

      if (roleIds.length > 0) {
        await client.userRole.createMany({
          data: roleIds.map((roleId) => ({
            userId,
            roleId,
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
