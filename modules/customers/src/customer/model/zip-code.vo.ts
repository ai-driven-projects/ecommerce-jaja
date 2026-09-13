import {
  Result,
  ValueObject,
  ValueObjectConfig,
  resolveVoConfig,
} from '@mentoria-360/shared'
import { CustomerErrors } from '../errors'

// Brazilian CEP: accepts `60150-160` or `60150160` (trimmed) and keeps the 8
// digits. Any other format fails with `CUSTOMER_ZIP_CODE_INVALID`.
export class ZipCode extends ValueObject<string, ValueObjectConfig> {
  private static readonly PATTERN: RegExp = /^\d{5}-?\d{3}$/
  private static readonly NON_DIGIT: RegExp = /\D/g

  private constructor(value: string, config?: ValueObjectConfig) {
    super(value, config)
  }

  static create(value: string, config?: ValueObjectConfig): ZipCode {
    const result = ZipCode.tryCreate(value, config)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(value: string, config?: ValueObjectConfig): Result<ZipCode> {
    if (typeof value !== 'string') {
      return Result.fail(CustomerErrors.CUSTOMER_ZIP_CODE_INVALID)
    }

    const text = value.trim()
    if (!ZipCode.PATTERN.test(text)) {
      return Result.fail(CustomerErrors.CUSTOMER_ZIP_CODE_INVALID)
    }

    return Result.ok(
      new ZipCode(text.replace(ZipCode.NON_DIGIT, ''), resolveVoConfig(config)),
    )
  }

  // `60150-160`
  get formatted(): string {
    return `${this.value.slice(0, 5)}-${this.value.slice(5)}`
  }
}
