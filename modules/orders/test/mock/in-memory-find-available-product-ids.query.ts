import { Result } from '@mentoria-360/shared'
import { FindAvailableProductIdsQuery } from '../../src/cart'

// Availability configured by the test: only the ids in the set are available.
// Every call is counted and its argument recorded.
export class InMemoryFindAvailableProductIdsQuery
  implements FindAvailableProductIdsQuery
{
  private available: Set<string>
  readonly calls: string[][] = []

  constructor(availableIds: string[] = []) {
    this.available = new Set(availableIds)
  }

  get callCount(): number {
    return this.calls.length
  }

  setAvailable(availableIds: string[]): void {
    this.available = new Set(availableIds)
  }

  async execute(productIds: string[]): Promise<Result<string[]>> {
    this.calls.push([...productIds])
    const ids = [...new Set(productIds)]
    return Result.ok(ids.filter((id) => this.available.has(id)))
  }
}
