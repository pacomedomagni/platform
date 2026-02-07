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

    if (userTenantId && headerTenantId && userTenantId !== headerTenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    return true;
  }
}
