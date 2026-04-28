import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'isPublic';

/**
 * Decorator to specify which roles can access an endpoint.
 * @example @Roles('admin', 'System Manager')
 */
export const Roles = (...roles: string[]) => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(ROLES_KEY, roles, target);
    return target;
  };
};

/**
 * Marks an endpoint as intentionally accessible to any authenticated user
 * (or public, if AuthGuard is also absent). Required because routes
 * decorated with `@UseGuards(AuthGuard, RolesGuard)` now default-DENY
 * when no `@Roles` is set — that closes the historical hole where
 * forgetting `@Roles` silently let everyone in.
 */
export const Public = () => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(PUBLIC_KEY, true, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(PUBLIC_KEY, true, target);
    return target;
  };
};

function normalize(role: string): string {
  return role.trim().toLowerCase();
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const userRoles: string[] = (user.roles || []).map(normalize);

    // Admin / System Manager bypass — allowed within their own tenant only.
    if (userRoles.includes('admin') || userRoles.includes('system manager')) {
      const requestTenantId = request.tenantId || request.headers?.['x-tenant-id'];
      if (requestTenantId && user.tenantId && requestTenantId !== user.tenantId) {
        return false;
      }
      return true;
    }

    // Default-deny when RolesGuard is applied without @Roles. This is the
    // safer default; previously a missing @Roles silently let any authed
    // user through. Use @Public() to explicitly opt out.
    if (!requiredRoles || requiredRoles.length === 0) {
      return false;
    }

    const required = requiredRoles.map(normalize);
    return required.some((role) => userRoles.includes(role));
  }
}
