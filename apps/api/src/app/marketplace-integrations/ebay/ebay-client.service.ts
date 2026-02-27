import { Injectable, Logger } from '@nestjs/common';
import eBayApi from 'ebay-api';

/**
 * eBay API Client Wrapper
 * Provides methods for interacting with eBay Sell API.
 * Includes automatic rate limit handling with exponential backoff.
 */
@Injectable()
export class EbayClientService {
  private readonly logger = new Logger(EbayClientService.name);
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 1000;

  /**
   * Execute an eBay API call with automatic rate limit (HTTP 429) retry handling.
   * Uses exponential backoff and respects the Retry-After header when present.
   */
  private async withRateLimitRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check for rate limit (429) or eBay-specific rate limit errors
        const status = error?.statusCode ?? error?.status ?? error?.response?.status;
        if (status === 429 && attempt < this.MAX_RETRIES) {
          // Respect Retry-After header if present (value in seconds)
          const retryAfterHeader =
            error?.response?.headers?.['retry-after'] ??
            error?.meta?.headers?.['retry-after'];
          const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

          const delayMs =
            retryAfterSeconds && !isNaN(retryAfterSeconds)
              ? retryAfterSeconds * 1000
              : this.BASE_DELAY_MS * Math.pow(2, attempt);

          this.logger.warn(
            `eBay API rate limited (429). Retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`
          );

          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        // Not a rate limit error or max retries exceeded
        throw error;
      }
    }
    throw lastError;
  }

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
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.inventory.createOrReplaceInventoryItem(sku, data as any);
        this.logger.log(`Created/updated inventory item: ${sku}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to create/update inventory item ${sku}`, error);
        throw error;
      }
    });
  }

  /**
   * Delete an inventory item (for rollback on publish failure)
   */
  async deleteInventoryItem(client: eBayApi, sku: string) {
    return this.withRateLimitRetry(async () => {
      try {
        await client.sell.inventory.deleteInventoryItem(sku);
        this.logger.log(`Deleted inventory item: ${sku}`);
      } catch (error) {
        this.logger.error(`Failed to delete inventory item ${sku}`, error);
        throw error;
      }
    });
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
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.inventory.createOffer(data);
        this.logger.log(`Created offer for SKU: ${data.sku}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to create offer for SKU ${data.sku}`, error);
        throw error;
      }
    });
  }

  /**
   * Publish offer to eBay
   */
  async publishOffer(client: eBayApi, offerId: string) {
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.inventory.publishOffer(offerId);
        this.logger.log(`Published offer: ${offerId}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to publish offer ${offerId}`, error);
        throw error;
      }
    });
  }

  /**
   * Get a single inventory item by SKU
   */
  async getInventoryItem(client: eBayApi, sku: string) {
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.inventory.getInventoryItem(sku);
        this.logger.log(`Fetched inventory item: ${sku}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to fetch inventory item ${sku}`, error);
        throw error;
      }
    });
  }

  /**
   * Update inventory quantity
   *
   * Fetches the existing inventory item first, then merges the quantity update
   * into the full item payload before writing it back. This preserves the
   * listing's title, description, images, and all other fields.
   *
   * Previously this called createOrReplaceInventoryItem with only the
   * availability field, which is a full-replace operation that destroyed
   * all other item data (product title, description, images, etc.).
   */
  async updateInventoryQuantity(client: eBayApi, sku: string, quantity: number) {
    return this.withRateLimitRetry(async () => {
      try {
        // Fetch the existing inventory item to preserve all current data
        const existingItem = await this.getInventoryItem(client, sku);

        // Merge the quantity update into the existing item
        const updatedItem = {
          ...existingItem,
          availability: {
            ...existingItem.availability,
            shipToLocationAvailability: {
              ...existingItem.availability?.shipToLocationAvailability,
              quantity
            }
          }
        };

        // Write back the full item with only the quantity changed
        await client.sell.inventory.createOrReplaceInventoryItem(sku, updatedItem);
        this.logger.log(`Updated quantity for SKU ${sku}: ${quantity}`);
      } catch (error) {
        this.logger.error(`Failed to update quantity for SKU ${sku}`, error);
        throw error;
      }
    });
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
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.fulfillment.getOrders(params);
        this.logger.log(`Fetched ${response.orders?.length || 0} orders from eBay`);
        return response.orders || [];
      } catch (error) {
        this.logger.error('Failed to fetch orders from eBay', error);
        throw error;
      }
    });
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
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.fulfillment.createShippingFulfillment(orderId, data);
        this.logger.log(`Created shipping fulfillment for order: ${orderId}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to create shipping fulfillment for order ${orderId}`, error);
        throw error;
      }
    });
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
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.inventory.getInventoryItems(params);
        this.logger.log(`Fetched ${response.inventoryItems?.length || 0} active listings`);
        return response.inventoryItems || [];
      } catch (error) {
        this.logger.error('Failed to fetch active listings', error);
        throw error;
      }
    });
  }

  /**
   * End listing
   */
  async withdrawOffer(client: eBayApi, offerId: string) {
    return this.withRateLimitRetry(async () => {
      try {
        await client.sell.inventory.withdrawOffer(offerId);
        this.logger.log(`Withdrew offer: ${offerId}`);
      } catch (error) {
        this.logger.error(`Failed to withdraw offer ${offerId}`, error);
        throw error;
      }
    });
  }

  /**
   * Get fulfillment policies
   */
  async getFulfillmentPolicies(client: eBayApi, marketplaceId: string) {
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.account.getFulfillmentPolicies(marketplaceId as any);
        return response.fulfillmentPolicies || [];
      } catch (error) {
        this.logger.error('Failed to fetch fulfillment policies', error);
        throw error;
      }
    });
  }

  /**
   * Get payment policies
   */
  async getPaymentPolicies(client: eBayApi, marketplaceId: string) {
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.account.getPaymentPolicies(marketplaceId as any);
        return response.paymentPolicies || [];
      } catch (error) {
        this.logger.error('Failed to fetch payment policies', error);
        throw error;
      }
    });
  }

  /**
   * Get return policies
   */
  async getReturnPolicies(client: eBayApi, marketplaceId: string) {
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.account.getReturnPolicies(marketplaceId as any);
        return response.returnPolicies || [];
      } catch (error) {
        this.logger.error('Failed to fetch return policies', error);
        throw error;
      }
    });
  }

  /**
   * Get inventory locations
   */
  async getInventoryLocations(client: eBayApi) {
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.inventory.getInventoryLocations();
        return response.locations || [];
      } catch (error) {
        this.logger.error('Failed to fetch inventory locations', error);
        throw error;
      }
    });
  }
}
