import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Catalog of permissions each role grants. This is the SAME shape as
 * ROLE_DEFINITIONS in apps/api/src/app/admin-users/admin-users.service.ts —
 * intentionally duplicated here because @platform/auth must not depend on
 * the API app. Keep in sync; a unit test asserts they match.
 *
 * Permission strings are colon-separated `<scope>:<action>`. Wildcards:
 *   `*`             — grants every permission
 *   `<scope>:*`     — grants every action within the scope
 *   `*:<action>`    — grants <action> on every scope (used by 'viewer' for *:read)
 */
const ROLE_PERMISSIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  owner: ['*'],
  admin: [
    'products:*',
    'orders:*',
    'customers:*',
    'inventory:*',
    'reports:read',
    'settings:read',
    'settings:write',
    'marketplace:*',
    'reviews:*',
    'themes:*',
    'shipping:*',
    'users:invite',
    'users:read',
    'users:write',
    // Note: users:delete is intentionally NOT here — only owner (via *) can delete users.
  ],
  staff: [
    'orders:*',
    'customers:read',
    'inventory:read',
    'inventory:write',
    'reviews:moderate',
    'products:read',
    'shipping:read',
  ],
  viewer: ['*:read'],
  user: ['dashboard:read'],
});

/**
 * Decorator: declare the permission(s) required to access an endpoint.
 *
 * @example
 *   @RequirePermission('products:write')
 *   @Post('products')
 *   create(...) { ... }
 *
 * Multiple permissions are OR-ed (any match grants access). For AND semantics,
 * use multiple @RequirePermission stacks or compose at the service level.
 */
export const RequirePermission = (...permissions: string[]) => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(PERMISSIONS_KEY, permissions, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(PERMISSIONS_KEY, permissions, target);
    return target;
  };
};

/**
 * Returns true if `granted` (a permission string with possible wildcards)
 * satisfies the `required` permission. Both arguments are colon-separated.
 *
 *   match('*', 'anything:any')              → true
 *   match('products:*', 'products:write')   → true
 *   match('products:read', 'products:read') → true
 *   match('products:read', 'products:write')→ false
 *   match('*:read', 'products:read')        → true
 *   match('*:read', 'products:write')       → false
 */
export function permissionMatches(granted: string, required: string): boolean {
  if (granted === '*') return true;
  if (granted === required) return true;

  const [gScope, gAction] = granted.split(':');
  const [rScope, rAction] = required.split(':');
  // A required permission without an action ('dashboard') matches a granted
  // glob with the same scope ('dashboard:*') and vice versa, but in practice
  // every required string is colon-formatted. Be defensive anyway.
  if (gScope === '*' && gAction === rAction) return true;
  if (gAction === '*' && gScope === rScope) return true;
  return false;
}

export function hasAnyPermission(userRoles: readonly string[], required: readonly string[]): boolean {
  if (!required || required.length === 0) return true;
  if (!userRoles || userRoles.length === 0) return false;

  // Union the granted permissions from all the user's roles.
  const granted = new Set<string>();
  for (const role of userRoles) {
    const perms = ROLE_PERMISSIONS[role];
    if (perms) for (const p of perms) granted.add(p);
  }
  if (granted.size === 0) return false;

  for (const req of required) {
    for (const g of granted) {
      if (permissionMatches(g, req)) return true;
    }
  }
  return false;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    const userRoles: string[] = Array.isArray(user.roles) ? user.roles : [];
    const requestTenantId = request.tenantId || request.headers?.['x-tenant-id'];

    // Tenant isolation: if both sides expose a tenantId, they must match.
    // (JwtTenantGuard already does this, but we defend in depth in case
    // someone composes PermissionsGuard with a different upstream guard.)
    if (requestTenantId && user.tenantId && requestTenantId !== user.tenantId) {
      return false;
    }

    return hasAnyPermission(userRoles, required);
  }
}

/** Exposed for tests + admin-users.service to keep one source of truth on the API side. */
export { ROLE_PERMISSIONS };
