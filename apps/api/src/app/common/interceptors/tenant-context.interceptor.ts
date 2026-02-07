import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userTenantId = request.user?.tenantId;

    // Only trust x-tenant-id header when ALLOW_TENANT_HEADER is explicitly enabled
    const headerTenantId =
      process.env['ALLOW_TENANT_HEADER'] === 'true'
        ? request.headers?.['x-tenant-id']
        : undefined;

    const tenantId = userTenantId || headerTenantId;

    const isUuid = (value: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    if (tenantId && isUuid(tenantId)) {
      this.cls.set('tenantId', tenantId);
    }

    return next.handle();
  }
}
