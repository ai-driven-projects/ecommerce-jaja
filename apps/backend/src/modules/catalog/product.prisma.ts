import { Injectable } from '@nestjs/common';
import { Id, Result, TransactionContext } from '@mentoria-360/shared';
import {
  BrandErrors,
  CATEGORY_MAX_DEPTH,
  CategoryErrors,
  FindProductByIdQuery,
  FindProductsQuery,
  Product,
  ProductDTO,
  ProductErrors,
  ProductFiltersDTO,
  ProductListItemDTO,
  ProductPageDTO,
  ProductRepository,
} from '@jaja/catalog';
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

// Maps the unique constraints of `products` to the domain error they represent.
// A primary key collision only happens when creating with the id of a deleted
// product (PUT on a deleted id), which the API must answer as "not found".
const UNIQUE_VIOLATIONS: readonly ConstraintViolation[] = [
  {
    fields: ['slug'],
    constraint: 'products_slug_key',
    code: ProductErrors.PRODUCT_SLUG_ALREADY_EXISTS,
  },
  {
    fields: ['sku'],
    constraint: 'products_sku_key',
    code: ProductErrors.PRODUCT_SKU_ALREADY_EXISTS,
  },
  {
    fields: ['id'],
    constraint: 'products_pkey',
    code: ProductErrors.PRODUCT_NOT_FOUND,
  },
];

// P2003: the brand or the category vanished between the use case check and the write.
const FOREIGN_KEY_VIOLATIONS: readonly ConstraintViolation[] = [
  {
    fields: ['brand_id', 'brandId'],
    constraint: 'products_brand_id_fkey',
    code: BrandErrors.BRAND_NOT_FOUND,
  },
  {
    fields: ['category_id', 'categoryId'],
    constraint: 'products_category_id_fkey',
    code: CategoryErrors.CATEGORY_NOT_FOUND,
  },
];

// Extra hops allowed beyond the maximum depth when walking up the hierarchy, so
// a loop stored by corrupted data can never make the walk spin forever.
const MAX_ANCESTOR_HOPS = CATEGORY_MAX_DEPTH + 3;

// Same separator as `CategoryDTO.path`.
const PATH_SEPARATOR = ' / ';

const WITH_IMAGES = {
  images: { orderBy: { order: 'asc' } },
} satisfies Prisma.ProductInclude;

// List rows only need the brand name and the main image (lowest order).
const LIST_INCLUDE = {
  brand: { select: { name: true } },
  images: { orderBy: { order: 'asc' }, take: 1 },
} satisfies Prisma.ProductInclude;

const DETAIL_INCLUDE = {
  brand: { select: { name: true } },
  images: { orderBy: { order: 'asc' } },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof WITH_IMAGES }>;
type ProductListRow = Prisma.ProductGetPayload<{ include: typeof LIST_INCLUDE }>;
type ProductDetailRow = Prisma.ProductGetPayload<{ include: typeof DETAIL_INCLUDE }>;

type CategoryNode = { id: string; name: string; parentId: string | null };

// Live categories of one request, loaded once: paths and descendants are
// computed in memory (the tree has three levels and a few hundred nodes).
type CategoryTree = {
  byId: Map<string, CategoryNode>;
  childrenOf: Map<string, string[]>;
  paths: Map<string, string>;
};

