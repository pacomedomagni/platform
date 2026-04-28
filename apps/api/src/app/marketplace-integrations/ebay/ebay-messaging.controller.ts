import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayMessagingService } from './ebay-messaging.service';
import {
  SyncMessagesDto,
  GetMessagesQueryDto,
  ReplyMessageDto,
} from '../shared/marketplace.dto';

/**
 * eBay Messaging API Controller
 * Manages buyer-seller message sync, retrieval, and replies
 */
@Controller('marketplace/messages')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayMessagingController {
  constructor(private messagingService: EbayMessagingService) {}

  /**
   * Trigger message sync for a connection
   * POST /api/marketplace/messages/sync
   */
  @Post('sync')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async syncMessages(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: SyncMessagesDto
  ) {
    const result = await this.messagingService.syncMessages(tenantId, dto.connectionId);
    return {
      success: true,
      message: `Synced ${result.itemsSuccess}/${result.itemsTotal} messages`,
      ...result,
    };
  }

  /**
   * List message threads with optional filters
   * GET /api/marketplace/messages
   */
  @Get()
  @Roles('admin', 'System Manager', 'Inventory Manager', 'Customer Service')
  async getThreads(
    @Tenant() tenantId: string,
    @Query(ValidationPipe) query: GetMessagesQueryDto
  ) {
    return this.messagingService.getThreads(tenantId, {
      connectionId: query.connectionId,
      status: query.status,
      unreadOnly: query.unreadOnly,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /**
   * Get unread message count
   * GET /api/marketplace/messages/unread-count
   *
   * NOTE: This route is defined BEFORE the :id route to avoid
   * "unread-count" being captured as a thread ID parameter.
   */
  @Get('unread-count')
  @Roles('admin', 'System Manager', 'Inventory Manager', 'Customer Service')
  async getUnreadCount(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId?: string
  ) {
    const count = await this.messagingService.getUnreadCount(tenantId, connectionId);
    return { unreadCount: count };
  }

  /**
   * Get a single message thread with all messages
   * GET /api/marketplace/messages/:id
   */
  @Get(':id')
  @Roles('admin', 'System Manager', 'Inventory Manager', 'Customer Service')
  async getThread(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    return this.messagingService.getThread(tenantId, id);
  }

  /**
   * Reply to a message thread
   * POST /api/marketplace/messages/:id/reply
   */
  @Post(':id/reply')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async replyToMessage(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: ReplyMessageDto
  ) {
    await this.messagingService.replyToMessage(tenantId, id, dto.body);
    return { success: true, message: 'Reply sent successfully' };
  }

  /**
   * Mark a message thread as read
   * POST /api/marketplace/messages/:id/read
   */
  @Post(':id/read')
  @Roles('admin', 'System Manager', 'Inventory Manager', 'Customer Service')
  async markAsRead(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    await this.messagingService.markAsRead(tenantId, id);
    return { success: true, message: 'Thread marked as read' };
  }
}
