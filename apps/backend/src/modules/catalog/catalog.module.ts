import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { CatalogController } from './catalog.controller';
import { CatalogPrisma } from './catalog.prisma';

@Module({
  imports: [DbModule],
  controllers: [CatalogController],
  providers: [CatalogPrisma],
  exports: [CatalogPrisma],
})
export class CatalogModule {}
