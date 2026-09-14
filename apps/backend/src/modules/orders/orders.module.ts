import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { CartController } from './cart.controller.js';
import { CartPrisma } from './cart.prisma.js';
import { MyCartController } from './my-cart.controller.js';

@Module({
  imports: [DbModule],
  controllers: [MyCartController, CartController],
  providers: [CartPrisma],
  exports: [CartPrisma],
})
export class OrdersModule {}
