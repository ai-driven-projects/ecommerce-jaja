import { Result } from '@mentoria-360/shared'
import { FindLoadTestPoolQuery, LoadTestPoolDTO } from '../../../src/load-test'

// The pool configured by the test; `fail` makes the next calls fail. Counts
// the calls.
export class InMemoryFindLoadTestPoolQuery implements FindLoadTestPoolQuery {
  calls = 0
  private failure: string | null = null

  constructor(private pool: LoadTestPoolDTO) {}

  fail(code: string): void {
    this.failure = code
  }

  async execute(): Promise<Result<LoadTestPoolDTO>> {
    this.calls++
    if (this.failure) return Result.fail(this.failure)
    return Result.ok(structuredClone(this.pool))
  }
}
