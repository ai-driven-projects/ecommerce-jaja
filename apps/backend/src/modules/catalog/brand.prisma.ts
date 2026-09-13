import { Injectable } from '@nestjs/common';
import { Id, Result, TransactionContext } from '@mentoria-360/shared';
import {
  Brand,
  BrandDTO,
  BrandErrors,
  BrandRepository,
  FindBrandByIdQuery,
  FindBrandsQuery,
} from '@jaja/catalog';
import { Brand as BrandRow, Prisma } from '@prisma/client';
import {
  PrismaService,
  PrismaTransactionContext,
} from '../../db/prisma.service.js';
import { folded, toPrefixTsQuery } from '../../db/text-search.sql.js';

// Maps the unique constraints of `brands` to the domain error they represent.
// A primary key collision only happens when creating with the id of a deleted
// brand (PUT on a deleted id), which the API must answer as "not found".
const UNIQUE_VIOLATIONS = [
  { field: 'name', constraint: 'brands_name_key', code: BrandErrors.BRAND_NAME_ALREADY_EXISTS },
  { field: 'slug', constraint: 'brands_slug_key', code: BrandErrors.BRAND_SLUG_ALREADY_EXISTS },
  { field: 'id', constraint: 'brands_pkey', code: BrandErrors.BRAND_NOT_FOUND },
] as const;

// Full-text document of a brand: name and slug weigh more than the description.
const SEARCH_DOCUMENT = Prisma.raw(
  [
    `setweight(to_tsvector('simple', ${folded('name')}), 'A')`,
    `setweight(to_tsvector('simple', replace(slug, '-', ' ')), 'A')`,
    `setweight(to_tsvector('simple', ${folded("coalesce(description, '')")}), 'B')`,
  ].join(' || '),
);

// The database collation orders by bytes (uppercase first); the ICU collation
// orders brand names ignoring case and accents. `id` keeps pages stable.
const NAME_ORDER = Prisma.raw('name COLLATE "pt-BR-x-icu", id');

type BrandSearchRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

function searchRowToDTO(row: BrandSearchRow): BrandDTO {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    logoUrl: row.logo_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class BrandPrisma implements BrandRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Read side (CQRS): rows are mapped straight to `BrandDTO`, without the entity.
  // The listing is raw SQL: Prisma has neither full-text search on Postgres nor
  // a collation-aware `orderBy`.
  readonly findBrands: FindBrandsQuery = {
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

        // With a search the best matches come first (name and slug before description).
        const orderBy = tsQuery
          ? Prisma.sql`ts_rank(${SEARCH_DOCUMENT}, to_tsquery('simple', ${tsQuery})) DESC, ${NAME_ORDER}`
          : NAME_ORDER;

        const client = this.prisma.client;
        const [counts, rows] = await Promise.all([
          client.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM brands WHERE ${where}`,
          client.$queryRaw<BrandSearchRow[]>`
            SELECT id, name, slug, description, logo_url, is_active, created_at, updated_at
            FROM brands
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

  readonly findBrandById: FindBrandByIdQuery = {
    execute: (id) =>
      Result.tryAsync(async () => {
        // A malformed id never matches the uuid column; skip the database error.
        if (!this.isUuid(id)) return null;

        const row = await this.prisma.client.brand.findFirst({
          where: { id, deletedAt: null },
        });
        return row ? this.toDTO(row) : null;
      }),
  };

  async create(brand: Brand, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        await this.clientFor(tx).brand.create({ data: this.fromDomain(brand) });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  async update(brand: Brand, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        // `deletedAt: null` keeps a deleted brand from being edited back to life.
        await this.clientFor(tx).brand.update({
          where: { id: brand.id, deletedAt: null },
          data: this.fromDomain(brand),
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  async findById(id: string): Promise<Result<Brand>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<Brand>(BrandErrors.BRAND_NOT_FOUND);

      const row = await this.prisma.client.brand.findFirst({
        where: { id, deletedAt: null },
      });
      if (!row) return Result.fail<Brand>(BrandErrors.BRAND_NOT_FOUND);
      return this.toDomain(row);
    });
  }

  async findBySlug(slug: string): Promise<Result<Brand | null>> {
    return Result.tryAsync(async () => {
      // An empty filter would match any brand in Prisma, so it finds nothing instead.
      if (typeof slug !== 'string' || !slug) return Result.ok<Brand | null>(null);

      const row = await this.prisma.client.brand.findFirst({
        where: { slug, deletedAt: null },
      });
      if (!row) return Result.ok<Brand | null>(null);
      return this.toDomain(row);
    });
  }

  async findByName(name: string): Promise<Result<Brand | null>> {
    return Result.tryAsync(async () => {
      const value = String(name ?? '').trim();
      if (!value) return Result.ok<Brand | null>(null);

      const row = await this.prisma.client.brand.findFirst({
        where: {
          name: { equals: value, mode: 'insensitive' },
          deletedAt: null,
        },
      });
      if (!row) return Result.ok<Brand | null>(null);
      return this.toDomain(row);
    });
  }

  // Soft delete: fills `deletedAt` and keeps the record.
  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<void>(BrandErrors.BRAND_NOT_FOUND);

      try {
        await this.clientFor(tx).brand.update({
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

  // Translates the known write failures into domain errors; anything else is
  // rethrown and becomes a failure through `Result.tryAsync`.
  private writeFailure(error: unknown): Result<void> {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025: the `where` matched no row (missing or already deleted brand).
      if (error.code === 'P2025') return Result.fail(BrandErrors.BRAND_NOT_FOUND);

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

  private toDomain(row: BrandRow): Result<Brand> {
    return Brand.tryCreate({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      logoUrl: row.logoUrl,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  private fromDomain(brand: Brand): Prisma.BrandUncheckedCreateInput {
    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      logoUrl: brand.logoUrl,
      isActive: brand.isActive,
      // Persisting the entity timestamps keeps the database equal to the returned DTO.
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }

  private toDTO(row: BrandRow): BrandDTO {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      logoUrl: row.logoUrl,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
