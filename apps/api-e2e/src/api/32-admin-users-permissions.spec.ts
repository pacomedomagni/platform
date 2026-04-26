/**
 * Permission-level integration tests for /admin/users.
 *
 * Proves that PermissionsGuard + @RequirePermission(...) actually enforce
 * the catalog defined in libs/auth/src/lib/guards/permissions.guard.ts.
 *
 * Three tokens are issued in three separate tenants so we can test:
 *   - owner    → all admin/users endpoints, including DELETE
 *   - admin    → can read/edit/invite, but DELETE returns 403
 *   - staff    → 403 on every admin/users endpoint
 *
 * The key insight: once the request passes JwtTenantGuard + RolesGuard
 * (admin and staff are tenant members), it's PermissionsGuard that decides.
 * For staff that means a 403 because 'users:read' isn't in staff's catalog.
 */
import axios from 'axios';
import { signupJourneyTenant, journeyAdminHeaders, reloginJourneyUser } from '../support/auth-helper';

interface ActorCtx {
  tenantId: string;
  accessToken: string;
  userId: string;
}

async function freshTenantWithRoles(prefix: string, roles: string[]): Promise<ActorCtx> {
  const ts = Date.now() + Math.floor(Math.random() * 10_000);
  const email = `${prefix.toLowerCase()}-${ts}@perm.test`;
  const password = 'PermPass123';
  const { tenantId, accessToken: bootstrap } = await signupJourneyTenant(
    `${prefix} Co ${ts}`,
    email,
    password,
    `${prefix.toLowerCase()}${ts}`,
  );

  const list = await axios.get('/admin/users', {
    headers: journeyAdminHeaders(tenantId, bootstrap),
  });
  const userId = list.data.data[0].id;

  await axios.patch(
    `/admin/users/${userId}`,
    { roles },
    { headers: journeyAdminHeaders(tenantId, bootstrap) },
  );

  // Re-login so the JWT carries the new role set; PermissionsGuard reads from the claim.
  const accessToken = await reloginJourneyUser(email, password);
  return { tenantId, accessToken, userId };
}

