import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles can access an endpoint
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

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const userRoles: string[] = user.roles || [];

    // Admin and System Manager have access to everything
    if (userRoles.includes('admin') || userRoles.includes('System Manager')) {
      return true;
    }

    // Check if user has any of the required roles
    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
