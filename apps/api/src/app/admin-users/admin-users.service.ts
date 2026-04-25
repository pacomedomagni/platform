import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DbService } from '@platform/db';
import { randomBytes } from 'node:crypto';

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

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private readonly db: DbService) {}

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
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roles: true,
        emailVerified: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { data: users, total: users.length };
  }

  async get(tenantId: string, id: string) {
    const user = await this.db.user.findFirst({
      where: { tenantId, id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roles: true,
        emailVerified: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    return user;
  }

  async invite(
    tenantId: string,
    body: { email: string; firstName?: string; lastName?: string; roles?: string[] }
  ) {
    const email = body.email.trim().toLowerCase();
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      throw new HttpException('A user with that email already exists.', HttpStatus.CONFLICT);
    }
    const sanitizedRoles = sanitizeRoles(body.roles);

    // Random temp password — should be replaced via reset link or invite token flow.
    const tempPassword = randomBytes(24).toString('base64url');

    const user = await this.db.user.create({
      data: {
        email,
        password: tempPassword, // Caller should immediately trigger a password reset email.
        firstName: body.firstName ?? null,
        lastName: body.lastName ?? null,
        tenantId,
        roles: sanitizedRoles,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roles: true,
        emailVerified: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Invited user ${user.email} to tenant ${tenantId} with roles ${user.roles.join(',')}`);
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
      // Refuse to remove the last owner.
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

    return this.db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roles: true,
        emailVerified: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
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
}

function sanitizeRoles(input?: string[]): string[] {
  if (!input || input.length === 0) return ['user'];
  const filtered = input.filter((r) => ALLOWED_ROLES.has(r));
  if (filtered.length === 0) return ['user'];
  return Array.from(new Set(filtered));
}
