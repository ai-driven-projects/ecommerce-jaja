import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { MessagingModule } from '../../messaging/messaging.module.js';
import { CartController } from './cart.controller.js';
import { CartPrisma } from './cart.prisma.js';
import { MyCartController } from './my-cart.controller.js';
import { MyOrderController } from './my-order.controller.js';
import { OrderPrisma } from './order.prisma.js';

// `MessagingModule` provides `DomainEventPrisma` (the outbox) to
// `MyOrderController`; Nest modules are singletons, so the relay stays unique.
@Module({
  imports: [DbModule, MessagingModule],
  controllers: [MyCartController, CartController, MyOrderController],
  providers: [CartPrisma, OrderPrisma],
  exports: [CartPrisma, OrderPrisma],
})
export class OrdersModule {}
