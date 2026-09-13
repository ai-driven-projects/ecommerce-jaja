import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request.type.js';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    // No user means JwtGuard did not authenticate (e.g. combined with @Public()).
    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.admin !== true) {
      throw new ForbiddenException('ADMIN_REQUIRED');
    }

    return true;
  }
}
