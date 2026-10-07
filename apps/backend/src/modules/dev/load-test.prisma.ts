import { Injectable } from '@nestjs/common';
import { Id, Result } from '@mentoria-360/shared';
import {
  FindLoadTestPoolQuery,
  FindLoadTestRunQuery,
  LoadTestPoolDTO,
  LoadTestRunDTO,
  LoadTestRunOrderDTO,
  loadTestInstructions,
} from '@jaja/dev';
import { PrismaService } from '../../db/prisma.service.js';
import { visibleProducts } from '../../db/visible-products.sql.js';

// How long the pool is reused: a run of 1 000 orders reads it once, not 1 000
// times, and a product or customer changed in the admin shows up in seconds.
export const LOAD_TEST_POOL_TTL_MS = 30_000;

// Enough variety for any run; keeps the pool small in a large catalog.
const POOL_LIMIT = 500;

// A run is read whole by the queue panel; this cap only protects the API.
const RUN_ORDERS_LIMIT = 10_000;

type PoolCache = { expiresAt: number; pool: Promise<Result<LoadTestPoolDTO>> };

/**
 * Reads of the load test, straight on the tables of catalog, customers and
 * orders (the link between modules belongs to the database).
 */
@Injectable()
export class LoadTestPrisma {
  private poolCache: PoolCache | null = null;

  constructor(private readonly prisma: PrismaService) {}

  // The same promise serves every request while it is valid, so the orders
  // fired at the same time share one read; a failed read is not kept.
  readonly findLoadTestPool: FindLoadTestPoolQuery = {
    execute: () => {
      const now = Date.now();
      if (this.poolCache && this.poolCache.expiresAt > now) return this.poolCache.pool;

      const pool = this.readPool();
      this.poolCache = { expiresAt: now + LOAD_TEST_POOL_TTL_MS, pool };
      void pool.then((result) => {
        if (result.isFailure && this.poolCache?.pool === pool) this.poolCache = null;
      });
      return pool;
    },
  };

  readonly findLoadTestRun: FindLoadTestRunQuery = {
    execute: (runId) =>
      Result.tryAsync(async (): Promise<LoadTestRunDTO> => {
        const id = typeof runId === 'string' ? runId.trim().toLowerCase() : '';
        // A malformed id never matches; skip the database.
        if (!Id.isValid(id)) return { runId: id, total: 0, byStatus: {}, orders: [] };

        const orders = await this.prisma.client.$queryRaw<LoadTestRunOrderDTO[]>`
          SELECT
            o.id,
            o.status,
            o.placed_at AS "placedAt",
            COALESCE(o.delivered_at, o.out_for_delivery_at, o.picking_started_at, o.payment_approved_at, o.placed_at)
              AS "statusChangedAt",
            o.delivered_at AS "deliveredAt"
          FROM orders o
          WHERE o.deleted_at IS NULL AND o.delivery_instructions = ${loadTestInstructions(id)}
          ORDER BY o.placed_at, o.id
          LIMIT ${RUN_ORDERS_LIMIT}`;

        const byStatus: Record<string, number> = {};
        for (const order of orders) byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;

        return { runId: id, total: orders.length, byStatus, orders };
      }),
  };

  private readPool(): Promise<Result<LoadTestPoolDTO>> {
    return Result.tryAsync(async () => {
      const client = this.prisma.client;
      const [products, customers] = await Promise.all([
        client.$queryRaw<{ id: string }[]>`SELECT p.id ${visibleProducts()} ORDER BY p.id LIMIT ${POOL_LIMIT}`,
        client.customer.findMany({
          where: { deletedAt: null, isActive: true },
          select: { userId: true },
          orderBy: { userId: 'asc' },
          take: POOL_LIMIT,
        }),
      ]);

      return {
        productIds: products.map((row) => row.id),
        customerUserIds: customers.map((row) => row.userId),
      };
    });
  }
}
