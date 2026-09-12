import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { AuthController } from './auth.controller';
import { AuthPrisma } from './auth.prisma';

@Module({
  imports: [DbModule],
  controllers: [AuthController],
  providers: [AuthPrisma],
  exports: [AuthPrisma],
})
export class AuthModule {}
