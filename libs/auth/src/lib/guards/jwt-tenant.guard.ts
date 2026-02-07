import { Injectable, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtTenantGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const userTenantId = request.user?.tenantId;
    const headerTenantId = request.headers?.['x-tenant-id'];

    if (userTenantId) {
      // Authenticated user: always use JWT tenantId
      if (headerTenantId && userTenantId !== headerTenantId) {
        throw new ForbiddenException('Tenant mismatch');
      }
      request.tenantId = userTenantId;
    } else if (headerTenantId && process.env['ALLOW_TENANT_HEADER'] === 'true') {
      // No JWT tenantId but header allowed in dev mode
      request.tenantId = headerTenantId;
    } else {
      throw new ForbiddenException('Tenant context required');
    }

    return true;
  }
}
