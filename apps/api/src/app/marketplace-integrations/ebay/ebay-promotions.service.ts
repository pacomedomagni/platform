import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EbayStoreService } from './ebay-store.service';

/**
 * eBay Promotions Service
 * Manages promotions (markdown sales, volume/order discounts) via the eBay Marketing API.
 * Supports creating, pausing, resuming, deleting promotions and fetching summary reports.
 */
@Injectable()
export class EbayPromotionsService {
  private readonly logger = new Logger(EbayPromotionsService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(private ebayStore: EbayStoreService) {}

  /**
   * Create a markdown (price reduction) promotion.
   */
  async createMarkdownPromotion(
    connectionId: string,
    data: {
      name: string;
      description: string;
      startDate: string;
      endDate: string;
      marketplaceId: string;
      selectedItems: Array<{ listingId: string; discount: number }>;
    }
  ): Promise<any> {
    if (this.mockMode) {
      const promotionId = `mock_markdown_${Date.now()}`;
      this.logger.log(`[MOCK] Created markdown promotion: ${data.name} (${promotionId})`);
      return {
        promotionId,
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        marketplaceId: data.marketplaceId,
        type: 'MARKDOWN_SALE',
        status: 'SCHEDULED',
        selectedItems: data.selectedItems,
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body: any = {
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        marketplaceId: data.marketplaceId,
        selectedInventoryDiscounts: data.selectedItems.map((item) => ({
          listingId: item.listingId,
          discountBenefit: {
            percentageOffItem: String(item.discount),
          },
        })),
      };

      const response = await (client.sell as any).marketing.createItemPriceMarkdownPromotion(body);

      const promotionId =
        response?.promotionId ||
        response?.promotionHref?.split('/').pop() ||
        `ebay_markdown_${Date.now()}`;

      this.logger.log(`Created markdown promotion: ${data.name} (${promotionId})`);

      return {
        promotionId,
        ...response,
      };
    } catch (error) {
      this.logger.error(`Failed to create markdown promotion: ${data.name}`, error);
      throw error;
    }
  }

  /**
   * Create an order/volume discount promotion.
   */
  async createOrderPromotion(
    connectionId: string,
    data: {
      name: string;
      description: string;
      startDate: string;
      endDate: string;
      marketplaceId: string;
      discountRules: any;
    }
  ): Promise<any> {
    if (this.mockMode) {
      const promotionId = `mock_order_promo_${Date.now()}`;
      this.logger.log(`[MOCK] Created order promotion: ${data.name} (${promotionId})`);
      return {
        promotionId,
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        marketplaceId: data.marketplaceId,
        type: 'ORDER_DISCOUNT',
        status: 'SCHEDULED',
        discountRules: data.discountRules,
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body: any = {
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        marketplaceId: data.marketplaceId,
        discountRules: data.discountRules,
      };

      const response = await (client.sell as any).marketing.createItemPromotion(body);

      const promotionId =
        response?.promotionId ||
        response?.promotionHref?.split('/').pop() ||
        `ebay_order_promo_${Date.now()}`;

      this.logger.log(`Created order promotion: ${data.name} (${promotionId})`);

      return {
        promotionId,
        ...response,
      };
    } catch (error) {
      this.logger.error(`Failed to create order promotion: ${data.name}`, error);
      throw error;
    }
  }

  /**
   * List all promotions for a marketplace.
   */
  async getPromotions(connectionId: string, marketplaceId: string): Promise<any[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched promotions for marketplace ${marketplaceId}`);
      return [
        {
          promotionId: 'mock_promo_001',
          name: 'Summer Sale 20% Off',
          type: 'MARKDOWN_SALE',
          status: 'ACTIVE',
          startDate: '2025-06-01T00:00:00.000Z',
          endDate: '2025-08-31T23:59:59.000Z',
          marketplaceId,
        },
        {
          promotionId: 'mock_promo_002',
          name: 'Buy 2 Get 10% Off',
          type: 'ORDER_DISCOUNT',
          status: 'SCHEDULED',
          startDate: '2025-07-01T00:00:00.000Z',
          endDate: '2025-07-31T23:59:59.000Z',
          marketplaceId,
        },
      ];
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).marketing.getPromotions(marketplaceId);

      const promotions = response?.promotions || [];
      this.logger.log(
        `Fetched ${promotions.length} promotions for marketplace ${marketplaceId}`
      );

      return promotions;
    } catch (error) {
      this.logger.error(
        `Failed to fetch promotions for marketplace ${marketplaceId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a single promotion by ID.
   */
  async getPromotion(connectionId: string, promotionId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched promotion ${promotionId}`);
      return {
        promotionId,
        name: 'Mock Promotion',
        type: 'MARKDOWN_SALE',
        status: 'ACTIVE',
        startDate: '2025-06-01T00:00:00.000Z',
        endDate: '2025-08-31T23:59:59.000Z',
        marketplaceId: 'EBAY_US',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).marketing.getPromotion(promotionId);

      if (!response) {
        throw new NotFoundException(`Promotion ${promotionId} not found`);
      }

      this.logger.log(`Fetched promotion ${promotionId}`);
      return response;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to fetch promotion ${promotionId}`, error);
      throw error;
    }
  }

  /**
   * Pause an active promotion.
   */
  async pausePromotion(connectionId: string, promotionId: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Paused promotion ${promotionId}`);
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client.sell as any).marketing.pausePromotion(promotionId);
      this.logger.log(`Paused promotion ${promotionId}`);
    } catch (error) {
      this.logger.error(`Failed to pause promotion ${promotionId}`, error);
      throw error;
    }
  }

  /**
   * Resume a paused promotion.
   */
  async resumePromotion(connectionId: string, promotionId: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Resumed promotion ${promotionId}`);
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client.sell as any).marketing.resumePromotion(promotionId);
      this.logger.log(`Resumed promotion ${promotionId}`);
    } catch (error) {
      this.logger.error(`Failed to resume promotion ${promotionId}`, error);
      throw error;
    }
  }

