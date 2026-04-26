/**
 * Admin Users module — RBAC + lifecycle integration tests.
 *
 * Covers:
 *   - Role-based access enforcement (anonymous → 401, wrong tenant → 401/403)
 *   - Tenant isolation (one tenant cannot see/modify users of another)
 *   - Direct user CRUD (PATCH/DELETE on existing User rows)
 *   - Last-owner protection
 *   - Role catalog endpoint
 *
 * The full invite → accept flow lives in 31-admin-users-invites.spec.ts.
 */
import axios from 'axios';
import { signupJourneyTenant, journeyAdminHeaders, reloginJourneyUser } from '../support/auth-helper';

interface SignupContext {
  tenantId: string;
  accessToken: string;
  ownerUserId: string;
}

async function freshTenant(prefix: string): Promise<SignupContext> {
  const ts = Date.now() + Math.floor(Math.random() * 10_000);
  const email = `${prefix.toLowerCase()}-${ts}@admin-users.test`;
  const password = 'AdminUserPass123';
  const { tenantId, accessToken: bootstrap } = await signupJourneyTenant(
    `${prefix} Co ${ts}`,
    email,
    password,
    `${prefix.toLowerCase()}${ts}`,
  );
  const list = await axios.get('/admin/users', { headers: journeyAdminHeaders(tenantId, bootstrap) });
  const ownerUserId = list.data.data[0].id;
  await axios.patch(
    `/admin/users/${ownerUserId}`,
    { roles: ['owner', 'admin'] },
    { headers: journeyAdminHeaders(tenantId, bootstrap) },
  );
  // Re-login: PermissionsGuard reads roles from the JWT claim, so the
  // pre-promotion token wouldn't include 'owner'.
  const accessToken = await reloginJourneyUser(email, password);
  return { tenantId, accessToken, ownerUserId };
}

describe('Admin Users — RBAC enforcement', () => {
  let owner: SignupContext;

  beforeAll(async () => {
    owner = await freshTenant('Rbac');
  });

  describe('without auth', () => {
    it('GET /admin/users → 401', async () => {
      const res = await axios.get('/admin/users', { validateStatus: () => true });
      expect(res.status).toBe(401);
    });

    it('GET /admin/users/roles → 401', async () => {
      const res = await axios.get('/admin/users/roles', { validateStatus: () => true });
      expect(res.status).toBe(401);
    });

    it('POST /admin/users/invite → 401', async () => {
      const res = await axios.post('/admin/users/invite', { email: 'x@y.test' }, { validateStatus: () => true });
      expect(res.status).toBe(401);
    });

    it('GET /admin/users/invites → 401', async () => {
      const res = await axios.get('/admin/users/invites', { validateStatus: () => true });
      expect(res.status).toBe(401);
    });

    it('PATCH /admin/users/:id → 401', async () => {
      const res = await axios.patch('/admin/users/some-id', { roles: ['admin'] }, { validateStatus: () => true });
      expect(res.status).toBe(401);
    });

    it('DELETE /admin/users/:id → 401', async () => {
      const res = await axios.delete('/admin/users/some-id', { validateStatus: () => true });
      expect(res.status).toBe(401);
    });
  });

  describe('with cross-tenant token', () => {
    it('cannot read users of another tenant', async () => {
      const other = await freshTenant('Other');
      const res = await axios.get('/admin/users', {
        headers: { Authorization: `Bearer ${other.accessToken}`, 'x-tenant-id': owner.tenantId },
        validateStatus: () => true,
      });
      // JwtTenantGuard rejects mismatched tenant
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('with owner/admin role on own tenant', () => {
    it('GET /admin/users → 200', async () => {
      const res = await axios.get('/admin/users', {
        headers: journeyAdminHeaders(owner.tenantId, owner.accessToken),
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    it('GET /admin/users/roles → 200 + 5 role definitions', async () => {
      const res = await axios.get('/admin/users/roles', {
        headers: journeyAdminHeaders(owner.tenantId, owner.accessToken),
      });
      expect(res.status).toBe(200);
      const ids = res.data.map((r: any) => r.id);
      expect(ids).toEqual(expect.arrayContaining(['owner', 'admin', 'staff', 'viewer', 'user']));
      expect(res.data.every((r: any) => Array.isArray(r.permissions))).toBe(true);
    });

    it('GET /admin/users/invites → 200 (empty initially)', async () => {
      const res = await axios.get('/admin/users/invites', {
        headers: journeyAdminHeaders(owner.tenantId, owner.accessToken),
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data.data)).toBe(true);
    });
  });
});

describe('Admin Users — direct CRUD on User rows', () => {
  let ctx: SignupContext;
  let secondUserId: string;

  beforeAll(async () => {
    ctx = await freshTenant('Crud');
    // Create a second user via invite + accept so we have someone to mutate.
    const inviteRes = await axios.post(
      '/admin/users/invite',
      { email: `crud-second-${Date.now()}@admin-users.test`, roles: ['staff'] },
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
    );
    const token = inviteRes.data.inviteUrl.split('/').pop();
    const acceptRes = await axios.post(`/onboarding/invites/${token}/accept`, {
      password: 'AcceptedUserPass123',
    });
    secondUserId = acceptRes.data.user.id;
  });

  it('PATCH /admin/users/:id promotes staff → admin and verifies email', async () => {
    const res = await axios.patch(
      `/admin/users/${secondUserId}`,
      { roles: ['admin'], emailVerified: true },
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
    );
    expect(res.status).toBe(200);
    expect(res.data.roles).toEqual(['admin']);
    expect(res.data.emailVerified).toBe(true);
  });

  it('DELETE /admin/users/:id removes the user', async () => {
    const res = await axios.delete(`/admin/users/${secondUserId}`, {
      headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken),
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });
});

describe('Admin Users — last owner protection', () => {
  let ctx: SignupContext;

  beforeAll(async () => {
    ctx = await freshTenant('Guard');
  });

  it('rejects role demotion that would leave zero owners', async () => {
    const res = await axios.patch(
      `/admin/users/${ctx.ownerUserId}`,
      { roles: ['staff'] },
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken), validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.message).toMatch(/owner/i);
  });

  it('rejects deletion of the last owner', async () => {
    const res = await axios.delete(`/admin/users/${ctx.ownerUserId}`, {
      headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken),
      validateStatus: () => true,
    });
    expect(res.status).toBe(400);
    expect(res.data.message).toMatch(/owner/i);
  });
});
