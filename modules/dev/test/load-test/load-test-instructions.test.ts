import {
  LOAD_TEST_INSTRUCTIONS_PREFIX,
  loadTestInstructions,
} from '../../src/load-test'

describe('loadTestInstructions', () => {
  it('tags the order with the prefix and the run id', () => {
    const runId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8'

    expect(loadTestInstructions(runId)).toBe(`Teste de carga · ${runId}`)
    expect(loadTestInstructions(runId).startsWith(LOAD_TEST_INSTRUCTIONS_PREFIX)).toBe(true)
  })
})
