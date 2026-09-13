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
  CategoryDTO,
  CategoryErrors,
  CategoryFiltersDTO,
  DeleteCategory,
  SaveCategory,
  SaveCategoryInput,
} from '@jaja/catalog';
import { AdminOnly } from '../../shared/decorators/admin-only.decorator.js';
import { CategoryPrisma } from './category.prisma.js';
import { ProductPrisma } from './product.prisma.js';

// On update an omitted field keeps the current value and `null` clears
// `parentId` (making the category a root), `description` and `imageUrl`.
export type SaveCategoryBody = {
  name: string;
  slug?: string | null;
  description?: string | null;
  parentId?: string | null;
  order?: number | null;
  isHighlighted?: boolean | null;
  imageUrl?: string | null;
  isActive?: boolean | null;
};

const NOT_FOUND_CODES: string[] = [
  CategoryErrors.CATEGORY_NOT_FOUND,
  CategoryErrors.PARENT_CATEGORY_NOT_FOUND,
];

const CONFLICT_CODES: string[] = [
  CategoryErrors.CATEGORY_SLUG_ALREADY_EXISTS,
  CategoryErrors.CATEGORY_HAS_CHILDREN,
  CategoryErrors.CATEGORY_HAS_PRODUCTS,
];

@Controller('categories')
@AdminOnly()
export class CategoryController {
  constructor(
    private readonly categoryPrisma: CategoryPrisma,
    private readonly productPrisma: ProductPrisma,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: SaveCategoryBody): Promise<CategoryDTO> {
    const useCase = new SaveCategory(this.categoryPrisma);

    // No `id`: the use case generates one, so an `id` in the body is discarded.
    const result = await useCase.execute(this.toInput(body));

    if (result.isFailure) this.throwFailure(result.errors);
    return this.respondWith(result.instance.id);
  }

  @Get()
  async findAll(@Query('isActive') isActive?: string): Promise<CategoryDTO[]> {
    const filter: CategoryFiltersDTO = {};
    // Any value other than exactly "true" or "false" is ignored.
    if (isActive === 'true' || isActive === 'false') {
      filter.isActive = isActive === 'true';
    }

    const result = await this.categoryPrisma.findCategories.execute(filter);

    if (result.isFailure) this.throwFailure(result.errors);
    return result.instance;
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<CategoryDTO> {
    return this.respondWith(id);
  }

  @Put(':id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body() body: SaveCategoryBody,
  ): Promise<CategoryDTO> {
    const useCase = new SaveCategory(this.categoryPrisma);

    // The route id wins: an `id` in the body is discarded.
    const result = await useCase.execute({ ...this.toInput(body), id });

    if (result.isFailure) this.throwFailure(result.errors);
    return this.respondWith(result.instance.id);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    // Children block first (CATEGORY_HAS_CHILDREN), then live products (CATEGORY_HAS_PRODUCTS).
    const useCase = new DeleteCategory(this.categoryPrisma, this.productPrisma);

    const result = await useCase.execute({ id });

    if (result.isFailure) this.throwFailure(result.errors);
  }

  // The use case returns only the id; `level` and `path` come from the query.
  private async respondWith(id: string): Promise<CategoryDTO> {
    const result = await this.categoryPrisma.findCategoryById.execute(id);

    if (result.isFailure) this.throwFailure(result.errors);
    if (!result.instance) {
      throw new NotFoundException([CategoryErrors.CATEGORY_NOT_FOUND]);
    }
    return result.instance;
  }

  // Only these fields reach the use case; `undefined` and `null` are preserved.
  private toInput(body: SaveCategoryBody): SaveCategoryInput {
    return {
      name: body?.name,
      slug: body?.slug,
      description: body?.description,
      parentId: body?.parentId,
      order: body?.order,
      isHighlighted: body?.isHighlighted,
      imageUrl: body?.imageUrl,
      isActive: body?.isActive,
    };
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
