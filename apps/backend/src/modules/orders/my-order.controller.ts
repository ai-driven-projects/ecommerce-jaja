import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrderDetailDTO, OrderErrors, PlaceOrder } from '@jaja/orders';
import { PrismaService } from '../../db/prisma.service.js';
import { DomainEventPrisma } from '../../messaging/outbox/domain-event.prisma.js';
import { JwtGuard } from '../../shared/auth/jwt.guard.js';
import { CurrentUser } from '../../shared/decorators/current-user.decorator.js';
import { CartPrisma } from './cart.prisma.js';
import type { PlaceOrderBody } from './order-http.js';
import { throwOrderFailure, toPlaceOrderInput } from './order-http.js';
import { OrderPrisma } from './order.prisma.js';

// The orders of the authenticated user, administrator or not. The owner is
// always the token user: customer, items and prices are read on the server, and
// only the recipient and the delivery instructions come from the body. Both
// endpoints answer with the order read by `findMyOrderById`, so every response
// has the same shape.
@Controller('me/orders')
@UseGuards(JwtGuard)
export class MyOrderController {
  constructor(
    private readonly orderPrisma: OrderPrisma,
    private readonly cartPrisma: CartPrisma,
    private readonly domainEventPrisma: DomainEventPrisma,
    private readonly prisma: PrismaService,
  ) {}

  // Places the order from the account cart ("Confirmar pedido"). The order, the
  // emptied cart and the `order.placed` event are stored in one transaction.
  @Post()
  @HttpCode(201)
  async place(
    @CurrentUser('id') userId: string,
    @Body() body: PlaceOrderBody,
  ): Promise<OrderDetailDTO> {
    const useCase = new PlaceOrder(
      this.orderPrisma,
      this.cartPrisma,
      this.orderPrisma.findOrderCustomerByUserId,
      this.cartPrisma.findCartByUserId,
      this.domainEventPrisma,
      // `PrismaService` is the `TransactionManager`.
      this.prisma,
    );

    const result = await useCase.execute(toPlaceOrderInput(userId, body));

    if (result.isFailure) throwOrderFailure(result.errors);
    return this.respondWith(userId, result.instance.orderId);
  }

  // A missing order, a deleted one, the order of another user and a malformed
  // id all answer 404, so the existence of an id is never revealed.
  @Get(':id')
  async findById(
    @CurrentUser('id') userId: string,
    @Param('id') orderId: string,
  ): Promise<OrderDetailDTO> {
    return this.respondWith(userId, orderId);
  }

  private async respondWith(userId: string, orderId: string): Promise<OrderDetailDTO> {
    const result = await this.orderPrisma.findMyOrderById.execute({ userId, orderId });

    if (result.isFailure) throwOrderFailure(result.errors);
    if (!result.instance) {
      throw new NotFoundException([OrderErrors.ORDER_NOT_FOUND]);
    }
    return result.instance;
  }
}
