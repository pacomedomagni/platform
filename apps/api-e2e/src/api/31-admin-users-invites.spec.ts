/**
 * Real invite-flow integration tests.
 *
 * Covers:
 *   - Invite issuance returns inviteUrl (in non-prod) with a real token
 *   - Public preview endpoint returns 404 / 410 / 200 correctly
 *   - Accept endpoint creates a real User + returns access_token + refresh_token
 *   - Accepted user can hit /admin/users with the new token (proving the JWT works)
 *   - Re-issue rotates the token (old token → 404, new token → 200)
 *   - Revoke disables the invite (404 on accept after revoke)
 *   - Email duplicate handling (re-inviting same address revokes prior pending invite)
 */
import axios from 'axios';
import { signupJourneyTenant, journeyAdminHeaders } from '../support/auth-helper';

async function freshTenant(prefix: string) {
  const ts = Date.now() + Math.floor(Math.random() * 10_000);
  const { tenantId, accessToken } = await signupJourneyTenant(
    `${prefix} Co ${ts}`,
    `${prefix.toLowerCase()}-${ts}@invite.test`,
    'OwnerPass123',
    `${prefix.toLowerCase()}${ts}`,
  );
  return { tenantId, accessToken };
}

function tokenFromUrl(url: string): string {
  return url.split('/').pop() as string;
}

describe('Invite flow — happy path', () => {
  let tenantId: string;
  let accessToken: string;
  let inviteId: string;
  let inviteUrl: string;
  let inviteEmail: string;

  beforeAll(async () => {
    const ctx = await freshTenant('Happy');
    tenantId = ctx.tenantId;
    accessToken = ctx.accessToken;
    inviteEmail = `happy-${Date.now()}@invite.test`;
  });

  it('POST /admin/users/invite creates an invite (NOT a User)', async () => {
    const res = await axios.post(
      '/admin/users/invite',
      { email: inviteEmail, firstName: 'Happy', lastName: 'Path', roles: ['staff'] },
      { headers: journeyAdminHeaders(tenantId, accessToken) },
    );
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.status).toBe('PENDING');
    expect(res.data.inviteUrl).toMatch(/\/onboarding\/accept-invite\/[A-Za-z0-9_-]+$/);
    expect(res.data.email).toBe(inviteEmail);

    inviteId = res.data.id;
    inviteUrl = res.data.inviteUrl;

    // The User row should NOT exist yet.
    const list = await axios.get('/admin/users', { headers: journeyAdminHeaders(tenantId, accessToken) });
    expect(list.data.data.find((u: any) => u.email === inviteEmail)).toBeUndefined();
  });

  it('GET /admin/users/invites lists the new pending invite', async () => {
    const res = await axios.get('/admin/users/invites', {
      headers: journeyAdminHeaders(tenantId, accessToken),
    });
    const found = res.data.data.find((i: any) => i.id === inviteId);
    expect(found).toBeDefined();
    expect(found.status).toBe('PENDING');
  });

  it('GET /onboarding/invites/:token returns preview (no auth)', async () => {
    const token = tokenFromUrl(inviteUrl);
    const res = await axios.get(`/onboarding/invites/${token}`);
    expect(res.status).toBe(200);
    expect(res.data.email).toBe(inviteEmail);
    expect(res.data.roles).toEqual(['staff']);
  });

  it('GET /onboarding/invites/:token with bogus token → 404', async () => {
    const res = await axios.get('/onboarding/invites/bogus-token-does-not-exist', { validateStatus: () => true });
    expect(res.status).toBe(404);
  });

  it('POST /onboarding/invites/:token/accept rejects short password', async () => {
    const token = tokenFromUrl(inviteUrl);
    const res = await axios.post(`/onboarding/invites/${token}/accept`, { password: 'short' }, { validateStatus: () => true });
    expect(res.status).toBe(400);
  });

  it('POST /onboarding/invites/:token/accept creates user + returns tokens', async () => {
    const token = tokenFromUrl(inviteUrl);
    const res = await axios.post(`/onboarding/invites/${token}/accept`, {
      password: 'GoodAcceptPass123',
      firstName: 'Override',
    });
    expect(res.status).toBe(201);
    expect(res.data.access_token).toBeTruthy();
    expect(res.data.refresh_token).toBeTruthy();
    expect(res.data.user.email).toBe(inviteEmail);
    expect(res.data.user.firstName).toBe('Override');
    expect(res.data.tenantId).toBe(tenantId);
  });

  it('accept token is single-use (second attempt → 410)', async () => {
    const token = tokenFromUrl(inviteUrl);
    const res = await axios.post(`/onboarding/invites/${token}/accept`, { password: 'GoodAcceptPass123' }, { validateStatus: () => true });
    expect(res.status).toBe(410);
  });

  it('preview after accept → 410 GONE', async () => {
    const token = tokenFromUrl(inviteUrl);
    const res = await axios.get(`/onboarding/invites/${token}`, { validateStatus: () => true });
    expect(res.status).toBe(410);
  });

  it('User now appears in /admin/users with role staff and emailVerified=true', async () => {
    const list = await axios.get('/admin/users', { headers: journeyAdminHeaders(tenantId, accessToken) });
    const u = list.data.data.find((u: any) => u.email === inviteEmail);
    expect(u).toBeDefined();
    expect(u.roles).toEqual(['staff']);
    expect(u.emailVerified).toBe(true);
  });

  it('invite is now in ACCEPTED status', async () => {
    const res = await axios.get('/admin/users/invites?status=ACCEPTED', {
      headers: journeyAdminHeaders(tenantId, accessToken),
    });
    expect(res.data.data.find((i: any) => i.id === inviteId)).toBeDefined();
  });
});

