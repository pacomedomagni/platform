import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DbService } from '@platform/db';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';

/**
 * Built-in role definitions. The User model stores roles as a string[]; this list is
 * the authoritative catalog the admin UI presents and the backend will accept.
 */
export const ROLE_DEFINITIONS = [
  {
    id: 'owner',
    label: 'Owner',
    description: 'Full access including billing and tenant ownership.',
    permissions: ['*'],
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Manage products, orders, customers, and most settings.',
    permissions: [
      'products:*',
      'orders:*',
      'customers:*',
      'inventory:*',
      'reports:read',
      'settings:read',
      'settings:write',
      'marketplace:*',
      'users:invite',
    ],
  },
  {
    id: 'staff',
    label: 'Staff',
    description: 'Day-to-day fulfillment: orders, customers, inventory, reviews.',
    permissions: ['orders:*', 'customers:read', 'inventory:read', 'inventory:write', 'reviews:moderate', 'products:read'],
  },
  {
    id: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to dashboards and reports.',
    permissions: ['*:read'],
  },
  {
    id: 'user',
    label: 'User',
    description: 'Default basic role.',
    permissions: ['dashboard:read'],
  },
] as const;

const ALLOWED_ROLES = new Set<string>(ROLE_DEFINITIONS.map((r) => r.id));

/** 7 days from now. Tokens expire to limit blast radius of a leaked invite link. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Single round of bcrypt for the temp password is unnecessary because invitees never use it —
 * but we still hash to satisfy storage policies and avoid lint complaints about cleartext writes. */
const BCRYPT_ROUNDS = 10;

