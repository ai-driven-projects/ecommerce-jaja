import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AppUser } from '../../../src/shared/types/app-user.type.js';
import { AdminGuard } from '../../../src/shared/auth/admin.guard.js';

function createContext(user?: Partial<AppUser>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('allows a user with admin = true', () => {
    const context = createContext({
      id: '1',
      name: 'Admin',
      email: 'admin@jaja.dev',
      admin: true,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException with ADMIN_REQUIRED for a user with admin = false', () => {
    const context = createContext({
      id: '2',
      name: 'Ana',
      email: 'ana.pereira.carvalho@jaja.dev',
      admin: false,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('ADMIN_REQUIRED');
  });

  it('throws UnauthorizedException when request.user is missing', () => {
    const context = createContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
