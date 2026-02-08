import {
  Controller, Get, Post, Put, Delete, Param, Body, Headers,
  BadRequestException, UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { ScheduledReportsService } from './scheduled-reports.service';

@Controller('store/admin/reports/scheduled')
@UseGuards(StoreAdminGuard)
export class ScheduledReportsController {
  constructor(private readonly reportsService: ScheduledReportsService) {}

  @Get()
  async list(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reportsService.list(tenantId);
  }

  @Post()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { reportType: string; schedule: string; recipients: string[]; format?: string },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reportsService.create(tenantId, body);
  }

  @Put(':id')
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() body: { schedule?: string; recipients?: string[]; format?: string; isActive?: boolean },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reportsService.update(tenantId, id, body);
  }

  @Delete(':id')
  async delete(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reportsService.delete(tenantId, id);
  }
}
