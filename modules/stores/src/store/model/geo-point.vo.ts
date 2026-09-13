import {
  Result,
  ValueObject,
  ValueObjectConfig,
  resolveVoConfig,
} from '@mentoria-360/shared'
import { StoreErrors } from '../errors'

export interface GeoPointProps {
  latitude: number
  longitude: number
}

// A point on the map in decimal degrees (WGS 84). Both coordinates are rounded
// to 6 decimal places (about 11 cm), so the same value comes back from storage.
export class GeoPoint extends ValueObject<GeoPointProps, ValueObjectConfig> {
  static readonly MAX_LATITUDE = 90
  static readonly MAX_LONGITUDE = 180
  static readonly DECIMAL_PLACES = 6

  private constructor(value: GeoPointProps, config?: ValueObjectConfig) {
    super(Object.freeze({ ...value }), config)
  }

  static create(props: GeoPointProps, config?: ValueObjectConfig): GeoPoint {
    const result = GeoPoint.tryCreate(props, config)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(
    props: GeoPointProps,
    config?: ValueObjectConfig,
  ): Result<GeoPoint> {
    const input: Partial<GeoPointProps> = props ?? {}
    const latitude = GeoPoint.coordinate(
      input.latitude,
      GeoPoint.MAX_LATITUDE,
      StoreErrors.GEO_POINT_LATITUDE_INVALID,
    )
    const longitude = GeoPoint.coordinate(
      input.longitude,
      GeoPoint.MAX_LONGITUDE,
      StoreErrors.GEO_POINT_LONGITUDE_INVALID,
    )

    const attrs = Result.combine([latitude, longitude])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    return Result.ok(
      new GeoPoint(
        { latitude: latitude.instance, longitude: longitude.instance },
        resolveVoConfig(config),
      ),
    )
  }

  // Rounds a coordinate to 6 decimal places; `-0` becomes `0`.
  static round(value: number): number {
    const factor = 10 ** GeoPoint.DECIMAL_PLACES
    const rounded = Math.round(value * factor) / factor
    return rounded === 0 ? 0 : rounded
  }

  // Only finite numbers from `-limit` to `limit`. The range is checked on the
  // value as sent, before rounding.
  private static coordinate(
    value: unknown,
    limit: number,
    errorCode: string,
  ): Result<number> {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      Math.abs(value) > limit
    ) {
      return Result.fail(errorCode)
    }
    return Result.ok(GeoPoint.round(value))
  }

  get latitude(): number {
    return this.value.latitude
  }

  get longitude(): number {
    return this.value.longitude
  }

  equals(other: GeoPoint): boolean {
    return (
      this.latitude === other.latitude && this.longitude === other.longitude
    )
  }

  toProps(): GeoPointProps {
    return { ...this.value }
  }
}
