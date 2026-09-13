import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  BrandErrors,
  CategoryErrors,
  DeleteProduct,
  ProductDTO,
  ProductErrors,
  ProductFiltersDTO,
  ProductPageDTO,
  SaveProduct,
  SaveProductInput,
} from '@jaja/catalog';
import { AdminOnly } from '../../shared/decorators/admin-only.decorator.js';
import { BrandPrisma } from './brand.prisma.js';
import { CategoryPrisma } from './category.prisma.js';
import { ProductPrisma } from './product.prisma.js';

export type ProductImageBody = {
  thumbUrl: string;
  largeUrl: string;
  order: number;
};

// On update an omitted field keeps the current value and `null` (or a blank
// string) clears the optional ones; `images` always replaces the whole list,
// so omitting it leaves the product without images.
export type SaveProductBody = {
  name: string;
  slug?: string | null;
  sku?: string | null;
  brandId?: string | null;
  categoryId: string;
  description?: string | null;
  priceCents: number;
  listPriceCents?: number | null;
  unit?: string | null;
  images?: ProductImageBody[] | null;
  isActive?: boolean | null;
};

// Raised by the controller itself when the payload has a shape the domain
// cannot read (e.g. `images` that is not a list).
export const ProductRequestErrors = {
  PRODUCT_IMAGES_INVALID: 'PRODUCT_IMAGES_INVALID',
} as const;

// Same codes the shared value objects emit for these fields (`SharedErrors` is
// not exported by the shared package entrypoint).
const SharedErrors = {
  ID_INVALID: 'INVALID_ID',
  ALIAS_INVALID: 'INVALID_ALIAS',
  TEXT_INVALID: 'INVALID_TEXT',
  URL_INVALID: 'INVALID_URL',
} as const;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const NOT_FOUND_CODES: string[] = [
  ProductErrors.PRODUCT_NOT_FOUND,
  BrandErrors.BRAND_NOT_FOUND,
  CategoryErrors.CATEGORY_NOT_FOUND,
];

const CONFLICT_CODES: string[] = [
  ProductErrors.PRODUCT_SLUG_ALREADY_EXISTS,
  ProductErrors.PRODUCT_SKU_ALREADY_EXISTS,
];

@Controller('products')
@AdminOnly()
export class ProductController {
  constructor(
    private readonly productPrisma: ProductPrisma,
    private readonly brandPrisma: BrandPrisma,
    private readonly categoryPrisma: CategoryPrisma,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: SaveProductBody): Promise<ProductDTO> {
    // No `id`: the use case generates one, so an `id` in the body is discarded.
    const result = await this.saveProduct().execute(this.toInput(body));

    if (result.isFailure) this.throwFailure(result.errors);
    return this.respondWith(result.instance.id);
  }

