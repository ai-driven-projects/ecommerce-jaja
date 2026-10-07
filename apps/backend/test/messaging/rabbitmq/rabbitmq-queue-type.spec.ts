import { describe, expect, it } from 'vitest';
import {
  BROADCAST_QUEUE_OPTIONS,
  durableQueueOptions,
  readQueueType,
} from '../../../src/messaging/rabbitmq/rabbitmq-queue-type.js';

describe('RabbitMQ queue type', () => {
  it('reads classic when RABBITMQ_QUEUE_TYPE is missing or empty', () => {
    expect(readQueueType(undefined)).toBe('classic');
    expect(readQueueType('  ')).toBe('classic');
  });

  it('reads classic and quorum, ignoring case and spaces', () => {
    expect(readQueueType('classic')).toBe('classic');
    expect(readQueueType(' Quorum ')).toBe('quorum');
  });

  it('rejects any other value, citing the variable and the accepted values', () => {
    expect(() => readQueueType('stream')).toThrow(
      'Invalid RABBITMQ_QUEUE_TYPE "stream": accepted values are classic and quorum',
    );
  });

  it('declares the classic type explicitly, since a broker may default to quorum', () => {
    expect(durableQueueOptions('classic')).toEqual({
      durable: true,
      arguments: { 'x-queue-type': 'classic' },
    });
    expect(durableQueueOptions('classic', { 'x-dead-letter-exchange': '' })).toEqual({
      durable: true,
      arguments: { 'x-dead-letter-exchange': '', 'x-queue-type': 'classic' },
    });
  });

  it('declares broadcast queues as exclusive classic queues', () => {
    expect(BROADCAST_QUEUE_OPTIONS).toEqual({
      durable: false,
      exclusive: true,
      autoDelete: true,
      arguments: { 'x-queue-type': 'classic' },
    });
  });

  it('adds x-queue-type quorum to the arguments of a quorum queue', () => {
    expect(durableQueueOptions('quorum')).toEqual({
      durable: true,
      arguments: { 'x-queue-type': 'quorum' },
    });
    expect(durableQueueOptions('quorum', { 'x-dead-letter-routing-key': 'q' })).toEqual({
      durable: true,
      arguments: { 'x-dead-letter-routing-key': 'q', 'x-queue-type': 'quorum' },
    });
  });
});
