import {
  Controller,
  Get,
  Post,
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
import { EbayPromotionsService } from './ebay-promotions.service';

/**
 * eBay Promotions API Controller
 * Manages markdown sales, volume discounts, and order promotions
 */
@Controller('marketplace/promotions')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayPromotionsController {
  constructor(private promotionsService: EbayPromotionsService) {}

  /**
   * Create a markdown (price reduction) promotion
   * POST /api/marketplace/promotions/markdown
   */
  @Post('markdown')
  @Roles('admin', 'System Manager')
  async createMarkdownPromotion(
    @Tenant() tenantId: string,
    @Body()
    body: {
      connectionId: string;
      name: string;
      description: string;
      startDate: string;
      endDate: string;
      marketplaceId: string;
      selectedItems: Array<{ listingId: string; discount: number }>;
    }
  ) {
    return this.promotionsService.createMarkdownPromotion(body.connectionId, {
      name: body.name,
      description: body.description,
      startDate: body.startDate,
      endDate: body.endDate,
      marketplaceId: body.marketplaceId,
      selectedItems: body.selectedItems,
    });
  }

  /**
   * Create an order/volume discount promotion
   * POST /api/marketplace/promotions/order-discount
   */
  @Post('order-discount')
  @Roles('admin', 'System Manager')
  async createOrderPromotion(
    @Tenant() tenantId: string,
    @Body()
    body: {
      connectionId: string;
      name: string;
      description: string;
      startDate: string;
      endDate: string;
      marketplaceId: string;
      discountRules: any;
    }
  ) {
    return this.promotionsService.createOrderPromotion(body.connectionId, {
      name: body.name,
      description: body.description,
      startDate: body.startDate,
      endDate: body.endDate,
      marketplaceId: body.marketplaceId,
      discountRules: body.discountRules,
    });
  }

  /**
   * List promotions for a marketplace
   * GET /api/marketplace/promotions?connectionId=...&marketplaceId=...
   */
  @Get()
  async getPromotions(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('marketplaceId') marketplaceId: string
  ) {
    return this.promotionsService.getPromotions(connectionId, marketplaceId);
  }

  /**
   * Get promotion summary report
   * GET /api/marketplace/promotions/report?connectionId=...&marketplaceId=...
   *
   * NOTE: This route is defined BEFORE the :id route to avoid
   * "report" being captured as a promotion ID parameter.
   */
  @Get('report')
  async getPromotionSummaryReport(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('marketplaceId') marketplaceId: string
  ) {
    return this.promotionsService.getPromotionSummaryReport(connectionId, marketplaceId);
  }

  /**
   * Create a coded coupon promotion
   * POST /api/marketplace/promotions/coupons
   */
  @Post('coupons')
  @Roles('admin', 'System Manager')
  async createCodedCoupon(
    @Tenant() tenantId: string,
    @Body()
    body: {
      connectionId: string;
      name: string;
      couponCode: string;
      discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
      discountValue: number;
      minOrderAmount?: number;
      maxUses?: number;
      startDate?: string;
      endDate?: string;
      listingIds?: string[];
    }
  ) {
    return this.promotionsService.createCodedCoupon(body.connectionId, tenantId, {
      name: body.name,
      couponCode: body.couponCode,
      discountType: body.discountType,
      discountValue: body.discountValue,
      minOrderAmount: body.minOrderAmount,
      maxUses: body.maxUses,
      startDate: body.startDate,
      endDate: body.endDate,
      listingIds: body.listingIds,
    });
  }

  /**
   * List coded coupon promotions
   * GET /api/marketplace/promotions/coupons?connectionId=...
   *
   * NOTE: This route is defined BEFORE the :id route to avoid
   * "coupons" being captured as a promotion ID parameter.
   */
  @Get('coupons')
  async getCodedCoupons(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.promotionsService.getCodedCoupons(connectionId, tenantId);
  }

  /**
   * Delete a coded coupon promotion
   * DELETE /api/marketplace/promotions/coupons/:id?connectionId=...
   */
  @Delete('coupons/:id')
  @Roles('admin', 'System Manager')
  async deleteCodedCoupon(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Query('connectionId') connectionId: string
  ) {
    await this.promotionsService.deleteCodedCoupon(connectionId, tenantId, id);
    return { success: true, message: 'Coded coupon deleted' };
  }

  /**
   * Create a volume pricing (volume discount) promotion
   * POST /api/marketplace/promotions/volume-pricing
   */
  @Post('volume-pricing')
  @Roles('admin', 'System Manager')
  async createVolumePricing(
    @Tenant() tenantId: string,
    @Body()
    body: {
      connectionId: string;
      name: string;
      listingIds: string[];
      tiers: Array<{ minQuantity: number; discountPercentage: number }>;
      startDate?: string;
      endDate?: string;
    }
  ) {
    return this.promotionsService.createVolumePricing(body.connectionId, tenantId, {
      name: body.name,
      listingIds: body.listingIds,
      tiers: body.tiers,
      startDate: body.startDate,
      endDate: body.endDate,
    });
  }

  /**
   * List volume pricing promotions
   * GET /api/marketplace/promotions/volume-pricing?connectionId=...
   *
   * NOTE: This route is defined BEFORE the :id route to avoid
   * "volume-pricing" being captured as a promotion ID parameter.
   */
  @Get('volume-pricing')
  async getVolumePricing(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.promotionsService.getVolumePricing(connectionId, tenantId);
  }

  /**
   * Get a single promotion detail
   * GET /api/marketplace/promotions/:id?connectionId=...
   */
  @Get(':id')
  async getPromotion(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.promotionsService.getPromotion(connectionId, id);
  }

  /**
   * Pause a promotion
   * POST /api/marketplace/promotions/:id/pause
   */
  @Post(':id/pause')
  @Roles('admin', 'System Manager')
  async pausePromotion(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { connectionId: string }
  ) {
    await this.promotionsService.pausePromotion(body.connectionId, id);
    return { success: true, message: 'Promotion paused' };
  }

  /**
   * Resume a promotion
   * POST /api/marketplace/promotions/:id/resume
   */
  @Post(':id/resume')
  @Roles('admin', 'System Manager')
  async resumePromotion(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { connectionId: string }
  ) {
    await this.promotionsService.resumePromotion(body.connectionId, id);
    return { success: true, message: 'Promotion resumed' };
  }

  /**
   * Delete a promotion
   * DELETE /api/marketplace/promotions/:id?connectionId=...
   */
  @Delete(':id')
  @Roles('admin', 'System Manager')
  async deletePromotion(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Query('connectionId') connectionId: string
  ) {
    await this.promotionsService.deletePromotion(connectionId, id);
    return { success: true, message: 'Promotion deleted' };
  }
}
