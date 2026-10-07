import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ValidationError } from '@mentoria-360/shared';
import { ApiErrorResponse } from './api-error-response.type.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this._buildBody(exception, request.url);
    if (body.statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      this._logUnexpected(exception, request);
    }
    response.status(body.statusCode).json(body);
  }

  // The client only gets the generic 500, so the cause goes to the log: method,
  // path, type and message of the error, and the stack. Never the body nor the
  // headers of the request (they may carry personal data and the token).
  private _logUnexpected(exception: unknown, request: Request): void {
    const error = exception instanceof Error ? exception : null;
    const cause = error ? `${error.name}: ${error.message}` : String(exception);
    this.logger.error(`${request.method ?? '?'} ${request.url} → 500: ${cause}`, error?.stack);
  }

  private _buildBody(exception: unknown, path: string): ApiErrorResponse {
    const timestamp = new Date().toISOString();

    if (exception instanceof ValidationError) {
      return {
        statusCode: exception.status ?? HttpStatus.BAD_REQUEST,
        error: 'Validation Error',
        message: [exception.codes],
        details: exception.messages,
        path,
        timestamp,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const raw =
        typeof payload === 'string'
          ? payload
          : ((payload as any).message ?? exception.message);
      const message: string[] = Array.isArray(raw) ? raw : [raw];

      return {
        statusCode: status,
        error: exception.name,
        message,
        path,
        timestamp,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Error',
      message: ['An unexpected error occurred. Please try again later.'],
      path,
      timestamp,
    };
  }
}
