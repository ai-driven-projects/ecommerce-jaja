import { Injectable } from '@nestjs/common';
import { Id, Result, TransactionContext } from '@mentoria-360/shared';
import {
  BrandErrors,
  CATEGORY_MAX_DEPTH,
  CategoryErrors,
  FindProductByIdQuery,
  FindProductsQuery,
  FindStorefrontProductBySlugQuery,
  FindStorefrontProductsQuery,
  Product,
  ProductDTO,
  ProductErrors,
  ProductFiltersDTO,
  ProductImageDTO,
  ProductListItemDTO,
  ProductPageDTO,
  ProductRepository,
  StorefrontBrandFacetDTO,
  StorefrontCategoryRefDTO,
  StorefrontProductDetailDTO,
  StorefrontProductListItemDTO,
  StorefrontProductSort,
} from '@jaja/catalog';
import { Prisma } from '@prisma/client';
import {
  PrismaService,
  PrismaTransactionContext,
} from '../../db/prisma.service.js';
import { folded, toPrefixTsQuery } from '../../db/text-search.sql.js';
import { visibleProducts } from './storefront.sql.js';

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

// Storefront search document: the generated `p.search_document` (name and sku
// weigh A, description C) plus the brand name (A) and the names of the category
// and its ancestors (B), which live in other tables. The same expression feeds
// the filter and `ts_rank`.
const STOREFRONT_SEARCH_DOCUMENT = Prisma.raw(
  [
    'p.search_document',
    `setweight(to_tsvector('simple', ${folded("coalesce(b.name, '')")}), 'A')`,
    `setweight(to_tsvector('simple', ${folded("concat_ws(' ', c1.name, c2.name, c3.name)")}), 'B')`,
  ].join(' || '),
);

// Percentage off the "De:" price, used by the projection and by the `discount` order.
const DISCOUNT_PERCENT = Prisma.sql`(CASE WHEN p.list_price_cents > p.price_cents
  THEN round((1 - p.price_cents::numeric / p.list_price_cents) * 100)::int END)`;

// The ICU collation orders names ignoring case and accents; `p.id` keeps pages stable.
const STOREFRONT_NAME_ORDER = Prisma.sql`p.name COLLATE "pt-BR-x-icu", p.id`;

