import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { CustomerController } from './customer.controller.js';
import { CustomerPrisma } from './customer.prisma.js';
import { MyCustomerController } from './my-customer.controller.js';

@Module({
  imports: [DbModule],
  controllers: [CustomerController, MyCustomerController],
  providers: [CustomerPrisma],
  exports: [CustomerPrisma],
})
export class CustomersModule {}
