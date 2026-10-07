import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DB_POOL_MAX,
  DEFAULT_DB_TRANSACTION_MAX_WAIT_MS,
  databasePoolMax,
  transactionMaxWaitMs,
} from '../../src/db/prisma.service.js';

describe('databasePoolMax', () => {
  it.each([
    ['1', 1],
    ['25', 25],
    [' 40 ', 40],
    ['100', 100],
  ])('accepts "%s"', (value, expected) => {
    expect(databasePoolMax(value)).toBe(expected);
  });

  it.each([undefined, '', '  ', '0', '101', '-5', '2.5', 'abc', '1e2'])(
    'falls back to the default for %p',
    (value) => {
      expect(databasePoolMax(value)).toBe(DEFAULT_DB_POOL_MAX);
    },
  );
});

describe('transactionMaxWaitMs', () => {
  it('waits 5 s by default', () => {
    expect(DEFAULT_DB_TRANSACTION_MAX_WAIT_MS).toBe(5_000);
    expect(transactionMaxWaitMs(undefined)).toBe(5_000);
  });

  it.each([
    ['100', 100],
    ['10000', 10_000],
    ['60000', 60_000],
  ])('accepts "%s"', (value, expected) => {
    expect(transactionMaxWaitMs(value)).toBe(expected);
  });

  it.each(['', '99', '60001', '-1', '2.5', 'abc'])('falls back to the default for %p', (value) => {
    expect(transactionMaxWaitMs(value)).toBe(DEFAULT_DB_TRANSACTION_MAX_WAIT_MS);
  });
});
