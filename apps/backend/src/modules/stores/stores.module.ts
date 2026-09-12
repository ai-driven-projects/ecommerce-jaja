import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { StoresController } from './stores.controller.js';
import { StoresPrisma } from './stores.prisma.js';

@Module({
  imports: [DbModule],
  controllers: [StoresController],
  providers: [StoresPrisma],
  exports: [StoresPrisma],
})
export class StoresModule {}