@Injectable()
export class ProductPrisma implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Read side (CQRS): rows are mapped straight to DTOs, without the entity.
  // One query loads the live categories, then the page and the count run in the
  // same `$transaction`, with the brand name and the main image included (no N+1).
  readonly findProducts: FindProductsQuery = {
    execute: (filter) =>
      Result.tryAsync(async () => {
        const { page, pageSize } = filter;
        const tree = await this.loadCategoryTree();

        const where = this.listWhere(filter, tree);
        if (!where) return this.toPage([], 0, page, pageSize);

        const client = this.prisma.client;
        const [rows, total] = await client.$transaction([
          client.product.findMany({
            where,
            include: LIST_INCLUDE,
            // `id` breaks ties between equal names, so pages never overlap.
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          client.product.count({ where }),
        ]);

        const items = rows.map((row) =>
          this.toListItem(row, this.categoryPath(tree, row.categoryId)),
        );
        return this.toPage(items, total, page, pageSize);
      }),
  };

  readonly findProductById: FindProductByIdQuery = {
    execute: (id) =>
      Result.tryAsync(async () => {
        // A malformed id never matches the uuid column; skip the database error.
        if (!this.isUuid(id)) return null;

        const row = await this.prisma.client.product.findFirst({
          where: { id, deletedAt: null },
          include: DETAIL_INCLUDE,
        });
        if (!row) return null;

        const tree = await this.loadCategoryTree();
        return this.toDTO(row, this.categoryPath(tree, row.categoryId));
      }),
  };

  async create(product: Product, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        // Nested write: the product and its images are inserted atomically.
        const images = this.imagesFromDomain(product);
        await this.clientFor(tx).product.create({
          data: {
            ...this.fromDomain(product),
            ...(images.length ? { images: { createMany: { data: images } } } : {}),
          },
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  async update(product: Product, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        const write = async (client: Prisma.TransactionClient) => {
          // `deletedAt: null` keeps a deleted product from being edited back to life.
          await client.product.update({
            where: { id: product.id, deletedAt: null },
            data: this.fromDomain(product),
          });

          // Images have no identity: the stored list is replaced as a whole.
          await client.productImage.deleteMany({ where: { productId: product.id } });
          const images = this.imagesFromDomain(product);
          if (images.length) {
            await client.productImage.createMany({
              data: images.map((image) => ({ ...image, productId: product.id })),
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

  async findById(id: string): Promise<Result<Product>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<Product>(ProductErrors.PRODUCT_NOT_FOUND);

      const row = await this.prisma.client.product.findFirst({
        where: { id, deletedAt: null },
        include: WITH_IMAGES,
      });
      if (!row) return Result.fail<Product>(ProductErrors.PRODUCT_NOT_FOUND);
      return this.toDomain(row);
    });
  }

  async findBySlug(slug: string): Promise<Result<Product | null>> {
    return Result.tryAsync(async () => {
      // An empty filter would match any product in Prisma, so it finds nothing instead.
      if (typeof slug !== 'string' || !slug) return Result.ok<Product | null>(null);

      const row = await this.prisma.client.product.findFirst({
        where: { slug, deletedAt: null },
        include: WITH_IMAGES,
      });
      if (!row) return Result.ok<Product | null>(null);
      return this.toDomain(row);
    });
  }

  async findBySku(sku: string): Promise<Result<Product | null>> {
    return Result.tryAsync(async () => {
      if (typeof sku !== 'string' || !sku) return Result.ok<Product | null>(null);

      const row = await this.prisma.client.product.findFirst({
        where: { sku, deletedAt: null },
        include: WITH_IMAGES,
      });
      if (!row) return Result.ok<Product | null>(null);
      return this.toDomain(row);
    });
  }

  // Only live products with a direct link count.
  async existsByBrandId(brandId: string): Promise<Result<boolean>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(brandId)) return Result.ok(false);

      const row = await this.prisma.client.product.findFirst({
        where: { brandId, deletedAt: null },
        select: { id: true },
      });
      return Result.ok(row !== null);
    });
  }

  // Only live products with a direct link count (descendants are not considered).
  async existsByCategoryId(categoryId: string): Promise<Result<boolean>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(categoryId)) return Result.ok(false);

      const row = await this.prisma.client.product.findFirst({
        where: { categoryId, deletedAt: null },
        select: { id: true },
      });
      return Result.ok(row !== null);
    });
  }

  // Soft delete: fills `deletedAt` and keeps the record (slug and sku stay reserved).
  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<void>(ProductErrors.PRODUCT_NOT_FOUND);

      try {
        await this.clientFor(tx).product.update({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  // `null` means a filter that can never match (a malformed id), so the
  // database is not even queried.
  private listWhere(
    filter: ProductFiltersDTO,
    tree: CategoryTree,
  ): Prisma.ProductWhereInput | null {
    const where: Prisma.ProductWhereInput = { deletedAt: null };

    const search = filter.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (filter.brandId) {
      if (!this.isUuid(filter.brandId)) return null;
      where.brandId = filter.brandId.toLowerCase();
    }
    if (filter.categoryId) {
      if (!this.isUuid(filter.categoryId)) return null;
      where.categoryId = {
        in: this.descendantIds(tree, filter.categoryId.toLowerCase()),
      };
    }
    if (typeof filter.isActive === 'boolean') {
      where.isActive = filter.isActive;
    }
    return where;
  }

  private toPage(
    items: ProductListItemDTO[],
    total: number,
    page: number,
    pageSize: number,
  ): ProductPageDTO {
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  private async loadCategoryTree(): Promise<CategoryTree> {
    const rows = await this.prisma.client.category.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, parentId: true },
    });

    const childrenOf = new Map<string, string[]>();
    for (const row of rows) {
      if (!row.parentId) continue;
      const siblings = childrenOf.get(row.parentId) ?? [];
      siblings.push(row.id);
      childrenOf.set(row.parentId, siblings);
    }

    return {
      byId: new Map(rows.map((row) => [row.id, row])),
      childrenOf,
      paths: new Map(),
    };
  }

  // The category itself plus every live descendant, breadth-first. An unknown
  // id yields only itself; `visited` stops loops stored by corrupted data.
  private descendantIds(tree: CategoryTree, categoryId: string): string[] {
    const visited = new Set<string>([categoryId]);
    const queue = [categoryId];

    while (queue.length) {
      const current = queue.shift()!;
      for (const child of tree.childrenOf.get(current) ?? []) {
        if (visited.has(child)) continue;
        visited.add(child);
        queue.push(child);
      }
    }
    return [...visited];
  }

  // Names from the root down to the category, joined like `CategoryDTO.path`.
  // A parent missing from the live categories ends the chain.
  private categoryPath(tree: CategoryTree, categoryId: string): string {
    const cached = tree.paths.get(categoryId);
    if (cached !== undefined) return cached;

    const names: string[] = [];
    let node = tree.byId.get(categoryId);
    while (node && names.length <= MAX_ANCESTOR_HOPS) {
      names.unshift(node.name);
      node = node.parentId ? tree.byId.get(node.parentId) : undefined;
    }

    const path = names.join(PATH_SEPARATOR);
    tree.paths.set(categoryId, path);
    return path;
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
      // P2025: the `where` matched no row (missing or already deleted product).
      if (error.code === 'P2025') return Result.fail(ProductErrors.PRODUCT_NOT_FOUND);

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

  private toDomain(row: ProductRow): Result<Product> {
    return Product.tryCreate({
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      brandId: row.brandId,
      categoryId: row.categoryId,
      description: row.description,
      priceCents: row.priceCents,
      listPriceCents: row.listPriceCents,
      unit: row.unit,
      images: row.images.map(({ thumbUrl, largeUrl, order }) => ({
        thumbUrl,
        largeUrl,
        order,
      })),
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  private fromDomain(product: Product): Prisma.ProductUncheckedCreateInput {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      brandId: product.brandId,
      categoryId: product.categoryId,
      description: product.description,
      priceCents: product.priceCents,
      listPriceCents: product.listPriceCents,
      unit: product.unit,
      isActive: product.isActive,
      // Persisting the entity timestamps keeps the database equal to the returned DTO.
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  // The entity already sorted the images and normalized `order` to 0..n-1.
  private imagesFromDomain(product: Product) {
    return product.images.map(({ thumbUrl, largeUrl, order }) => ({
      thumbUrl,
      largeUrl,
      order,
    }));
  }

  private toListItem(row: ProductListRow, categoryPath: string): ProductListItemDTO {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      brandName: row.brand?.name ?? null,
      categoryPath,
      priceCents: row.priceCents,
      listPriceCents: row.listPriceCents,
      mainImageUrl: row.images[0]?.thumbUrl ?? null,
      isActive: row.isActive,
    };
  }

  private toDTO(row: ProductDetailRow, categoryPath: string): ProductDTO {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      brandId: row.brandId,
      categoryId: row.categoryId,
      description: row.description,
      priceCents: row.priceCents,
      listPriceCents: row.listPriceCents,
      unit: row.unit,
      images: row.images.map(({ thumbUrl, largeUrl, order }) => ({
        thumbUrl,
        largeUrl,
        order,
      })),
      isActive: row.isActive,
      brandName: row.brand?.name ?? null,
      categoryPath,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
