import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayShippingService } from './ebay-shipping.service';

/**
 * eBay Shipping Labels API Controller
 * Manages shipping quotes, label purchases, downloads, and cancellations
 * via the eBay Sell Logistics API.
 */
@Controller('marketplace/shipping')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayShippingController {
  constructor(private shippingService: EbayShippingService) {}

  /**
   * Get a shipping rate quote for an order
   * POST /api/marketplace/shipping/quote
   */
  @Post('quote')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getShippingQuote(
    @Tenant() tenantId: string,
    @Body() body: { connectionId: string; orderId: string; shippingOption?: string }
  ) {
    if (!body.connectionId || !body.orderId) {
      throw new HttpException(
        'connectionId and orderId are required',
        HttpStatus.BAD_REQUEST
      );
    }

    const result = await this.shippingService.getShippingQuote(
      body.connectionId,
      {
        orderId: body.orderId,
        shippingOption: body.shippingOption,
      }
    );
    return { success: true, ...result };
  }

  /**
   * Create shipment / purchase shipping label
   * POST /api/marketplace/shipping
   */
  @Post()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createShipment(
    @Tenant() tenantId: string,
    @Body() body: { connectionId: string; shippingQuoteId: string; rateId: string }
  ) {
    if (!body.connectionId || !body.shippingQuoteId || !body.rateId) {
      throw new HttpException(
        'connectionId, shippingQuoteId, and rateId are required',
        HttpStatus.BAD_REQUEST
      );
    }

    const result = await this.shippingService.createShipment(
      body.connectionId,
      {
        shippingQuoteId: body.shippingQuoteId,
        rateId: body.rateId,
      }
    );
    return { success: true, ...result };
  }

  /**
   * Get shipment details
   * GET /api/marketplace/shipping/:shipmentId?connectionId=...
   */
  @Get(':shipmentId')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getShipment(
    @Tenant() tenantId: string,
    @Param('shipmentId') shipmentId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException(
        'connectionId query parameter is required',
        HttpStatus.BAD_REQUEST
      );
    }

    return this.shippingService.getShipment(connectionId, shipmentId);
  }

  /**
   * Download shipping label PDF
   * GET /api/marketplace/shipping/:shipmentId/label?connectionId=...
   */
  @Get(':shipmentId/label')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async downloadLabel(
    @Tenant() tenantId: string,
    @Param('shipmentId') shipmentId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException(
        'connectionId query parameter is required',
        HttpStatus.BAD_REQUEST
      );
    }

    return this.shippingService.downloadLabel(connectionId, shipmentId);
  }

  /**
   * Cancel / void a shipment
   * DELETE /api/marketplace/shipping/:shipmentId?connectionId=...
   */
  @Delete(':shipmentId')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async cancelShipment(
    @Tenant() tenantId: string,
    @Param('shipmentId') shipmentId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException(
        'connectionId query parameter is required',
        HttpStatus.BAD_REQUEST
      );
    }

    const result = await this.shippingService.cancelShipment(connectionId, shipmentId);
    return { success: true, ...result };
  }
}
