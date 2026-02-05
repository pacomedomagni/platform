import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

interface RequestWithContext extends Request {
  tenantId?: string;
  user?: { id?: string };
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<RequestWithContext>();
    const response = ctx.getResponse<Response>();
    
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const tenantId = request.tenantId || 'unknown';
    const userId = request.user?.id || 'anonymous';
    
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const { statusCode } = response;
          
          // Skip logging for health checks to reduce noise
          if (url.startsWith('/api/health')) {
            return;
          }

          this.logger.log(
            `${method} ${url} ${statusCode} ${duration}ms - tenant:${tenantId} user:${userId} ip:${ip} ua:${userAgent.substring(0, 50)}`
          );
        },
        error: (error) => {
          const duration = Date.now() - start;
          const statusCode = error.status || 500;
          
          this.logger.error(
            `${method} ${url} ${statusCode} ${duration}ms - tenant:${tenantId} user:${userId} ip:${ip} - ${error.message}`
          );
        },
      }),
    );
  }
}
