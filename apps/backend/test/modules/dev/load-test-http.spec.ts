import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { throwLoadTestFailure, toPlanInput } from '../../../src/modules/dev/load-test-http.js';

describe('toPlanInput', () => {
  it('reads only runId', () => {
    expect(toPlanInput({ runId: 'abc', other: 1 } as never)).toEqual({ runId: 'abc' });
  });

  it.each([undefined, {}, { runId: 42 }, { runId: null }])('turns %p into an empty runId', (body) => {
    expect(toPlanInput(body as never)).toEqual({ runId: '' });
  });
});

describe('throwLoadTestFailure', () => {
  it('throws 400 with each code once', () => {
    try {
      throwLoadTestFailure(['LOAD_TEST_NO_PRODUCTS', 'LOAD_TEST_NO_PRODUCTS']);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: ['LOAD_TEST_NO_PRODUCTS'],
      });
      return;
    }
    throw new Error('should have thrown');
  });
});
