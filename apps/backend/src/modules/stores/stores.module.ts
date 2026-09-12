import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { StoresController } from './stores.controller';
import { StoresPrisma } from './stores.prisma';

@Module({
  imports: [DbModule],
  controllers: [StoresController],
  providers: [StoresPrisma],
  exports: [StoresPrisma],
})
export class StoresModule {}
