import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import {
  CustomerDTO,
  CustomerDetailDTO,
  CustomerErrors,
  CustomerFiltersDTO,
  CustomerPageDTO,
  SaveCustomer,
} from '@jaja/customers';
import { AdminOnly } from '../../shared/decorators/admin-only.decorator.js';
import { CustomerPrisma } from './customer.prisma.js';
import type { SaveCustomerBody } from './customer-http.js';
import { throwFailure, toInput } from './customer-http.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Administration of customers. There is no POST nor DELETE: customers are only
// created by their own user (`PUT /me/customer`) and are never deleted.
@Controller('customers')
@AdminOnly()
export class CustomerController {
  constructor(private readonly customerPrisma: CustomerPrisma) {}

  @Get()
  async findAll(
    @Query('page') page?: unknown,
    @Query('pageSize') pageSize?: unknown,
    @Query('search') search?: unknown,
    @Query('isActive') isActive?: unknown,
  ): Promise<CustomerPageDTO> {
    // Invalid `page`/`pageSize` fall back to the defaults; `pageSize` is capped.
    const filter: CustomerFiltersDTO = {
      page: this.positiveInteger(page, DEFAULT_PAGE),
      pageSize: Math.min(this.positiveInteger(pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    };
    if (typeof search === 'string' && search.trim()) filter.search = search.trim();
    // Any value other than exactly "true" or "false" is ignored.
    if (isActive === 'true' || isActive === 'false') {
      filter.isActive = isActive === 'true';
    }

    const result = await this.customerPrisma.findCustomers.execute(filter);

    if (result.isFailure) throwFailure(result.errors);
    return result.instance;
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<CustomerDetailDTO> {
    const result = await this.customerPrisma.findCustomerById.execute(id);

    if (result.isFailure) throwFailure(result.errors);
    if (!result.instance) {
      throw new NotFoundException([CustomerErrors.CUSTOMER_NOT_FOUND]);
    }
    return result.instance;
  }

  @Put(':id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body() body: SaveCustomerBody,
  ): Promise<CustomerDTO> {
    const useCase = new SaveCustomer(this.customerPrisma);

    // The route id wins over an `id` in the body, and `userId` in the body never
    // reaches the use case: the link to the user does not change.
    const result = await useCase.execute({ ...toInput(body), id });

    if (result.isFailure) throwFailure(result.errors);
    return result.instance;
  }

  private positiveInteger(value: unknown, fallback: number): number {
    if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return fallback;
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
  }
}
