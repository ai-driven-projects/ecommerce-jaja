import { describe, expect, it } from 'vitest';
import {
  brokerAddress,
  redactCredentials,
} from '../../../src/messaging/rabbitmq/rabbitmq-url.util.js';

describe('RabbitMQ URL helpers', () => {
  it('identifies an amqp broker by host and port, 5672 by default', () => {
    expect(brokerAddress('amqp://jaja:jaja@localhost:5999')).toBe('localhost:5999');
    expect(brokerAddress('amqp://jaja:jaja@localhost')).toBe('localhost:5672');
  });

  it('identifies an amqps broker by host and port, 5671 by default', () => {
    expect(
      brokerAddress('amqps://usuario:s3nh4@b-1234.mq.sa-east-1.amazonaws.com:5671'),
    ).toBe('b-1234.mq.sa-east-1.amazonaws.com:5671');
    expect(brokerAddress('amqps://usuario:s3nh4@broker.exemplo')).toBe('broker.exemplo:5671');
  });

  it('removes the credentials of an amqps URL from a message', () => {
    const url = 'amqps://usuario:s3nh4@broker.exemplo';
    const text = redactCredentials(`connect failed for ${url} (user usuario, pass s3nh4)`, url);

    expect(text).not.toContain('s3nh4');
    expect(text).not.toContain('usuario');
  });
});
