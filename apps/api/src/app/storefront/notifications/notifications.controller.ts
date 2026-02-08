import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Headers,
  Param,
  Query,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { NotificationsService } from './notifications.service';

@Controller('store/admin/notifications')
@UseGuards(StoreAdminGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('channels')
  async listChannels(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.notificationsService.listChannels(tenantId);
  }

  @Post('channels')
  async createChannel(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { type: string; provider: string; config: Record<string, unknown> },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.notificationsService.createChannel(tenantId, body);
  }

  @Put('channels/:id')
  async updateChannel(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      provider?: string;
      config?: Record<string, unknown>;
      isActive?: boolean;
      orderConfirmationEnabled?: boolean;
      shippingUpdateEnabled?: boolean;
      deliveryConfirmEnabled?: boolean;
      abandonedCartEnabled?: boolean;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.notificationsService.updateChannel(tenantId, id, body);
  }

  @Delete('channels/:id')
  async deleteChannel(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.notificationsService.deleteChannel(tenantId, id);
  }

  @Post('send')
  async sendNotification(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      channelId: string;
      recipient: string;
      messageType: string;
      content: string;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.notificationsService.sendNotification(tenantId, body);
  }

  @Post('send-order/:orderId')
  async sendOrderNotification(
    @Headers('x-tenant-id') tenantId: string,
    @Param('orderId') orderId: string,
    @Body('messageType') messageType: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.notificationsService.sendOrderNotification(tenantId, orderId, messageType);
  }

  @Get('logs')
  async listLogs(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('channelId') channelId?: string,
    @Query('status') status?: string,
    @Query('messageType') messageType?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.notificationsService.listLogs(tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      channelId,
      status,
      messageType,
    });
  }

  @Get('stats')
  async getNotificationStats(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.notificationsService.getNotificationStats(tenantId);
  }
}
