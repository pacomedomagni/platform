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
import { EbayReturnsService } from './ebay-returns.service';
import {
  SyncReturnsDto,
  GetReturnsQueryDto,
  DeclineReturnDto,
  RefundReturnDto,
  SendReturnMessageDto,
} from '../shared/marketplace.dto';

/**
 * eBay Returns API Controller
 * Manages return sync from eBay and return lifecycle actions
 */
@Controller('marketplace/returns')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayReturnsController {
  constructor(private returnsService: EbayReturnsService) {}

  /**
   * Trigger return sync for a connection
   * POST /api/marketplace/returns/sync
   */
  @Post('sync')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async syncReturns(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: SyncReturnsDto
  ) {
    const result = await this.returnsService.syncReturns(tenantId, dto.connectionId);
    return {
      success: true,
      message: `Synced ${result.itemsSuccess}/${result.itemsTotal} returns`,
      ...result,
    };
  }

  /**
   * List synced marketplace returns
   * GET /api/marketplace/returns
   */
  @Get()
  async getReturns(
    @Tenant() tenantId: string,
    @Query(ValidationPipe) query: GetReturnsQueryDto
  ) {
    return this.returnsService.getReturns(tenantId, {
      connectionId: query.connectionId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /**
   * Get single return detail
   * GET /api/marketplace/returns/:id
   */
  @Get(':id')
  async getReturn(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    return this.returnsService.getReturn(tenantId, id);
  }

  /**
   * Approve a return
   * POST /api/marketplace/returns/:id/approve
   */
  @Post(':id/approve')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async approveReturn(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    await this.returnsService.approveReturn(tenantId, id);
    return { success: true, message: 'Return approved' };
  }

  /**
   * Decline a return
   * POST /api/marketplace/returns/:id/decline
   */
  @Post(':id/decline')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async declineReturn(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: DeclineReturnDto
  ) {
    await this.returnsService.declineReturn(tenantId, id, dto.reason);
    return { success: true, message: 'Return declined' };
  }

  /**
   * Issue refund for a return
   * POST /api/marketplace/returns/:id/refund
   */
  @Post(':id/refund')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async issueRefund(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: RefundReturnDto
  ) {
    await this.returnsService.issueRefund(tenantId, id, dto.amount, dto.comment);
    return { success: true, message: 'Refund issued' };
  }

  /**
   * Mark return as received
   * POST /api/marketplace/returns/:id/received
   */
  @Post(':id/received')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async markReturnReceived(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    await this.returnsService.markReturnReceived(tenantId, id);
    return { success: true, message: 'Return marked as received' };
  }

  /**
   * Send message on a return
   * POST /api/marketplace/returns/:id/message
   */
  @Post(':id/message')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async sendReturnMessage(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: SendReturnMessageDto
  ) {
    await this.returnsService.sendReturnMessage(tenantId, id, dto.message);
    return { success: true, message: 'Message sent' };
  }
}
