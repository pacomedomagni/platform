import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayCrossBorderService } from './ebay-cross-border.service';
import { ListItemCrossBorderDto } from '../shared/marketplace.dto';

/**
 * eBay Cross-Border Trade API Controller
 * Provides endpoints for international marketplace listing,
 * policy retrieval, and exchange rate information.
 */
@Controller('marketplace/cross-border')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class EbayCrossBorderController {
  constructor(private crossBorderService: EbayCrossBorderService) {}

  /**
   * List supported eBay global marketplaces
   * GET /api/marketplace/cross-border/marketplaces
   */
  @Get('marketplaces')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getSupportedMarketplaces(@Tenant() tenantId: string) {
    return this.crossBorderService.getSupportedMarketplaces();
  }

  /**
   * Get exchange rates from a base currency to target currencies
   * GET /api/marketplace/cross-border/exchange-rates?baseCurrency=USD&targetCurrencies=GBP,EUR,AUD
   */
  @Get('exchange-rates')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getExchangeRates(
    @Tenant() tenantId: string,
    @Query('baseCurrency') baseCurrency: string,
    @Query('targetCurrencies') targetCurrencies: string
  ) {
    if (!baseCurrency) {
      throw new HttpException('baseCurrency query parameter is required', HttpStatus.BAD_REQUEST);
    }
    if (!targetCurrencies) {
      throw new HttpException('targetCurrencies query parameter is required', HttpStatus.BAD_REQUEST);
    }

    const targets = targetCurrencies.split(',').map((c) => c.trim()).filter(Boolean);
    return this.crossBorderService.getExchangeRates(baseCurrency, targets);
  }

  /**
   * Get fulfillment (shipping) policies for a marketplace
   * GET /api/marketplace/cross-border/shipping-policies?connectionId=...&marketplaceId=...
   */
  @Get('shipping-policies')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getShippingPolicies(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('marketplaceId') marketplaceId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    if (!marketplaceId) {
      throw new HttpException('marketplaceId query parameter is required', HttpStatus.BAD_REQUEST);
    }

    return this.crossBorderService.getShippingPolicies(connectionId, marketplaceId);
  }

  /**
   * Get return policies for a marketplace
   * GET /api/marketplace/cross-border/return-policies?connectionId=...&marketplaceId=...
   */
  @Get('return-policies')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getReturnPolicies(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('marketplaceId') marketplaceId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    if (!marketplaceId) {
      throw new HttpException('marketplaceId query parameter is required', HttpStatus.BAD_REQUEST);
    }

    return this.crossBorderService.getReturnPolicies(connectionId, marketplaceId);
  }

  /**
   * Get payment policies for a marketplace
   * GET /api/marketplace/cross-border/payment-policies?connectionId=...&marketplaceId=...
   */
  @Get('payment-policies')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getPaymentPolicies(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('marketplaceId') marketplaceId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    if (!marketplaceId) {
      throw new HttpException('marketplaceId query parameter is required', HttpStatus.BAD_REQUEST);
    }

    return this.crossBorderService.getPaymentPolicies(connectionId, marketplaceId);
  }

  /**
   * List an inventory item on a target international marketplace
   * POST /api/marketplace/cross-border/list
   */
  @Post('list')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async listItemCrossBorder(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: ListItemCrossBorderDto
  ) {
    const result = await this.crossBorderService.listItemCrossBorder(dto.connectionId, {
      sku: dto.sku,
      targetMarketplace: dto.targetMarketplace,
      price: dto.price,
      fulfillmentPolicyId: dto.fulfillmentPolicyId,
      returnPolicyId: dto.returnPolicyId,
      paymentPolicyId: dto.paymentPolicyId,
      categoryId: dto.categoryId,
    });

    return {
      success: true,
      message: `Item listed on ${dto.targetMarketplace}`,
      ...result,
    };
  }
}
