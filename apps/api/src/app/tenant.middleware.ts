import { Injectable, NestMiddleware, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Request, Response, NextFunction } from 'express';

/**
 * Parameter decorator to extract tenantId from the request
 */
export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // First try to get from user (set by AuthGuard/JWT)
    if (request.user?.tenantId) {
      return request.user.tenantId;
    }
    // Fallback to header for dev mode
    if (process.env.ALLOW_TENANT_HEADER === 'true') {
      const headerTenantId = request.headers['x-tenant-id'];
      if (headerTenantId) return headerTenantId;
    }
    return '';
  },
);

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(private readonly cls: ClsService) {}

    use(req: Request, res: Response, next: NextFunction) {
        const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        // Allow explicit tenant header for local/dev only
        const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
        const tenantId =
          process.env.ALLOW_TENANT_HEADER === 'true' && headerTenantId
            ? headerTenantId
            : undefined;

        if (tenantId && isUuid(tenantId)) {
            this.cls.set('tenantId', tenantId);
        }
        next();
    }
}