// Main image (lowest `order`) of each product of the page, in the same query.
const MAIN_IMAGE_JOIN = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT i.thumb_url FROM product_images i
    WHERE i.product_id = p.id
    ORDER BY i."order"
    LIMIT 1
  ) main_image ON true`;

const STOREFRONT_BRAND_FACETS_LIMIT = 30;

type StorefrontProductRow = {
  id: string;
  slug: string;
  name: string;
  brand_name: string | null;
  category_name: string;
  root_category_slug: string;
  price_cents: number;
  list_price_cents: number | null;
  discount_percent: number | null;
  unit: string;
  thumb_url: string | null;
  is_featured: boolean;
};

type StorefrontProductDetailRow = {
  id: string;
  slug: string;
  name: string;
  sku: string | null;
  description: string | null;
  price_cents: number;
  list_price_cents: number | null;
  discount_percent: number | null;
  unit: string;
  is_featured: boolean;
  brand: StorefrontCategoryRefDTO | null;
  categories: StorefrontCategoryRefDTO[];
  images: ProductImageDTO[];
};

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

  // Storefront (public) read side: every rule lives in the SQL (visibility,
  // category subtree, search, filters, order, facets and `discount_percent`);
  // the adapter only maps rows. Count, page and brand facets run in parallel.
  readonly findStorefrontProducts: FindStorefrontProductsQuery = {
    execute: (filter) =>
      Result.tryAsync(async () => {
        const page = Math.max(1, Math.trunc(filter.page) || 1);
        const pageSize = Math.max(1, Math.trunc(filter.pageSize) || 1);
        const tsQuery = filter.search ? toPrefixTsQuery(filter.search) : null;
        const isCents = (value: unknown): value is number =>
          Number.isSafeInteger(value) && (value as number) >= 0;

        // Every condition but the brand one: the facets are computed with these.
        const conditions: Prisma.Sql[] = [];
        if (tsQuery) {
          conditions.push(
            Prisma.sql`(${STOREFRONT_SEARCH_DOCUMENT}) @@ to_tsquery('simple', ${tsQuery})`,
          );
        }
        if (filter.categorySlug) {
          // The category and its active descendants; an unknown or inactive
          // slug yields no ids, so the page is empty.
          conditions.push(Prisma.sql`p.category_id IN (
            WITH RECURSIVE subtree AS (
              SELECT id FROM categories
              WHERE slug = ${filter.categorySlug} AND is_active AND deleted_at IS NULL
              UNION
              SELECT c.id FROM categories c
              JOIN subtree s ON c.parent_id = s.id
              WHERE c.is_active AND c.deleted_at IS NULL
            )
            SELECT id FROM subtree)`);
        }
        // A closed range; `LEAST`/`GREATEST` swap the limits when min > max.
        const { minPriceCents: min, maxPriceCents: max } = filter;
        if (isCents(min) && isCents(max)) {
          conditions.push(
            Prisma.sql`p.price_cents BETWEEN LEAST(${min}::int, ${max}::int) AND GREATEST(${min}::int, ${max}::int)`,
          );
        } else if (isCents(min)) {
          conditions.push(Prisma.sql`p.price_cents >= ${min}::int`);
        } else if (isCents(max)) {
          conditions.push(Prisma.sql`p.price_cents <= ${max}::int`);
        }
        if (filter.onSale) conditions.push(Prisma.sql`p.list_price_cents IS NOT NULL`);
        if (filter.featured) conditions.push(Prisma.sql`p.is_featured`);

        // Any of the brands; slugs that match no visible brand are ignored, so
        // when none of them is known the brand filter does not apply.
        const brandSlugs = (filter.brandSlugs ?? []).filter(Boolean);
        const byBrand = brandSlugs.length
          ? Prisma.sql`(b.slug = ANY(${brandSlugs}::text[]) OR NOT EXISTS (
              SELECT 1 FROM brands kb
              WHERE kb.slug = ANY(${brandSlugs}::text[]) AND kb.is_active AND kb.deleted_at IS NULL))`
          : null;

        const where = this.andAll(byBrand ? [...conditions, byBrand] : conditions);
        const facetsWhere = this.andAll(conditions);
        const orderBy = this.storefrontOrder(filter.sort, tsQuery);

        const client = this.prisma.client;
        const [counts, rows, brandFacets] = await Promise.all([
          client.$queryRaw<{ total: number }[]>`
            SELECT count(*)::int AS total ${visibleProducts()}${where}`,
          client.$queryRaw<StorefrontProductRow[]>`
            SELECT p.id, p.slug, p.name, b.name AS brand_name, c1.name AS category_name,
              coalesce(c3.slug, c2.slug, c1.slug) AS root_category_slug,
              p.price_cents, p.list_price_cents, ${DISCOUNT_PERCENT} AS discount_percent,
              p.unit, main_image.thumb_url, p.is_featured
            ${visibleProducts(MAIN_IMAGE_JOIN)}${where}
            ORDER BY ${orderBy}
            LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
          client.$queryRaw<StorefrontBrandFacetDTO[]>`
            SELECT b.slug, b.name, count(*)::int AS count
            ${visibleProducts()} AND b.id IS NOT NULL${facetsWhere}
            GROUP BY b.id, b.slug, b.name
            ORDER BY count(*) DESC, b.name COLLATE "pt-BR-x-icu", b.id
            LIMIT ${STOREFRONT_BRAND_FACETS_LIMIT}`,
        ]);

        const total = counts[0]?.total ?? 0;
        return {
          items: rows.map((row) => this.toStorefrontListItem(row)),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
          brandFacets,
        };
      }),
  };

  // One query: the visible product with its brand, the category trail (root →
  // product's category, built from c3/c2/c1 without nulls) and every image.
  readonly findStorefrontProductBySlug: FindStorefrontProductBySlugQuery = {
    execute: (slug) =>
      Result.tryAsync(async () => {
        // An empty slug never matches a product; skip the database.
        if (typeof slug !== 'string' || !slug) return null;

        const rows = await this.prisma.client.$queryRaw<StorefrontProductDetailRow[]>`
          SELECT p.id, p.slug, p.name, p.sku, p.description,
            p.price_cents, p.list_price_cents, ${DISCOUNT_PERCENT} AS discount_percent,
            p.unit, p.is_featured,
            CASE WHEN b.id IS NULL THEN NULL
              ELSE json_build_object('slug', b.slug, 'name', b.name) END AS brand,
            (SELECT json_agg(json_build_object('slug', trail.slug, 'name', trail.name) ORDER BY trail.depth)
              FROM (VALUES (c3.slug, c3.name, 1), (c2.slug, c2.name, 2), (c1.slug, c1.name, 3))
                AS trail(slug, name, depth)
              WHERE trail.slug IS NOT NULL) AS categories,
            coalesce((SELECT json_agg(json_build_object(
                'thumbUrl', i.thumb_url, 'largeUrl', i.large_url, 'order', i."order")
                ORDER BY i."order")
              FROM product_images i WHERE i.product_id = p.id), '[]'::json) AS images
          ${visibleProducts()} AND p.slug = ${slug}`;

        const row = rows[0];
        return row ? this.toStorefrontDetail(row) : null;
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

  // ` AND c1 AND c2 ...` appended to the visibility `WHERE`, or nothing.
  private andAll(conditions: Prisma.Sql[]): Prisma.Sql {
    return conditions.length
      ? Prisma.sql` AND ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;
  }

  // `relevance` needs a search: without valid terms it orders like `featured`,
  // which is also the default without search. Every order ends with name and id.
  private storefrontOrder(
    sort: StorefrontProductSort | undefined,
    tsQuery: string | null,
  ): Prisma.Sql {
    const effective = !sort || sort === 'relevance' ? (tsQuery ? 'relevance' : 'featured') : sort;

    switch (effective) {
      case 'relevance':
        return Prisma.sql`ts_rank(${STOREFRONT_SEARCH_DOCUMENT}, to_tsquery('simple', ${tsQuery})) DESC, ${STOREFRONT_NAME_ORDER}`;
      case 'price-asc':
        return Prisma.sql`p.price_cents ASC, ${STOREFRONT_NAME_ORDER}`;
      case 'price-desc':
        return Prisma.sql`p.price_cents DESC, ${STOREFRONT_NAME_ORDER}`;
      case 'name':
        return STOREFRONT_NAME_ORDER;
      case 'discount':
        return Prisma.sql`${DISCOUNT_PERCENT} DESC NULLS LAST, ${STOREFRONT_NAME_ORDER}`;
      default:
        return Prisma.sql`p.is_featured DESC, ${STOREFRONT_NAME_ORDER}`;
    }
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
      isFeatured: row.isFeatured,
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
      isFeatured: product.isFeatured,
      // `search_document` is a generated column: the database fills it.
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
      isFeatured: row.isFeatured,
    };
  }

  private toStorefrontListItem(row: StorefrontProductRow): StorefrontProductListItemDTO {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      brandName: row.brand_name,
      categoryName: row.category_name,
      rootCategorySlug: row.root_category_slug,
      priceCents: row.price_cents,
      listPriceCents: row.list_price_cents,
      discountPercent: row.discount_percent,
      unit: row.unit,
      thumbUrl: row.thumb_url,
      isFeatured: row.is_featured,
    };
  }

  private toStorefrontDetail(row: StorefrontProductDetailRow): StorefrontProductDetailDTO {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      sku: row.sku,
      description: row.description,
      priceCents: row.price_cents,
      listPriceCents: row.list_price_cents,
      discountPercent: row.discount_percent,
      unit: row.unit,
      isFeatured: row.is_featured,
      brand: row.brand,
      categories: row.categories ?? [],
      images: row.images ?? [],
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
      isFeatured: row.isFeatured,
      brandName: row.brand?.name ?? null,
      categoryPath,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
