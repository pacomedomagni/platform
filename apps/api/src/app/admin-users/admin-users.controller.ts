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
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@platform/auth';
import { Tenant } from '../tenant.middleware';
import { AdminUsersService, ROLE_DEFINITIONS } from './admin-users.service';

@Controller('admin/users')
@UseGuards(AuthGuard)
@Throttle({ short: { limit: 30, ttl: 1000 }, medium: { limit: 200, ttl: 60000 } })
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get('roles')
  listRoles() {
    return ROLE_DEFINITIONS;
  }

  @Get()
  list(@Tenant() tenantId: string, @Query('q') q?: string, @Query('role') role?: string) {
    return this.users.list(tenantId, { q, role });
  }

  @Get(':id')
  get(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.users.get(tenantId, id);
  }

  @Post('invite')
  async invite(
    @Tenant() tenantId: string,
    @Body()
    body: {
      email: string;
      firstName?: string;
      lastName?: string;
      roles?: string[];
    }
  ) {
    if (!body?.email) throw new HttpException('Email required', HttpStatus.BAD_REQUEST);
    return this.users.invite(tenantId, body);
  }

  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { firstName?: string; lastName?: string; roles?: string[]; emailVerified?: boolean }
  ) {
    return this.users.update(tenantId, id, body);
  }

  @Delete(':id')
  remove(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.users.remove(tenantId, id);
  }
}
