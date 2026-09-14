import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import {
  ProductErrors,
  STOREFRONT_PRODUCT_SORTS,
  StorefrontCategoryDTO,
  StorefrontProductDetailDTO,
  StorefrontProductFiltersDTO,
  StorefrontProductPageDTO,
  StorefrontProductSort,
} from '@jaja/catalog';
import { CategoryPrisma } from './category.prisma.js';
import { ProductPrisma } from './product.prisma.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;
const MAX_BRAND_SLUGS = 20;

// Public, read-only catalog of the store. There is no global guard, so these
// routes need no token, and an `Authorization` header (valid or not) is simply
// ignored. Each method only normalizes the HTTP parameters and calls the query:
// the reading rules (visibility, search, filters, order) live in the SQL.
@Controller('storefront')
export class StorefrontController {
  constructor(
    private readonly productPrisma: ProductPrisma,
    private readonly categoryPrisma: CategoryPrisma,
  ) {}

  @Get('categories')
  async findCategories(): Promise<StorefrontCategoryDTO[]> {
    const result = await this.categoryPrisma.findStorefrontCategories.execute();

    if (result.isFailure) this.throwFailure(result.errors);
    return result.instance;
  }

  @Get('products')
  async findProducts(
    @Query('page') page?: unknown,
    @Query('pageSize') pageSize?: unknown,
    @Query('search') search?: unknown,
    @Query('category') category?: unknown,
    @Query('brand') brand?: unknown,
    @Query('minPriceCents') minPriceCents?: unknown,
    @Query('maxPriceCents') maxPriceCents?: unknown,
    @Query('onSale') onSale?: unknown,
    @Query('featured') featured?: unknown,
    @Query('sort') sort?: unknown,
  ): Promise<StorefrontProductPageDTO> {
    const filter: StorefrontProductFiltersDTO = {
      page: this.positiveInteger(page, DEFAULT_PAGE),
      pageSize: Math.min(this.positiveInteger(pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    };

    if (this.text(search)) filter.search = this.text(search);
    if (this.text(category)) filter.categorySlug = this.text(category);

    const brandSlugs = this.brandSlugs(brand);
    if (brandSlugs.length) filter.brandSlugs = brandSlugs;

    const min = this.cents(minPriceCents);
    const max = this.cents(maxPriceCents);
    if (min !== undefined) filter.minPriceCents = min;
    if (max !== undefined) filter.maxPriceCents = max;

    // Only "true" turns these filters on; any other value is ignored.
    if (onSale === 'true') filter.onSale = true;
    if (featured === 'true') filter.featured = true;

    if (STOREFRONT_PRODUCT_SORTS.includes(sort as StorefrontProductSort)) {
      filter.sort = sort as StorefrontProductSort;
    }

    const result = await this.productPrisma.findStorefrontProducts.execute(filter);

    if (result.isFailure) this.throwFailure(result.errors);
    return result.instance;
  }

  @Get('products/:slug')
  async findProductBySlug(
    @Param('slug') slug: string,
  ): Promise<StorefrontProductDetailDTO> {
    const result = await this.productPrisma.findStorefrontProductBySlug.execute(slug);

    if (result.isFailure) this.throwFailure(result.errors);
    if (!result.instance) {
      throw new NotFoundException([ProductErrors.PRODUCT_NOT_FOUND]);
    }
    return result.instance;
  }

  // Trimmed text; blank or non-string values are discarded.
  private text(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  // Comma-separated slugs (a repeated `brand` parameter is accepted too), blanks
  // discarded, at most `MAX_BRAND_SLUGS`.
  private brandSlugs(value: unknown): string[] {
    const values = Array.isArray(value) ? value : [value];
    return values
      .filter((item): item is string => typeof item === 'string')
      .flatMap((item) => item.split(','))
      .map((slug) => slug.trim())
      .filter(Boolean)
      .slice(0, MAX_BRAND_SLUGS);
  }

  // Integers >= 0 written only with digits; anything else is ignored.
  private cents(value: unknown): number | undefined {
    if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return undefined;
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }

  // Integers >= 1 written only with digits; anything else takes the default.
  private positiveInteger(value: unknown, fallback: number): number {
    if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return fallback;
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
  }

  // A read failure has no "not found" or conflict meaning: it is a 400 with
  // each code once, like the other catalog controllers.
  private throwFailure(errors: string[]): never {
    throw new BadRequestException([...new Set(errors)]);
  }
}
