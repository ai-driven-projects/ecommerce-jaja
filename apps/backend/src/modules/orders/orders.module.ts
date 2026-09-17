import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { MessagingModule } from '../../messaging/messaging.module.js';
import { CartController } from './cart.controller.js';
import { CartPrisma } from './cart.prisma.js';
import { MyCartController } from './my-cart.controller.js';
import { MyOrderController } from './my-order.controller.js';
import { OrderAdminController } from './order-admin.controller.js';
import { OrderLiveUpdates } from './order-live-updates.js';
import { OrderPrisma } from './order.prisma.js';
import { OrderSimulationConsumers } from './simulation/order-simulation.consumers.js';

// `MessagingModule` provides `DomainEventPrisma` (the outbox) and `LiveEventFeed`
// (live notices) to `MyOrderController` and `OrderAdminController`,
// `EventTimelinePrisma` (event timeline) to `OrderAdminController`, and
// `EventConsumerRegistry` to the simulated services; Nest modules are
// singletons, so the relay stays unique.
@Module({
  imports: [DbModule, MessagingModule],
  controllers: [MyCartController, CartController, MyOrderController, OrderAdminController],
  providers: [CartPrisma, OrderPrisma, OrderLiveUpdates, OrderSimulationConsumers],
  exports: [CartPrisma, OrderPrisma],
})
export class OrdersModule {}
