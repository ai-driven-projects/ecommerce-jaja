import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { MessagingModule } from '../../messaging/messaging.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { DevToolsGuard } from './dev-tools.guard.js';
import { LoadTestController } from './load-test.controller.js';
import { LoadTestPrisma } from './load-test.prisma.js';

// Development tools of the administrators (the load test of orders). Nothing
// here changes the other modules: the orders of a run are placed with the
// `PlaceOrder` of `@jaja/orders` and the adapters exported by `OrdersModule`
// (`OrderPrisma`, `CartPrisma`), and `MessagingModule` provides the outbox
// (`DomainEventPrisma`). Every route answers 404 unless `DEV_TOOLS_ENABLED`
// is `"true"` (`DevToolsGuard`).
@Module({
  imports: [DbModule, MessagingModule, OrdersModule],
  controllers: [LoadTestController],
  providers: [LoadTestPrisma, DevToolsGuard],
})
export class DevModule {}
