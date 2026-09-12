import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { OrdersController } from './orders.controller';
import { OrdersPrisma } from './orders.prisma';

@Module({
  imports: [DbModule],
  controllers: [OrdersController],
  providers: [OrdersPrisma],
  exports: [OrdersPrisma],
})
export class OrdersModule {}
