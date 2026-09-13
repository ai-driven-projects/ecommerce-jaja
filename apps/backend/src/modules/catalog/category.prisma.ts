import { Injectable } from '@nestjs/common';
import { Id, Result, TransactionContext } from '@mentoria-360/shared';
import {
  CATEGORY_MAX_DEPTH,
  Category,
  CategoryDTO,
  CategoryErrors,
  CategoryRepository,
  FindCategoriesQuery,
  FindCategoryByIdQuery,
} from '@jaja/catalog';
import { Category as CategoryRow, Prisma } from '@prisma/client';
import {
  PrismaService,
  PrismaTransactionContext,
} from '../../db/prisma.service.js';

// Maps the unique constraints of `categories` to the domain error they represent.
// A primary key collision only happens when creating with the id of a deleted
// category (PUT on a deleted id), which the API must answer as "not found".
const UNIQUE_VIOLATIONS = [
  {
    field: 'slug',
    constraint: 'categories_slug_key',
    code: CategoryErrors.CATEGORY_SLUG_ALREADY_EXISTS,
  },
  {
    field: 'id',
    constraint: 'categories_pkey',
    code: CategoryErrors.CATEGORY_NOT_FOUND,
  },
] as const;

// Extra hops allowed beyond the maximum depth when walking up the hierarchy, so
// a loop stored by corrupted data can never make the walk spin forever.
const MAX_ANCESTOR_HOPS = CATEGORY_MAX_DEPTH + 3;

const PATH_SEPARATOR = ' / ';

type Lineage = { level: number; path: string };

