import { Injectable, NestMiddleware, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Request, Response, NextFunction } from 'express';
import { DomainResolverService } from './storefront/domain-resolver/domain-resolver.service';

const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

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
    // Try CLS context (set by TenantMiddleware — resolves Host header to UUID)
    const clsTenantId = request['resolvedTenantId'];
    if (clsTenantId && isUuid(clsTenantId)) {
      return clsTenantId;
    }
    // Fallback to header for dev mode
    if (process.env.ALLOW_TENANT_HEADER === 'true') {
      const headerTenantId = request.headers['x-tenant-id'];
      if (headerTenantId && isUuid(headerTenantId as string)) return headerTenantId as string;
    }
    return '';
  },
);

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly cls: ClsService,
    private readonly domainResolver: DomainResolverService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let tenantId: string | undefined;

    // Priority 1: Explicit x-tenant-id header with valid UUID (authenticated requests or dev mode)
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    if (headerTenantId && isUuid(headerTenantId)) {
      tenantId = headerTenantId;
    }

    // Priority 2: Resolve from Host header (storefront requests via subdomain or custom domain)
    if (!tenantId) {
      const host = req.headers['host']?.split(':')[0]; // strip port
      if (host) {
        try {
          const resolved = await this.domainResolver.resolve(host);
          if (resolved) {
            tenantId = resolved.tenantId;
          }
        } catch {
          // Domain resolution failed — continue without tenant context
        }
      }
    }

    // Priority 3: Non-UUID x-tenant-id header — resolve as subdomain (dev compatibility)
    if (!tenantId && headerTenantId && !isUuid(headerTenantId) && process.env.ALLOW_TENANT_HEADER === 'true') {
      try {
        const platformDomain = process.env['DOMAIN'] || 'noslag.com';
        const resolved = await this.domainResolver.resolve(`${headerTenantId}.${platformDomain}`);
        if (resolved) {
          tenantId = resolved.tenantId;
        }
      } catch {
        // Resolution failed
      }
    }

    if (tenantId) {
      this.cls.set('tenantId', tenantId);
      (req as any)['resolvedTenantId'] = tenantId;
    }

    next();
  }
}
