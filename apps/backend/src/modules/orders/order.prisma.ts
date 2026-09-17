import { Injectable } from '@nestjs/common';
import { Id, Result, TransactionContext } from '@mentoria-360/shared';
import {
  FindMyOrderByIdQuery,
  FindOrderByIdQuery,
  FindOrderCustomerByUserIdQuery,
  FindOrdersQuery,
  FindOrdersSummaryQuery,
  Order,
  OrderAdminDetailDTO,
  OrderDetailDTO,
  OrderErrors,
  OrderFiltersDTO,
  OrderListItemDTO,
  OrderRepository,
  OrderStatus,
} from '@jaja/orders';
import { Prisma } from '@prisma/client';
import {
  PrismaService,
  PrismaTransactionContext,
} from '../../db/prisma.service.js';
import { folded, toSearchTerms } from '../../db/text-search.sql.js';

/**
 * Time zone of the operation: "today" in the admin summary is the current day
 * here. Fixed in this version (no environment variable).
 */
export const OPERATION_TIME_ZONE = 'America/Sao_Paulo';

type ConstraintViolation = {
  fields: readonly string[];
  constraint: string;
  code: string;
};

// P2002: the id of the order is already used (a new order always gets a new
// uuid, so it only happens when creating with the id of an existing order).
const UNIQUE_VIOLATIONS: readonly ConstraintViolation[] = [
  {
    fields: ['id'],
    constraint: 'orders_pkey',
    code: OrderErrors.ORDER_ALREADY_EXISTS,
  },
];

// P2003: the customer vanished before the write (e.g. a physical delete) or a
// product of the cart vanished between reading the cart and storing the order.
const FOREIGN_KEY_VIOLATIONS: readonly ConstraintViolation[] = [
  {
    fields: ['customer_id', 'customerId'],
    constraint: 'orders_customer_id_fkey',
    code: OrderErrors.ORDER_CUSTOMER_NOT_FOUND,
  },
  {
    fields: ['product_id', 'productId'],
    constraint: 'order_items_product_id_fkey',
    code: OrderErrors.ORDER_PRODUCT_NOT_FOUND,
  },
];

