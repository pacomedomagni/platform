import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import * as Sentry from '@sentry/nestjs';
import { Request } from 'express';

interface RequestWithContext extends Request {
  tenantId?: string;
  user?: { id?: string; email?: string };
}

/**
 * Interceptor that adds request context to Sentry for better error tracking
 */
@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    
    // Set Sentry context for this request
    Sentry.withScope((scope) => {
      // Set request tags
      scope.setTag('request.url', request.url);
      scope.setTag('request.method', request.method);
      
      // Set tenant context
      if (request.tenantId) {
        scope.setTag('tenant_id', request.tenantId);
      }
      
      // Set user context
      if (request.user) {
        scope.setUser({
          id: request.user.id,
          email: request.user.email,
        });
      }
      
      // Add breadcrumb for the request
      Sentry.addBreadcrumb({
        category: 'http',
        message: `${request.method} ${request.url}`,
        level: 'info',
        data: {
          method: request.method,
          url: request.url,
          tenantId: request.tenantId,
        },
      });
    });
    
    return next.handle();
  }
}
