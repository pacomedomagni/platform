import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, Roles, RolesGuard } from '@platform/auth';
import { Tenant } from '../tenant.middleware';
import { AdminUsersService, ROLE_DEFINITIONS } from './admin-users.service';

/**
 * AuthGuard validates JWT + tenant match. RolesGuard then enforces that the caller
 * has the required role for each endpoint. The combo: anonymous → 401, wrong tenant → 401,
 * authenticated but not owner/admin → 403.
 *
 * Note on role hierarchy: RolesGuard treats `admin` as a tenant-wide superuser, so endpoints
 * marked @Roles('owner') are accessible to admins too within the same tenant. Use @Roles('owner')
 * sparingly — only for actions that should be restricted to the tenant owner specifically.
 */
@Controller('admin/users')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 30, ttl: 1000 }, medium: { limit: 200, ttl: 60000 } })
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get('roles')
  @Roles('owner', 'admin', 'staff', 'viewer')
  listRoles() {
    return ROLE_DEFINITIONS;
  }

  // ─── Pending invites ──────────────────────────────────────────────────────
  // Defined BEFORE the parametric :id routes so /invites doesn't get caught
  // by /:id.

  @Get('invites')
  @Roles('owner', 'admin')
  listInvites(@Tenant() tenantId: string, @Query('status') status?: string) {
    return this.users.listInvites(tenantId, { status });
  }

  @Post('invite')
  @Roles('owner', 'admin')
  async invite(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Body()
    body: {
      email: string;
      firstName?: string;
      lastName?: string;
      roles?: string[];
    },
  ) {
    if (!body?.email) throw new HttpException('Email required', HttpStatus.BAD_REQUEST);
    const invitedById = req.user?.sub ?? req.user?.id ?? null;
    return this.users.invite(tenantId, { ...body, invitedById });
  }

  @Post('invites/:id/resend')
  @Roles('owner', 'admin')
  resendInvite(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.users.resendInvite(tenantId, id);
  }

  @Delete('invites/:id')
  @Roles('owner', 'admin')
  revokeInvite(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.users.revokeInvite(tenantId, id);
  }

  // ─── Active users ─────────────────────────────────────────────────────────

  @Get()
  @Roles('owner', 'admin')
  list(@Tenant() tenantId: string, @Query('q') q?: string, @Query('role') role?: string) {
    return this.users.list(tenantId, { q, role });
  }

  @Get(':id')
  @Roles('owner', 'admin')
  get(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.users.get(tenantId, id);
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  update(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { firstName?: string; lastName?: string; roles?: string[]; emailVerified?: boolean },
  ) {
    return this.users.update(tenantId, id, body);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  remove(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.users.remove(tenantId, id);
  }
}
