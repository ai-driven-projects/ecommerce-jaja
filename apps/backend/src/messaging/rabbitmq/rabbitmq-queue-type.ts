import type { Options } from 'amqplib';

// Type of the durable queues declared by the adapter (`RABBITMQ_QUEUE_TYPE`):
// - `classic` (default): the queue lives on one node, as in the local broker;
// - `quorum`: replicated on every node of a cluster (e.g. Amazon MQ in cluster
//   mode), so the queue survives the loss of one node.
// The broadcast queues are always classic: a quorum queue cannot be exclusive.
export const RABBITMQ_QUEUE_TYPES = ['classic', 'quorum'] as const;
export type RabbitMqQueueType = (typeof RABBITMQ_QUEUE_TYPES)[number];

export const DEFAULT_RABBITMQ_QUEUE_TYPE: RabbitMqQueueType = 'classic';

// Reads `RABBITMQ_QUEUE_TYPE`. Empty or missing is `classic`; any other value
// is a configuration error that stops the startup.
export function readQueueType(value: string | undefined): RabbitMqQueueType {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return DEFAULT_RABBITMQ_QUEUE_TYPE;
  if ((RABBITMQ_QUEUE_TYPES as readonly string[]).includes(text)) {
    return text as RabbitMqQueueType;
  }
  throw new Error(
    `Invalid RABBITMQ_QUEUE_TYPE "${value}": accepted values are ${RABBITMQ_QUEUE_TYPES.join(' and ')}`,
  );
}

// Options of a durable queue of the given type. The type always goes in
// `x-queue-type`, classic included: a broker may have another default queue
// type (Amazon MQ for RabbitMQ 4.2+ creates quorum queues when it is missing).
// RabbitMQ 4 records `x-queue-type` on queues declared without it, so the
// queues that already exist in a local broker accept this declaration. It
// never changes the type of an existing queue: switching it requires deleting
// the queues first.
export function durableQueueOptions(
  type: RabbitMqQueueType,
  args: Record<string, unknown> = {},
): Options.AssertQueue {
  return { durable: true, arguments: { ...args, 'x-queue-type': type } };
}

// Options of a broadcast queue: per connection, deleted with it, and always
// classic (a quorum queue cannot be exclusive), whatever the default type of
// the broker.
export const BROADCAST_QUEUE_OPTIONS: Options.AssertQueue = {
  durable: false,
  exclusive: true,
  autoDelete: true,
  arguments: { 'x-queue-type': 'classic' },
};
