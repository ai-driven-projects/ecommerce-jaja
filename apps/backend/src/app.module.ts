import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrdersModule } from './modules/orders/orders.module';
import { StoresModule } from './modules/stores/stores.module';
import { CustomersModule } from './modules/customers/customers.module';

@Module({
  imports: [
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
