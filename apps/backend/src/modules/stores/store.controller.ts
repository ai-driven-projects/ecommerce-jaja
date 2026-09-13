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
  DeleteStore,
  SaveStore,
  StoreDTO,
  StoreErrors,
  StoreFiltersDTO,
  StorePageDTO,
} from '@jaja/stores';
import { AdminOnly } from '../../shared/decorators/admin-only.decorator.js';
import { StorePrisma } from './store.prisma.js';

export type SaveStoreBody = {
  name: string;
  slug?: string;
  phone?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
  deliveryRadiusMeters?: number;
  isActive?: boolean;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Controller('stores')
@AdminOnly()
export class StoreController {
  constructor(private readonly storePrisma: StorePrisma) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: SaveStoreBody): Promise<StoreDTO> {
    const useCase = new SaveStore(this.storePrisma);

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
  ): Promise<StorePageDTO> {
    // Invalid `page`/`pageSize` fall back to the defaults; `pageSize` is capped.
    const filter: StoreFiltersDTO = {
      page: this.positiveInteger(page, DEFAULT_PAGE),
      pageSize: Math.min(this.positiveInteger(pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    };
    if (typeof search === 'string' && search.trim()) filter.search = search.trim();
    // Any value other than exactly "true" or "false" is ignored.
    if (isActive === 'true' || isActive === 'false') {
      filter.isActive = isActive === 'true';
    }

    const result = await this.storePrisma.findStores.execute(filter);

    if (result.isFailure) this.throwFailure(result.errors);
    return result.instance;
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<StoreDTO> {
    const result = await this.storePrisma.findStoreById.execute(id);

    if (result.isFailure) this.throwFailure(result.errors);
    if (!result.instance) {
      throw new NotFoundException([StoreErrors.STORE_NOT_FOUND]);
    }
    return result.instance;
  }

  @Put(':id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body() body: SaveStoreBody,
  ): Promise<StoreDTO> {
    const useCase = new SaveStore(this.storePrisma);

    // The route id wins: an `id` in the body is discarded.
    const result = await useCase.execute({ ...this.toInput(body), id });

    if (result.isFailure) this.throwFailure(result.errors);
    return result.instance;
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    const useCase = new DeleteStore(this.storePrisma);

    const result = await useCase.execute({ id });

    if (result.isFailure) this.throwFailure(result.errors);
  }

  // Only these fields reach the use case.
  private toInput(body: SaveStoreBody) {
    return {
      name: body?.name,
      slug: body?.slug,
      phone: body?.phone,
      address: body?.address,
      latitude: body?.latitude,
      longitude: body?.longitude,
      deliveryRadiusMeters: body?.deliveryRadiusMeters,
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
    if (codes.includes(StoreErrors.STORE_NOT_FOUND)) {
      throw new NotFoundException(codes);
    }
    if (
      codes.includes(StoreErrors.STORE_NAME_ALREADY_EXISTS) ||
      codes.includes(StoreErrors.STORE_SLUG_ALREADY_EXISTS)
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
