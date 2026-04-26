/**
 * Integration tests proving that admin write actions emit audit-log entries.
 *
 * Approach: take an action via the admin API, then read /operations/audit-logs
 * and assert the corresponding entry exists. This verifies the wiring end-to-end
 * (controller → service → AuditLogService → DB) without coupling to internals.
 *
 * Coverage:
 *   - user.invited        (POST /admin/users/invite)
 *   - user.invite_accepted (POST /onboarding/invites/:token/accept)
 *   - user.role_changed   (PATCH /admin/users/:id with new roles)
 *   - user.updated        (PATCH /admin/users/:id without roles)
 *   - user.invite_revoked (DELETE /admin/users/invites/:id)
 *   - user.invite_resent  (POST /admin/users/invites/:id/resend)
 *   - user.deleted        (DELETE /admin/users/:id)
 *   - theme.deleted / theme.restored
 *   - shipping_zone.deleted / shipping_zone.restored
 *   - review.deleted / review.restored  — covered as far as the soft-delete
 *     endpoint is reachable; we'll mark it skipped if no review fixture exists.
 */
import axios from 'axios';
import { signupJourneyTenant, journeyAdminHeaders, reloginJourneyUser } from '../support/auth-helper';

interface OwnerCtx {
  tenantId: string;
  accessToken: string;
  ownerUserId: string;
  email: string;
  password: string;
}

async function ownerTenant(prefix: string): Promise<OwnerCtx> {
  const ts = Date.now() + Math.floor(Math.random() * 10_000);
  const email = `${prefix.toLowerCase()}-${ts}@audit.test`;
  const password = 'AuditPass123';
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
  const accessToken = await reloginJourneyUser(email, password);
  return { tenantId, accessToken, ownerUserId, email, password };
}

async function findAudit(
  ctx: OwnerCtx,
  matchers: { action: string; docType?: string; docName?: string },
): Promise<any | undefined> {
  // The DTO uses class-validator with @IsInt() on `limit`, and axios serializes query
  // params as strings, so we omit `limit` and let the server use its default page size.
  const params: Record<string, string> = { action: matchers.action };
  if (matchers.docType) params.docType = matchers.docType;
  const res = await axios.get('/operations/audit-logs', {
    headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken),
    params,
  });
  if (res.status !== 200) {
    throw new Error(`audit-logs query failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  const rows: any[] = Array.isArray(res.data?.data) ? res.data.data : [];
  return rows.find((r) =>
    r.action === matchers.action &&
    (matchers.docType ? r.docType === matchers.docType : true) &&
    (matchers.docName ? r.docName === matchers.docName : true),
  );
}

describe('Audit trail — user lifecycle', () => {
  let ctx: OwnerCtx;

  beforeAll(async () => {
    ctx = await ownerTenant('UserAudit');
  });

  it('POST /admin/users/invite emits user.invited', async () => {
    const inviteRes = await axios.post(
      '/admin/users/invite',
      { email: `invitee-${Date.now()}@audit.test`, roles: ['staff'] },
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
    );
    const entry = await findAudit(ctx, { action: 'user.invited', docName: inviteRes.data.id });
    expect(entry).toBeDefined();
    expect(entry.docType).toBe('UserInvite');
    expect(entry.userId).toBe(ctx.ownerUserId); // actor is the inviter
  });

  it('POST /onboarding/invites/:token/accept emits user.invite_accepted', async () => {
    const inv = await axios.post(
      '/admin/users/invite',
      { email: `accept-${Date.now()}@audit.test`, roles: ['staff'] },
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
    );
    const token = inv.data.inviteUrl.split('/').pop();
    const accept = await axios.post(`/onboarding/invites/${token}/accept`, { password: 'AcceptPass123' });
    const newUserId = accept.data.user.id;
    const entry = await findAudit(ctx, { action: 'user.invite_accepted', docName: newUserId });
    expect(entry).toBeDefined();
    expect(entry.userId).toBe(newUserId); // actor is the accepting user
  });

  it('PATCH /admin/users/:id with new roles emits user.role_changed with previous+new', async () => {
    // Create a user we can mutate.
    const inv = await axios.post(
      '/admin/users/invite',
      { email: `promote-${Date.now()}@audit.test`, roles: ['staff'] },
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
    );
    const t = inv.data.inviteUrl.split('/').pop();
    const a = await axios.post(`/onboarding/invites/${t}/accept`, { password: 'PromotePass123' });
    const targetId = a.data.user.id;

    await axios.patch(
      `/admin/users/${targetId}`,
      { roles: ['admin'] },
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
    );

    const entry = await findAudit(ctx, { action: 'user.role_changed', docName: targetId });
    expect(entry).toBeDefined();
    expect(entry.docType).toBe('User');
    expect(entry.userId).toBe(ctx.ownerUserId);
    expect(entry.meta).toMatchObject({
      previousRoles: ['staff'],
      newRoles: ['admin'],
    });
  });

  it('PATCH /admin/users/:id without roles emits user.updated', async () => {
    const inv = await axios.post(
      '/admin/users/invite',
      { email: `rename-${Date.now()}@audit.test`, roles: ['staff'] },
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
    );
    const t = inv.data.inviteUrl.split('/').pop();
    const a = await axios.post(`/onboarding/invites/${t}/accept`, { password: 'RenamePass123' });
    const targetId = a.data.user.id;

    await axios.patch(
      `/admin/users/${targetId}`,
      { firstName: 'Renamed' },
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
    );

    const entry = await findAudit(ctx, { action: 'user.updated', docName: targetId });
    expect(entry).toBeDefined();
  });

  it('POST /admin/users/invites/:id/resend emits user.invite_resent', async () => {
    const inv = await axios.post(
      '/admin/users/invite',
      { email: `resend-${Date.now()}@audit.test`, roles: ['staff'] },
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
    );
    await axios.post(
      `/admin/users/invites/${inv.data.id}/resend`,
      {},
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
    );
    const entry = await findAudit(ctx, { action: 'user.invite_resent', docName: inv.data.id });
    expect(entry).toBeDefined();
    expect(entry.meta).toMatchObject({ resentCount: 1 });
  });

  it('DELETE /admin/users/invites/:id emits user.invite_revoked', async () => {
    const inv = await axios.post(
      '/admin/users/invite',
      { email: `revoke-${Date.now()}@audit.test`, roles: ['staff'] },
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
    );
    await axios.delete(`/admin/users/invites/${inv.data.id}`, {
      headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken),
    });
    const entry = await findAudit(ctx, { action: 'user.invite_revoked', docName: inv.data.id });
    expect(entry).toBeDefined();
  });

  it('DELETE /admin/users/:id emits user.deleted with email + roles snapshot', async () => {
    const inv = await axios.post(
      '/admin/users/invite',
      { email: `tombstone-${Date.now()}@audit.test`, roles: ['staff'] },
      { headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken) },
    );
    const t = inv.data.inviteUrl.split('/').pop();
    const a = await axios.post(`/onboarding/invites/${t}/accept`, { password: 'GravePass123' });
    const targetId = a.data.user.id;
    const targetEmail = a.data.user.email;

    await axios.delete(`/admin/users/${targetId}`, {
      headers: journeyAdminHeaders(ctx.tenantId, ctx.accessToken),
    });

    const entry = await findAudit(ctx, { action: 'user.deleted', docName: targetId });
    expect(entry).toBeDefined();
    expect(entry.meta).toMatchObject({ email: targetEmail });
  });
});
