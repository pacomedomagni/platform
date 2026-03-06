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
import { EbayOrderSyncService } from './ebay-order-sync.service';
import {
  SyncOrdersDto,
  GetMarketplaceOrdersQueryDto,
  FulfillOrderDto,
  IssueOrderRefundDto,
} from '../shared/marketplace.dto';

/**
 * eBay Orders API Controller
 * Manages order sync from eBay and fulfillment push-back
 */
@Controller('marketplace/orders')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayOrdersController {
  constructor(private orderSyncService: EbayOrderSyncService) {}

  /**
   * Trigger order sync for a connection
   * POST /api/marketplace/orders/sync
   */
  @Post('sync')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async syncOrders(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: SyncOrdersDto
  ) {
    const result = await this.orderSyncService.syncOrders(tenantId, dto.connectionId);
    return {
      success: true,
      message: `Synced ${result.itemsSuccess}/${result.itemsTotal} orders`,
      ...result,
    };
  }

  /**
   * List synced marketplace orders
   * GET /api/marketplace/orders
   */
  @Get()
  async getOrders(
    @Tenant() tenantId: string,
    @Query(ValidationPipe) query: GetMarketplaceOrdersQueryDto
  ) {
    return this.orderSyncService.getOrders(tenantId, query.connectionId, {
      fulfillmentStatus: query.fulfillmentStatus,
      paymentStatus: query.paymentStatus,
      syncStatus: query.syncStatus,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /**
   * Get single order detail
   * GET /api/marketplace/orders/:id
   */
  @Get(':id')
  async getOrder(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    return this.orderSyncService.getOrder(tenantId, id);
  }

  /**
   * Push fulfillment to eBay (mark order as shipped)
   * POST /api/marketplace/orders/:id/fulfill
   */
  @Post(':id/fulfill')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async fulfillOrder(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: FulfillOrderDto
  ) {
    return this.orderSyncService.fulfillOrder(
      tenantId,
      id,
      dto.trackingNumber,
      dto.carrier
    );
  }

  /**
   * Issue a refund for a marketplace order
   * POST /api/marketplace/orders/:id/refund
   */
  @Post(':id/refund')
  @Roles('admin', 'System Manager')
  async issueRefund(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: IssueOrderRefundDto
  ) {
    return this.orderSyncService.issueRefund(tenantId, id, dto);
  }

  /**
   * Create a NoSlag Order from a synced marketplace order.
   * This links the marketplace order into the core order system for unified
   * fulfillment, inventory reservations, and reporting.
   * POST /api/marketplace/orders/:id/create-order
   */
  @Post(':id/create-order')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createNoSlagOrder(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    const order = await this.orderSyncService.createNoSlagOrder(tenantId, id);
    return {
      success: true,
      message: `Created NoSlag order ${order.orderNumber}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  }
}
