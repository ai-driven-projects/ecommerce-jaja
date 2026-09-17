import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '../../../src/shared/auth/admin.guard.js';
import { JwtGuard } from '../../../src/shared/auth/jwt.guard.js';
import { AdminOnly } from '../../../src/shared/decorators/admin-only.decorator.js';

describe('AdminOnly', () => {
  it('applies JwtGuard before AdminGuard', () => {
    @AdminOnly()
    class TestController {}

    expect(Reflect.getMetadata(GUARDS_METADATA, TestController)).toEqual([
      JwtGuard,
      AdminGuard,
    ]);
  });
});
