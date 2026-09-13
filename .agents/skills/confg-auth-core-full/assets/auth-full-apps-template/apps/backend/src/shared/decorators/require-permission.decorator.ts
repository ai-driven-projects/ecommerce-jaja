import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

export type PermissionRequirement =
  | string
  | {
      name?: string;
      alias?: string;
    };

export const RequirePermission = (...permissions: PermissionRequirement[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
