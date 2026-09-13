import { BRAZILIAN_STATE_CODES, StateCode } from '../../src/customer'

describe('StateCode', () => {
  test('lists the 27 Brazilian federative units', () => {
    expect(BRAZILIAN_STATE_CODES).toHaveLength(27)
    expect(new Set(BRAZILIAN_STATE_CODES).size).toBe(27)
  })

  test.each(BRAZILIAN_STATE_CODES)('accepts %s', (code) => {
    expect(StateCode.tryCreate(code).isOk).toBe(true)
  })

  test('normalizes lowercase to uppercase', () => {
    const result = StateCode.tryCreate('ce')

    expect(result.isOk).toBe(true)
    expect(result.instance.value).toBe('CE')
  })

  test('trims the value', () => {
    expect(StateCode.create(' sp ').value).toBe('SP')
  })

  test.each(['XX', 'C', 'CEA', ''])(
    'fails with CUSTOMER_STATE_INVALID for %p',
    (value) => {
      const result = StateCode.tryCreate(value)

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual(['CUSTOMER_STATE_INVALID'])
    },
  )

  test('fails with CUSTOMER_STATE_INVALID for a non-string value', () => {
    const result = StateCode.tryCreate(null as unknown as string)

    expect(result.errors).toEqual(['CUSTOMER_STATE_INVALID'])
  })

  test('create throws on an invalid value', () => {
    expect(() => StateCode.create('XX')).toThrow()
  })
})
