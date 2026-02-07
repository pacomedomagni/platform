import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Priority 1: JWT user's tenantId (most trusted)
    const userTenantId = request.user?.tenantId;

    // Priority 2: Already resolved by TenantMiddleware (Host header → UUID)
    const resolvedTenantId = request['resolvedTenantId'];

    // Priority 3: Explicit header in dev mode
    const headerTenantId =
      process.env['ALLOW_TENANT_HEADER'] === 'true'
        ? request.headers?.['x-tenant-id']
        : undefined;

    const tenantId = userTenantId || resolvedTenantId || headerTenantId;

    const isUuid = (value: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    if (tenantId && isUuid(tenantId)) {
      this.cls.set('tenantId', tenantId);
    }

    return next.handle();
  }
}
