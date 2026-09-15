import {
  DomainEvent,
  DomainEventRepository,
  Result,
  TransactionContext,
} from '@mentoria-360/shared'

// One `append` call, with the events received and the transaction used.
export interface InMemoryDomainEventAppend {
  events: DomainEvent[]
  tx?: TransactionContext
}

// Stands for the outbox: keeps the appended events and the `tx` of each call.
// `failWith` makes every next `append` fail without keeping the events.
export class InMemoryDomainEventRepository implements DomainEventRepository {
  readonly events: DomainEvent[] = []
  readonly calls: InMemoryDomainEventAppend[] = []
  private failure: string[] | null = null

  failWith(errors: string | string[]): void {
    this.failure = Array.isArray(errors) ? errors : [errors]
  }

  async append(
    events: DomainEvent[],
    tx?: TransactionContext,
  ): Promise<Result<void>> {
    this.calls.push({ events: [...events], tx })
    if (this.failure) return Result.fail(this.failure)

    this.events.push(...events)
    return Result.ok()
  }
}
