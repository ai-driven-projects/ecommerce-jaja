import { Id, Result, UseCase } from '@mentoria-360/shared'
import { BrandDTO } from '../dto'
import { BrandErrors } from '../errors'
import { Brand } from '../model'
import { BrandRepository } from '../provider'

export interface SaveBrandInput {
  id?: string
  name: string
  slug?: string
  description?: string | null
  logoUrl?: string | null
  isActive?: boolean
}

export class SaveBrand implements UseCase<SaveBrandInput, BrandDTO> {
  constructor(private readonly brandRepository: BrandRepository) {}

  async execute(input: SaveBrandInput): Promise<Result<BrandDTO>> {
    if (!input.id) return this.create(Id.createUUID(), input)

    // Rejects a malformed id before it reaches the repository lookup.
    const id = Id.tryCreate(input.id)
    if (id.isFailure) return id.withFail

    const existing = await this.brandRepository.findById(id.instance.value)
    if (existing.isOk) return this.update(existing.instance, input)

    // Only a real "not found" turns into a creation; any other failure is propagated.
    if (existing.errors.includes(BrandErrors.BRAND_NOT_FOUND)) {
      return this.create(id.instance.value, input)
    }
    return existing.withFail
  }

  private async create(
    id: string,
    input: SaveBrandInput,
  ): Promise<Result<BrandDTO>> {
    const name = normalizeName(input.name)

    const nameAvailable = await this.ensureNameAvailable(name, id)
    if (nameAvailable.isFailure) return nameAvailable.withFail

    const slug = Brand.resolveSlug(input.slug, name)

    const slugAvailable = await this.ensureSlugAvailable(slug, id)
    if (slugAvailable.isFailure) return slugAvailable.withFail

    const brand = Brand.tryCreate({
      id,
      name,
      slug,
      description: input.description,
      logoUrl: input.logoUrl,
      isActive: input.isActive ?? true,
    })
    if (brand.isFailure) return brand.withFail

    const created = await this.brandRepository.create(brand.instance)
    if (created.isFailure) return created.withFail

    return Result.ok(brand.instance.toDTO())
  }

  private async update(
    current: Brand,
    input: SaveBrandInput,
  ): Promise<Result<BrandDTO>> {
    const name = normalizeName(input.name)

    const nameAvailable = await this.ensureNameAvailable(name, current.id)
    if (nameAvailable.isFailure) return nameAvailable.withFail

    // A slug that is not sent keeps the current one, so renaming never breaks URLs.
    const slug = isBlank(input.slug)
      ? current.slug
      : Brand.resolveSlug(input.slug, name)

    const slugAvailable = await this.ensureSlugAvailable(slug, current.id)
    if (slugAvailable.isFailure) return slugAvailable.withFail

    // `cloneWith` ignores `undefined`, which keeps the current value.
    const brand = current.cloneWith({
      name,
      slug,
      description: clearable(input.description),
      logoUrl: clearable(input.logoUrl),
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    if (brand.isFailure) return brand.withFail

    const updated = await this.brandRepository.update(brand.instance)
    if (updated.isFailure) return updated.withFail

    return Result.ok(brand.instance.toDTO())
  }

  private async ensureNameAvailable(
    name: string,
    brandId: string,
  ): Promise<Result<void>> {
    const found = await this.brandRepository.findByName(name)
    if (found.isFailure) return found.withFail
    if (found.instance && found.instance.id !== brandId) {
      return Result.fail(BrandErrors.BRAND_NAME_ALREADY_EXISTS)
    }
    return Result.ok()
  }

  private async ensureSlugAvailable(
    slug: string,
    brandId: string,
  ): Promise<Result<void>> {
    const found = await this.brandRepository.findBySlug(slug)
    if (found.isFailure) return found.withFail
    if (found.instance && found.instance.id !== brandId) {
      return Result.fail(BrandErrors.BRAND_SLUG_ALREADY_EXISTS)
    }
    return Result.ok()
  }
}

// Non-string names become empty so lookups find nothing and `Name` rejects them.
function normalizeName(name: unknown): string {
  return typeof name === 'string' ? name.trim() : ''
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim() === ''
}

// `undefined` keeps the current value; `null` or `''` clears it.
function clearable(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  return value || null
}
