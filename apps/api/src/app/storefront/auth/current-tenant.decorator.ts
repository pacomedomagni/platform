import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract current tenant ID from request
 * Must be used with JwtAuthGuard or CustomerAuthGuard
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId || request.headers['x-tenant-id'];
  },
);
