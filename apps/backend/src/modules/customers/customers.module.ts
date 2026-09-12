import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { CustomersController } from './customers.controller.js';
import { CustomersPrisma } from './customers.prisma.js';

@Module({
  imports: [DbModule],
  controllers: [CustomersController],
  providers: [CustomersPrisma],
  exports: [CustomersPrisma],
})
export class CustomersModule {}
