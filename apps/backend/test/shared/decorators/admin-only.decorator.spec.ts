import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '../auth/admin.guard.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { AdminOnly } from './admin-only.decorator.js';

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
