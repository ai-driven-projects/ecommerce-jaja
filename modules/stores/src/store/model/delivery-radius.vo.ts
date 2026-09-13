import {
  Result,
  ValueObject,
  ValueObjectConfig,
  resolveVoConfig,
} from '@mentoria-360/shared'
import {
  STORE_MAX_DELIVERY_RADIUS_METERS,
  STORE_MIN_DELIVERY_RADIUS_METERS,
  StoreErrors,
} from '../errors'

// Delivery radius in meters, in a straight line from the store point: an
// integer from 300 to 10,000.
export class DeliveryRadius extends ValueObject<number, ValueObjectConfig> {
  private constructor(value: number, config?: ValueObjectConfig) {
    super(value, config)
  }

  static create(value: number, config?: ValueObjectConfig): DeliveryRadius {
    const result = DeliveryRadius.tryCreate(value, config)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(
    value: number,
    config?: ValueObjectConfig,
  ): Result<DeliveryRadius> {
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < STORE_MIN_DELIVERY_RADIUS_METERS ||
      value > STORE_MAX_DELIVERY_RADIUS_METERS
    ) {
      return Result.fail(StoreErrors.DELIVERY_RADIUS_INVALID)
    }

    return Result.ok(new DeliveryRadius(value, resolveVoConfig(config)))
  }
}