interface UserRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Subset of EmailService methods we actually use. Optional so unit tests can omit it. */
export interface InviteEmailSender {
  sendInviteEmail(args: {
    tenantId: string;
    to: string;
    inviterName: string | null;
    storeName: string;
    inviteUrl: string;
    expiresAt: Date;
  }): Promise<void>;
}

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly db: DbService,
    private readonly emailSender?: InviteEmailSender,
  ) {}

  // ─── User listing & lifecycle ─────────────────────────────────────────────

  async list(tenantId: string, opts: { q?: string; role?: string }) {
    const where: any = { tenantId };
    if (opts.q) {
      const q = opts.q.toLowerCase();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (opts.role && ALLOWED_ROLES.has(opts.role)) {
      where.roles = { has: opts.role };
    }

    const users: UserRow[] = await this.db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    });
    return { data: users, total: users.length };
  }

  async get(tenantId: string, id: string) {
    const user = await this.db.user.findFirst({ where: { tenantId, id }, select: userSelect });
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    return user;
  }

  async update(
    tenantId: string,
    id: string,
    body: { firstName?: string; lastName?: string; roles?: string[]; emailVerified?: boolean }
  ) {
    const existing = await this.db.user.findFirst({ where: { tenantId, id } });
    if (!existing) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    const data: any = {};
    if (body.firstName !== undefined) data.firstName = body.firstName;
    if (body.lastName !== undefined) data.lastName = body.lastName;
    if (body.roles !== undefined) {
      const sanitized = sanitizeRoles(body.roles);
      if (existing.roles.includes('owner') && !sanitized.includes('owner')) {
        const ownerCount = await this.db.user.count({ where: { tenantId, roles: { has: 'owner' } } });
        if (ownerCount <= 1) {
          throw new HttpException('At least one owner must remain.', HttpStatus.BAD_REQUEST);
        }
      }
      data.roles = sanitized;
    }
    if (body.emailVerified !== undefined) {
      data.emailVerified = body.emailVerified;
      data.emailVerifiedAt = body.emailVerified ? new Date() : null;
    }

    return this.db.user.update({ where: { id }, data, select: userSelect });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.db.user.findFirst({ where: { tenantId, id } });
    if (!existing) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    if (existing.roles.includes('owner')) {
      const ownerCount = await this.db.user.count({ where: { tenantId, roles: { has: 'owner' } } });
      if (ownerCount <= 1) {
        throw new HttpException('Cannot delete the last owner.', HttpStatus.BAD_REQUEST);
      }
    }
    await this.db.user.delete({ where: { id } });
    return { success: true };
  }

  // ─── Invite flow ──────────────────────────────────────────────────────────

  /**
   * Issue an invite. Returns invite metadata; the raw token is sent in the email link only.
   * If the email is already a member of this tenant we throw 409. If there's an outstanding
   * PENDING invite for the same email in this tenant, we revoke it before issuing the new one.
   */
  async invite(
    tenantId: string,
    body: {
      email: string;
      firstName?: string;
      lastName?: string;
      roles?: string[];
      invitedById?: string;
    },
    opts?: { acceptUrlBase?: string },
  ) {
    const email = body.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new HttpException('Valid email is required.', HttpStatus.BAD_REQUEST);
    }

    // A user with this email may already exist in another tenant — that's fine, we still
    // issue an invite; if they accept they'll get a separate User row scoped to this tenant.
    // We only block if the user is already in THIS tenant.
    const existingMember = await this.db.user.findFirst({ where: { tenantId, email } });
    if (existingMember) {
      throw new HttpException('A user with that email is already a member of this tenant.', HttpStatus.CONFLICT);
    }

    const sanitizedRoles = sanitizeRoles(body.roles);

    // Revoke any outstanding pending invite for this email + tenant so only one is active.
    await this.db.userInvite.updateMany({
      where: { tenantId, email, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const invite = await this.db.userInvite.create({
      data: {
        tenantId,
        email,
        firstName: body.firstName ?? null,
        lastName: body.lastName ?? null,
        roles: sanitizedRoles,
        tokenHash,
        expiresAt,
        invitedById: body.invitedById ?? null,
      },
      select: inviteSelect,
    });

    // Best-effort send. If the email pipeline isn't wired (unit/integration tests), we
    // fall back to logging the invite URL so the operator can hand-deliver during smoke.
    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, businessName: true, customDomain: true, domain: true },
    });
    const storeName = tenant?.businessName || tenant?.name || 'your store';
    const baseUrl = opts?.acceptUrlBase
      || process.env.FRONTEND_URL
      || (tenant?.customDomain ? `https://${tenant.customDomain}` : 'http://localhost:4200');
    const inviteUrl = `${baseUrl.replace(/\/$/, '')}/onboarding/accept-invite/${rawToken}`;

    let inviter: { firstName: string | null; lastName: string | null } | null = null;
    if (body.invitedById) {
      inviter = await this.db.user.findUnique({
        where: { id: body.invitedById },
        select: { firstName: true, lastName: true },
      });
    }
    const inviterName = inviter ? [inviter.firstName, inviter.lastName].filter(Boolean).join(' ') || null : null;

    if (this.emailSender) {
      try {
        await this.emailSender.sendInviteEmail({
          tenantId,
          to: email,
          inviterName,
          storeName,
          inviteUrl,
          expiresAt,
        });
      } catch (err) {
        this.logger.error(`Failed to send invite email to ${email}: ${err}`);
        // Don't fail the request — operator can resend. Surface a flag so callers know.
        return { ...invite, inviteUrl, emailDelivered: false };
      }
    } else {
      this.logger.warn(
        `Invite created but no EmailSender wired. Hand-deliver this URL: ${inviteUrl}`,
      );
    }

    // Return inviteUrl in non-production so operators can copy/paste during dev/smoke;
    // in production we omit it so a logging compromise doesn't leak the token.
    const includeUrl = process.env.NODE_ENV !== 'production';
    return {
      ...invite,
      ...(includeUrl ? { inviteUrl } : {}),
      emailDelivered: !!this.emailSender,
    };
  }

  async listInvites(tenantId: string, opts: { status?: string }) {
    const where: any = { tenantId };
    if (opts.status) where.status = opts.status;
    const invites = await this.db.userInvite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: inviteSelect,
    });
    return { data: invites, total: invites.length };
  }

  async revokeInvite(tenantId: string, id: string) {
    const invite = await this.db.userInvite.findFirst({ where: { tenantId, id } });
    if (!invite) throw new HttpException('Invite not found', HttpStatus.NOT_FOUND);
    if (invite.status !== 'PENDING') {
      throw new HttpException(`Cannot revoke a ${invite.status.toLowerCase()} invite.`, HttpStatus.BAD_REQUEST);
    }
    await this.db.userInvite.update({ where: { id }, data: { status: 'REVOKED' } });
    return { success: true };
  }

  /**
   * Re-issue the email + extend the expiry for an outstanding invite. Token is unchanged.
   */
  async resendInvite(tenantId: string, id: string, opts?: { acceptUrlBase?: string }) {
    const invite = await this.db.userInvite.findFirst({ where: { tenantId, id } });
    if (!invite) throw new HttpException('Invite not found', HttpStatus.NOT_FOUND);
    if (invite.status !== 'PENDING') {
      throw new HttpException(`Cannot resend a ${invite.status.toLowerCase()} invite.`, HttpStatus.BAD_REQUEST);
    }

    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const updated = await this.db.userInvite.update({
      where: { id },
      data: { expiresAt, resentAt: new Date(), resentCount: invite.resentCount + 1 },
      select: inviteSelect,
    });

    // We can't reissue the same token because we only stored its hash. The right thing to do
    // is rotate: issue a new raw token, update the hash, and email the new URL. This invalidates
    // any leaked older link.
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    await this.db.userInvite.update({ where: { id }, data: { tokenHash } });

    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, businessName: true, customDomain: true },
    });
    const storeName = tenant?.businessName || tenant?.name || 'your store';
    const baseUrl = opts?.acceptUrlBase
      || process.env.FRONTEND_URL
      || (tenant?.customDomain ? `https://${tenant.customDomain}` : 'http://localhost:4200');
    const inviteUrl = `${baseUrl.replace(/\/$/, '')}/onboarding/accept-invite/${rawToken}`;

    if (this.emailSender) {
      try {
        await this.emailSender.sendInviteEmail({
          tenantId,
          to: invite.email,
          inviterName: null,
          storeName,
          inviteUrl,
          expiresAt,
        });
      } catch (err) {
        this.logger.error(`Failed to resend invite email to ${invite.email}: ${err}`);
      }
    } else {
      this.logger.warn(`Invite resent but no EmailSender wired. URL: ${inviteUrl}`);
    }

    const includeUrl = process.env.NODE_ENV !== 'production';
    return {
      ...updated,
      ...(includeUrl ? { inviteUrl } : {}),
    };
  }

  // ─── Public accept-invite path (no auth) ──────────────────────────────────

  /**
   * Validate an invite token and return preview info for the accept page to render.
   * Returns 404 for missing tokens and 410 GONE for expired/revoked/accepted.
   */
  async previewInvite(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const invite = await this.db.userInvite.findFirst({
      where: { tokenHash },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roles: true,
        status: true,
        expiresAt: true,
        tenant: { select: { id: true, name: true, businessName: true } },
      },
    });
    if (!invite) throw new HttpException('Invite not found.', HttpStatus.NOT_FOUND);
    if (invite.status === 'ACCEPTED') {
      throw new HttpException('This invite has already been accepted.', HttpStatus.GONE);
    }
    if (invite.status === 'REVOKED') {
      throw new HttpException('This invite has been revoked.', HttpStatus.GONE);
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      // Mark expired so subsequent calls are consistent.
      await this.db.userInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
      throw new HttpException('This invite has expired.', HttpStatus.GONE);
    }
    return {
      email: invite.email,
      firstName: invite.firstName,
      lastName: invite.lastName,
      roles: invite.roles,
      storeName: invite.tenant.businessName || invite.tenant.name,
      expiresAt: invite.expiresAt,
    };
  }

  /**
   * Accept an invite: create the User row in the inviting tenant with the chosen password,
   * mark invite ACCEPTED, return the new userId. Caller (controller) issues the JWT.
   */
  async acceptInvite(rawToken: string, body: { password: string; firstName?: string; lastName?: string }) {
    if (!body.password || body.password.length < 8) {
      throw new HttpException('Password must be at least 8 characters.', HttpStatus.BAD_REQUEST);
    }

    const tokenHash = hashToken(rawToken);
    const invite = await this.db.userInvite.findFirst({ where: { tokenHash } });
    if (!invite) throw new HttpException('Invite not found.', HttpStatus.NOT_FOUND);
    if (invite.status !== 'PENDING') {
      throw new HttpException(`This invite is ${invite.status.toLowerCase()}.`, HttpStatus.GONE);
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      await this.db.userInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
      throw new HttpException('This invite has expired.', HttpStatus.GONE);
    }

    // Refuse if email is somehow already a member of this tenant (race).
    const existing = await this.db.user.findFirst({ where: { tenantId: invite.tenantId, email: invite.email } });
    if (existing) {
      throw new HttpException('You are already a member of this tenant. Sign in instead.', HttpStatus.CONFLICT);
    }

    const hashedPassword = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    const user = await this.db.user.create({
      data: {
        email: invite.email,
        password: hashedPassword,
        firstName: body.firstName?.trim() || invite.firstName,
        lastName: body.lastName?.trim() || invite.lastName,
        tenantId: invite.tenantId,
        roles: sanitizeRoles(invite.roles),
        emailVerified: true, // accepting from the email link proves ownership of the address
        emailVerifiedAt: new Date(),
      },
      select: userSelect,
    });

    await this.db.userInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedUserId: user.id },
    });

    return { user, tenantId: invite.tenantId };
  }
}

// ─── helpers ───────────────────────────────────────────────────────────────

function sanitizeRoles(input?: string[]): string[] {
  if (!input || input.length === 0) return ['user'];
  const filtered = input.filter((r) => ALLOWED_ROLES.has(r));
  if (filtered.length === 0) return ['user'];
  return Array.from(new Set(filtered));
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  roles: true,
  emailVerified: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const inviteSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  roles: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  invitedById: true,
  resentAt: true,
  resentCount: true,
  createdAt: true,
  updatedAt: true,
} as const;