  /**
   * Delete a promotion.
   */
  async deletePromotion(connectionId: string, promotionId: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Deleted promotion ${promotionId}`);
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client.sell as any).marketing.deleteItemPromotion(promotionId);
      this.logger.log(`Deleted promotion ${promotionId}`);
    } catch (error) {
      this.logger.error(`Failed to delete promotion ${promotionId}`, error);
      throw error;
    }
  }

  /**
   * Get promotion summary report for a marketplace.
   */
  async getPromotionSummaryReport(
    connectionId: string,
    marketplaceId: string
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched promotion summary report for ${marketplaceId}`);
      return {
        marketplaceId,
        totalPromotions: 5,
        activePromotions: 2,
        scheduledPromotions: 1,
        endedPromotions: 2,
        totalSales: { value: '1250.00', currency: 'USD' },
        totalDiscount: { value: '187.50', currency: 'USD' },
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).marketing.getPromotionSummaryReport(
        marketplaceId
      );

      this.logger.log(`Fetched promotion summary report for ${marketplaceId}`);
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to fetch promotion summary report for ${marketplaceId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Create a coded coupon promotion.
   * Uses eBay Marketing API: createItemPromotion with promotionType=CODED_COUPON
   */
  async createCodedCoupon(
    connectionId: string,
    tenantId: string,
    data: {
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
  ): Promise<any> {
    if (this.mockMode) {
      const promotionId = `mock_coupon_${Date.now()}`;
      this.logger.log(
        `[MOCK] Created coded coupon: ${data.name} (${promotionId}) code=${data.couponCode}`
      );
      return {
        promotionId,
        name: data.name,
        couponCode: data.couponCode,
        promotionType: 'CODED_COUPON',
        status: 'SCHEDULED',
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderAmount: data.minOrderAmount || null,
        maxUses: data.maxUses || null,
        startDate: data.startDate || new Date().toISOString(),
        endDate: data.endDate || null,
        listingIds: data.listingIds || [],
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const discountBenefit: any = {};
      if (data.discountType === 'PERCENTAGE') {
        discountBenefit.percentageOffOrder = String(data.discountValue);
      } else {
        discountBenefit.amountOffOrder = {
          value: data.discountValue.toFixed(2),
          currency: 'USD',
        };
      }

      const body: any = {
        name: data.name,
        promotionType: 'CODED_COUPON',
        couponCode: data.couponCode,
        discountRules: [
          {
            discountBenefit,
            ...(data.minOrderAmount && {
              minOrderValue: {
                value: data.minOrderAmount.toFixed(2),
                currency: 'USD',
              },
            }),
          },
        ],
        ...(data.maxUses && { maxDiscountAmount: data.maxUses }),
        ...(data.startDate && { startDate: data.startDate }),
        ...(data.endDate && { endDate: data.endDate }),
        ...(data.listingIds &&
          data.listingIds.length > 0 && {
            inventoryCriterion: {
              inventoryCriterionType: 'INVENTORY_BY_VALUE',
              listingIds: data.listingIds,
            },
          }),
      };

      const response = await (client.sell as any).marketing.createItemPromotion(body);

      const promotionId =
        response?.promotionId ||
        response?.promotionHref?.split('/').pop() ||
        `ebay_coupon_${Date.now()}`;

      this.logger.log(`Created coded coupon: ${data.name} (${promotionId})`);

      return {
        promotionId,
        ...response,
      };
    } catch (error) {
      this.logger.error(`Failed to create coded coupon: ${data.name}`, error);
      throw error;
    }
  }

  /**
   * List coded coupon promotions.
   * Fetches all promotions and filters by type CODED_COUPON.
   */
  async getCodedCoupons(connectionId: string, tenantId: string): Promise<any[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched coded coupons for connection ${connectionId}`);
      return [
        {
          promotionId: 'mock_coupon_001',
          name: 'Spring Sale 15% Off',
          couponCode: 'SPRING15',
          promotionType: 'CODED_COUPON',
          status: 'ACTIVE',
          discountType: 'PERCENTAGE',
          discountValue: 15,
          startDate: '2026-03-01T00:00:00.000Z',
          endDate: '2026-05-31T23:59:59.000Z',
        },
        {
          promotionId: 'mock_coupon_002',
          name: '$10 Off Order',
          couponCode: 'SAVE10',
          promotionType: 'CODED_COUPON',
          status: 'SCHEDULED',
          discountType: 'FIXED_AMOUNT',
          discountValue: 10,
          startDate: '2026-04-01T00:00:00.000Z',
          endDate: '2026-04-30T23:59:59.000Z',
        },
      ];
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      // Fetch all promotions and filter for CODED_COUPON type
      const response = await (client.sell as any).marketing.getPromotions();

      const allPromotions = response?.promotions || [];
      const codedCoupons = allPromotions.filter(
        (promo: any) =>
          promo.promotionType === 'CODED_COUPON' || promo.type === 'CODED_COUPON'
      );

      this.logger.log(
        `Fetched ${codedCoupons.length} coded coupons for connection ${connectionId}`
      );

      return codedCoupons;
    } catch (error) {
      this.logger.error(
        `Failed to fetch coded coupons for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete a coded coupon promotion.
   */
  async deleteCodedCoupon(
    connectionId: string,
    tenantId: string,
    promotionId: string
  ): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Deleted coded coupon ${promotionId}`);
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client.sell as any).marketing.deleteItemPromotion(promotionId);
      this.logger.log(`Deleted coded coupon ${promotionId}`);
    } catch (error) {
      this.logger.error(`Failed to delete coded coupon ${promotionId}`, error);
      throw error;
    }
  }

  /**
   * Create a volume pricing (volume discount) promotion.
   * Uses eBay Marketing API: createItemPromotion with promotionType=VOLUME_DISCOUNT
   * Allows 2-4 quantity-based discount tiers (e.g., Buy 2 get 5% off, Buy 5 get 10% off).
   */
  async createVolumePricing(
    connectionId: string,
    tenantId: string,
    data: {
      name: string;
      listingIds: string[];
      tiers: Array<{ minQuantity: number; discountPercentage: number }>;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<any> {
    if (data.tiers.length < 2 || data.tiers.length > 4) {
      throw new BadRequestException(
        'Volume pricing requires between 2 and 4 discount tiers'
      );
    }

    if (this.mockMode) {
      const promotionId = `mock_volume_${Date.now()}`;
      this.logger.log(
        `[MOCK] Created volume pricing: ${data.name} (${promotionId}) with ${data.tiers.length} tiers`
      );
      return {
        promotionId,
        name: data.name,
        promotionType: 'VOLUME_DISCOUNT',
        status: 'SCHEDULED',
        tiers: data.tiers,
        listingIds: data.listingIds,
        startDate: data.startDate || new Date().toISOString(),
        endDate: data.endDate || null,
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body: any = {
        name: data.name,
        promotionType: 'VOLUME_DISCOUNT',
        discountRules: data.tiers.map((tier) => ({
          discountBenefit: {
            percentageOffOrder: String(tier.discountPercentage),
          },
          minQuantity: tier.minQuantity,
        })),
        inventoryCriterion: {
          inventoryCriterionType: 'INVENTORY_BY_VALUE',
          listingIds: data.listingIds,
        },
        ...(data.startDate && { startDate: data.startDate }),
        ...(data.endDate && { endDate: data.endDate }),
      };

      const response = await (client.sell as any).marketing.createItemPromotion(body);

      const promotionId =
        response?.promotionId ||
        response?.promotionHref?.split('/').pop() ||
        `ebay_volume_${Date.now()}`;

      this.logger.log(`Created volume pricing: ${data.name} (${promotionId})`);

      return {
        promotionId,
        ...response,
      };
    } catch (error) {
      this.logger.error(`Failed to create volume pricing: ${data.name}`, error);
      throw error;
    }
  }

  /**
   * List volume pricing (volume discount) promotions.
   * Fetches all promotions and filters by type VOLUME_DISCOUNT.
   */
  async getVolumePricing(connectionId: string, tenantId: string): Promise<any[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched volume pricing promotions for connection ${connectionId}`);
      return [
        {
          promotionId: 'mock_volume_001',
          name: 'Buy More Save More',
          promotionType: 'VOLUME_DISCOUNT',
          status: 'ACTIVE',
          tiers: [
            { minQuantity: 2, discountPercentage: 5 },
            { minQuantity: 5, discountPercentage: 10 },
            { minQuantity: 10, discountPercentage: 15 },
          ],
          startDate: '2026-03-01T00:00:00.000Z',
          endDate: '2026-06-30T23:59:59.000Z',
        },
        {
          promotionId: 'mock_volume_002',
          name: 'Bulk Discount Special',
          promotionType: 'VOLUME_DISCOUNT',
          status: 'SCHEDULED',
          tiers: [
            { minQuantity: 3, discountPercentage: 8 },
            { minQuantity: 6, discountPercentage: 12 },
          ],
          startDate: '2026-04-01T00:00:00.000Z',
          endDate: '2026-04-30T23:59:59.000Z',
        },
      ];
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      // Fetch all promotions and filter for VOLUME_DISCOUNT type
      const response = await (client.sell as any).marketing.getPromotions();

      const allPromotions = response?.promotions || [];
      const volumeDiscounts = allPromotions.filter(
        (promo: any) =>
          promo.promotionType === 'VOLUME_DISCOUNT' || promo.type === 'VOLUME_DISCOUNT'
      );

      this.logger.log(
        `Fetched ${volumeDiscounts.length} volume pricing promotions for connection ${connectionId}`
      );

      return volumeDiscounts;
    } catch (error) {
      this.logger.error(
        `Failed to fetch volume pricing promotions for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }
}
