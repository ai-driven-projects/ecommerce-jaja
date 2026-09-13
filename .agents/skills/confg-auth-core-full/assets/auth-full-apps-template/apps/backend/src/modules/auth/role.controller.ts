import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RequirePermissionGuard } from 'src/shared/guards/require-permission.guard';
import { RequirePermission } from 'src/shared/decorators/require-permission.decorator';
import { RolePrisma } from './role.prisma';
import { PermissionPrisma } from './permission.prisma';
import {
  CreateRole,
  DeleteRoleUseCase,
  FindAllPermissions,
  FindAllRoles,
  PERMISSIONS,
  UpdateRoleUseCase,
} from '__AUTH_PACKAGE_NAME__';
import type {
  CreateRoleIn,
  PermissionDTO,
  RoleDTO,
  UpdateRoleIn,
} from '__AUTH_PACKAGE_NAME__';

@Controller('roles')
export class RoleController {
  constructor(
    private readonly rolePrisma: RolePrisma,
    private readonly permissionPrisma: PermissionPrisma,
  ) {}

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.AUTH.ROLE.READ)
  @Get()
  async getRoles(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('all') all?: string,
  ) {
    const parsedPage = Number(page);
    const parsedPageSize = Number(pageSize);
    const shouldReturnAll = all === 'true';

    const uc = new FindAllRoles(this.rolePrisma.findAllRolesQuery);
    const result = await uc.execute({
      page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      pageSize:
        Number.isFinite(parsedPageSize) && parsedPageSize > 0
          ? parsedPageSize
          : 10,
      all: shouldReturnAll,
    });
    if (result.isFailure) {
      return {
        data: [],
        meta: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        },
      };
    }
    return result.instance;
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.AUTH.ROLE.CREATE)
  @Post()
  async createRole(@Body() data: CreateRoleIn): Promise<void> {
    const uc = new CreateRole(
      this.rolePrisma,
      this.permissionPrisma.permissionsExistQuery,
    );
    const result = await uc.execute(data);
    if (result.isFailure) {
      throw new BadRequestException(result.errors!);
    }
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.AUTH.ROLE.UPDATE)
  @Patch('/:id')
  async updateRole(@Body() data: UpdateRoleIn): Promise<void> {
    const uc = new UpdateRoleUseCase(
      this.rolePrisma,
      this.permissionPrisma.permissionsExistQuery,
    );
    const result = await uc.execute(data);
    if (result.isFailure) {
      throw new BadRequestException(result.errors);
    }
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.AUTH.ROLE.DELETE)
  @Delete('/:id')
  async deleteRole(@Param('id') id: string): Promise<void> {
    const uc = new DeleteRoleUseCase(this.rolePrisma);
    const result = await uc.execute({ id });
    if (result.isFailure) {
      throw new InternalServerErrorException({ errors: result.errors });
    }
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.AUTH.PERMISSION.READ)
  @Get('permissions')
  async getPermissions(): Promise<PermissionDTO[]> {
    const uc = new FindAllPermissions(
      this.permissionPrisma.findAllPermissionQuery,
    );
    const result = await uc.execute();
    if (result.isFailure) {
      return [];
    }
    return result.instance;
  }
}
