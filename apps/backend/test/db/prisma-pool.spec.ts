import { describe, expect, it } from 'vitest';
import { DEFAULT_DB_POOL_MAX, databasePoolMax } from '../../src/db/prisma.service.js';

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
