import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { StoresModule } from './modules/stores/stores.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { SharedModule } from './shared/shared.module.js';
import { DbModule } from './db/db.module.js';
import { MessagingModule } from './messaging/messaging.module.js';

@Module({
  imports: [
    DbModule,
    SharedModule,
    MessagingModule,
    CustomersModule,
    StoresModule,
    OrdersModule,
    CatalogModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
