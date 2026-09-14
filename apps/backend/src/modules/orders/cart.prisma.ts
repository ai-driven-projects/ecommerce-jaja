import { Injectable } from '@nestjs/common';
import { Id, Result, TransactionContext } from '@mentoria-360/shared';
import {
  Cart,
  CartDetailDTO,
  CartErrors,
  CartItemInputDTO,
  CartLineDTO,
  CartRepository,
  DELIVERY_FEE_CENTS,
  FREE_DELIVERY_THRESHOLD_CENTS,
  FindAvailableProductIdsQuery,
  FindCartByUserIdQuery,
  PreviewCartQuery,
} from '@jaja/orders';
import { Prisma } from '@prisma/client';
import {
  PrismaService,
  PrismaTransactionContext,
} from '../../db/prisma.service.js';
import { visibleProducts } from '../../db/visible-products.sql.js';

type ConstraintViolation = {
  fields: readonly string[];
  constraint: string;
  code: string;
};

// Maps the unique constraints of `carts` to the domain error they represent.
// `carts_user_id_key` only fires when two first items of the same user race; a
// primary key collision only happens when creating with the id of a deleted
// cart, which the API must answer as "not found".
const UNIQUE_VIOLATIONS: readonly ConstraintViolation[] = [
  {
    fields: ['user_id', 'userId'],
    constraint: 'carts_user_id_key',
    code: CartErrors.CART_ALREADY_EXISTS,
  },
  {
    fields: ['id'],
    constraint: 'carts_pkey',
    code: CartErrors.CART_NOT_FOUND,
  },
];

// P2003: the user no longer exists (e.g. a token issued before a `migrate
// reset`) or the product vanished between the availability check and the write.
const FOREIGN_KEY_VIOLATIONS: readonly ConstraintViolation[] = [
  {
    fields: ['user_id', 'userId'],
    constraint: 'carts_user_id_fkey',
    code: CartErrors.CART_USER_NOT_FOUND,
  },
  {
    fields: ['product_id', 'productId'],
    constraint: 'cart_items_product_id_fkey',
    code: CartErrors.CART_PRODUCT_NOT_FOUND,
  },
];

const WITH_ITEMS = {
  items: { orderBy: { position: 'asc' } },
} satisfies Prisma.CartInclude;

type CartRow = Prisma.CartGetPayload<{ include: typeof WITH_ITEMS }>;

// The single row of the cart query: every total is computed by the SQL.
type CartDetailRow = {
  lines: CartLineDTO[];
  item_count: number;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  free_delivery_threshold_cents: number;
  missing_for_free_delivery_cents: number;
  has_unavailable_items: boolean;
};

// The empty cart (no lines, every total 0), answered without the database when
// there is nothing to read.
const EMPTY_CART_ROW: CartDetailRow = {
  lines: [],
  item_count: 0,
  subtotal_cents: 0,
  delivery_fee_cents: 0,
  total_cents: 0,
  free_delivery_threshold_cents: FREE_DELIVERY_THRESHOLD_CENTS,
  missing_for_free_delivery_cents: 0,
  has_unavailable_items: false,
};

