import { Injectable } from '@nestjs/common';
import { Id, Result, TransactionContext } from '@mentoria-360/shared';
import {
  Category,
  CategoryDTO,
  CategoryErrors,
  CategoryRepository,
  CategoryTreeNodeDTO,
  FindCategoriesQuery,
  FindCategoryByIdQuery,
  FindCategoryChildrenQuery,
  FindCategoryTreeQuery,
  FindStorefrontCategoriesQuery,
  StorefrontCategoryDTO,
} from '@jaja/catalog';
import { Category as CategoryRow, Prisma } from '@prisma/client';
import {
  PrismaService,
  PrismaTransactionContext,
} from '../../db/prisma.service.js';
import { folded, toPrefixTsQuery } from '../../db/text-search.sql.js';
import { visibleProducts } from './storefront.sql.js';

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

// Base selection of the read side. The depth is at most 3, so two self-joins
// (`p` parent, `g` grandparent) are enough to compute `level` and `path`, and
// they never filter: an ancestor that fails the filters still names the path.
const BASE_FROM = Prisma.sql`
  FROM categories c
  LEFT JOIN categories p ON p.id = c.parent_id
  LEFT JOIN categories g ON g.id = p.parent_id`;

const LEVEL = Prisma.sql`CASE WHEN c.parent_id IS NULL THEN 1 WHEN p.parent_id IS NULL THEN 2 ELSE 3 END`;

const PATH = Prisma.sql`concat_ws(' / ', g.name, p.name, c.name)`;

const BASE_SELECT = Prisma.sql`
  SELECT c.id, c.name, c.slug, c.description, c.parent_id, c."order",
    c.is_highlighted, c.image_url, c.is_active, c.created_at, c.updated_at,
    ${LEVEL} AS level,
    ${PATH} AS path,
    (SELECT count(*)::int FROM categories k
      WHERE k.parent_id = c.id AND k.deleted_at IS NULL) AS children_count
  ${BASE_FROM}`;

// Full-text document of a category: name and slug weigh more than the description.
const SEARCH_DOCUMENT = Prisma.raw(
  [
    `setweight(to_tsvector('simple', ${folded('c.name')}), 'A')`,
    `setweight(to_tsvector('simple', replace(c.slug, '-', ' ')), 'A')`,
    `setweight(to_tsvector('simple', ${folded("coalesce(c.description, '')")}), 'B')`,
  ].join(' || '),
);

// The database collation orders by bytes (uppercase first); the ICU collation
// ignores case and accents. `c.id` keeps pages stable.
const PATH_ORDER = Prisma.sql`${PATH} COLLATE "pt-BR-x-icu", c.id`;
const SIBLING_ORDER = Prisma.sql`c."order", c.name COLLATE "pt-BR-x-icu", c.id`;

type CategoryReadRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  order: number;
  is_highlighted: boolean;
  image_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  level: number;
  path: string;
  children_count: number;
};

type StorefrontCategoryRow = {
  slug: string;
  name: string;
  level: number;
  parent_slug: string | null;
  is_highlighted: boolean;
  product_count: number;
};

type Paging = { page: number; pageSize: number };

