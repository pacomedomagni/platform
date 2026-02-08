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
import { ReturnsService } from './returns.service';
import { ReturnStatus } from '@prisma/client';

@Controller('store/admin/returns')
@UseGuards(StoreAdminGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  /**
   * List returns
   * GET /api/v1/store/admin/returns
   */
  @Get()
  async listReturns(
    @Headers('x-tenant-id') tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: ReturnStatus,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.returnsService.listReturns(tenantId, {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      status,
    });
  }

  /**
   * Return statistics
   * GET /api/v1/store/admin/returns/stats
   */
  @Get('stats')
  async getStats(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.returnsService.getReturnStats(tenantId);
  }

  /**
   * Get a single return
   * GET /api/v1/store/admin/returns/:id
   */
  @Get(':id')
  async getReturn(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.returnsService.getReturn(tenantId, id);
  }

  /**
   * Create a return request
   * POST /api/v1/store/admin/returns
   */
  @Post()
  async createReturn(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      orderId: string;
      reason: string;
      notes?: string;
      resolution?: string;
      items: Array<{
        orderItemId?: string;
        productName: string;
        sku?: string;
        quantity: number;
        unitPrice: number;
        reason?: string;
      }>;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.returnsService.createReturn(tenantId, body);
  }

  /**
   * Approve a return
   * POST /api/v1/store/admin/returns/:id/approve
   */
  @Post(':id/approve')
  async approveReturn(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() body: { approvedBy: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.returnsService.approveReturn(tenantId, id, body.approvedBy);
  }

  /**
   * Reject a return
   * POST /api/v1/store/admin/returns/:id/reject
   */
  @Post(':id/reject')
  async rejectReturn(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.returnsService.rejectReturn(tenantId, id, body.reason);
  }

  /**
   * Receive items for a return
   * POST /api/v1/store/admin/returns/:id/receive
   */
  @Post(':id/receive')
  async receiveItems(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.returnsService.receiveItems(tenantId, id);
  }

  /**
   * Restock items for a return
   * POST /api/v1/store/admin/returns/:id/restock
   */
  @Post(':id/restock')
  async restockItems(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.returnsService.restockItems(tenantId, id);
  }

  /**
   * Process refund for a return
   * POST /api/v1/store/admin/returns/:id/refund
   */
  @Post(':id/refund')
  async processRefund(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() body: { refundAmount: number; refundMethod?: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.returnsService.processRefund(tenantId, id, body);
  }
}
