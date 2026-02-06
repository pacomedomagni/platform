import { Injectable, NestMiddleware, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Request, Response, NextFunction } from 'express';
import { decode } from 'jsonwebtoken';

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
    // Final fallback: decode from token directly
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payload: any = decode(token);
        if (payload?.tenant_id || payload?.tenantId) {
          return payload.tenant_id || payload.tenantId;
        }
      } catch {
        // ignore
      }
    }
    return '';
  },
);

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(private readonly cls: ClsService) {}

    use(req: Request, res: Response, next: NextFunction) {
        const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        // Strategy 1 (preferred): Extract from JWT (token wins over any header)
        let tenantId: string | undefined;
        const authHeader = req.headers.authorization;
        if (!tenantId && authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                // Optimistic decode - Verification happens in AuthGuard later
                const payload: any = decode(token);
                if (payload && (payload.tenant_id || payload.tenantId)) {
                    tenantId = payload.tenant_id || payload.tenantId;
                }
            } catch (e) {
                // Ignore invalid tokens here
            }
        }

        // Strategy 2 (optional): Allow explicit tenant header for local/dev only
        const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
        if (!tenantId && process.env.ALLOW_TENANT_HEADER === 'true' && headerTenantId) {
          tenantId = headerTenantId;
        }

        if (tenantId && isUuid(tenantId)) {
            this.cls.set('tenantId', tenantId);
        }
        next();
    }
}
