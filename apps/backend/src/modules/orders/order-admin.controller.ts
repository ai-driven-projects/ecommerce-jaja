import {
  Controller,
  Get,
  MessageEvent,
  NotFoundException,
  Param,
  Query,
  Sse,
} from '@nestjs/common';
import {
  OrderAdminDetailDTO,
  OrderErrors,
  OrderPageDTO,
  OrdersSummaryDTO,
} from '@jaja/orders';
import { Observable } from 'rxjs';
import { EventTimelinePrisma } from '../../messaging/monitoring/event-timeline.prisma.js';
import type { EventTimelineEntry } from '../../messaging/monitoring/event-timeline.types.js';
import { AdminOnly } from '../../shared/decorators/admin-only.decorator.js';
import type { OrderListQuery } from './order-admin-http.js';
import { toOrderFilters } from './order-admin-http.js';
import { throwOrderFailure } from './order-http.js';
import { OrderLiveUpdates } from './order-live-updates.js';
import { OrderPrisma } from './order.prisma.js';

const ORDER_AGGREGATE_TYPE = 'Order';

// Administration of the orders of every customer: read only (no action changes
// an order). The reads are CQRS queries of `OrderPrisma` called directly, and
// the event timeline is a monitoring read of the messaging tables.
//
// The fixed paths (`summary`, `stream`) are declared before `:id`, so they are
// never taken for an order id.
@Controller('orders')
@AdminOnly()
export class OrderAdminController {
  constructor(
    private readonly orderPrisma: OrderPrisma,
    private readonly orderLiveUpdates: OrderLiveUpdates,
    private readonly eventTimelinePrisma: EventTimelinePrisma,
  ) {}

  // Invalid `page`/`pageSize` fall back to the defaults, an unknown `status` and
  // an empty `search` are ignored (see `toOrderFilters`).
  @Get()
  async findAll(@Query() query: OrderListQuery): Promise<OrderPageDTO> {
    const result = await this.orderPrisma.findOrders.execute(toOrderFilters(query));

    if (result.isFailure) throwOrderFailure(result.errors);
    return result.instance;
  }

  // Indicators of the day in the operation time zone and the latest orders in
  // progress.
  @Get('summary')
  async summary(): Promise<OrdersSummaryDTO> {
    const result = await this.orderPrisma.findOrdersSummary.execute();

    if (result.isFailure) throwOrderFailure(result.errors);
    return result.instance;
  }

  // Live notices of every order (`text/event-stream`): an `order` event with
  // `{ orderId, eventType, messageId, occurredAt }` for each event of any order
  // and a `ping` every 20 s. The stream is only a notice: it never carries order
  // data, and the screens (listing, menu counter, dashboard, order monitor) read
  // the REST API again. The guards of the class run before the stream opens, so
  // 401 and 403 are ordinary JSON responses.
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.orderLiveUpdates.forAll();
  }

  // A missing order, a deleted one and a malformed id answer 404.
  @Get(':id')
  async findById(@Param('id') orderId: string): Promise<OrderAdminDetailDTO> {
    return this.findOrder(orderId);
  }

  // The events of the order in the outbox, with causation, correlation, the
  // outbox situation and the state of each consumer. The order is checked first,
  // so a missing order answers 404 like the other endpoints.
  @Get(':id/events')
  async events(@Param('id') orderId: string): Promise<EventTimelineEntry[]> {
    const order = await this.findOrder(orderId);
    const result = await this.eventTimelinePrisma.findByAggregate(ORDER_AGGREGATE_TYPE, order.id);

    if (result.isFailure) throwOrderFailure(result.errors);
    return result.instance;
  }

  private async findOrder(orderId: string): Promise<OrderAdminDetailDTO> {
    const result = await this.orderPrisma.findOrderById.execute(orderId);

    if (result.isFailure) throwOrderFailure(result.errors);
    if (!result.instance) {
      throw new NotFoundException([OrderErrors.ORDER_NOT_FOUND]);
    }
    return result.instance;
  }
}
