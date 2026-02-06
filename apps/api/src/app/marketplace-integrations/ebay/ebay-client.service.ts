import { Injectable, Logger } from '@nestjs/common';
import eBayApi from 'ebay-api';

/**
 * eBay API Client Wrapper
 * Provides methods for interacting with eBay Sell API
 */
@Injectable()
export class EbayClientService {
  private readonly logger = new Logger(EbayClientService.name);

  /**
   * Create or replace inventory item
   */
  async createOrReplaceInventoryItem(
    client: eBayApi,
    sku: string,
    data: {
      product: {
        title: string;
        description: string;
        imageUrls: string[];
        aspects?: Record<string, string[]>;
      };
      condition: string;
      availability: {
        shipToLocationAvailability: {
          quantity: number;
        };
      };
      packageWeightAndSize?: {
        dimensions?: {
          height?: number;
          length?: number;
          width?: number;
          unit?: string;
        };
        weight?: {
          value?: number;
          unit?: string;
        };
      };
    }
  ) {
    try {
      const response = await client.sell.inventory.createOrReplaceInventoryItem(sku, data);
      this.logger.log(`Created/updated inventory item: ${sku}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to create/update inventory item ${sku}`, error);
      throw error;
    }
  }

  /**
   * Create offer for an inventory item
   */
  async createOffer(
    client: eBayApi,
    data: {
      sku: string;
      marketplaceId: string;
      format: string;
      availableQuantity: number;
      categoryId: string;
      listingDescription?: string;
      listingPolicies: {
        fulfillmentPolicyId: string;
        paymentPolicyId: string;
        returnPolicyId: string;
      };
      pricingSummary: {
        price: {
          value: string;
          currency: string;
        };
      };
      merchantLocationKey?: string;
      includeCatalogProductDetails?: boolean;
      hideBuyerDetails?: boolean;
    }
  ) {
    try {
      const response = await client.sell.inventory.createOffer(data);
      this.logger.log(`Created offer for SKU: ${data.sku}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to create offer for SKU ${data.sku}`, error);
      throw error;
    }
  }

  /**
   * Publish offer to eBay
   */
  async publishOffer(client: eBayApi, offerId: string) {
    try {
      const response = await client.sell.inventory.publishOffer(offerId);
      this.logger.log(`Published offer: ${offerId}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to publish offer ${offerId}`, error);
      throw error;
    }
  }

  /**
   * Update inventory quantity
   */
  async updateInventoryQuantity(client: eBayApi, sku: string, quantity: number) {
    try {
      await client.sell.inventory.createOrReplaceInventoryItem(sku, {
        availability: {
          shipToLocationAvailability: {
            quantity
          }
        }
      });
      this.logger.log(`Updated quantity for SKU ${sku}: ${quantity}`);
    } catch (error) {
      this.logger.error(`Failed to update quantity for SKU ${sku}`, error);
      throw error;
    }
  }

  /**
   * Get orders from eBay
   */
  async getOrders(
    client: eBayApi,
    params: {
      filter?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    try {
      const response = await client.sell.fulfillment.getOrders(params);
      this.logger.log(`Fetched ${response.orders?.length || 0} orders from eBay`);
      return response.orders || [];
    } catch (error) {
      this.logger.error('Failed to fetch orders from eBay', error);
      throw error;
    }
  }

  /**
   * Create shipping fulfillment (mark order as shipped)
   */
  async createShippingFulfillment(
    client: eBayApi,
    orderId: string,
    data: {
      lineItems: Array<{
        lineItemId: string;
        quantity: number;
      }>;
      shippingCarrierCode: string;
      trackingNumber: string;
    }
  ) {
    try {
      const response = await client.sell.fulfillment.createShippingFulfillment(orderId, data);
      this.logger.log(`Created shipping fulfillment for order: ${orderId}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to create shipping fulfillment for order ${orderId}`, error);
      throw error;
    }
  }

  /**
   * Get active listings
   */
  async getActiveListings(
    client: eBayApi,
    params?: {
      limit?: number;
      offset?: number;
      sku?: string;
    }
  ) {
    try {
      const response = await client.sell.inventory.getInventoryItems(params);
      this.logger.log(`Fetched ${response.inventoryItems?.length || 0} active listings`);
      return response.inventoryItems || [];
    } catch (error) {
      this.logger.error('Failed to fetch active listings', error);
      throw error;
    }
  }

  /**
   * End listing
   */
  async withdrawOffer(client: eBayApi, offerId: string) {
    try {
      await client.sell.inventory.withdrawOffer(offerId);
      this.logger.log(`Withdrew offer: ${offerId}`);
    } catch (error) {
      this.logger.error(`Failed to withdraw offer ${offerId}`, error);
      throw error;
    }
  }

  /**
   * Get fulfillment policies
   */
  async getFulfillmentPolicies(client: eBayApi, marketplaceId: string) {
    try {
      const response = await client.sell.account.getFulfillmentPolicies({ marketplace_id: marketplaceId });
      return response.fulfillmentPolicies || [];
    } catch (error) {
      this.logger.error('Failed to fetch fulfillment policies', error);
      throw error;
    }
  }

  /**
   * Get payment policies
   */
  async getPaymentPolicies(client: eBayApi, marketplaceId: string) {
    try {
      const response = await client.sell.account.getPaymentPolicies({ marketplace_id: marketplaceId });
      return response.paymentPolicies || [];
    } catch (error) {
      this.logger.error('Failed to fetch payment policies', error);
      throw error;
    }
  }

  /**
   * Get return policies
   */
  async getReturnPolicies(client: eBayApi, marketplaceId: string) {
    try {
      const response = await client.sell.account.getReturnPolicies({ marketplace_id: marketplaceId });
      return response.returnPolicies || [];
    } catch (error) {
      this.logger.error('Failed to fetch return policies', error);
      throw error;
    }
  }

  /**
   * Get inventory locations
   */
  async getInventoryLocations(client: eBayApi) {
    try {
      const response = await client.sell.inventory.getInventoryLocations();
      return response.locations || [];
    } catch (error) {
      this.logger.error('Failed to fetch inventory locations', error);
      throw error;
    }
  }
}
