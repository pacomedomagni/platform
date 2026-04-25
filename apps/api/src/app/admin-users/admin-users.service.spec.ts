/**
 * Unit tests for AdminUsersService.
 *
 * These cover business rules that don't depend on the database:
 *  - role sanitization (unknown roles dropped, deduped, defaulted to ['user'])
 *  - last-owner protection on PATCH and DELETE
 *  - tenant scoping of get/list/update/delete
 *  - invite issuance: hashed token storage, raw URL returned in non-prod, dedupe of pending invites
 *  - accept-invite: validation, expiry, status transitions
 *  - email sender failure does not fail the request
 *
 * The PrismaService and InviteEmailSender are fully mocked so these tests run fast.
 * Integration tests in apps/api-e2e/src/api/30-admin-users.spec.ts cover the
 * full HTTP path with the real RolesGuard wired in.
 */
import { Test } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { AdminUsersService, ROLE_DEFINITIONS } from './admin-users.service';

type Mock<T> = { [K in keyof T]: jest.Mock };

function makePrismaMock() {
  return {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    userInvite: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
  };
}

function makeEmailSenderMock(): { sendInviteEmail: jest.Mock } {
  return { sendInviteEmail: jest.fn().mockResolvedValue(undefined) };
}

const TENANT = 'tenant-123';

const baseUser = {
  id: 'user-1',
  email: 'one@example.test',
  firstName: null,
  lastName: null,
  roles: ['admin', 'user'],
  emailVerified: false,
  emailVerifiedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  tenantId: TENANT,
  password: 'hashed',
};

