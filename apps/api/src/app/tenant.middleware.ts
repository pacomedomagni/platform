import {
  Injectable,
  Logger,
  NestMiddleware,
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Request, Response, NextFunction } from 'express';
import { DomainResolverService } from './storefront/domain-resolver/domain-resolver.service';

const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

/**
 * Resolve the tenant id from the request. Shared between @Tenant and @OptionalTenant.
 */
function resolveTenantIdFromRequest(request: any): string | undefined {
  // Priority 1: authenticated user
  if (request.user?.tenantId && isUuid(request.user.tenantId)) {
    return request.user.tenantId;
  }
  // Priority 2: TenantMiddleware's host-resolved tenant (CLS-bound)
  const clsTenantId = request['resolvedTenantId'];
  if (clsTenantId && isUuid(clsTenantId)) {
    return clsTenantId;
  }
  // Priority 3: development-only escape hatch via x-tenant-id header.
  // Env-validator.ts rejects ALLOW_TENANT_HEADER=true in production.
  if (process.env['ALLOW_TENANT_HEADER'] === 'true') {
    const headerTenantId = request.headers?.['x-tenant-id'];
    if (headerTenantId && isUuid(headerTenantId)) {
      return headerTenantId;
    }
  }
  return undefined;
}

/**
 * Parameter decorator that injects the resolved tenant id.
 *
 * Throws 401 UnauthorizedException if no tenant can be resolved — services
 * guarding on `if (tenantId)` were silently skipping filtering and leaking
 * data cross-tenant. Use @OptionalTenant() for endpoints that legitimately
 * accept an anonymous / unresolved caller (public landing pages, health, etc.).
 */
export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const tenantId = resolveTenantIdFromRequest(request);
    if (!tenantId) {
      throw new UnauthorizedException('Missing tenant context');
    }
    return tenantId;
  },
);

/**
 * Variant for endpoints that must work without a tenant (public landing pages,
 * health probes, domain-resolver itself, etc.). Returns `undefined` when none
 * is present; the handler must NOT feed undefined into a tenantId filter.
 */
export const OptionalTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return resolveTenantIdFromRequest(request);
  },
);

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(
    private readonly cls: ClsService,
    private readonly domainResolver: DomainResolverService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let tenantId: string | undefined;
    let hostResolvedTenantId: string | undefined;

    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;

    // Priority 1: Resolve from Host header (most trusted — cannot be spoofed by client)
    const host = req.headers['host']?.split(':')[0]; // strip port
    if (host) {
      try {
        const resolved = await this.domainResolver.resolve(host);
        if (resolved) {
          hostResolvedTenantId = resolved.tenantId;
          tenantId = resolved.tenantId;
        }
      } catch {
        // Domain resolution failed — continue without tenant context
      }
    }

    // Priority 2: Explicit x-tenant-id header with valid UUID
    // If Host already resolved, validate consistency; if they conflict, prefer Host-resolved
    if (!tenantId && headerTenantId && isUuid(headerTenantId)) {
      tenantId = headerTenantId;
    } else if (tenantId && headerTenantId && isUuid(headerTenantId) && headerTenantId !== tenantId) {
      this.logger.warn(
        `Tenant header mismatch: x-tenant-id=${headerTenantId} vs host-resolved=${hostResolvedTenantId}. Using host-resolved.`
      );
      // Keep host-resolved tenantId (more trusted)
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
