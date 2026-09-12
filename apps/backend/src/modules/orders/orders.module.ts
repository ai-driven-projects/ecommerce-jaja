import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersPrisma } from './orders.prisma.js';

@Module({
  imports: [DbModule],
  controllers: [OrdersController],
  providers: [OrdersPrisma],
  exports: [OrdersPrisma],
})
export class OrdersModule {}
