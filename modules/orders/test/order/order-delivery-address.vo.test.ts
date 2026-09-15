import {
  OrderDeliveryAddress,
  OrderDeliveryAddressProps,
  OrderErrors,
} from '../../src/order'

function props(
  overrides: Partial<OrderDeliveryAddressProps> = {},
): OrderDeliveryAddressProps {
  return {
    zipCode: '60150160',
    street: 'Rua Silva Paulet',
    number: '1200',
    complement: 'Apto 302',
    neighborhood: 'Aldeota',
    city: 'Fortaleza',
    state: 'CE',
    ...overrides,
  }
}

describe('OrderDeliveryAddress', () => {
  test('creates with valid attributes', () => {
    const result = OrderDeliveryAddress.tryCreate(props())

    expect(result.isOk).toBe(true)
    expect(result.instance.zipCode).toBe('60150160')
    expect(result.instance.street).toBe('Rua Silva Paulet')
    expect(result.instance.number).toBe('1200')
    expect(result.instance.complement).toBe('Apto 302')
    expect(result.instance.neighborhood).toBe('Aldeota')
    expect(result.instance.city).toBe('Fortaleza')
    expect(result.instance.state).toBe('CE')
  })

  test('trims every text', () => {
    const address = OrderDeliveryAddress.create(
      props({
        zipCode: ' 60150160 ',
        street: '  Rua Silva Paulet ',
        complement: ' Apto 302 ',
        state: ' CE ',
      }),
    )

    expect(address.zipCode).toBe('60150160')
    expect(address.street).toBe('Rua Silva Paulet')
    expect(address.complement).toBe('Apto 302')
    expect(address.state).toBe('CE')
  })

  test.each([
    'zipCode',
    'street',
    'number',
    'neighborhood',
    'city',
    'state',
  ] as const)(
    'fails with ORDER_DELIVERY_ADDRESS_INVALID for a blank %s',
    (field) => {
      for (const value of ['', '   ', undefined, null]) {
        const result = OrderDeliveryAddress.tryCreate(
          props({ [field]: value as unknown as string }),
        )

        expect(result.errors).toEqual([
          OrderErrors.ORDER_DELIVERY_ADDRESS_INVALID,
        ])
      }
    },
  )

  test.each(['6015016', '601501600', '60150-160', 'abcdefgh'])(
    'fails with ORDER_DELIVERY_ADDRESS_INVALID for the zipCode %p',
    (zipCode) => {
      expect(OrderDeliveryAddress.tryCreate(props({ zipCode })).errors).toEqual(
        [OrderErrors.ORDER_DELIVERY_ADDRESS_INVALID],
      )
    },
  )

  test.each(['C', 'CEA', 'ce', 'C1'])(
    'fails with ORDER_DELIVERY_ADDRESS_INVALID for the state %p',
    (state) => {
      expect(OrderDeliveryAddress.tryCreate(props({ state })).errors).toEqual([
        OrderErrors.ORDER_DELIVERY_ADDRESS_INVALID,
      ])
    },
  )

  test.each([undefined, null, '', '   '])(
    'resolves the complement %p to null',
    (complement) => {
      const address = OrderDeliveryAddress.create(
        props({ complement: complement as unknown as string }),
      )

      expect(address.complement).toBeNull()
      expect(address.toDTO().complement).toBeNull()
    },
  )

  test('fails with ORDER_DELIVERY_ADDRESS_INVALID for a complement that is not text', () => {
    const result = OrderDeliveryAddress.tryCreate(
      props({ complement: 42 as unknown as string }),
    )

    expect(result.errors).toEqual([OrderErrors.ORDER_DELIVERY_ADDRESS_INVALID])
  })

  test('reports the error only once for several invalid fields', () => {
    const result = OrderDeliveryAddress.tryCreate(
      undefined as unknown as OrderDeliveryAddressProps,
    )

    expect(result.errors).toEqual([OrderErrors.ORDER_DELIVERY_ADDRESS_INVALID])
  })

  test('toDTO exposes exactly the normalized fields', () => {
    expect(OrderDeliveryAddress.create(props({ complement: ' ' })).toDTO()).toEqual(
      {
        zipCode: '60150160',
        street: 'Rua Silva Paulet',
        number: '1200',
        complement: null,
        neighborhood: 'Aldeota',
        city: 'Fortaleza',
        state: 'CE',
      },
    )
  })

  test('equals compares every field', () => {
    const address = OrderDeliveryAddress.create(props())

    expect(address.equals(OrderDeliveryAddress.create(props()))).toBe(true)
    expect(
      address.equals(OrderDeliveryAddress.create(props({ number: '1201' }))),
    ).toBe(false)
  })

  test('create throws on invalid props', () => {
    expect(() => OrderDeliveryAddress.create(props({ state: 'X' }))).toThrow()
  })
})
