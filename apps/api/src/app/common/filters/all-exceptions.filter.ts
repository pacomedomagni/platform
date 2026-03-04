import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext('ExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const errorResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const context = {
      statusCode,
      method: request.method,
      url: request.url,
      tenantId: request.tenantId || 'unknown',
      userId: request.user?.id || 'anonymous',
      requestId: request.id || request.headers['x-request-id'] || 'unknown',
      errorClass: exception?.constructor?.name || 'UnknownError',
    };

    if (statusCode >= 500) {
      this.logger.error(
        {
          ...context,
          err: exception instanceof Error ? exception : undefined,
        },
        `${request.method} ${request.url} ${statusCode} - ${message}`,
      );
    } else {
      this.logger.warn(context, `${request.method} ${request.url} ${statusCode} - ${message}`);
    }

    // Never leak internal details to client
    const clientResponse =
      statusCode >= 500
        ? {
            statusCode,
            message: 'Internal server error',
            error: 'Internal Server Error',
          }
        : typeof errorResponse === 'object' && errorResponse !== null
          ? errorResponse
          : { statusCode, message };

    response.status(statusCode).json(clientResponse);
  }
}
