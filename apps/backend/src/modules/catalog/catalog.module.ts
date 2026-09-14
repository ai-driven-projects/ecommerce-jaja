import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { BrandController } from './brand.controller.js';
import { BrandPrisma } from './brand.prisma.js';
import { CategoryController } from './category.controller.js';
import { CategoryPrisma } from './category.prisma.js';
import { ProductController } from './product.controller.js';
import { ProductPrisma } from './product.prisma.js';
import { StorefrontController } from './storefront.controller.js';

@Module({
  imports: [DbModule],
  controllers: [BrandController, CategoryController, ProductController, StorefrontController],
  providers: [BrandPrisma, CategoryPrisma, ProductPrisma],
  exports: [BrandPrisma, CategoryPrisma, ProductPrisma],
})
export class CatalogModule {}
