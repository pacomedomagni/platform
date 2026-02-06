import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for storefront admin endpoints.
 * Requires JWT authentication + admin/System Manager role.
 */
@Injectable()
export class StoreAdminGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, validate JWT
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    // Then check for admin role
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const userRoles: string[] = user.roles || [];
    const adminRoles = ['admin', 'System Manager', 'Store Manager'];

    if (!userRoles.some((role) => adminRoles.includes(role))) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