@Injectable()
export class CategoryPrisma implements CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Read side (CQRS): raw SQL rows are mapped straight to DTOs, without the
  // entity. Prisma has neither full-text search on Postgres, a collation-aware
  // `orderBy`, nor a way to compute `level`/`path`/`childrenCount` per row.
  readonly findCategories: FindCategoriesQuery = {
    execute: (filter) =>
      Result.tryAsync(async () => {
        const { page, pageSize } = this.paging(filter);
        const tsQuery = filter.search ? toPrefixTsQuery(filter.search) : null;

        const conditions = [Prisma.sql`c.deleted_at IS NULL`];
        if (typeof filter.isActive === 'boolean') {
          conditions.push(Prisma.sql`c.is_active = ${filter.isActive}`);
        }
        if (filter.maxLevel) {
          conditions.push(Prisma.sql`${LEVEL} <= ${filter.maxLevel}`);
        }
        // The category, its children and its grandchildren (the whole subtree).
        if (filter.excludeSubtreeOf && this.isUuid(filter.excludeSubtreeOf)) {
          const rootId = filter.excludeSubtreeOf;
          conditions.push(
            Prisma.sql`c.id <> ${rootId}::uuid
              AND c.parent_id IS DISTINCT FROM ${rootId}::uuid
              AND p.parent_id IS DISTINCT FROM ${rootId}::uuid`,
          );
        }
        if (tsQuery) {
          conditions.push(Prisma.sql`(${SEARCH_DOCUMENT}) @@ to_tsquery('simple', ${tsQuery})`);
        }
        const where = Prisma.join(conditions, ' AND ');

        // With a search the best matches come first (name and slug before description).
        const orderBy = tsQuery
          ? Prisma.sql`ts_rank(${SEARCH_DOCUMENT}, to_tsquery('simple', ${tsQuery})) DESC, ${PATH_ORDER}`
          : PATH_ORDER;

        const client = this.prisma.client;
        const [counts, rows] = await Promise.all([
          client.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${BASE_FROM} WHERE ${where}`,
          client.$queryRaw<CategoryReadRow[]>`
            ${BASE_SELECT}
            WHERE ${where}
            ORDER BY ${orderBy}
            LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        ]);

        return this.toPage(rows.map((row) => this.toDTO(row)), counts[0]?.total ?? 0, page, pageSize);
      }),
  };

  // Roots of the page and their count; with `expanded`, one query for the
  // children of those roots and one for the grandchildren (at most 4 queries).
  readonly findCategoryTree: FindCategoryTreeQuery = {
    execute: (filter) =>
      Result.tryAsync(async () => {
        const { page, pageSize } = this.paging(filter);
        const where = Prisma.sql`c.deleted_at IS NULL AND c.parent_id IS NULL`;

        const client = this.prisma.client;
        const [counts, rootRows] = await Promise.all([
          client.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM categories c WHERE ${where}`,
          client.$queryRaw<CategoryReadRow[]>`
            ${BASE_SELECT}
            WHERE ${where}
            ORDER BY ${SIBLING_ORDER}
            LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        ]);

        const roots = rootRows.map((row) => this.toNode(row));
        if (filter.expanded) {
          const children = await this.attachChildren(roots);
          await this.attachChildren(children);
        }

        return this.toPage(roots, counts[0]?.total ?? 0, page, pageSize);
      }),
  };

  readonly findCategoryChildren: FindCategoryChildrenQuery = {
    execute: (parentId) =>
      Result.tryAsync(async () => {
        // A malformed id never matches the uuid column; skip the database error.
        if (!this.isUuid(parentId)) return null;

        const [parent, rows] = await Promise.all([
          this.findReadRow(parentId),
          this.findChildRows([parentId]),
        ]);
        if (!parent) return null;
        return rows.map((row) => this.toNode(row));
      }),
  };

  readonly findCategoryById: FindCategoryByIdQuery = {
    execute: (id) =>
      Result.tryAsync(async () => {
        // A malformed id never matches the uuid column; skip the database error.
        if (!this.isUuid(id)) return null;

        const row = await this.findReadRow(id);
        return row ? this.toDTO(row) : null;
      }),
  };

  // Storefront (public) tree in one query. `tree` walks down from the roots only
  // through active, non-deleted categories (the subtree of an inactive one is
  // left out), with `level`, `parent_slug` and the ids from the root (`path`).
  // `direct` counts the visible products per category; each node sums the
  // counts of every node whose path contains it, and the inner joins drop the
  // categories without products. Rows come parents first, siblings in order.
  readonly findStorefrontCategories: FindStorefrontCategoriesQuery = {
    execute: () =>
      Result.tryAsync(async () => {
        const rows = await this.prisma.client.$queryRaw<StorefrontCategoryRow[]>`
          WITH RECURSIVE tree AS (
            SELECT c.id, c.slug, c.name, c."order", c.is_highlighted,
              1 AS level, NULL::text AS parent_slug, ARRAY[c.id] AS path
            FROM categories c
            WHERE c.parent_id IS NULL AND c.is_active AND c.deleted_at IS NULL
            UNION ALL
            SELECT c.id, c.slug, c.name, c."order", c.is_highlighted,
              t.level + 1, t.slug, t.path || c.id
            FROM categories c
            JOIN tree t ON c.parent_id = t.id
            WHERE c.is_active AND c.deleted_at IS NULL AND NOT c.id = ANY(t.path)
          ),
          direct AS (
            SELECT p.category_id, count(*)::int AS products
            ${visibleProducts()}
            GROUP BY p.category_id
          )
          SELECT t.slug, t.name, t.level, t.parent_slug, t.is_highlighted,
            sum(d.products)::int AS product_count
          FROM tree t
          JOIN tree x ON t.id = ANY(x.path)
          JOIN direct d ON d.category_id = x.id
          GROUP BY t.id, t.slug, t.name, t.level, t.parent_slug, t.is_highlighted, t."order"
          ORDER BY t.level, t."order", t.name COLLATE "pt-BR-x-icu", t.id`;

        return this.nestStorefrontCategories(rows);
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

  private async findReadRow(id: string): Promise<CategoryReadRow | null> {
    const rows = await this.prisma.client.$queryRaw<CategoryReadRow[]>`
      ${BASE_SELECT}
      WHERE c.deleted_at IS NULL AND c.id = ${id}::uuid`;
    return rows[0] ?? null;
  }

  // Live children of the given parents, in sibling order.
  private async findChildRows(parentIds: string[]): Promise<CategoryReadRow[]> {
    if (parentIds.length === 0) return [];

    return this.prisma.client.$queryRaw<CategoryReadRow[]>`
      ${BASE_SELECT}
      WHERE c.deleted_at IS NULL AND c.parent_id = ANY(${parentIds}::uuid[])
      ORDER BY ${SIBLING_ORDER}`;
  }

  // Loads the children of `nodes` in one query and fills their `children`
  // (the query order is kept per parent). Returns the loaded children.
  private async attachChildren(nodes: CategoryTreeNodeDTO[]): Promise<CategoryTreeNodeDTO[]> {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const rows = await this.findChildRows([...byId.keys()]);

    const children = rows.map((row) => this.toNode(row));
    for (const child of children) {
      byId.get(child.parentId as string)?.children.push(child);
    }
    return children;
  }

  // Normalizes the paging the controller already validated, so a direct call
  // with invalid numbers still produces a valid LIMIT/OFFSET.
  private paging(filter: Paging): Paging {
    return {
      page: Math.max(1, Math.trunc(filter.page) || 1),
      pageSize: Math.max(1, Math.trunc(filter.pageSize) || 1),
    };
  }

  private toPage<T>(items: T[], total: number, page: number, pageSize: number) {
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
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

  private toDTO(row: CategoryReadRow): CategoryDTO {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      parentId: row.parent_id,
      order: row.order,
      isHighlighted: row.is_highlighted,
      imageUrl: row.image_url,
      isActive: row.is_active,
      level: row.level,
      path: row.path,
      childrenCount: row.children_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toNode(row: CategoryReadRow): CategoryTreeNodeDTO {
    return { ...this.toDTO(row), children: [] };
  }

  // Only nests the rows (already parents first and in sibling order) by `parent_slug`.
  private nestStorefrontCategories(rows: StorefrontCategoryRow[]): StorefrontCategoryDTO[] {
    const bySlug = new Map<string, StorefrontCategoryDTO>();
    const roots: StorefrontCategoryDTO[] = [];

    for (const row of rows) {
      const node: StorefrontCategoryDTO = {
        slug: row.slug,
        name: row.name,
        level: row.level,
        parentSlug: row.parent_slug,
        isHighlighted: row.is_highlighted,
        productCount: row.product_count,
        children: [],
      };
      bySlug.set(node.slug, node);
      if (node.parentSlug === null) roots.push(node);
      else bySlug.get(node.parentSlug)?.children.push(node);
    }
    return roots;
  }
}
