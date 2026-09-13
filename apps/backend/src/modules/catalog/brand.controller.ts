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
  BrandDTO,
  BrandErrors,
  BrandFiltersDTO,
  BrandPageDTO,
  DeleteBrand,
  SaveBrand,
} from '@jaja/catalog';
import { AdminOnly } from '../../shared/decorators/admin-only.decorator.js';
import { BrandPrisma } from './brand.prisma.js';
import { ProductPrisma } from './product.prisma.js';

export type SaveBrandBody = {
  name: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
  isActive?: boolean;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Controller('brands')
@AdminOnly()
export class BrandController {
  constructor(
    private readonly brandPrisma: BrandPrisma,
    private readonly productPrisma: ProductPrisma,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: SaveBrandBody): Promise<BrandDTO> {
    const useCase = new SaveBrand(this.brandPrisma);

    // No `id`: the use case generates one, so an `id` in the body is discarded.
    const result = await useCase.execute(this.toInput(body));

    if (result.isFailure) this.throwFailure(result.errors);
    return result.instance;
  }

  @Get()
  async findAll(
    @Query('page') page?: unknown,
    @Query('pageSize') pageSize?: unknown,
    @Query('search') search?: unknown,
    @Query('isActive') isActive?: unknown,
  ): Promise<BrandPageDTO> {
    // Invalid `page`/`pageSize` fall back to the defaults; `pageSize` is capped.
    const filter: BrandFiltersDTO = {
      page: this.positiveInteger(page, DEFAULT_PAGE),
      pageSize: Math.min(this.positiveInteger(pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    };
    if (typeof search === 'string' && search.trim()) filter.search = search.trim();
    // Any value other than exactly "true" or "false" is ignored.
    if (isActive === 'true' || isActive === 'false') {
      filter.isActive = isActive === 'true';
    }

    const result = await this.brandPrisma.findBrands.execute(filter);

    if (result.isFailure) this.throwFailure(result.errors);
    return result.instance;
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<BrandDTO> {
    const result = await this.brandPrisma.findBrandById.execute(id);

    if (result.isFailure) this.throwFailure(result.errors);
    if (!result.instance) {
      throw new NotFoundException([BrandErrors.BRAND_NOT_FOUND]);
    }
    return result.instance;
  }

  @Put(':id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body() body: SaveBrandBody,
  ): Promise<BrandDTO> {
    const useCase = new SaveBrand(this.brandPrisma);

    // The route id wins: an `id` in the body is discarded.
    const result = await useCase.execute({ ...this.toInput(body), id });

    if (result.isFailure) this.throwFailure(result.errors);
    return result.instance;
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    // A brand with live products cannot be deleted (BRAND_HAS_PRODUCTS).
    const useCase = new DeleteBrand(this.brandPrisma, this.productPrisma);

    const result = await useCase.execute({ id });

    if (result.isFailure) this.throwFailure(result.errors);
  }

  // Only these fields reach the use case.
  private toInput(body: SaveBrandBody) {
    return {
      name: body?.name,
      slug: body?.slug,
      description: body?.description,
      logoUrl: body?.logoUrl,
      isActive: body?.isActive,
    };
  }

  private positiveInteger(value: unknown, fallback: number): number {
    if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return fallback;
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
  }

  private throwFailure(errors: string[]): never {
    const codes = this.uniqueCodes(errors);
    if (codes.includes(BrandErrors.BRAND_NOT_FOUND)) {
      throw new NotFoundException(codes);
    }
    if (
      codes.includes(BrandErrors.BRAND_NAME_ALREADY_EXISTS) ||
      codes.includes(BrandErrors.BRAND_SLUG_ALREADY_EXISTS) ||
      codes.includes(BrandErrors.BRAND_HAS_PRODUCTS)
    ) {
      throw new ConflictException(codes);
    }
    throw new BadRequestException(codes);
  }

  // Value objects may repeat a code; the API exposes each code once.
  private uniqueCodes(errors: string[]): string[] {
    return [...new Set(errors)];
  }
}
