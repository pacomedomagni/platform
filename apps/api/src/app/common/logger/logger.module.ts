import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

/**
 * Production-ready logging module using Pino
 * 
 * Features:
 * - JSON structured logs in production (for Loki/Promtail)
 * - Pretty printed logs in development
 * - Request ID tracing
 * - Tenant and user context in all logs
 * - Automatic redaction of sensitive fields
 */
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        // Use JSON in production, pretty print in development
        transport: process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: false,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            }
          : undefined,

        // Log level based on environment
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

        // Generate unique request ID
        genReqId: (req) => {
          return req.headers['x-request-id'] as string || crypto.randomUUID();
        },

        // Customize serializers for request/response
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            // Don't log sensitive headers
            headers: {
              'user-agent': req.headers['user-agent'],
              'content-type': req.headers['content-type'],
              'x-forwarded-for': req.headers['x-forwarded-for'],
              host: req.headers.host,
            },
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },

        // Redact sensitive data from logs
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.newPassword',
            'req.body.currentPassword',
            'req.body.token',
            'req.body.refreshToken',
            'req.body.accessToken',
            'req.body.apiKey',
            'req.body.secretKey',
            'req.body.cardNumber',
            'req.body.cvv',
            'req.body.cvc',
            '*.password',
            '*.secret',
            '*.token',
            '*.apiKey',
          ],
          censor: '[REDACTED]',
        },

        // Custom log attributes
        customProps: (req) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const request = req as any;
          return {
            tenantId: request.tenantId || request['resolvedTenantId'] || 'unknown',
            userId: request.user?.id || request.user?.sub || 'anonymous',
            service: 'platform-api',
            environment: process.env.NODE_ENV || 'development',
          };
        },

        // Custom success message
        customSuccessMessage: (req) => {
          return `${req.method} ${req.url} completed`;
        },

        // Custom error message
        customErrorMessage: (req, res, error) => {
          return `${req.method} ${req.url} failed: ${error.message}`;
        },

        // Don't log health check endpoints
        autoLogging: {
          ignore: (req) => {
            const url = req.url || '';
            return url.includes('/health') || url.includes('/ready') || url.includes('/live');
          },
        },
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
