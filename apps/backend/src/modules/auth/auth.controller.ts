import { Controller, Get } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get()
  getExample() {
    return {
      module: 'auth',
      message: 'auth endpoint is working',
    };
  }
}
