import {
  LOAD_TEST_MAX_PRODUCTS_PER_ORDER,
  LOAD_TEST_MAX_QUANTITY,
  SyntheticOrderService,
} from '../../src/load-test'
import { sequenceRandom } from './mock/sequence-random'

const products = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']

describe('SyntheticOrderService', () => {
  describe('pickCustomer', () => {
    it('draws one of the users', () => {
      const service = new SyntheticOrderService(sequenceRandom([0.5]))

      expect(service.pickCustomer(['u1', 'u2', 'u3', 'u4'])).toBe('u3')
    })

    it('answers undefined without users', () => {
      expect(new SyntheticOrderService(sequenceRandom([0.5])).pickCustomer([])).toBeUndefined()
    })

    it('clamps a source outside [0, 1)', () => {
      expect(new SyntheticOrderService(sequenceRandom([1])).pickCustomer(['u1', 'u2'])).toBe('u2')
      expect(new SyntheticOrderService(sequenceRandom([-1])).pickCustomer(['u1', 'u2'])).toBe('u1')
    })
  })

  describe('pickItems', () => {
    it('draws the count, then each product and its quantity', () => {
      // count: 1 + floor(0.5 * 4) = 3; then product/quantity pairs.
      const service = new SyntheticOrderService(
        sequenceRandom([0.5, 0, 0, 0.99, 0.99, 0.4, 0.5]),
      )

      expect(service.pickItems(products)).toEqual([
        { productId: 'p1', quantity: 1 },
        { productId: 'p6', quantity: 3 },
        { productId: 'p3', quantity: 2 },
      ])
    })

    it('never repeats a product', () => {
      const service = new SyntheticOrderService()

      for (let run = 0; run < 200; run++) {
        const ids = service.pickItems(products).map((item) => item.productId)
        expect(new Set(ids).size).toBe(ids.length)
      }
    })

    it('keeps count and quantities inside the limits', () => {
      const service = new SyntheticOrderService()

      for (let run = 0; run < 200; run++) {
        const items = service.pickItems(products)
        expect(items.length).toBeGreaterThanOrEqual(1)
        expect(items.length).toBeLessThanOrEqual(LOAD_TEST_MAX_PRODUCTS_PER_ORDER)
        for (const item of items) {
          expect(item.quantity).toBeGreaterThanOrEqual(1)
          expect(item.quantity).toBeLessThanOrEqual(LOAD_TEST_MAX_QUANTITY)
        }
      }
    })

    it('never draws more products than the list has, counting repeated ids once', () => {
      const service = new SyntheticOrderService(sequenceRandom([0.99]))

      expect(service.pickItems(['p1', 'p1', 'p2'])).toEqual([
        { productId: 'p2', quantity: 3 },
        { productId: 'p1', quantity: 3 },
      ])
    })

    it('draws nothing from an empty list', () => {
      expect(new SyntheticOrderService(sequenceRandom([0.5])).pickItems([])).toEqual([])
    })
  })
})
