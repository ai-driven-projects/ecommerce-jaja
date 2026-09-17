import {
  Result,
  ValueObject,
  ValueObjectConfig,
  resolveVoConfig,
} from '@mentoria-360/shared'
import { CustomerLocationDTO } from '../dto'
import { CustomerErrors } from '../errors'

export interface CustomerLocationProps {
  latitude: number
  longitude: number
}

// The point of the customer's address on the map, in decimal degrees (WGS 84).
// It repeats the rules of `GeoPoint` (`@jaja/stores`) without importing the
// stores package: both coordinates are finite numbers within the limits and are
// rounded to 6 decimal places (about 11 cm), with `-0` stored as `0`. For the
// customer the point is a single thing, so any invalid value (missing, not a
// number, `NaN`, `Infinity` or out of range) fails with one code,
// `CUSTOMER_LOCATION_INVALID`.
export class CustomerLocation extends ValueObject<
  CustomerLocationProps,
  ValueObjectConfig
> {
  static readonly MAX_LATITUDE = 90
  static readonly MAX_LONGITUDE = 180
  static readonly DECIMAL_PLACES = 6

  private constructor(value: CustomerLocationProps, config?: ValueObjectConfig) {
    super(Object.freeze({ ...value }), config)
  }

  static create(
    props: CustomerLocationProps,
    config?: ValueObjectConfig,
  ): CustomerLocation {
    const result = CustomerLocation.tryCreate(props, config)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(
    props: CustomerLocationProps,
    config?: ValueObjectConfig,
  ): Result<CustomerLocation> {
    const input: Partial<CustomerLocationProps> =
      props !== null && typeof props === 'object' ? props : {}

    if (
      !CustomerLocation.isCoordinate(input.latitude, CustomerLocation.MAX_LATITUDE) ||
      !CustomerLocation.isCoordinate(input.longitude, CustomerLocation.MAX_LONGITUDE)
    ) {
      return Result.fail(CustomerErrors.CUSTOMER_LOCATION_INVALID)
    }

    return Result.ok(
      new CustomerLocation(
        {
          latitude: CustomerLocation.round(input.latitude),
          longitude: CustomerLocation.round(input.longitude),
        },
        resolveVoConfig(config),
      ),
    )
  }

  // Rounds a coordinate to 6 decimal places; `-0` becomes `0`.
  static round(value: number): number {
    const factor = 10 ** CustomerLocation.DECIMAL_PLACES
    const rounded = Math.round(value * factor) / factor
    return rounded === 0 ? 0 : rounded
  }

  // Only finite numbers from `-limit` to `limit`. The range is checked on the
  // value as sent, before rounding.
  private static isCoordinate(value: unknown, limit: number): value is number {
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      Math.abs(value) <= limit
    )
  }

  get latitude(): number {
    return this.value.latitude
  }

  get longitude(): number {
    return this.value.longitude
  }

  equals(other: CustomerLocation): boolean {
    return (
      this.latitude === other.latitude && this.longitude === other.longitude
    )
  }

  toDTO(): CustomerLocationDTO {
    return { ...this.value }
  }
}