@Injectable()
export class CategoryPrisma implements CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Read side (CQRS): rows are mapped straight to `CategoryDTO`, without the
  // entity. One query loads every live category; `level`/`path` are computed in
  // memory and the `isActive` filter runs only afterwards, so a filtered category
  // keeps the path of an ancestor that did not pass the filter.
  readonly findCategories: FindCategoriesQuery = {
    execute: (filter) =>
      Result.tryAsync(async () => {
        const rows = await this.prisma.client.category.findMany({
          where: { deletedAt: null },
        });
        const lineageOf = this.lineageResolver(rows);

        const categories = rows.map((row) => this.toDTO(row, lineageOf(row)));
        const filtered =
          typeof filter?.isActive === 'boolean'
            ? categories.filter((category) => category.isActive === filter.isActive)
            : categories;

        return filtered.sort((a, b) => a.path.localeCompare(b.path, 'pt-BR'));
      }),
  };

  readonly findCategoryById: FindCategoryByIdQuery = {
    execute: (id) =>
      Result.tryAsync(async () => {
        // A malformed id never matches the uuid column; skip the database error.
        if (!this.isUuid(id)) return null;

        const row = await this.prisma.client.category.findFirst({
          where: { id, deletedAt: null },
        });
        if (!row) return null;

        // Walks up the live ancestors (at most two extra queries in a valid tree).
        const chain: CategoryRow[] = [row];
        let parentId = row.parentId;
        while (parentId && chain.length <= MAX_ANCESTOR_HOPS) {
          const parent = await this.prisma.client.category.findFirst({
            where: { id: parentId, deletedAt: null },
          });
          if (!parent) break;
          chain.push(parent);
          parentId = parent.parentId;
        }

        return this.toDTO(row, this.lineageResolver(chain)(row));
      }),
  };

  async create(category: Category, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        await this.clientFor(tx).category.create({
          data: this.fromDomain(category),
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  async update(category: Category, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        // `deletedAt: null` keeps a deleted category from being edited back to life.
        await this.clientFor(tx).category.update({
          where: { id: category.id, deletedAt: null },
          data: this.fromDomain(category),
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  async findById(id: string): Promise<Result<Category>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) {
        return Result.fail<Category>(CategoryErrors.CATEGORY_NOT_FOUND);
      }

      const row = await this.prisma.client.category.findFirst({
        where: { id, deletedAt: null },
      });
      if (!row) return Result.fail<Category>(CategoryErrors.CATEGORY_NOT_FOUND);
      return this.toDomain(row);
    });
  }

  async findBySlug(slug: string): Promise<Result<Category | null>> {
    return Result.tryAsync(async () => {
      // An empty filter would match any category in Prisma, so it finds nothing instead.
      if (typeof slug !== 'string' || !slug) return Result.ok<Category | null>(null);

      const row = await this.prisma.client.category.findFirst({
        where: { slug, deletedAt: null },
      });
      if (!row) return Result.ok<Category | null>(null);
      return this.toDomain(row);
    });
  }

  async findByParentId(parentId: string | null): Promise<Result<Category[]>> {
    return Result.tryAsync(async () => {
      // `null` lists the roots; a malformed id cannot be the parent of anything.
      if (parentId !== null && !this.isUuid(parentId)) {
        return Result.ok<Category[]>([]);
      }

      const rows = await this.prisma.client.category.findMany({
        where: { parentId, deletedAt: null },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });
      return this.toDomainList(rows);
    });
  }

  async findAll(): Promise<Result<Category[]>> {
    return Result.tryAsync(async () => {
      const rows = await this.prisma.client.category.findMany({
        where: { deletedAt: null },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });
      return this.toDomainList(rows);
    });
  }

  // Soft delete: fills `deletedAt` and keeps the record (and its slug reserved).
  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<void>(CategoryErrors.CATEGORY_NOT_FOUND);

      try {
        await this.clientFor(tx).category.update({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  // Returns a memoized function that computes `level` (root = 1) and `path` of a
  // row from the given rows. A parent missing from them ends the chain.
  private lineageResolver(rows: CategoryRow[]): (row: CategoryRow) => Lineage {
    const byId = new Map(rows.map((row) => [row.id, row]));
    const memo = new Map<string, Lineage>();

    const resolve = (row: CategoryRow, hops: number): Lineage => {
      const cached = memo.get(row.id);
      if (cached) return cached;

      const parent = row.parentId ? byId.get(row.parentId) : undefined;
      const lineage =
        parent && hops < MAX_ANCESTOR_HOPS
          ? this.childLineage(resolve(parent, hops + 1), row.name)
          : { level: 1, path: row.name };

      memo.set(row.id, lineage);
      return lineage;
    };

    return (row) => resolve(row, 0);
  }

  private childLineage(parent: Lineage, name: string): Lineage {
    return { level: parent.level + 1, path: `${parent.path}${PATH_SEPARATOR}${name}` };
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
      // P2025: the `where` matched no row (missing or already deleted category).
      if (error.code === 'P2025') return Result.fail(CategoryErrors.CATEGORY_NOT_FOUND);

      // P2003: the parent row vanished between the use case check and the write.
      if (error.code === 'P2003') {
        return Result.fail(CategoryErrors.PARENT_CATEGORY_NOT_FOUND);
      }

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

  private toDomainList(rows: CategoryRow[]): Result<Category[]> {
    const categories: Category[] = [];
    for (const row of rows) {
      const category = this.toDomain(row);
      if (category.isFailure) return category.withFail;
      categories.push(category.instance);
    }
    return Result.ok(categories);
  }

  private toDomain(row: CategoryRow): Result<Category> {
    return Category.tryCreate({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      parentId: row.parentId,
      order: row.order,
      isHighlighted: row.isHighlighted,
      imageUrl: row.imageUrl,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  private fromDomain(category: Category): Prisma.CategoryUncheckedCreateInput {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      order: category.order,
      isHighlighted: category.isHighlighted,
      imageUrl: category.imageUrl,
      isActive: category.isActive,
      // Persisting the entity timestamps keeps the database equal to the returned DTO.
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private toDTO(row: CategoryRow, lineage: Lineage): CategoryDTO {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      parentId: row.parentId,
      order: row.order,
      isHighlighted: row.isHighlighted,
      imageUrl: row.imageUrl,
      isActive: row.isActive,
      level: lineage.level,
      path: lineage.path,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
