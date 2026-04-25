import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '@platform/auth';
import { AdminUsersService } from './admin-users.service';

/**
 * Public-facing invite endpoints. The raw invite token is the credential —
 * there is no Authorization header on these calls. Throttled tightly because
 * the accept endpoint accepts a password and creates a User row.
 */
@Controller('onboarding/invites')
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60_000 } })
export class InvitesPublicController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly auth: AuthService,
  ) {}

  /**
   * GET preview info for the accept page (no side-effect, used by the UI to render
   * "you've been invited to X by Y" before showing the password form).
   */
  @Get(':token')
  async preview(@Param('token') token: string) {
    return this.users.previewInvite(token);
  }

  /**
   * POST accept: create the User row, mark the invite ACCEPTED, return a JWT
   * so the new user is signed in immediately.
   */
  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Body() body: { password: string; firstName?: string; lastName?: string },
  ) {
    if (!body?.password) {
      throw new HttpException('Password is required.', HttpStatus.BAD_REQUEST);
    }
    const { user, tenantId } = await this.users.acceptInvite(token, body);
    // Hand the user to AuthService.login() so token issuance + refresh logic
    // matches what the regular login endpoint does. We attach tenantId because
    // userSelect omits it from the service return.
    const tokens = await this.auth.login({ ...user, tenantId });
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: tokens.user,
      tenantId,
    };
  }
}
