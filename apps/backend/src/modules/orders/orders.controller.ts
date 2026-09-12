import { Controller, Get } from '@nestjs/common';

@Controller('orders')
export class OrdersController {
  @Get()
  getExample() {
    return {
      module: 'orders',
      message: 'orders endpoint is working',
    };
  }
}
