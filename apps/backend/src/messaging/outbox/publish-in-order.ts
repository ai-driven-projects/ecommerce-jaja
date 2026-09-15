import {
  DomainEvent,
  MessagePublisher,
  domainEventToBrokerMessage,
} from '@mentoria-360/shared';
import { errorMessage } from '../error-message.util.js';

export interface PublishFailure {
  readonly id: string;
  readonly error: string;
}

export interface PublishInOrderResult {
  readonly publishedIds: string[];
  readonly failure: PublishFailure | null;
}

// Publishes one event at a time, in the given order, with the event type as
// the routing key. Stops at the first failure (failed `Result` or exception)
// without trying the next events, so two events of the same aggregate are
// never published out of order inside a cycle.
export async function publishInOrder(
  events: DomainEvent[],
  publisher: MessagePublisher,
): Promise<PublishInOrderResult> {
  const publishedIds: string[] = [];

  for (const event of events) {
    const error = await publishOne(event, publisher);
    if (error !== null) {
      return { publishedIds, failure: { id: event.id, error } };
    }
    publishedIds.push(event.id);
  }

  return { publishedIds, failure: null };
}

// `null` when published; otherwise the error message.
async function publishOne(
  event: DomainEvent,
  publisher: MessagePublisher,
): Promise<string | null> {
  try {
    const result = await publisher.publish({
      message: domainEventToBrokerMessage(event),
      options: { routingKey: event.type },
    });
    return result.isFailure ? result.errors.join(', ') : null;
  } catch (error: unknown) {
    return errorMessage(error);
  }
}
