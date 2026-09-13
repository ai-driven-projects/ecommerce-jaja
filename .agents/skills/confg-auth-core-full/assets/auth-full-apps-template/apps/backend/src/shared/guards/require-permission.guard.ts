import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserDTO } from '__AUTH_PACKAGE_NAME__';
import {
  REQUIRE_PERMISSION_KEY,
  type PermissionRequirement,
} from '../decorators/require-permission.decorator';

function permissionKey(value: PermissionRequirement): string {
  if (typeof value === 'string') return value;
  return value.alias ?? value.name ?? '';
}

@Injectable()
export class RequirePermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionRequirement[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: UserDTO }>();
    const userKeys = new Set(
      (request.user?.permissions ?? []).flatMap((permission) =>
        [permission.alias, permission.name].filter(Boolean),
      ),
    );

    const allowed = required.every((permission) => {
      const key = permissionKey(permission);
      return key.length > 0 && userKeys.has(key);
    });

    if (!allowed) {
      throw new ForbiddenException({ errors: ['FORBIDDEN'] });
    }

    return true;
  }
}
