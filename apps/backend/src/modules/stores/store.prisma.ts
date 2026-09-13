import { Injectable } from '@nestjs/common';
import { Id, Result, TransactionContext } from '@mentoria-360/shared';
import {
  FindStoreByIdQuery,
  FindStoresQuery,
  Store,
  StoreDTO,
  StoreErrors,
  StoreRepository,
} from '@jaja/stores';
import { Prisma, Store as StoreRow } from '@prisma/client';
import {
  PrismaService,
  PrismaTransactionContext,
} from '../../db/prisma.service.js';
import { folded, toPrefixTsQuery } from '../../db/text-search.sql.js';

// Maps the unique constraints of `stores` to the domain error they represent.
// A primary key collision only happens when creating with the id of a deleted
// store (PUT on a deleted id), which the API must answer as "not found".
const UNIQUE_VIOLATIONS = [
  { field: 'name', constraint: 'stores_name_key', code: StoreErrors.STORE_NAME_ALREADY_EXISTS },
  { field: 'slug', constraint: 'stores_slug_key', code: StoreErrors.STORE_SLUG_ALREADY_EXISTS },
  { field: 'id', constraint: 'stores_pkey', code: StoreErrors.STORE_NOT_FOUND },
] as const;

// Full-text document of a store: name and slug weigh more than the reference address.
const SEARCH_DOCUMENT = Prisma.raw(
  [
    `setweight(to_tsvector('simple', ${folded('name')}), 'A')`,
    `setweight(to_tsvector('simple', replace(slug, '-', ' ')), 'A')`,
    `setweight(to_tsvector('simple', ${folded("coalesce(address, '')")}), 'B')`,
  ].join(' || '),
);

// The database collation orders by bytes (uppercase first); the ICU collation
// orders store names ignoring case and accents. `id` keeps pages stable.
const NAME_ORDER = Prisma.raw('name COLLATE "pt-BR-x-icu", id');

type StoreSearchRow = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  delivery_radius_meters: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