  @Get()
  async findAll(
    @Query('page') page?: unknown,
    @Query('pageSize') pageSize?: unknown,
    @Query('search') search?: unknown,
    @Query('brandId') brandId?: unknown,
    @Query('categoryId') categoryId?: unknown,
    @Query('isActive') isActive?: unknown,
  ): Promise<ProductPageDTO> {
    const filter: ProductFiltersDTO = {
      page: this.positiveInteger(page, DEFAULT_PAGE),
      pageSize: Math.min(this.positiveInteger(pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    };

    // Empty strings are discarded; any `isActive` other than "true"/"false" is ignored.
    const text = (value: unknown) =>
      typeof value === 'string' && value.trim() ? value.trim() : undefined;
    if (text(search)) filter.search = text(search);
    if (text(brandId)) filter.brandId = text(brandId);
    if (text(categoryId)) filter.categoryId = text(categoryId);
    if (isActive === 'true' || isActive === 'false') {
      filter.isActive = isActive === 'true';
    }

    const result = await this.productPrisma.findProducts.execute(filter);

    if (result.isFailure) this.throwFailure(result.errors);
    return result.instance;
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<ProductDTO> {
    return this.respondWith(id);
  }

  @Put(':id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body() body: SaveProductBody,
  ): Promise<ProductDTO> {
    // The route id wins: an `id` in the body is discarded.
    const result = await this.saveProduct().execute({ ...this.toInput(body), id });

    if (result.isFailure) this.throwFailure(result.errors);
    return this.respondWith(result.instance.id);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    const useCase = new DeleteProduct(this.productPrisma);

    const result = await useCase.execute({ id });

    if (result.isFailure) this.throwFailure(result.errors);
  }

  private saveProduct(): SaveProduct {
    return new SaveProduct(this.productPrisma, this.brandPrisma, this.categoryPrisma);
  }

  // The use case returns the entity; `brandName` and `categoryPath` come from the query.
  private async respondWith(id: string): Promise<ProductDTO> {
    const result = await this.productPrisma.findProductById.execute(id);

    if (result.isFailure) this.throwFailure(result.errors);
    if (!result.instance) {
      throw new NotFoundException([ProductErrors.PRODUCT_NOT_FOUND]);
    }
    return result.instance;
  }

  // Only these fields reach the use case; `undefined` and `null` are preserved.
  // Values of a type the domain cannot read are rejected here with a readable code.
  private toInput(body: SaveProductBody): SaveProductInput {
    const raw = (body ?? {}) as Record<string, unknown>;
    const errors = this.typeErrors(raw);
    if (errors.length) throw new BadRequestException(this.uniqueCodes(errors));

    const images = raw.images as Record<string, unknown>[] | null | undefined;
    return {
      name: raw.name as string,
      slug: raw.slug as string | null | undefined,
      sku: raw.sku as string | null | undefined,
      brandId: raw.brandId as string | null | undefined,
      categoryId: raw.categoryId as string,
      description: raw.description as string | null | undefined,
      priceCents: raw.priceCents as number,
      listPriceCents: raw.listPriceCents as number | null | undefined,
      unit: raw.unit as string | null | undefined,
      images: Array.isArray(images)
        ? images.map((image) => ({
            thumbUrl: image.thumbUrl as string,
            largeUrl: image.largeUrl as string,
            order: image.order as number,
          }))
        : images,
      isActive: raw.isActive as boolean | null | undefined,
    };
  }

  // Name, sku, description, prices and `isActive` of any type are validated by
  // the entity; these fields would crash it, be silently ignored or yield an
  // unreadable message instead.
  private typeErrors(raw: Record<string, unknown>): string[] {
    const errors: string[] = [];
    const isOptionalString = (value: unknown) =>
      value === undefined || value === null || typeof value === 'string';

    if (!isOptionalString(raw.brandId) || !isOptionalString(raw.categoryId)) {
      errors.push(SharedErrors.ID_INVALID);
    }
    if (!isOptionalString(raw.slug)) errors.push(SharedErrors.ALIAS_INVALID);
    if (!isOptionalString(raw.unit)) errors.push(SharedErrors.TEXT_INVALID);

    const images = raw.images;
    if (images === undefined || images === null) return errors;

    if (!Array.isArray(images)) {
      errors.push(ProductRequestErrors.PRODUCT_IMAGES_INVALID);
      return errors;
    }
    for (const image of images) {
      if (typeof image !== 'object' || image === null || Array.isArray(image)) {
        errors.push(ProductRequestErrors.PRODUCT_IMAGES_INVALID);
        continue;
      }
      const { thumbUrl, largeUrl } = image as Record<string, unknown>;
      if (!isOptionalString(thumbUrl) || !isOptionalString(largeUrl)) {
        errors.push(SharedErrors.URL_INVALID);
      }
    }
    return errors;
  }

  // Integers >= 1 written only with digits; anything else takes the default.
  private positiveInteger(value: unknown, fallback: number): number {
    if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return fallback;
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
  }

  private throwFailure(errors: string[]): never {
    const codes = this.uniqueCodes(errors);
    if (codes.some((code) => NOT_FOUND_CODES.includes(code))) {
      throw new NotFoundException(codes);
    }
    if (codes.some((code) => CONFLICT_CODES.includes(code))) {
      throw new ConflictException(codes);
    }
    throw new BadRequestException(codes);
  }

  // Value objects may repeat a code; the API exposes each code once.
  private uniqueCodes(errors: string[]): string[] {
    return [...new Set(errors)];
  }
}
