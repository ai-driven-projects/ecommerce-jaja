// The delivery instructions are the tag of the orders of a run: the order is
// placed by the regular flow of the orders module, without any column of its
// own, and anyone who opens it in the admin sees that it is a test.
export const LOAD_TEST_INSTRUCTIONS_PREFIX = 'Teste de carga · '

// The instructions of every order of the run.
export function loadTestInstructions(runId: string): string {
  return `${LOAD_TEST_INSTRUCTIONS_PREFIX}${runId}`
}
