import { Controller, Get } from '@nestjs/common';

@Controller('catalog')
export class CatalogController {
  @Get()
  getExample() {
    return {
      module: 'catalog',
      message: 'catalog endpoint is working',
    };
  }
}