const WITH_ITEMS = {
  items: { orderBy: { position: 'asc' } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof WITH_ITEMS }>;

const WITH_ITEMS_AND_CUSTOMER = {
  ...WITH_ITEMS,
  customer: {
    select: { id: true, phone: true, user: { select: { name: true, email: true } } },
  },
} satisfies Prisma.OrderInclude;

type OrderWithCustomerRow = Prisma.OrderGetPayload<{ include: typeof WITH_ITEMS_AND_CUSTOMER }>;

// The listing reads the orders with the name of the user of the customer. The
// customer is joined even when soft-deleted: its orders are still orders.
const FROM_ORDERS = Prisma.sql`
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  JOIN users u ON u.id = c.user_id`;

// Columns of `OrderListItemDTO`. `itemCount` sums the quantities of the items;
// `statusChangedAt` is the date of the most recent step reached.
const LIST_ITEM_COLUMNS = Prisma.sql`
  o.id::text AS id,
  o.status,
  u.name AS "customerName",
  o.delivery_neighborhood AS "deliveryNeighborhood",
  o.delivery_city AS "deliveryCity",
  COALESCE((SELECT sum(i.quantity) FROM order_items i WHERE i.order_id = o.id), 0)::int AS "itemCount",
  o.total_cents AS "totalCents",
  o.placed_at AS "placedAt",
  COALESCE(o.delivered_at, o.out_for_delivery_at, o.picking_started_at, o.payment_approved_at, o.placed_at)
    AS "statusChangedAt"`;

// Most recent first; `id` keeps pages stable between orders of the same instant.
const LIST_ORDER = Prisma.sql`ORDER BY o.placed_at DESC, o.id`;

const DELIVERED: OrderStatus = 'DELIVERED';
const LATEST_IN_PROGRESS_LIMIT = 6;

// The order number is the start of the id without dashes; the search compares
// it only when the text (without dashes and spaces) is hexadecimal.
const ORDER_NUMBER_SEARCH = /^[0-9a-f]{1,32}$/;

// Order dates are `timestamp` without time zone holding UTC: each one is read as
// UTC, converted to the operation time zone and reduced to its day. The zone is
// a constant, never user input.
const OPERATION_ZONE_SQL = Prisma.raw(`'${OPERATION_TIME_ZONE}'`);
const TODAY = Prisma.sql`(now() AT TIME ZONE ${OPERATION_ZONE_SQL})::date`;

function localDay(column: string): Prisma.Sql {
  return Prisma.sql`((${Prisma.raw(column)} AT TIME ZONE 'UTC') AT TIME ZONE ${OPERATION_ZONE_SQL})::date`;
}

type OrderListItemRow = Omit<OrderListItemDTO, 'status'> & { status: string };

type OrdersSummaryRow = {
  placedToday: number;
  inProgress: number;
  deliveredToday: number;
  // `bigint` in SQL, so the sum never overflows.
  revenueTodayCents: bigint | number | string;
  averageTicketTodayCents: number | null;
  averageDeliveryMinutesToday: number | null;
};

function listItemToDTO(row: OrderListItemRow): OrderListItemDTO {
  return { ...row, status: row.status as OrderStatus };
}

@Injectable()
export class OrderPrisma implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Read side (CQRS): rows are mapped straight to DTOs, without the entity.

  // The customer record of the user with the name of the linked user; inactive
  // records are returned too, since refusing them is a rule of `PlaceOrder`.
  // CEP and state go as stored (`char(8)` and `char(2)`).
  readonly findOrderCustomerByUserId: FindOrderCustomerByUserIdQuery = {
    execute: (userId) =>
      Result.tryAsync(async () => {
        // A malformed id never matches the uuid column; skip the database error.
        if (!this.isUuid(userId)) return null;

        const row = await this.prisma.client.customer.findFirst({
          where: { userId, deletedAt: null },
          include: { user: { select: { name: true } } },
        });
        if (!row) return null;

        return {
          customerId: row.id,
          isActive: row.isActive,
          name: row.user.name,
          deliveryAddress: {
            zipCode: row.zipCode,
            street: row.street,
            number: row.number,
            complement: row.complement,
            neighborhood: row.neighborhood,
            city: row.city,
            state: row.state,
          },
        };
      }),
  };

  // The order is filtered by its id **and** by the user of its customer, so the
  // order of another user answers `null` like a missing one. The totals are
  // read as stored, never recomputed.
  readonly findMyOrderById: FindMyOrderByIdQuery = {
    execute: (input) =>
      Result.tryAsync(async () => {
        const { userId, orderId } = input ?? ({} as Partial<typeof input>);
        if (!this.isUuid(userId) || !this.isUuid(orderId)) return null;

        const row = await this.prisma.client.order.findFirst({
          where: {
            id: orderId.trim(),
            deletedAt: null,
            customer: { userId: userId.trim() },
          },
          include: WITH_ITEMS,
        });
        return row ? this.toDetailDTO(row) : null;
      }),
  };

  // Admin listing: raw SQL for the sum of the items, the most recent step and
  // the search that ignores accents (see `FindOrdersQuery`).
  readonly findOrders: FindOrdersQuery = {
    execute: (filters) =>
      Result.tryAsync(async () => {
        const page = Math.max(1, Math.trunc(filters.page) || 1);
        const pageSize = Math.max(1, Math.trunc(filters.pageSize) || 1);
        const where = this.listWhere(filters);

        const client = this.prisma.client;
        const [counts, rows] = await Promise.all([
          client.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${FROM_ORDERS} WHERE ${where}`,
          client.$queryRaw<OrderListItemRow[]>`
            SELECT ${LIST_ITEM_COLUMNS}
            ${FROM_ORDERS}
            WHERE ${where}
            ${LIST_ORDER}
            LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        ]);

        const total = counts[0]?.total ?? 0;
        return {
          items: rows.map(listItemToDTO),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      }),
  };

  // Indicators of the day in `OPERATION_TIME_ZONE`, computed by one aggregate
  // query with `FILTER`, plus the latest in-progress orders.
  readonly findOrdersSummary: FindOrdersSummaryQuery = {
    execute: () =>
      Result.tryAsync(async () => {
        const placedToday = Prisma.sql`${localDay('o.placed_at')} = ${TODAY}`;
        const deliveredToday = Prisma.sql`o.delivered_at IS NOT NULL AND ${localDay('o.delivered_at')} = ${TODAY}`;

        const client = this.prisma.client;
        const [totals, latest] = await Promise.all([
          client.$queryRaw<OrdersSummaryRow[]>`
            SELECT
              count(*) FILTER (WHERE ${placedToday})::int AS "placedToday",
              count(*) FILTER (WHERE o.status <> ${DELIVERED})::int AS "inProgress",
              count(*) FILTER (WHERE ${deliveredToday})::int AS "deliveredToday",
              COALESCE(sum(o.total_cents) FILTER (WHERE ${placedToday}), 0)::bigint AS "revenueTodayCents",
              round(avg(o.total_cents) FILTER (WHERE ${placedToday}))::int AS "averageTicketTodayCents",
              round(
                (avg(extract(epoch FROM o.delivered_at - o.placed_at)) FILTER (WHERE ${deliveredToday}) / 60)::numeric,
                1
              )::float8 AS "averageDeliveryMinutesToday"
            FROM orders o
            WHERE o.deleted_at IS NULL`,
          client.$queryRaw<OrderListItemRow[]>`
            SELECT ${LIST_ITEM_COLUMNS}
            ${FROM_ORDERS}
            WHERE ${this.listWhere({ page: 1, pageSize: LATEST_IN_PROGRESS_LIMIT, status: 'IN_PROGRESS' })}
            ${LIST_ORDER}
            LIMIT ${LATEST_IN_PROGRESS_LIMIT}`,
        ]);

        const row = totals[0];
        return {
          placedToday: row?.placedToday ?? 0,
          inProgress: row?.inProgress ?? 0,
          deliveredToday: row?.deliveredToday ?? 0,
          revenueTodayCents: Number(row?.revenueTodayCents ?? 0),
          averageTicketTodayCents: row?.averageTicketTodayCents ?? null,
          averageDeliveryMinutesToday: row?.averageDeliveryMinutesToday ?? null,
          latestInProgress: latest.map(listItemToDTO),
        };
      }),
  };

  // Any order, with its customer, for administrators. The totals are read as
  // stored, like in `findMyOrderById`.
  readonly findOrderById: FindOrderByIdQuery = {
    execute: (orderId) =>
      Result.tryAsync(async () => {
        if (!this.isUuid(orderId)) return null;

        const row = await this.prisma.client.order.findFirst({
          where: { id: orderId.trim(), deletedAt: null },
          include: WITH_ITEMS_AND_CUSTOMER,
        });
        return row ? this.toAdminDetailDTO(row) : null;
      }),
  };

  async create(order: Order, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        // Nested write: the order and its items are inserted atomically, with
        // the client of the received transaction.
        await this.clientFor(tx).order.create({
          data: {
            ...this.fromDomain(order),
            items: { createMany: { data: this.itemsFromDomain(order) } },
          },
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  // Stores what changes after the order is placed: the status, the date of each
  // step and `updatedAt` (used by `AdvanceOrderStatus`, with the client of the
  // received transaction). Items, address, recipient and totals are copies made
  // when the order is placed and never change, so they are not written again.
  async update(order: Order, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        // `deletedAt: null` keeps a deleted order from being edited back to life.
        await this.clientFor(tx).order.update({
          where: { id: order.id, deletedAt: null },
          data: {
            status: order.status,
            ...this.stepDatesFromDomain(order),
            updatedAt: order.updatedAt,
          },
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  async findById(id: string): Promise<Result<Order>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<Order>(OrderErrors.ORDER_NOT_FOUND);

      const row = await this.prisma.client.order.findFirst({
        where: { id: id.trim(), deletedAt: null },
        include: WITH_ITEMS,
      });
      if (!row) return Result.fail<Order>(OrderErrors.ORDER_NOT_FOUND);
      return this.toDomain(row);
    });
  }

  // Soft delete: fills `deletedAt` and keeps the record. Exists only because of
  // the repository contract; no use case deletes orders.
  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<void>(OrderErrors.ORDER_NOT_FOUND);

      try {
        await this.clientFor(tx).order.update({
          where: { id: id.trim(), deletedAt: null },
          data: { deletedAt: new Date() },
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  // Conditions of the listing (see `FindOrdersQuery`): not deleted, status or
  // `IN_PROGRESS`, and the search by order number `OR` customer name.
  private listWhere(filters: OrderFiltersDTO): Prisma.Sql {
    const conditions = [Prisma.sql`o.deleted_at IS NULL`];

    if (filters.status === 'IN_PROGRESS') {
      conditions.push(Prisma.sql`o.status <> ${DELIVERED}`);
    } else if (filters.status) {
      conditions.push(Prisma.sql`o.status = ${filters.status}`);
    }

    const search = this.searchCondition(filters.search);
    if (search) conditions.push(search);

    return Prisma.join(conditions, ' AND ');
  }

  // Number: the id without dashes starts with the text (lowercase, without
  // dashes and spaces), only when that text is hexadecimal. Name: the name of
  // the user, without accents and in lowercase, contains every term. Either one
  // is enough. The terms and the number only have `[a-z0-9]`, so they never
  // carry `LIKE` wildcards.
  private searchCondition(search: string | undefined): Prisma.Sql | null {
    if (typeof search !== 'string' || !search.trim()) return null;

    const alternatives: Prisma.Sql[] = [];

    const number = search.replace(/[\s-]+/g, '').toLowerCase();
    if (ORDER_NUMBER_SEARCH.test(number)) {
      alternatives.push(Prisma.sql`replace(o.id::text, '-', '') LIKE ${`${number}%`}`);
    }

    const terms = toSearchTerms(search);
    if (terms.length) {
      const name = Prisma.raw(folded('u.name'));
      alternatives.push(
        Prisma.sql`(${Prisma.join(
          terms.map((term) => Prisma.sql`${name} LIKE ${`%${term}%`}`),
          ' AND ',
        )})`,
      );
    }

    // Text without a number nor terms (e.g. only punctuation) matches nothing.
    if (!alternatives.length) return Prisma.sql`FALSE`;
    return Prisma.sql`(${Prisma.join(alternatives, ' OR ')})`;
  }

  private clientFor(tx?: TransactionContext) {
    return (tx as PrismaTransactionContext | undefined)?.client ?? this.prisma.client;
  }

  private isUuid(id: unknown): id is string {
    return typeof id === 'string' && Id.isValid(id.trim());
  }

  // Translates the known write failures into domain errors; anything else is
  // rethrown and becomes a failure through `Result.tryAsync`.
  private writeFailure(error: unknown): Result<void> {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025: the `where` matched no row (missing or already deleted order).
      if (error.code === 'P2025') return Result.fail(OrderErrors.ORDER_NOT_FOUND);

      const violations =
        error.code === 'P2002'
          ? UNIQUE_VIOLATIONS
          : error.code === 'P2003'
            ? FOREIGN_KEY_VIOLATIONS
            : [];
      const code = this.violationCode(error, violations);
      if (code) return Result.fail(code);
    }
    throw error;
  }

  // With the driver adapter (`@prisma/adapter-pg`) the error has no `meta.target`:
  // the constraint comes in `meta.driverAdapterError.cause.constraint` and in the
  // message. Both shapes are checked, constraint names before field names.
  private violationCode(
    error: Prisma.PrismaClientKnownRequestError,
    violations: readonly ConstraintViolation[],
  ): string | null {
    if (!violations.length) return null;

    const meta = (error.meta ?? {}) as {
      target?: string | string[];
      field_name?: string;
      driverAdapterError?: {
        cause?: { constraint?: { index?: string; name?: string; fields?: string[] } };
      };
    };
    const constraint = meta.driverAdapterError?.cause?.constraint;

    const hints = [
      ...[meta.target ?? []].flat(),
      ...(constraint?.fields ?? []),
      meta.field_name,
      constraint?.index,
      constraint?.name,
      error.message,
    ]
      .filter((hint): hint is string => typeof hint === 'string')
      .map((hint) => hint.replace(/"/g, ''));

    const byConstraint = violations.find(({ constraint: name }) =>
      hints.some((hint) => hint.includes(name)),
    );
    const byField = violations.find(({ fields }) =>
      hints.some((hint) => fields.includes(hint)),
    );
    return (byConstraint ?? byField)?.code ?? null;
  }

  // The stored totals are not read: the entity recomputes them from the items.
  private toDomain(row: OrderRow): Result<Order> {
    return Order.tryCreate({
      id: row.id,
      customerId: row.customerId,
      status: row.status as OrderStatus,
      items: row.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        unit: item.unit,
        thumbUrl: item.thumbUrl,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
      })),
      deliveryAddress: this.addressFromRow(row),
      recipientName: row.recipientName,
      deliveryInstructions: row.deliveryInstructions,
      placedAt: row.placedAt,
      paymentApprovedAt: row.paymentApprovedAt,
      pickingStartedAt: row.pickingStartedAt,
      outForDeliveryAt: row.outForDeliveryAt,
      deliveredAt: row.deliveredAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  private fromDomain(order: Order): Prisma.OrderUncheckedCreateInput {
    const address = order.deliveryAddress;
    return {
      id: order.id,
      customerId: order.customerId,
      status: order.status,
      recipientName: order.recipientName,
      deliveryInstructions: order.deliveryInstructions,
      deliveryZipCode: address.zipCode,
      deliveryStreet: address.street,
      deliveryNumber: address.number,
      deliveryComplement: address.complement,
      deliveryNeighborhood: address.neighborhood,
      deliveryCity: address.city,
      deliveryState: address.state,
      // Totals computed by the entity, stored for reading.
      subtotalCents: order.subtotalCents,
      deliveryFeeCents: order.deliveryFeeCents,
      totalCents: order.totalCents,
      placedAt: order.placedAt,
      ...this.stepDatesFromDomain(order),
      // Persisting the entity timestamps keeps the database equal to the entity.
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  // Dates of the steps after `PLACED` (`null` while the order has not reached them).
  private stepDatesFromDomain(order: Order) {
    return {
      paymentApprovedAt: order.paymentApprovedAt,
      pickingStartedAt: order.pickingStartedAt,
      outForDeliveryAt: order.outForDeliveryAt,
      deliveredAt: order.deliveredAt,
    };
  }

  // The entity keeps the order of the cart: `position` is the index (0..n-1).
  private itemsFromDomain(order: Order) {
    return order.items.map((item, position) => ({
      productId: item.productId,
      position,
      name: item.name,
      unit: item.unit,
      thumbUrl: item.thumbUrl,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
    }));
  }

  private addressFromRow(row: OrderRow) {
    return {
      zipCode: row.deliveryZipCode,
      street: row.deliveryStreet,
      number: row.deliveryNumber,
      complement: row.deliveryComplement,
      neighborhood: row.deliveryNeighborhood,
      city: row.deliveryCity,
      state: row.deliveryState,
    };
  }

  private toAdminDetailDTO(row: OrderWithCustomerRow): OrderAdminDetailDTO {
    return {
      ...this.toDetailDTO(row),
      customer: {
        id: row.customer.id,
        name: row.customer.user.name,
        email: row.customer.user.email,
        phone: row.customer.phone,
      },
      updatedAt: row.updatedAt,
    };
  }

  private toDetailDTO(row: OrderRow): OrderDetailDTO {
    return {
      id: row.id,
      customerId: row.customerId,
      status: row.status as OrderStatus,
      items: row.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        unit: item.unit,
        thumbUrl: item.thumbUrl,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        lineTotalCents: item.lineTotalCents,
      })),
      deliveryAddress: this.addressFromRow(row),
      recipientName: row.recipientName,
      deliveryInstructions: row.deliveryInstructions,
      itemCount: row.items.reduce((total, item) => total + item.quantity, 0),
      subtotalCents: row.subtotalCents,
      deliveryFeeCents: row.deliveryFeeCents,
      totalCents: row.totalCents,
      placedAt: row.placedAt,
      paymentApprovedAt: row.paymentApprovedAt,
      pickingStartedAt: row.pickingStartedAt,
      outForDeliveryAt: row.outForDeliveryAt,
      deliveredAt: row.deliveredAt,
    };
  }
}
