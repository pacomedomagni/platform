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
import { AuthGuard, PermissionsGuard, RequirePermission, Roles, RolesGuard } from '@platform/auth';
import { Tenant } from '../tenant.middleware';
import { AdminUsersService, ROLE_DEFINITIONS } from './admin-users.service';

/**
 * Guard stack:
 *   1. AuthGuard (JwtTenantGuard) — validates JWT + tenant header match.
 *   2. RolesGuard — coarse role gate; ensures only owner/admin reach this controller
 *      (defence in depth so a misconfigured @RequirePermission can't slip past).
 *   3. PermissionsGuard — fine-grained per-method check using @RequirePermission.
 *
 * Net behaviour: anonymous → 401; tenant mismatch → 401; correct tenant
 * but wrong role → 403; correct role but missing permission → 403.
 */
@Controller('admin/users')
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Roles('owner', 'admin')
@Throttle({ short: { limit: 30, ttl: 1000 }, medium: { limit: 200, ttl: 60000 } })
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get('roles')
  @RequirePermission('users:read')
  listRoles() {
    return ROLE_DEFINITIONS;
  }

  // ─── Pending invites ──────────────────────────────────────────────────────
  // Defined BEFORE the parametric :id routes so /invites doesn't get caught
  // by /:id.

  @Get('invites')
  @RequirePermission('users:read')
  listInvites(@Tenant() tenantId: string, @Query('status') status?: string) {
    return this.users.listInvites(tenantId, { status });
  }

  @Post('invite')
  @RequirePermission('users:invite')
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
    const invitedById = req.user?.userId ?? req.user?.sub ?? req.user?.id ?? null;
    return this.users.invite(tenantId, { ...body, invitedById });
  }

  @Post('invites/:id/resend')
  @RequirePermission('users:invite')
  resendInvite(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    const actorId = req.user?.userId ?? req.user?.sub ?? req.user?.id ?? undefined;
    return this.users.resendInvite(tenantId, id, actorId);
  }

  @Delete('invites/:id')
  @RequirePermission('users:invite')
  revokeInvite(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    const actorId = req.user?.userId ?? req.user?.sub ?? req.user?.id ?? undefined;
    return this.users.revokeInvite(tenantId, id, actorId);
  }

  // ─── Active users ─────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('users:read')
  list(@Tenant() tenantId: string, @Query('q') q?: string, @Query('role') role?: string) {
    return this.users.list(tenantId, { q, role });
  }

  @Get(':id')
  @RequirePermission('users:read')
  get(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.users.get(tenantId, id);
  }

  @Patch(':id')
  @RequirePermission('users:write')
  update(
    @Tenant() tenantId: string,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { firstName?: string; lastName?: string; roles?: string[]; emailVerified?: boolean },
  ) {
    const actorId = req.user?.userId ?? req.user?.sub ?? req.user?.id ?? undefined;
    return this.users.update(tenantId, id, body, actorId);
  }

  @Delete(':id')
  @RequirePermission('users:delete')
  remove(@Tenant() tenantId: string, @Req() req: any, @Param('id') id: string) {
    const actorId = req.user?.userId ?? req.user?.sub ?? req.user?.id ?? undefined;
    return this.users.remove(tenantId, id, actorId);
  }
}