@Injectable()
export class CartPrisma implements CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Read side (CQRS): the rules (availability, current prices, totals and
  // delivery fee) live in the SQL; the adapter only maps the row to the DTO.

  // Ids come back as PostgreSQL renders a uuid (lowercase), the same form the
  // domain uses to compare them.
  readonly findAvailableProductIds: FindAvailableProductIdsQuery = {
    execute: (productIds) =>
      Result.tryAsync(async () => {
        const ids = this.uniqueUuids(productIds);
        if (!ids.length) return [];

        const rows = await this.prisma.client.$queryRaw<{ id: string }[]>`
          SELECT p.id::text AS id
          ${visibleProducts()} AND p.id = ANY(${ids}::uuid[])`;
        return rows.map((row) => row.id);
      }),
  };

  readonly findCartByUserId: FindCartByUserIdQuery = {
    execute: (userId) =>
      Result.tryAsync(async () => {
        // A malformed id never matches the uuid column; skip the database error.
        if (!this.isUuid(userId)) return this.toDetail(EMPTY_CART_ROW);

        return this.cartDetail(Prisma.sql`
          SELECT ci.product_id, ci.quantity, ci.position
          FROM cart_items ci
          JOIN carts c ON c.id = ci.cart_id
          WHERE c.user_id = ${userId}::uuid AND c.deleted_at IS NULL`);
      }),
  };

  // The items were already normalized by the caller (`toGuestItems`).
  readonly previewCart: PreviewCartQuery = {
    execute: (items) =>
      Result.tryAsync(async () => {
        const list: CartItemInputDTO[] = Array.isArray(items) ? items : [];
        if (!list.length) return this.toDetail(EMPTY_CART_ROW);

        const productIds = list.map((item) => item.productId);
        const quantities = list.map((item) => item.quantity);
        return this.cartDetail(Prisma.sql`
          SELECT t.product_id, t.quantity, t.position
          FROM unnest(${productIds}::uuid[], ${quantities}::int[])
            WITH ORDINALITY AS t(product_id, quantity, position)`);
      }),
  };

  async create(cart: Cart, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        // Nested write: the cart and its items are inserted atomically.
        const items = this.itemsFromDomain(cart);
        await this.clientFor(tx).cart.create({
          data: {
            ...this.fromDomain(cart),
            ...(items.length ? { items: { createMany: { data: items } } } : {}),
          },
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  async update(cart: Cart, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        const write = async (client: Prisma.TransactionClient) => {
          // `deletedAt: null` keeps a deleted cart from being edited back to life.
          await client.cart.update({
            where: { id: cart.id, deletedAt: null },
            data: this.fromDomain(cart),
          });

          // Items have no identity: the stored list is replaced as a whole.
          await client.cartItem.deleteMany({ where: { cartId: cart.id } });
          const items = this.itemsFromDomain(cart);
          if (items.length) {
            await client.cartItem.createMany({
              data: items.map((item) => ({ ...item, cartId: cart.id })),
            });
          }
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

  async findById(id: string): Promise<Result<Cart>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<Cart>(CartErrors.CART_NOT_FOUND);

      const row = await this.prisma.client.cart.findFirst({
        where: { id, deletedAt: null },
        include: WITH_ITEMS,
      });
      if (!row) return Result.fail<Cart>(CartErrors.CART_NOT_FOUND);
      return this.toDomain(row);
    });
  }

  async findByUserId(userId: string): Promise<Result<Cart | null>> {
    return Result.tryAsync(async () => {
      // A malformed id never matches the uuid column; skip the database error.
      if (!this.isUuid(userId)) return Result.ok<Cart | null>(null);

      const row = await this.prisma.client.cart.findFirst({
        where: { userId, deletedAt: null },
        include: WITH_ITEMS,
      });
      if (!row) return Result.ok<Cart | null>(null);
      return this.toDomain(row);
    });
  }

  // Soft delete: fills `deletedAt` and keeps the record (`userId` stays
  // reserved). Exists only because of the repository contract; no use case
  // deletes carts.
  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<void>(CartErrors.CART_NOT_FOUND);

      try {
        await this.clientFor(tx).cart.update({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  /**
   * The cart projection shared by the account cart and the guest preview.
   * `items` is the source of the items, a `SELECT` of
   * `(product_id, quantity, position)`. In one query:
   * - every item joins its product, inactive and deleted ones included (an
   *   item without a product row disappears in the `JOIN`);
   * - the root category comes from the joins up to the grandparent and the
   *   thumbnail from the main image (lowest `order`);
   * - `is_available` is the storefront visibility rule, checked by `EXISTS`
   *   over `visibleProducts()` (aliases `p`, `c1`, `c2`, `c3`, `b`, so the
   *   outer query uses `lp`, `lc1`, `lc2`, `lc3`);
   * - lines are aggregated in the order of `position`, and the totals and the
   *   delivery fee are computed with the domain constants.
   */
  private async cartDetail(items: Prisma.Sql): Promise<CartDetailDTO> {
    const rows = await this.prisma.client.$queryRaw<CartDetailRow[]>`
      WITH items(product_id, quantity, position) AS (${items}),
      lines AS (
        SELECT i.position, i.quantity, lp.id AS product_id, lp.slug, lp.name, lp.unit,
          coalesce(lc3.slug, lc2.slug, lc1.slug) AS root_category_slug,
          main_image.thumb_url, lp.price_cents, lp.list_price_cents,
          EXISTS (SELECT 1 ${visibleProducts()} AND p.id = lp.id) AS is_available
        FROM items i
        JOIN products lp ON lp.id = i.product_id
        JOIN categories lc1 ON lc1.id = lp.category_id
        LEFT JOIN categories lc2 ON lc2.id = lc1.parent_id
        LEFT JOIN categories lc3 ON lc3.id = lc2.parent_id
        LEFT JOIN LATERAL (
          SELECT pi.thumb_url FROM product_images pi
          WHERE pi.product_id = lp.id
          ORDER BY pi."order"
          LIMIT 1
        ) main_image ON true
      ),
      totals AS (
        SELECT
          coalesce(json_agg(json_build_object(
            'productId', product_id,
            'slug', slug,
            'name', name,
            'unit', unit,
            'rootCategorySlug', root_category_slug,
            'thumbUrl', thumb_url,
            'priceCents', price_cents,
            'listPriceCents', list_price_cents,
            'quantity', quantity,
            'isAvailable', is_available,
            'lineTotalCents', CASE WHEN is_available THEN price_cents * quantity END
          ) ORDER BY position), '[]'::json) AS lines,
          coalesce(sum(quantity), 0)::int AS item_count,
          coalesce(sum(price_cents * quantity) FILTER (WHERE is_available), 0)::int AS subtotal_cents,
          coalesce(bool_or(NOT is_available), false) AS has_unavailable_items
        FROM lines
      ),
      charged AS (
        SELECT totals.*,
          CASE WHEN subtotal_cents > 0 AND subtotal_cents < ${FREE_DELIVERY_THRESHOLD_CENTS}::int
            THEN ${DELIVERY_FEE_CENTS}::int ELSE 0 END AS delivery_fee_cents
        FROM totals
      )
      SELECT lines, item_count, subtotal_cents, delivery_fee_cents,
        subtotal_cents + delivery_fee_cents AS total_cents,
        ${FREE_DELIVERY_THRESHOLD_CENTS}::int AS free_delivery_threshold_cents,
        CASE WHEN delivery_fee_cents > 0
          THEN ${FREE_DELIVERY_THRESHOLD_CENTS}::int - subtotal_cents ELSE 0 END
          AS missing_for_free_delivery_cents,
        has_unavailable_items
      FROM charged`;

    return this.toDetail(rows[0] ?? EMPTY_CART_ROW);
  }

  private toDetail(row: CartDetailRow): CartDetailDTO {
    return {
      lines: row.lines,
      itemCount: row.item_count,
      subtotalCents: row.subtotal_cents,
      deliveryFeeCents: row.delivery_fee_cents,
      totalCents: row.total_cents,
      freeDeliveryThresholdCents: row.free_delivery_threshold_cents,
      missingForFreeDeliveryCents: row.missing_for_free_delivery_cents,
      hasUnavailableItems: row.has_unavailable_items,
    };
  }

  // Lowercase uuids without repetition; malformed values are left out, so they
  // never reach the uuid cast.
  private uniqueUuids(values: unknown): string[] {
    const ids = new Set<string>();
    for (const value of Array.isArray(values) ? values : []) {
      if (this.isUuid(value)) ids.add(value.trim().toLowerCase());
    }
    return [...ids];
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
      // P2025: the `where` matched no row (missing or already deleted cart).
      if (error.code === 'P2025') return Result.fail(CartErrors.CART_NOT_FOUND);

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

  private toDomain(row: CartRow): Result<Cart> {
    return Cart.tryCreate({
      id: row.id,
      userId: row.userId,
      items: row.items.map(({ productId, quantity }) => ({ productId, quantity })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  private fromDomain(cart: Cart): Prisma.CartUncheckedCreateInput {
    return {
      id: cart.id,
      userId: cart.userId,
      // Persisting the entity timestamps keeps the database equal to the entity.
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  // The entity keeps the order of inclusion: `position` is the index (0..n-1).
  private itemsFromDomain(cart: Cart) {
    return cart.items.map(({ productId, quantity }, position) => ({
      productId,
      quantity,
      position,
    }));
  }
}
