import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract current tenant ID from request
 * Must be used with JwtAuthGuard or CustomerAuthGuard
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (request.user?.tenantId) {
      return request.user.tenantId;
    }
    if (process.env.ALLOW_TENANT_HEADER === 'true') {
      return request.headers['x-tenant-id'];
    }
    return undefined;
  },
);
