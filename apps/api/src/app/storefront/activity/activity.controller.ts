import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { ActivityService } from './activity.service';

@Controller('store/admin/activity')
@UseGuards(StoreAdminGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  /**
   * Get entity timeline
   * GET /api/v1/store/admin/activity/timeline/:entityType/:entityId
   */
  @Get('timeline/:entityType/:entityId')
  async getTimeline(
    @Headers('x-tenant-id') tenantId: string,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.activityService.getTimeline(tenantId, entityType, entityId, {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * Get recent activity across all entities
   * GET /api/v1/store/admin/activity/recent
   */
  @Get('recent')
  async getRecentActivity(
    @Headers('x-tenant-id') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.activityService.getRecentActivity(
      tenantId,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * Log a manual activity event (e.g., note)
   * POST /api/v1/store/admin/activity
   */
  @Post()
  async logActivity(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      entityType: string;
      entityId: string;
      eventType: string;
      title: string;
      description?: string;
      metadata?: Record<string, unknown>;
      actorType?: string;
      actorId?: string;
      actorName?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.activityService.logActivity(tenantId, body);
  }
}
