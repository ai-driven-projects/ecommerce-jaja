import {
  LoadTestErrors,
  PlanLoadTestOrder,
  SyntheticOrderService,
  loadTestInstructions,
} from '../../src/load-test'
import { InMemoryFindLoadTestPoolQuery } from './mock/in-memory-find-load-test-pool.query'
import { sequenceRandom } from './mock/sequence-random'

const runId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8'
const productA = '550e8400-e29b-41d4-a716-446655440000'
const productB = '11111111-2222-4333-8444-555555555555'
const userA = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const userB = '22222222-3333-4444-8555-666666666666'

function setup(pool = { productIds: [productA, productB], customerUserIds: [userA, userB] }) {
  const findPool = new InMemoryFindLoadTestPoolQuery(pool)
  // count 1, productB with quantity 2, then userB.
  const service = new SyntheticOrderService(sequenceRandom([0, 0.9, 0.5, 0.9]))
  return { findPool, useCase: new PlanLoadTestOrder(findPool, service) }
}

describe('PlanLoadTestOrder', () => {
  it('plans the order with a drawn customer, items and the tag of the run', async () => {
    const { useCase } = setup()

    const result = await useCase.execute({ runId })

    expect(result.isOk).toBe(true)
    expect(result.instance).toEqual({
      runId,
      customerUserId: userB,
      items: [{ productId: productB, quantity: 2 }],
      deliveryInstructions: loadTestInstructions(runId),
    })
  })

  it('normalizes the run id', async () => {
    const { useCase } = setup()

    const result = await useCase.execute({ runId: ` ${runId.toUpperCase()} ` })

    expect(result.instance.runId).toBe(runId)
  })

  it.each([undefined, '', 'abc', 42])('fails with LOAD_TEST_RUN_ID_INVALID for %p, without reading the pool', async (value) => {
    const { useCase, findPool } = setup()

    const result = await useCase.execute({ runId: value as string })

    expect(result.errors).toEqual([LoadTestErrors.LOAD_TEST_RUN_ID_INVALID])
    expect(findPool.calls).toBe(0)
  })

  it('fails with LOAD_TEST_NO_PRODUCTS without visible products', async () => {
    const { useCase } = setup({ productIds: [], customerUserIds: [userA] })

    expect((await useCase.execute({ runId })).errors).toEqual([LoadTestErrors.LOAD_TEST_NO_PRODUCTS])
  })

  it('fails with LOAD_TEST_NO_CUSTOMERS without active customers', async () => {
    const { useCase } = setup({ productIds: [productA], customerUserIds: [] })

    expect((await useCase.execute({ runId })).errors).toEqual([LoadTestErrors.LOAD_TEST_NO_CUSTOMERS])
  })

  it('propagates the failure of the pool', async () => {
    const { useCase, findPool } = setup()
    findPool.fail('DB_DOWN')

    expect((await useCase.execute({ runId })).errors).toEqual(['DB_DOWN'])
  })
})
