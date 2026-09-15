import { Injectable } from '@nestjs/common';
import { Id, Result, TransactionContext } from '@mentoria-360/shared';
import {
  FindMyOrderByIdQuery,
  FindOrderCustomerByUserIdQuery,
  Order,
  OrderDetailDTO,
  OrderErrors,
  OrderRepository,
  OrderStatus,
} from '@jaja/orders';
import { Prisma } from '@prisma/client';
import {
  PrismaService,
  PrismaTransactionContext,
} from '../../db/prisma.service.js';

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

  // Exists only because of the repository contract; no use case changes orders
  // in this delivery.
  async update(order: Order, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        const write = async (client: Prisma.TransactionClient) => {
          // `deletedAt: null` keeps a deleted order from being edited back to life.
          await client.order.update({
            where: { id: order.id, deletedAt: null },
            data: this.fromDomain(order),
          });

          // Items have no identity: the stored list is replaced as a whole.
          await client.orderItem.deleteMany({ where: { orderId: order.id } });
          await client.orderItem.createMany({
            data: this.itemsFromDomain(order).map((item) => ({
              ...item,
              orderId: order.id,
            })),
          });
        };

        const context = tx as PrismaTransactionContext | undefined;
        if (context?.client) {
          await write(context.client);
        } else {
          await this.prisma.client.$transaction((client) => write(client));
        }
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
      // Persisting the entity timestamps keeps the database equal to the entity.
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
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
    };
  }
}
