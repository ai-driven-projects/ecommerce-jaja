import { ArgumentsHost, HttpStatus, NotFoundException } from '@nestjs/common';
import { ValidationError } from '@mentoria-360/shared';
import { ApiExceptionFilter } from '../../../src/shared/errors/api-exception.filter.js';
import { ApiErrorResponse } from '../../../src/shared/errors/api-error-response.type.js';

function createHost(url = '/resource') {
  let statusCode: number | undefined;
  let body: ApiErrorResponse | undefined;

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: ApiErrorResponse) {
      body = payload;
      return this;
    },
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  it('maps ValidationError from @mentoria-360/shared to its status and codes', () => {
    const ctx = createHost('/users');
    const error = new ValidationError(
      [{ code: 'NAME_TOO_SHORT' }, { code: 'INVALID_EMAIL' }],
      422,
    );

    filter.catch(error, ctx.host);

    expect(ctx.statusCode).toBe(422);
    expect(ctx.body).toMatchObject({
      statusCode: 422,
      error: 'Validation Error',
      message: ['NAME_TOO_SHORT,INVALID_EMAIL'],
      details: [{ code: 'NAME_TOO_SHORT' }, { code: 'INVALID_EMAIL' }],
      path: '/users',
    });
    expect(typeof ctx.body?.timestamp).toBe('string');
  });

  it('preserves HttpException status and always returns message as string[]', () => {
    const ctx = createHost();

    filter.catch(new NotFoundException('Store not found'), ctx.host);

    expect(ctx.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(ctx.body?.error).toBe('NotFoundException');
    expect(ctx.body?.message).toEqual(['Store not found']);
  });

  it('returns 500 without leaking details for unexpected errors', () => {
    const ctx = createHost();

    filter.catch(new Error('database exploded'), ctx.host);

    expect(ctx.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(ctx.body?.message).toEqual([
      'An unexpected error occurred. Please try again later.',
    ]);
    expect(JSON.stringify(ctx.body)).not.toContain('database exploded');
  });
});