const baseTenant = { name: 'Acme', businessName: 'Acme Inc', customDomain: null, domain: null };

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let email: ReturnType<typeof makeEmailSenderMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    email = makeEmailSenderMock();
    const moduleRef = await Test.createTestingModule({
      providers: [AdminUsersService],
    })
      .overrideProvider(AdminUsersService)
      .useFactory({
        factory: () => new AdminUsersService(prisma as any, email),
      })
      .compile();
    service = moduleRef.get(AdminUsersService);
  });

  describe('role catalog', () => {
    it('exports owner/admin/staff/viewer/user definitions', () => {
      const ids = ROLE_DEFINITIONS.map((r) => r.id);
      expect(ids).toEqual(['owner', 'admin', 'staff', 'viewer', 'user']);
    });

    it('every role has a label, description, and permissions array', () => {
      for (const r of ROLE_DEFINITIONS) {
        expect(typeof r.label).toBe('string');
        expect(typeof r.description).toBe('string');
        expect(Array.isArray(r.permissions)).toBe(true);
        expect(r.permissions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('list()', () => {
    it('scopes the query to the requested tenant', async () => {
      prisma.user.findMany.mockResolvedValue([baseUser]);
      const result = await service.list(TENANT, {});
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
      );
      expect(result.total).toBe(1);
    });

    it('applies search across email + firstName + lastName when q is set', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.list(TENANT, { q: 'alex' });
      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(3);
      expect(where.OR.map((c: any) => Object.keys(c)[0])).toEqual(['email', 'firstName', 'lastName']);
    });

    it('filters by role only when role is in the allowed set', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.list(TENANT, { role: 'admin' });
      expect(prisma.user.findMany.mock.calls[0][0].where.roles).toEqual({ has: 'admin' });

      prisma.user.findMany.mockResolvedValue([]);
      await service.list(TENANT, { role: 'unknown-role' });
      // Unknown role silently dropped — query proceeds without role filter
      expect(prisma.user.findMany.mock.calls[1][0].where.roles).toBeUndefined();
    });
  });

  describe('get()', () => {
    it('returns the user when it belongs to the tenant', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);
      const u = await service.get(TENANT, 'user-1');
      expect(u.id).toBe('user-1');
    });

    it('throws 404 when not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.get(TENANT, 'missing')).rejects.toThrow(HttpException);
    });
  });

  describe('invite()', () => {
    beforeEach(() => {
      prisma.tenant.findUnique.mockResolvedValue(baseTenant);
    });

    it('rejects when email is empty or malformed', async () => {
      await expect(service.invite(TENANT, { email: '' })).rejects.toThrow(/valid email/i);
      await expect(service.invite(TENANT, { email: 'not-an-email' })).rejects.toThrow(/valid email/i);
    });

    it('rejects when the email is already a member of THIS tenant (409)', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        service.invite(TENANT, { email: 'taken@example.test' }),
      ).rejects.toThrow(/already a member/i);
    });

    it('does NOT reject when the email exists only in a different tenant', async () => {
      prisma.user.findFirst.mockResolvedValue(null); // not in this tenant
      prisma.userInvite.create.mockResolvedValue({ id: 'inv-1', email: 'x@y.test', status: 'PENDING' });
      const result = await service.invite(TENANT, { email: 'x@y.test' });
      expect(result).toBeDefined();
    });

    it('lowercases + trims email before checking', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.userInvite.create.mockResolvedValue({ id: 'inv-1' });
      await service.invite(TENANT, { email: '  Mixed@Case.TEST  ' });
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { tenantId: TENANT, email: 'mixed@case.test' },
      });
    });

    it('revokes any outstanding pending invite for the same email before issuing a new one', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.userInvite.create.mockResolvedValue({ id: 'inv-2' });
      await service.invite(TENANT, { email: 'reissue@y.test' });
      expect(prisma.userInvite.updateMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT, email: 'reissue@y.test', status: 'PENDING' },
        data: { status: 'REVOKED' },
      });
    });

    it('stores only the SHA-256 hash of the token, never the raw token', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.userInvite.create.mockResolvedValue({ id: 'inv-3' });
      await service.invite(TENANT, { email: 'hash@y.test' });
      const data = prisma.userInvite.create.mock.calls[0][0].data;
      expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
      expect(data).not.toHaveProperty('token');
    });

    it('defaults to ["user"] when roles are omitted', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.userInvite.create.mockResolvedValue({ id: 'inv-4' });
      await service.invite(TENANT, { email: 'x@y.test' });
      expect(prisma.userInvite.create.mock.calls[0][0].data.roles).toEqual(['user']);
    });

    it('drops unknown roles and dedupes', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.userInvite.create.mockResolvedValue({ id: 'inv-5' });
      await service.invite(TENANT, {
        email: 'x@y.test',
        roles: ['admin', 'admin', 'staff', 'NOT_A_REAL_ROLE'],
      });
      const created = prisma.userInvite.create.mock.calls[0][0].data.roles;
      expect(created).toEqual(['admin', 'staff']);
    });

    it('falls back to ["user"] if every role provided is invalid', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.userInvite.create.mockResolvedValue({ id: 'inv-6' });
      await service.invite(TENANT, { email: 'x@y.test', roles: ['nope'] });
      expect(prisma.userInvite.create.mock.calls[0][0].data.roles).toEqual(['user']);
    });

    it('sets a 7-day expiresAt', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.userInvite.create.mockResolvedValue({ id: 'inv-7' });
      const before = Date.now();
      await service.invite(TENANT, { email: 'x@y.test' });
      const expires = (prisma.userInvite.create.mock.calls[0][0].data.expiresAt as Date).getTime();
      const diff = expires - before;
      const day = 24 * 60 * 60 * 1000;
      expect(diff).toBeGreaterThan(7 * day - 5_000);
      expect(diff).toBeLessThan(7 * day + 5_000);
    });

    it('calls the email sender once with the accept URL', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.userInvite.create.mockResolvedValue({ id: 'inv-8', email: 'mail@y.test' });
      await service.invite(TENANT, { email: 'mail@y.test' });
      expect(email.sendInviteEmail).toHaveBeenCalledTimes(1);
      const args = email.sendInviteEmail.mock.calls[0][0];
      expect(args.to).toBe('mail@y.test');
      expect(args.inviteUrl).toMatch(/\/onboarding\/accept-invite\/[A-Za-z0-9_-]{20,}$/);
      expect(args.expiresAt).toBeInstanceOf(Date);
    });

    it('does NOT throw when the email sender errors — request still succeeds', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.userInvite.create.mockResolvedValue({ id: 'inv-9' });
      email.sendInviteEmail.mockRejectedValueOnce(new Error('SMTP down'));
      const result = await service.invite(TENANT, { email: 'soft@y.test' });
      expect(result).toBeDefined();
      expect((result as any).emailDelivered).toBe(false);
    });

    it('returns inviteUrl in non-production for operator hand-delivery', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.userInvite.create.mockResolvedValue({ id: 'inv-10' });
      const result = await service.invite(TENANT, { email: 'dev@y.test' });
      expect((result as any).inviteUrl).toMatch(/\/onboarding\/accept-invite\//);
      process.env.NODE_ENV = prev;
    });

    it('omits inviteUrl in production', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.userInvite.create.mockResolvedValue({ id: 'inv-11' });
      const result = await service.invite(TENANT, { email: 'prod@y.test' });
      expect((result as any).inviteUrl).toBeUndefined();
      process.env.NODE_ENV = prev;
    });
  });

  describe('previewInvite()', () => {
    it('returns 404 for unknown token', async () => {
      prisma.userInvite.findFirst.mockResolvedValue(null);
      await expect(service.previewInvite('bogus')).rejects.toThrow(HttpException);
    });

    it('returns 410 GONE for accepted invite', async () => {
      prisma.userInvite.findFirst.mockResolvedValue({
        id: 'i', email: 'e@e.test', firstName: null, lastName: null,
        roles: ['staff'], status: 'ACCEPTED', expiresAt: new Date(Date.now() + 1000),
        tenant: { id: TENANT, name: 'A', businessName: 'A' },
      });
      await expect(service.previewInvite('t')).rejects.toMatchObject({ status: 410 });
    });

    it('returns 410 GONE for revoked invite', async () => {
      prisma.userInvite.findFirst.mockResolvedValue({
        id: 'i', email: 'e@e.test', firstName: null, lastName: null,
        roles: ['staff'], status: 'REVOKED', expiresAt: new Date(Date.now() + 1000),
        tenant: { id: TENANT, name: 'A', businessName: 'A' },
      });
      await expect(service.previewInvite('t')).rejects.toMatchObject({ status: 410 });
    });

    it('marks expired and throws 410 when past expiresAt', async () => {
      prisma.userInvite.findFirst.mockResolvedValue({
        id: 'i', email: 'e@e.test', firstName: null, lastName: null,
        roles: ['staff'], status: 'PENDING', expiresAt: new Date(Date.now() - 1000),
        tenant: { id: TENANT, name: 'A', businessName: 'A' },
      });
      await expect(service.previewInvite('t')).rejects.toMatchObject({ status: 410 });
      expect(prisma.userInvite.update).toHaveBeenCalledWith({
        where: { id: 'i' }, data: { status: 'EXPIRED' },
      });
    });

    it('returns preview info for a valid PENDING invite', async () => {
      prisma.userInvite.findFirst.mockResolvedValue({
        id: 'i', email: 'who@y.test', firstName: 'W', lastName: 'X',
        roles: ['staff'], status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
        tenant: { id: TENANT, name: 'Acme', businessName: 'Acme Inc' },
      });
      const result = await service.previewInvite('t');
      expect(result.email).toBe('who@y.test');
      expect(result.storeName).toBe('Acme Inc');
      expect(result.roles).toEqual(['staff']);
    });
  });

  describe('acceptInvite()', () => {
    it('rejects when password is missing or under 8 chars', async () => {
      await expect(
        service.acceptInvite('tok', { password: '' }),
      ).rejects.toThrow(/8 characters/);
      await expect(
        service.acceptInvite('tok', { password: 'short' }),
      ).rejects.toThrow(/8 characters/);
    });

    it('rejects unknown token (404)', async () => {
      prisma.userInvite.findFirst.mockResolvedValue(null);
      await expect(
        service.acceptInvite('tok', { password: 'goodpassword' }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('rejects already-accepted invite (410)', async () => {
      prisma.userInvite.findFirst.mockResolvedValue({
        id: 'i', email: 'e@e.test', tenantId: TENANT, roles: ['staff'],
        status: 'ACCEPTED', expiresAt: new Date(Date.now() + 60_000),
      });
      await expect(
        service.acceptInvite('tok', { password: 'goodpassword' }),
      ).rejects.toMatchObject({ status: 410 });
    });

    it('marks invite EXPIRED + 410 when past expiresAt', async () => {
      prisma.userInvite.findFirst.mockResolvedValue({
        id: 'i', email: 'e@e.test', tenantId: TENANT, roles: ['staff'],
        status: 'PENDING', expiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.acceptInvite('tok', { password: 'goodpassword' }),
      ).rejects.toMatchObject({ status: 410 });
      expect(prisma.userInvite.update).toHaveBeenCalledWith({
        where: { id: 'i' }, data: { status: 'EXPIRED' },
      });
    });

    it('refuses if a User with that email is already in the tenant (race)', async () => {
      prisma.userInvite.findFirst.mockResolvedValue({
        id: 'i', email: 'e@e.test', tenantId: TENANT, roles: ['staff'],
        status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.user.findFirst.mockResolvedValue({ id: 'racing' });
      await expect(
        service.acceptInvite('tok', { password: 'goodpassword' }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('creates a User with hashed password, marks emailVerified, and updates the invite to ACCEPTED', async () => {
      prisma.userInvite.findFirst.mockResolvedValue({
        id: 'i', email: 'fresh@y.test', tenantId: TENANT, roles: ['staff'], firstName: null, lastName: null,
        status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...baseUser, email: 'fresh@y.test', roles: ['staff'], emailVerified: true });

      const result = await service.acceptInvite('tok', { password: 'goodpassword', firstName: 'F', lastName: 'L' });

      const userData = prisma.user.create.mock.calls[0][0].data;
      expect(userData.email).toBe('fresh@y.test');
      expect(userData.password).not.toBe('goodpassword');
      expect(userData.password).toMatch(/^\$2[aby]\$/); // bcrypt
      expect(userData.tenantId).toBe(TENANT);
      expect(userData.emailVerified).toBe(true);
      expect(userData.firstName).toBe('F');
      expect(userData.lastName).toBe('L');

      expect(prisma.userInvite.update).toHaveBeenCalledWith({
        where: { id: 'i' },
        data: expect.objectContaining({ status: 'ACCEPTED', acceptedUserId: baseUser.id }),
      });

      expect(result.tenantId).toBe(TENANT);
    });
  });

  describe('listInvites() / revokeInvite() / resendInvite()', () => {
    it('list scopes by tenant and optional status', async () => {
      prisma.userInvite.findMany.mockResolvedValue([]);
      await service.listInvites(TENANT, { status: 'PENDING' });
      expect(prisma.userInvite.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { tenantId: TENANT, status: 'PENDING' },
      }));
    });

    it('revoke 404s when not found', async () => {
      prisma.userInvite.findFirst.mockResolvedValue(null);
      await expect(service.revokeInvite(TENANT, 'missing')).rejects.toMatchObject({ status: 404 });
    });

    it('revoke rejects non-pending invites with 400', async () => {
      prisma.userInvite.findFirst.mockResolvedValue({ id: 'i', status: 'ACCEPTED' });
      await expect(service.revokeInvite(TENANT, 'i')).rejects.toMatchObject({ status: 400 });
    });

    it('revoke marks PENDING invite as REVOKED', async () => {
      prisma.userInvite.findFirst.mockResolvedValue({ id: 'i', status: 'PENDING' });
      const result = await service.revokeInvite(TENANT, 'i');
      expect(result.success).toBe(true);
      expect(prisma.userInvite.update).toHaveBeenCalledWith({
        where: { id: 'i' }, data: { status: 'REVOKED' },
      });
    });

    it('resend rotates the token (new tokenHash) and re-emails', async () => {
      prisma.userInvite.findFirst.mockResolvedValue({
        id: 'i', email: 're@y.test', tenantId: TENANT, roles: ['staff'],
        status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
        firstName: null, lastName: null, resentCount: 0,
      });
      prisma.userInvite.update.mockResolvedValue({ id: 'i', resentCount: 1 });
      prisma.tenant.findUnique.mockResolvedValue(baseTenant);

      await service.resendInvite(TENANT, 'i');

      // First update: bump expiresAt + resentCount
      expect(prisma.userInvite.update.mock.calls[0][0].data).toMatchObject({
        resentCount: 1,
        resentAt: expect.any(Date),
        expiresAt: expect.any(Date),
      });
      // Second update: rotate tokenHash
      expect(prisma.userInvite.update.mock.calls[1][0].data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(email.sendInviteEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('update()', () => {
    it('throws 404 when target user is not in the tenant', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.update(TENANT, 'missing', { firstName: 'A' })).rejects.toThrow(HttpException);
    });

    it('rejects demotion that would leave zero owners', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...baseUser, roles: ['owner'] });
      prisma.user.count.mockResolvedValue(1);
      await expect(
        service.update(TENANT, 'user-1', { roles: ['admin'] }),
      ).rejects.toThrow(/owner must remain/i);
    });

    it('allows demotion when another owner exists', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...baseUser, roles: ['owner'] });
      prisma.user.count.mockResolvedValue(2);
      prisma.user.update.mockResolvedValue({ ...baseUser, roles: ['admin'] });
      const result = await service.update(TENANT, 'user-1', { roles: ['admin'] });
      expect(result.roles).toEqual(['admin']);
    });
  });

  describe('remove()', () => {
    it('throws 404 when target user is not in the tenant', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.remove(TENANT, 'missing')).rejects.toThrow(HttpException);
    });

    it('rejects deleting the last owner', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...baseUser, roles: ['owner'] });
      prisma.user.count.mockResolvedValue(1);
      await expect(service.remove(TENANT, 'user-1')).rejects.toThrow(/last owner/i);
    });

    it('allows deleting non-owner users without checking owner count', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);
      prisma.user.delete.mockResolvedValue(baseUser);
      const result = await service.remove(TENANT, 'user-1');
      expect(result.success).toBe(true);
      expect(prisma.user.count).not.toHaveBeenCalled();
    });
  });
});
