import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { AuthController } from './auth.controller.js';
import { BcryptProvider } from './bcrypt.provider.js';
import { PasswordPrisma } from './password.prisma.js';
import { UserPrisma } from './user.prisma.js';

@Module({
  imports: [DbModule],
  controllers: [AuthController],
  providers: [UserPrisma, PasswordPrisma, BcryptProvider],
  exports: [UserPrisma, PasswordPrisma, BcryptProvider],
})
export class AuthModule {}
