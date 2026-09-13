import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppUser } from '../types/app-user.type.js';
import { AuthenticatedRequest } from '../types/authenticated-request.type.js';

export const CurrentUser = createParamDecorator(
  (field: keyof AppUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