describe('Admin Users — PermissionsGuard enforcement', () => {
  describe('owner', () => {
    let ctx: ActorCtx;
    let inviteeUserId: string;

    beforeAll(async () => {
      ctx = await freshTenantWithRoles('OwnerPerm', ['owner', 'admin']);

      // Create an invitee + accept so we have a deletable target.
      const email = `owner-target-${Date.now()}@perm.test`;
      const inv = await axios.post(
        '/admin/users/invite',
        { email, roles: ['staff'] },
        { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
      );
      const token = inv.data.inviteUrl.split('/').pop();
      const accept = await axios.post(`/onboarding/invites/${token}/accept`, {
        password: 'TargetUserPass123',
      });
      inviteeUserId = accept.data.user.id;
    });

    it('GET /admin/users → 200', async () => {
      const res = await axios.get('/admin/users', { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) });
      expect(res.status).toBe(200);
    });

    it('PATCH /admin/users/:id → 200 (users:write)', async () => {
      const res = await axios.patch(
        `/admin/users/${inviteeUserId}`,
        { firstName: 'Edited' },
        { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
      );
      expect(res.status).toBe(200);
    });

    it('DELETE /admin/users/:id → 200 (users:delete via owner *)', async () => {
      const res = await axios.delete(`/admin/users/${inviteeUserId}`, {
        headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('admin (no owner role)', () => {
    let ownerCtx: ActorCtx;
    let adminToken: string;
    let adminUserId: string;
    let targetUserId: string;

    beforeAll(async () => {
      // Bootstrap an owner so we can mint an admin via invite + accept.
      ownerCtx = await freshTenantWithRoles('AdminPerm', ['owner', 'admin']);

      // Invite an admin-only user.
      const adminEmail = `admin-only-${Date.now()}@perm.test`;
      const inv = await axios.post(
        '/admin/users/invite',
        { email: adminEmail, roles: ['admin'] },
        { headers: journeyAdminHeaders(ownerCtx.tenantId, ownerCtx.accessToken) },
      );
      const inviteToken = inv.data.inviteUrl.split('/').pop();
      const accept = await axios.post(`/onboarding/invites/${inviteToken}/accept`, {
        password: 'AdminOnlyPass123',
      });
      adminUserId = accept.data.user.id;
      adminToken = accept.data.access_token;

      // Also create a deletable target for the DELETE test.
      const targetEmail = `admin-delete-target-${Date.now()}@perm.test`;
      const inv2 = await axios.post(
        '/admin/users/invite',
        { email: targetEmail, roles: ['staff'] },
        { headers: journeyAdminHeaders(ownerCtx.tenantId, ownerCtx.accessToken) },
      );
      const t2 = inv2.data.inviteUrl.split('/').pop();
      const a2 = await axios.post(`/onboarding/invites/${t2}/accept`, { password: 'TargetPass123' });
      targetUserId = a2.data.user.id;
    });

    const adminHeaders = () => ({ Authorization: `Bearer ${adminToken}`, 'x-tenant-id': ownerCtx.tenantId });

    it('GET /admin/users → 200 (users:read)', async () => {
      const res = await axios.get('/admin/users', { headers: adminHeaders(), validateStatus: () => true });
      expect(res.status).toBe(200);
    });

    it('POST /admin/users/invite → 201 (users:invite)', async () => {
      const res = await axios.post(
        '/admin/users/invite',
        { email: `admin-issued-${Date.now()}@perm.test`, roles: ['staff'] },
        { headers: adminHeaders(), validateStatus: () => true },
      );
      expect(res.status).toBe(201);
    });

    it('PATCH /admin/users/:id → 200 (users:write)', async () => {
      const res = await axios.patch(
        `/admin/users/${targetUserId}`,
        { firstName: 'AdminEdit' },
        { headers: adminHeaders(), validateStatus: () => true },
      );
      expect(res.status).toBe(200);
    });

    it('DELETE /admin/users/:id → 403 (users:delete is owner-only)', async () => {
      const res = await axios.delete(`/admin/users/${targetUserId}`, {
        headers: adminHeaders(),
        validateStatus: () => true,
      });
      expect(res.status).toBe(403);
    });
  });

  describe('staff', () => {
    let ownerCtx: ActorCtx;
    let staffToken: string;

    beforeAll(async () => {
      ownerCtx = await freshTenantWithRoles('StaffPerm', ['owner', 'admin']);

      const staffEmail = `staff-only-${Date.now()}@perm.test`;
      const inv = await axios.post(
        '/admin/users/invite',
        { email: staffEmail, roles: ['staff'] },
        { headers: journeyAdminHeaders(ownerCtx.tenantId, ownerCtx.accessToken) },
      );
      const inviteToken = inv.data.inviteUrl.split('/').pop();
      const accept = await axios.post(`/onboarding/invites/${inviteToken}/accept`, {
        password: 'StaffOnlyPass123',
      });
      staffToken = accept.data.access_token;
    });

    const staffHeaders = () => ({ Authorization: `Bearer ${staffToken}`, 'x-tenant-id': ownerCtx.tenantId });

    it('GET /admin/users → 403 (RolesGuard rejects: staff is not owner|admin)', async () => {
      const res = await axios.get('/admin/users', { headers: staffHeaders(), validateStatus: () => true });
      expect(res.status).toBe(403);
    });

    it('POST /admin/users/invite → 403', async () => {
      const res = await axios.post(
        '/admin/users/invite',
        { email: `staff-attempt-${Date.now()}@perm.test`, roles: ['staff'] },
        { headers: staffHeaders(), validateStatus: () => true },
      );
      expect(res.status).toBe(403);
    });
  });
});