function searchRowToDTO(row: StoreSearchRow): StoreDTO {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    phone: row.phone,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    deliveryRadiusMeters: row.delivery_radius_meters,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class StorePrisma implements StoreRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Read side (CQRS): rows are mapped straight to `StoreDTO`, without the entity.
  // The listing is raw SQL: Prisma has neither full-text search on Postgres nor
  // a collation-aware `orderBy`.
  readonly findStores: FindStoresQuery = {
    execute: (filter) =>
      Result.tryAsync(async () => {
        const page = Math.max(1, Math.trunc(filter.page) || 1);
        const pageSize = Math.max(1, Math.trunc(filter.pageSize) || 1);
        const tsQuery = filter.search ? toPrefixTsQuery(filter.search) : null;

        const conditions = [Prisma.sql`deleted_at IS NULL`];
        if (typeof filter.isActive === 'boolean') {
          conditions.push(Prisma.sql`is_active = ${filter.isActive}`);
        }
        if (tsQuery) {
          conditions.push(Prisma.sql`(${SEARCH_DOCUMENT}) @@ to_tsquery('simple', ${tsQuery})`);
        }
        const where = Prisma.join(conditions, ' AND ');

        // With a search the best matches come first (name and slug before address).
        const orderBy = tsQuery
          ? Prisma.sql`ts_rank(${SEARCH_DOCUMENT}, to_tsquery('simple', ${tsQuery})) DESC, ${NAME_ORDER}`
          : NAME_ORDER;

        const client = this.prisma.client;
        const [counts, rows] = await Promise.all([
          client.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM stores WHERE ${where}`,
          client.$queryRaw<StoreSearchRow[]>`
            SELECT id, name, slug, phone, address, latitude, longitude,
                   delivery_radius_meters, is_active, created_at, updated_at
            FROM stores
            WHERE ${where}
            ORDER BY ${orderBy}
            LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        ]);

        const total = counts[0]?.total ?? 0;
        return {
          items: rows.map(searchRowToDTO),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      }),
  };

  readonly findStoreById: FindStoreByIdQuery = {
    execute: (id) =>
      Result.tryAsync(async () => {
        // A malformed id never matches the uuid column; skip the database error.
        if (!this.isUuid(id)) return null;

        const row = await this.prisma.client.store.findFirst({
          where: { id, deletedAt: null },
        });
        return row ? this.toDTO(row) : null;
      }),
  };

  async create(store: Store, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      const client = this.clientFor(tx);
      try {
        // A record with this id, even a deleted one, would collide on the primary key.
        const existing = await client.store.findUnique({
          where: { id: store.id },
          select: { id: true },
        });
        if (existing) return Result.fail<void>(StoreErrors.STORE_NOT_FOUND);
        if (await this.isNameReserved(store, tx)) {
          return Result.fail<void>(StoreErrors.STORE_NAME_ALREADY_EXISTS);
        }

        await client.store.create({ data: this.fromDomain(store) });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  async update(store: Store, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      const client = this.clientFor(tx);
      try {
        const existing = await client.store.findFirst({
          where: { id: store.id, deletedAt: null },
          select: { id: true },
        });
        if (!existing) return Result.fail<void>(StoreErrors.STORE_NOT_FOUND);
        if (await this.isNameReserved(store, tx)) {
          return Result.fail<void>(StoreErrors.STORE_NAME_ALREADY_EXISTS);
        }

        // `deletedAt: null` keeps a deleted store from being edited back to life.
        await client.store.update({
          where: { id: store.id, deletedAt: null },
          data: this.fromDomain(store),
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  async findById(id: string): Promise<Result<Store>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<Store>(StoreErrors.STORE_NOT_FOUND);

      const row = await this.prisma.client.store.findFirst({
        where: { id, deletedAt: null },
      });
      if (!row) return Result.fail<Store>(StoreErrors.STORE_NOT_FOUND);
      return this.toDomain(row);
    });
  }

  async findBySlug(slug: string): Promise<Result<Store | null>> {
    return Result.tryAsync(async () => {
      // An empty filter would match any store in Prisma, so it finds nothing instead.
      if (typeof slug !== 'string' || !slug) return Result.ok<Store | null>(null);

      const row = await this.prisma.client.store.findFirst({
        where: { slug, deletedAt: null },
      });
      if (!row) return Result.ok<Store | null>(null);
      return this.toDomain(row);
    });
  }

  async findByName(name: string): Promise<Result<Store | null>> {
    return Result.tryAsync(async () => {
      const value = String(name ?? '').trim();
      if (!value) return Result.ok<Store | null>(null);

      const row = await this.prisma.client.store.findFirst({
        where: {
          name: { equals: value, mode: 'insensitive' },
          deletedAt: null,
        },
      });
      if (!row) return Result.ok<Store | null>(null);
      return this.toDomain(row);
    });
  }

  // Soft delete: fills `deletedAt` and keeps the record.
  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<void>(StoreErrors.STORE_NOT_FOUND);

      try {
        await this.clientFor(tx).store.update({
          where: { id, deletedAt: null },
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
    return typeof id === 'string' && Id.isValid(id);
  }

  // `stores_name_key` is case-sensitive, but the name is unique ignoring case and
  // stays reserved after deletion. `findByName` skips deleted stores, so this
  // check covers every other store, deleted ones included.
  private async isNameReserved(store: Store, tx?: TransactionContext): Promise<boolean> {
    const rows = await this.clientFor(tx).$queryRaw<{ id: string }[]>`
      SELECT id FROM stores
      WHERE lower(name) = lower(${store.name.trim()}) AND id <> ${store.id}::uuid
      LIMIT 1`;
    return rows.length > 0;
  }

  // Translates the known write failures into domain errors; anything else is
  // rethrown and becomes a failure through `Result.tryAsync`.
  private writeFailure(error: unknown): Result<void> {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025: the `where` matched no row (missing or already deleted store).
      if (error.code === 'P2025') return Result.fail(StoreErrors.STORE_NOT_FOUND);

      if (error.code === 'P2002') {
        const code = this.uniqueViolationCode(error);
        if (code) return Result.fail(code);
      }
    }
    throw error;
  }

  // With the driver adapter (`@prisma/adapter-pg`) P2002 has no `meta.target`: the
  // constraint name comes in `meta.driverAdapterError.cause.constraint.index` and in
  // the message. Both shapes are checked.
  private uniqueViolationCode(
    error: Prisma.PrismaClientKnownRequestError,
  ): string | null {
    const meta = (error.meta ?? {}) as {
      target?: string | string[];
      driverAdapterError?: {
        cause?: { constraint?: { index?: string; name?: string; fields?: string[] } };
      };
    };
    const constraint = meta.driverAdapterError?.cause?.constraint;

    const hints = [
      ...[meta.target ?? []].flat(),
      ...(constraint?.fields ?? []),
      constraint?.index,
      constraint?.name,
      error.message,
    ]
      .filter((hint): hint is string => typeof hint === 'string')
      .map((hint) => hint.replace(/"/g, ''));

    const violation = UNIQUE_VIOLATIONS.find(({ field, constraint: name }) =>
      hints.some((hint) => hint === field || hint.includes(name)),
    );
    return violation?.code ?? null;
  }

  private toDomain(row: StoreRow): Result<Store> {
    return Store.tryCreate({
      id: row.id,
      name: row.name,
      slug: row.slug,
      phone: row.phone,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      deliveryRadiusMeters: row.deliveryRadiusMeters,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  private fromDomain(store: Store): Prisma.StoreUncheckedCreateInput {
    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      phone: store.phone,
      address: store.address,
      latitude: store.latitude,
      longitude: store.longitude,
      deliveryRadiusMeters: store.deliveryRadiusMeters,
      isActive: store.isActive,
      // Persisting the entity timestamps keeps the database equal to the returned DTO.
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };
  }

  private toDTO(row: StoreRow): StoreDTO {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      phone: row.phone,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      deliveryRadiusMeters: row.deliveryRadiusMeters,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
