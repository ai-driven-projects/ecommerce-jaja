import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  CustomerDTO,
  CustomerDetailDTO,
  CustomerErrors,
  SaveCustomer,
} from '@jaja/customers';
import { JwtGuard } from '../../shared/auth/jwt.guard.js';
import { CurrentUser } from '../../shared/decorators/current-user.decorator.js';
import { CustomerPrisma } from './customer.prisma.js';
import type { SaveCustomerBody } from './customer-http.js';
import { throwFailure, toInput } from './customer-http.js';

// The customer record of the authenticated user, administrator or not. It lives
// under its own prefix (not `/customers/me`) so it never depends on the order of
// the admin-only `GET /customers/:id` route.
@Controller('me/customer')
@UseGuards(JwtGuard)
export class MyCustomerController {
  constructor(private readonly customerPrisma: CustomerPrisma) {}

  @Get()
  async find(@CurrentUser('id') userId: string): Promise<CustomerDetailDTO> {
    const result = await this.customerPrisma.findCustomerByUserId.execute(userId);

    if (result.isFailure) throwFailure(result.errors);
    // The store reads this as "no delivery data yet".
    if (!result.instance) {
      throw new NotFoundException([CustomerErrors.CUSTOMER_NOT_FOUND]);
    }
    return result.instance;
  }

  @Put()
  @HttpCode(200)
  async save(
    @CurrentUser('id') userId: string,
    @Body() body: SaveCustomerBody,
  ): Promise<CustomerDTO> {
    const useCase = new SaveCustomer(this.customerPrisma);

    // Creates or updates the customer of the token user: `id`, `userId` and
    // `isActive` in the body are discarded, so the user neither picks another
    // customer nor activates or deactivates their own record.
    const result = await useCase.execute({
      ...toInput(body),
      isActive: undefined,
      userId,
    });

    if (result.isFailure) throwFailure(result.errors);
    return result.instance;
  }
}