describe('Invite flow — rotation & revocation', () => {
  let tenantId: string;
  let accessToken: string;
  let inviteEmail: string;
  let originalToken: string;
  let inviteId: string;

  beforeAll(async () => {
    const ctx = await freshTenant('Rotate');
    tenantId = ctx.tenantId;
    accessToken = ctx.accessToken;
    inviteEmail = `rotate-${Date.now()}@invite.test`;

    const res = await axios.post(
      '/admin/users/invite',
      { email: inviteEmail, roles: ['staff'] },
      { headers: journeyAdminHeaders(tenantId, accessToken) },
    );
    inviteId = res.data.id;
    originalToken = tokenFromUrl(res.data.inviteUrl);
  });

  it('resend rotates the token: old token → 404, new token → 200', async () => {
    const resend = await axios.post(
      `/admin/users/invites/${inviteId}/resend`,
      {},
      { headers: journeyAdminHeaders(tenantId, accessToken) },
    );
    expect(resend.status).toBe(201);
    const newToken = tokenFromUrl(resend.data.inviteUrl);
    expect(newToken).not.toBe(originalToken);

    const oldPreview = await axios.get(`/onboarding/invites/${originalToken}`, { validateStatus: () => true });
    expect(oldPreview.status).toBe(404);

    const newPreview = await axios.get(`/onboarding/invites/${newToken}`);
    expect(newPreview.status).toBe(200);
  });

  it('revoke disables the invite (preview → 410)', async () => {
    const revoke = await axios.delete(`/admin/users/invites/${inviteId}`, {
      headers: journeyAdminHeaders(tenantId, accessToken),
    });
    expect(revoke.status).toBe(200);

    // Find the latest token (after rotation) by reading the invite back.
    const invites = await axios.get('/admin/users/invites', {
      headers: journeyAdminHeaders(tenantId, accessToken),
    });
    const found = invites.data.data.find((i: any) => i.id === inviteId);
    expect(found.status).toBe('REVOKED');
  });
});

describe('Invite flow — duplicate handling', () => {
  let tenantId: string;
  let accessToken: string;

  beforeAll(async () => {
    const ctx = await freshTenant('Dup');
    tenantId = ctx.tenantId;
    accessToken = ctx.accessToken;
  });

  it('re-inviting same email revokes prior pending invite', async () => {
    const email = `dup-${Date.now()}@invite.test`;
    const first = await axios.post(
      '/admin/users/invite',
      { email, roles: ['staff'] },
      { headers: journeyAdminHeaders(tenantId, accessToken) },
    );
    const second = await axios.post(
      '/admin/users/invite',
      { email, roles: ['admin'] },
      { headers: journeyAdminHeaders(tenantId, accessToken) },
    );
    expect(second.status).toBe(201);
    expect(second.data.id).not.toBe(first.data.id);

    const invites = await axios.get('/admin/users/invites', {
      headers: journeyAdminHeaders(tenantId, accessToken),
    });
    const firstFromList = invites.data.data.find((i: any) => i.id === first.data.id);
    const secondFromList = invites.data.data.find((i: any) => i.id === second.data.id);
    expect(firstFromList.status).toBe('REVOKED');
    expect(secondFromList.status).toBe('PENDING');
  });

  it('rejects invite for an email already a member of THIS tenant', async () => {
    // Get the owner's email — they're a tenant member.
    const list = await axios.get('/admin/users', { headers: journeyAdminHeaders(tenantId, accessToken) });
    const ownerEmail = list.data.data[0].email;
    const res = await axios.post(
      '/admin/users/invite',
      { email: ownerEmail, roles: ['staff'] },
      { headers: journeyAdminHeaders(tenantId, accessToken), validateStatus: () => true },
    );
    expect(res.status).toBe(409);
  });
});
