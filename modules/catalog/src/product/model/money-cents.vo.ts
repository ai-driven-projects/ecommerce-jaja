import {
  OptionalConfig,
  PositiveInteger,
  Result,
  ValueObject,
  ValueObjectConfig,
  resolveVoConfig,
} from '@mentoria-360/shared'
import { ProductErrors } from '../errors'

// Amount of money in cents: an integer greater than or equal to 1.
export class MoneyCents extends ValueObject<number, ValueObjectConfig> {
  private constructor(value: number, config?: ValueObjectConfig) {
    super(value, config)
  }

  static create(value: number, config?: ValueObjectConfig): MoneyCents {
    const result = MoneyCents.tryCreate(value, config)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(
    value: number | null | undefined,
    config: OptionalConfig<ValueObjectConfig>,
  ): Result<MoneyCents | null>
  static tryCreate(value: number, config?: ValueObjectConfig): Result<MoneyCents>
  static tryCreate(
    value: number | null | undefined,
    config?: ValueObjectConfig,
  ): Result<MoneyCents | null> {
    // Only `null`/`undefined` mean "absent": `NaN` is an invalid amount.
    if (config?.optional && value == null) {
      return Result.ok<MoneyCents | null>(null)
    }

    const integer = PositiveInteger.tryCreate(value as number, { min: 1 })
    if (integer.isFailure) return Result.fail(ProductErrors.MONEY_CENTS_INVALID)

    return Result.ok(
      new MoneyCents(integer.instance.value, resolveVoConfig(config)),
    )
  }
}
