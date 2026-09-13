import {
  Alias,
  Entity,
  EntityProps,
  Flag,
  Id,
  Name,
  Phone,
  Result,
  Text,
} from '@mentoria-360/shared'
import { StoreDTO } from '../dto'
import { STORE_DEFAULT_DELIVERY_RADIUS_METERS } from '../errors'
import { DeliveryRadius } from './delivery-radius.vo'
import { GeoPoint } from './geo-point.vo'

export interface StoreProps extends EntityProps {
  name: string
  slug?: string | null
  phone?: string | null
  address?: string | null
  latitude: number
  longitude: number
  deliveryRadiusMeters?: number
  isActive?: boolean
}

// A fast-delivery store: a point on the map and a delivery radius in meters. The
// entity does not check whether the point is near the reference address (there
// is no geocoding in the domain), and radii of different stores may overlap.
// Rules that depend on the repository (unique name and slug) live in the use cases.
export class Store extends Entity<Store, StoreProps> {
  private constructor(props: StoreProps) {
    super(props)
  }

  static create(props: StoreProps): Store {
    const result = Store.tryCreate(props)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(props: StoreProps): Result<Store> {
    const id = Id.tryCreate(props.id)
    const name = Name.tryCreate(props.name)
    const slug = Alias.tryCreate(Store.resolveSlug(props.slug, props.name))
    const phone = Phone.tryCreate(props.phone, { optional: true })
    const address = Text.tryCreate(props.address, {
      optional: true,
      maxLength: 200,
    })
    const location = GeoPoint.tryCreate({
      latitude: props.latitude,
      longitude: props.longitude,
    })
    const deliveryRadiusMeters = DeliveryRadius.tryCreate(
      props.deliveryRadiusMeters ?? STORE_DEFAULT_DELIVERY_RADIUS_METERS,
    )
    const isActive = Flag.tryCreate(props.isActive ?? true)

    const attrs = Result.combine([
      id,
      name,
      slug,
      phone,
      address,
      location,
      deliveryRadiusMeters,
      isActive,
    ])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    return Result.ok(
      new Store({
        ...props,
        id: id.instance.value,
        name: name.instance.value,
        slug: slug.instance.value,
        phone: phone.instance?.value ?? null,
        address: address.instance?.value ?? null,
        latitude: location.instance.latitude,
        longitude: location.instance.longitude,
        deliveryRadiusMeters: deliveryRadiusMeters.instance.value,
        isActive: isActive.instance.value,
      }),
    )
  }

  // A missing or blank slug is derived from the name. `Alias` lowercases the
  // value before validating it, so lowercasing here yields exactly what is stored.
  static resolveSlug(slug: string | null | undefined, name: string): string {
    if (typeof slug === 'string' && slug.trim()) return slug.toLowerCase()
    return Alias.format(name)
  }

  get name(): string {
    return this.props.name
  }

  get slug(): string {
    return this.props.slug!
  }

  // Only the digits.
  get phone(): string | null {
    return this.props.phone ?? null
  }

  get address(): string | null {
    return this.props.address ?? null
  }

  get latitude(): number {
    return this.props.latitude
  }

  get longitude(): number {
    return this.props.longitude
  }

  get deliveryRadiusMeters(): number {
    return this.props.deliveryRadiusMeters ?? STORE_DEFAULT_DELIVERY_RADIUS_METERS
  }

  get isActive(): boolean {
    return this.props.isActive === true
  }

  toDTO(): StoreDTO {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      phone: this.phone,
      address: this.address,
      latitude: this.latitude,
      longitude: this.longitude,
      deliveryRadiusMeters: this.deliveryRadiusMeters,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
