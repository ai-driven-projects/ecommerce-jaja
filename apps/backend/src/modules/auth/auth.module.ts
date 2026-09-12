import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { AuthController } from './auth.controller.js';
import { AuthPrisma } from './auth.prisma.js';

@Module({
  imports: [DbModule],
  controllers: [AuthController],
  providers: [AuthPrisma],
  exports: [AuthPrisma],
})
export class AuthModule {}
