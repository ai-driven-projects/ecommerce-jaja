import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogPrisma } from './catalog.prisma.js';

@Module({
  imports: [DbModule],
  controllers: [CatalogController],
  providers: [CatalogPrisma],
  exports: [CatalogPrisma],
})
export class CatalogModule {}
