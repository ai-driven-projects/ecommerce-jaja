import { describe, expect, it } from 'vitest';
import { errorMessage } from '../../src/messaging/error-message.util.js';

describe('errorMessage', () => {
  it('returns the message of an error', () => {
    expect(errorMessage(new Error('Transaction already closed'))).toBe('Transaction already closed');
  });

  it('joins the reasons of an AggregateError without message', () => {
    const error = new AggregateError(
      [new Error('connect ECONNREFUSED 127.0.0.1:5433'), new Error('connect ECONNREFUSED ::1:5433')],
      '',
    );

    expect(errorMessage(error)).toBe(
      'connect ECONNREFUSED 127.0.0.1:5433; connect ECONNREFUSED ::1:5433',
    );
  });

  it('falls back to the cause of an error without message', () => {
    expect(errorMessage(new Error('', { cause: new Error('socket hang up') }))).toBe('socket hang up');
  });

  it('falls back to name and code when nothing else describes the error', () => {
    expect(errorMessage(Object.assign(new Error(''), { code: 'ECONNRESET' }))).toBe('Error (ECONNRESET)');
  });

  it('converts a thrown value that is not an error', () => {
    expect(errorMessage('boom')).toBe('boom');
  });
});
