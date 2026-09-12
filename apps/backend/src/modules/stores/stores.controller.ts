import { Controller, Get } from '@nestjs/common';

@Controller('stores')
export class StoresController {
  @Get()
  getExample() {
    return {
      module: 'stores',
      message: 'stores endpoint is working',
    };
  }
}
