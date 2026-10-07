import { Result } from '@mentoria-360/shared'
import { LoadTestRunDTO } from '../dto'

/**
 * Every order (not deleted) whose delivery instructions are exactly
 * `loadTestInstructions(runId)`, from the oldest to the newest. A run without
 * orders (or a malformed `runId`) resolves to `total: 0`, `byStatus: {}` and
 * `orders: []`.
 */
export interface FindLoadTestRunQuery {
  execute(runId: string): Promise<Result<LoadTestRunDTO>>
}
