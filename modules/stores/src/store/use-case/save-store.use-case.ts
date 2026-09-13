import { Id, Result, UseCase } from '@mentoria-360/shared'
import { StoreDTO } from '../dto'
import { STORE_DEFAULT_DELIVERY_RADIUS_METERS, StoreErrors } from '../errors'
import { Store } from '../model'
import { StoreRepository } from '../provider'

export interface SaveStoreInput {
  id?: string
  name: string
  slug?: string
  phone?: string | null
  address?: string | null
  latitude: number
  longitude: number
  deliveryRadiusMeters?: number
  isActive?: boolean
}

export class SaveStore implements UseCase<SaveStoreInput, StoreDTO> {
  constructor(private readonly storeRepository: StoreRepository) {}

  async execute(input: SaveStoreInput): Promise<Result<StoreDTO>> {
    if (!input.id) return this.create(Id.createUUID(), input)

    // Rejects a malformed id before it reaches the repository lookup.
    const id = Id.tryCreate(input.id)
    if (id.isFailure) return id.withFail

    const existing = await this.storeRepository.findById(id.instance.value)
    if (existing.isOk) return this.update(existing.instance, input)

    // Only a real "not found" turns into a creation; any other failure is propagated.
    if (existing.errors.includes(StoreErrors.STORE_NOT_FOUND)) {
      return this.create(id.instance.value, input)
    }
    return existing.withFail
  }

  private async create(
    id: string,
    input: SaveStoreInput,
  ): Promise<Result<StoreDTO>> {
    const name = normalizeName(input.name)

    const nameAvailable = await this.ensureNameAvailable(name, id)
    if (nameAvailable.isFailure) return nameAvailable.withFail

    const slug = Store.resolveSlug(input.slug, name)

    const slugAvailable = await this.ensureSlugAvailable(slug, id)
    if (slugAvailable.isFailure) return slugAvailable.withFail

    const store = Store.tryCreate({
      id,
      name,
      slug,
      phone: input.phone,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      deliveryRadiusMeters:
        input.deliveryRadiusMeters ?? STORE_DEFAULT_DELIVERY_RADIUS_METERS,
      isActive: input.isActive ?? true,
    })
    if (store.isFailure) return store.withFail

    const created = await this.storeRepository.create(store.instance)
    if (created.isFailure) return created.withFail

    return Result.ok(store.instance.toDTO())
  }

  private async update(
    current: Store,
    input: SaveStoreInput,
  ): Promise<Result<StoreDTO>> {
    const name = normalizeName(input.name)

    const nameAvailable = await this.ensureNameAvailable(name, current.id)
    if (nameAvailable.isFailure) return nameAvailable.withFail

    // A slug that is not sent keeps the current one, so renaming never breaks URLs.
    const slug = isBlank(input.slug)
      ? current.slug
      : Store.resolveSlug(input.slug, name)

    const slugAvailable = await this.ensureSlugAvailable(slug, current.id)
    if (slugAvailable.isFailure) return slugAvailable.withFail

    // `cloneWith` ignores `undefined`, which keeps the current value.
    const store = current.cloneWith({
      name,
      slug,
      phone: clearable(input.phone),
      address: clearable(input.address),
      latitude: input.latitude,
      longitude: input.longitude,
      deliveryRadiusMeters: input.deliveryRadiusMeters,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    if (store.isFailure) return store.withFail

    const updated = await this.storeRepository.update(store.instance)
    if (updated.isFailure) return updated.withFail

    return Result.ok(store.instance.toDTO())
  }

  private async ensureNameAvailable(
    name: string,
    storeId: string,
  ): Promise<Result<void>> {
    const found = await this.storeRepository.findByName(name)
    if (found.isFailure) return found.withFail
    if (found.instance && found.instance.id !== storeId) {
      return Result.fail(StoreErrors.STORE_NAME_ALREADY_EXISTS)
    }
    return Result.ok()
  }

  private async ensureSlugAvailable(
    slug: string,
    storeId: string,
  ): Promise<Result<void>> {
    const found = await this.storeRepository.findBySlug(slug)
    if (found.isFailure) return found.withFail
    if (found.instance && found.instance.id !== storeId) {
      return Result.fail(StoreErrors.STORE_SLUG_ALREADY_EXISTS)
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
