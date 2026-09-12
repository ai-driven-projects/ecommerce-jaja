import { Controller, Get } from '@nestjs/common';

@Controller('customers')
export class CustomersController {
  @Get()
  getExample() {
    return {
      module: 'customers',
      message: 'customers endpoint is working',
    };
  }
}
