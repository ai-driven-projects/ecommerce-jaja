import {
  Result,
  ValueObject,
  ValueObjectConfig,
  resolveVoConfig,
} from '@mentoria-360/shared'
import { CustomerErrors } from '../errors'

// Codes of the 27 Brazilian federative units, in alphabetical order.
export const BRAZILIAN_STATE_CODES = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const

export type BrazilianStateCode = (typeof BRAZILIAN_STATE_CODES)[number]

// Code of a Brazilian federative unit: accepts lowercase (trimmed) and keeps it
// uppercase. Codes outside the list fail with `CUSTOMER_STATE_INVALID`.
export class StateCode extends ValueObject<
  BrazilianStateCode,
  ValueObjectConfig
> {
  private static readonly CODES: ReadonlySet<string> = new Set(
    BRAZILIAN_STATE_CODES,
  )

  private constructor(value: BrazilianStateCode, config?: ValueObjectConfig) {
    super(value, config)
  }

  static create(value: string, config?: ValueObjectConfig): StateCode {
    const result = StateCode.tryCreate(value, config)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(
    value: string,
    config?: ValueObjectConfig,
  ): Result<StateCode> {
    if (typeof value !== 'string') {
      return Result.fail(CustomerErrors.CUSTOMER_STATE_INVALID)
    }

    const code = value.trim().toUpperCase()
    if (!StateCode.CODES.has(code)) {
      return Result.fail(CustomerErrors.CUSTOMER_STATE_INVALID)
    }

    return Result.ok(
      new StateCode(code as BrazilianStateCode, resolveVoConfig(config)),
    )
  }
}
