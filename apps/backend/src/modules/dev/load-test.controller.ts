import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { LoadTestRunDTO, PlanLoadTestOrder } from '@jaja/dev';
import { PlaceOrder } from '@jaja/orders';
import { performance } from 'node:perf_hooks';
import { PrismaService } from '../../db/prisma.service.js';
import { DomainEventPrisma } from '../../messaging/outbox/domain-event.prisma.js';
import { AdminOnly } from '../../shared/decorators/admin-only.decorator.js';
import { CartPrisma } from '../orders/cart.prisma.js';
import { throwOrderFailure } from '../orders/order-http.js';
import { OrderPrisma } from '../orders/order.prisma.js';
import { DevToolsGuard } from './dev-tools.guard.js';
import type {
  LoadTestOrderBody,
  LoadTestOrderPlacedDTO,
  LoadTestPoolSummaryDTO,
} from './load-test-http.js';
import { throwLoadTestFailure, toPlanInput } from './load-test-http.js';
import { LoadTestPrisma } from './load-test.prisma.js';
import { SyntheticCartQuery, SyntheticCartRepository } from './synthetic-cart.js';

// Load test of orders, only for administrators and only with
// `DEV_TOOLS_ENABLED="true"`. Each `POST` places **one** order, so the screen
// fires as many requests at the same time as it wants and measures how the API
// answers; the order follows the regular cycle (outbox, broker and simulated
// services) and leaves the queue when it is delivered.
//
// `@UseGuards(DevToolsGuard)` is above `@AdminOnly()` so its guard runs last:
// 401/403 first, then 404 when the tools are off.
@Controller('dev/load-test')
@UseGuards(DevToolsGuard)
@AdminOnly()
export class LoadTestController {
  constructor(
    private readonly loadTestPrisma: LoadTestPrisma,
    private readonly orderPrisma: OrderPrisma,
    private readonly cartPrisma: CartPrisma,
    private readonly domainEventPrisma: DomainEventPrisma,
    private readonly prisma: PrismaService,
  ) {}

  // How many visible products and active customers the orders are drawn from;
  // the screen also uses it to know whether the tools are on (404 when off).
  @Get('pool')
  async pool(): Promise<LoadTestPoolSummaryDTO> {
    const result = await this.loadTestPrisma.findLoadTestPool.execute();

    if (result.isFailure) throwLoadTestFailure(result.errors);
    return {
      products: result.instance.productIds.length,
      customers: result.instance.customerUserIds.length,
    };
  }

  // Plans the order of the run (customer and items drawn among the active
  // customers and the visible products) and places it with `PlaceOrder`, over
  // a cart that exists only in memory. The order, tagged with the run in the
  // delivery instructions, and its `order.placed` event are stored in one
  // transaction, as in the checkout.
  @Post('orders')
  @HttpCode(201)
  async placeOrder(@Body() body: LoadTestOrderBody): Promise<LoadTestOrderPlacedDTO> {
    const startedAt = performance.now();

    const plan = await new PlanLoadTestOrder(this.loadTestPrisma.findLoadTestPool).execute(
      toPlanInput(body),
    );
    if (plan.isFailure) throwLoadTestFailure(plan.errors);

    const { runId, customerUserId, items, deliveryInstructions } = plan.instance;
    const useCase = new PlaceOrder(
      this.orderPrisma,
      new SyntheticCartRepository(items),
      this.orderPrisma.findOrderCustomerByUserId,
      new SyntheticCartQuery(this.cartPrisma.previewCart, items),
      this.domainEventPrisma,
      // `PrismaService` is the `TransactionManager`.
      this.prisma,
    );

    const placed = await useCase.execute({ userId: customerUserId, deliveryInstructions });
    if (placed.isFailure) throwOrderFailure(placed.errors);

    return {
      runId,
      orderId: placed.instance.orderId,
      serverMs: Math.round(performance.now() - startedAt),
    };
  }

  // Every order of the run with its status (the queue panel). An unknown run
  // or a malformed id answers the empty run.
  @Get('runs/:runId')
  async run(@Param('runId') runId: string): Promise<LoadTestRunDTO> {
    const result = await this.loadTestPrisma.findLoadTestRun.execute(runId);

    if (result.isFailure) throwLoadTestFailure(result.errors);
    return result.instance;
  }
}
