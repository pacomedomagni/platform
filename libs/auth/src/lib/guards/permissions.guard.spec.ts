/**
 * Unit tests for PermissionsGuard + permissionMatches + hasAnyPermission.
 *
 * The guard's whole job is to decide whether a request can proceed based on
 * the user's roles and the @RequirePermission(...) metadata on the handler.
 * If this is wrong, the entire authorization story is wrong — so we cover
 * the wildcard semantics, the role-union behavior, the tenant-mismatch case,
 * and the absent-decorator default case.
 */
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PermissionsGuard,
  hasAnyPermission,
  permissionMatches,
  ROLE_PERMISSIONS,
} from './permissions.guard';

function ctx(opts: {
  user?: any;
  tenantHeader?: string;
  required?: string[];
}): ExecutionContext {
  const request = {
    user: opts.user,
    tenantId: undefined,
    headers: opts.tenantHeader ? { 'x-tenant-id': opts.tenantHeader } : {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function makeGuard(required: string[]): PermissionsGuard {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);
  return new PermissionsGuard(reflector);
}

describe('permissionMatches()', () => {
  it('* grants everything', () => {
    expect(permissionMatches('*', 'anything:read')).toBe(true);
    expect(permissionMatches('*', 'products:write')).toBe(true);
    expect(permissionMatches('*', 'a:b')).toBe(true);
  });

  it('exact match', () => {
    expect(permissionMatches('products:read', 'products:read')).toBe(true);
    expect(permissionMatches('products:read', 'products:write')).toBe(false);
    expect(permissionMatches('products:read', 'orders:read')).toBe(false);
  });

  it('scope wildcard <scope>:* grants every action within that scope', () => {
    expect(permissionMatches('products:*', 'products:read')).toBe(true);
    expect(permissionMatches('products:*', 'products:write')).toBe(true);
    expect(permissionMatches('products:*', 'products:delete')).toBe(true);
    expect(permissionMatches('products:*', 'orders:read')).toBe(false);
  });

  it('action wildcard *:<action> grants <action> across all scopes', () => {
    expect(permissionMatches('*:read', 'products:read')).toBe(true);
    expect(permissionMatches('*:read', 'orders:read')).toBe(true);
    expect(permissionMatches('*:read', 'products:write')).toBe(false);
  });

  it('does NOT match across mismatched scope+action', () => {
    expect(permissionMatches('products:read', 'orders:write')).toBe(false);
  });
});

describe('hasAnyPermission()', () => {
  it('returns true with empty required list (no requirement)', () => {
    expect(hasAnyPermission(['user'], [])).toBe(true);
  });

  it('returns false when user has no roles', () => {
    expect(hasAnyPermission([], ['products:read'])).toBe(false);
  });

  it('returns false when role catalog has no permissions for the role', () => {
    expect(hasAnyPermission(['nonexistent-role'], ['products:read'])).toBe(false);
  });

  it('owner gets everything via *', () => {
    expect(hasAnyPermission(['owner'], ['products:write'])).toBe(true);
    expect(hasAnyPermission(['owner'], ['users:invite'])).toBe(true);
    expect(hasAnyPermission(['owner'], ['anything:any'])).toBe(true);
  });

  it('admin gets products:* but not arbitrary scopes', () => {
    expect(hasAnyPermission(['admin'], ['products:write'])).toBe(true);
    expect(hasAnyPermission(['admin'], ['products:delete'])).toBe(true);
    expect(hasAnyPermission(['admin'], ['orders:write'])).toBe(true);
    expect(hasAnyPermission(['admin'], ['users:invite'])).toBe(true);
    // 'billing' isn't in admin's catalog
    expect(hasAnyPermission(['admin'], ['billing:write'])).toBe(false);
  });

  it('staff has narrow catalog — orders:* but not products:write', () => {
    expect(hasAnyPermission(['staff'], ['orders:write'])).toBe(true);
    expect(hasAnyPermission(['staff'], ['products:read'])).toBe(true);
    expect(hasAnyPermission(['staff'], ['products:write'])).toBe(false);
    expect(hasAnyPermission(['staff'], ['users:invite'])).toBe(false);
  });

  it('viewer can read everything but cannot write', () => {
    expect(hasAnyPermission(['viewer'], ['products:read'])).toBe(true);
    expect(hasAnyPermission(['viewer'], ['orders:read'])).toBe(true);
    expect(hasAnyPermission(['viewer'], ['settings:read'])).toBe(true);
    expect(hasAnyPermission(['viewer'], ['products:write'])).toBe(false);
    expect(hasAnyPermission(['viewer'], ['users:invite'])).toBe(false);
  });

  it("user role only has dashboard:read", () => {
    expect(hasAnyPermission(['user'], ['dashboard:read'])).toBe(true);
    expect(hasAnyPermission(['user'], ['products:read'])).toBe(false);
  });

  it('unions permissions across multiple roles', () => {
    // staff alone cannot users:invite, but staff+admin can (admin grants it)
    expect(hasAnyPermission(['staff'], ['users:invite'])).toBe(false);
    expect(hasAnyPermission(['staff', 'admin'], ['users:invite'])).toBe(true);
  });

  it('OR semantics — any of the required permissions grants access', () => {
    // staff has orders:* but not products:write. With required=['products:write','orders:read'], staff passes via orders:read.
    expect(hasAnyPermission(['staff'], ['products:write', 'orders:read'])).toBe(true);
  });
});

describe('PermissionsGuard.canActivate()', () => {
  it('allows when no permission is required (no decorator)', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const guard = new PermissionsGuard(reflector);
    expect(
      guard.canActivate(ctx({ user: { roles: ['user'], tenantId: 't1' } })),
    ).toBe(true);
  });

  it('blocks when there is no authenticated user', () => {
    const guard = makeGuard(['products:read']);
    expect(guard.canActivate(ctx({ user: null }))).toBe(false);
  });

  it('blocks when the request tenant header does not match the user tenant', () => {
    const guard = makeGuard(['products:read']);
    expect(
      guard.canActivate(
        ctx({
          user: { roles: ['admin'], tenantId: 'tenant-A' },
          tenantHeader: 'tenant-B',
        }),
      ),
    ).toBe(false);
  });

  it('allows when tenant header matches user tenant + role grants the permission', () => {
    const guard = makeGuard(['products:write']);
    expect(
      guard.canActivate(
        ctx({
          user: { roles: ['admin'], tenantId: 'tenant-A' },
          tenantHeader: 'tenant-A',
        }),
      ),
    ).toBe(true);
  });

  it('allows when no tenant header is provided (admin endpoints often pass tenantId server-side)', () => {
    const guard = makeGuard(['products:read']);
    expect(
      guard.canActivate(
        ctx({ user: { roles: ['viewer'], tenantId: 'tenant-A' } }),
      ),
    ).toBe(true);
  });

  it('blocks staff trying to write products', () => {
    const guard = makeGuard(['products:write']);
    expect(
      guard.canActivate(
        ctx({ user: { roles: ['staff'], tenantId: 'tenant-A' } }),
      ),
    ).toBe(false);
  });

  it('blocks viewer trying to write anything', () => {
    const guard = makeGuard(['orders:write']);
    expect(
      guard.canActivate(
        ctx({ user: { roles: ['viewer'], tenantId: 'tenant-A' } }),
      ),
    ).toBe(false);
  });
});

describe('ROLE_PERMISSIONS catalog invariants', () => {
  it('contains the five canonical roles', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(
      ['admin', 'owner', 'staff', 'user', 'viewer'].sort(),
    );
  });

  it('owner is *', () => {
    expect(ROLE_PERMISSIONS['owner']).toEqual(['*']);
  });

  it('every permission string is colon-shaped or a bare wildcard', () => {
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      for (const p of perms) {
        expect(p === '*' || /^[a-z*]+:[a-z*]+$/.test(p)).toBe(true);
      }
    }
  });
});
