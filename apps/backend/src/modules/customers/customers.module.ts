import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { CustomersController } from './customers.controller';
import { CustomersPrisma } from './customers.prisma';

@Module({
  imports: [DbModule],
  controllers: [CustomersController],
  providers: [CustomersPrisma],
  exports: [CustomersPrisma],
})
export class CustomersModule {}
