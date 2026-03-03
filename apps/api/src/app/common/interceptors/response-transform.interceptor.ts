import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    path: string;
  };
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, StandardResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<StandardResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const path = request?.url || '';

    return next.handle().pipe(
      map((data) => ({
        data: data ?? null,
        meta: {
          timestamp: new Date().toISOString(),
          path,
        },
      })),
    );
  }
}
