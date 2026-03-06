import { Injectable, Logger } from '@nestjs/common';
import eBayApi from 'ebay-api';
import type {
  EbayOrder,
  EbayInventoryItem,
  EbayCreateOfferResponse,
  EbayPublishOfferResponse,
  EbayGetOffersResponse,
  EbayFulfillment,
  EbayFulfillmentPolicy,
  EbayPaymentPolicy,
  EbayReturnPolicy,
  EbayInventoryLocation,
  EbayInventoryItemGroup,
  EbayPublishGroupResponse,
  EbayGetMyMessagesResponse,
  EbayGetBestOffersResponse,
  EbayGetFeedbackResponse,
  EbayTradingResponse,
} from './ebay.types';

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
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

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
   * Extract an OAuth2 access token from an eBay API client instance.
   */
  getAccessToken(client: eBayApi): string {
    // TODO: remove when ebay-api types are fixed
    return (client as any).authToken
      || (client as any).auth?.oAuth2?.accessToken
      || '';
  }

  /**
   * Call the eBay Post-Order API with rate-limit retry.
   * The Post-Order API is not covered by the ebay-api SDK, so we use raw fetch.
   */
  async callPostOrderApi(
    client: eBayApi,
    method: 'GET' | 'POST',
    path: string,
    marketplaceId: string,
    body?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Post-Order API ${method} ${path}`);
      return {};
    }

    return this.withRateLimitRetry(async () => {
      const accessToken = this.getAccessToken(client);
      const url = `https://api.ebay.com/post-order/v2${path}`;
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId || 'EBAY_US',
      };

      const response = await fetch(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (!response.ok) {
        const err: any = new Error(`eBay Post-Order API returned ${response.status}: ${response.statusText}`);
        err.status = response.status;
        throw err;
      }

      return response.json().catch(() => ({}));
    });
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
        brand?: string;
        mpn?: string;
        upc?: string[];
        ean?: string[];
        isbn?: string[];
        epid?: string;
        subtitle?: string;
      };
      condition: string;
      conditionDescription?: string;
      availability: {
        shipToLocationAvailability: {
          quantity: number;
        };
      };
      packageWeightAndSize?: {
        packageType?: string;
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
  ): Promise<unknown> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Created/updated inventory item: ${sku}`);
      return { sku, statusCode: 204 };
    }
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
  async deleteInventoryItem(client: eBayApi, sku: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Deleted inventory item: ${sku}`);
      return;
    }
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
      secondaryCategoryId?: string;
      listingDescription?: string;
      listingDuration?: string; // DAYS_1, DAYS_3, DAYS_5, DAYS_7, DAYS_10, DAYS_21, DAYS_30, GTC
      listingPolicies: {
        fulfillmentPolicyId: string;
        paymentPolicyId: string;
        returnPolicyId: string;
        bestOfferTerms?: {
          bestOfferEnabled: boolean;
          autoAcceptPrice?: { value: string; currency: string };
          autoDeclinePrice?: { value: string; currency: string };
        };
      };
      pricingSummary: {
        price: {
          value: string;
          currency: string;
        };
        auctionStartPrice?: { value: string; currency: string };
        auctionReservePrice?: { value: string; currency: string };
      };
      merchantLocationKey?: string;
      includeCatalogProductDetails?: boolean;
      hideBuyerDetails?: boolean;
      lotSize?: number;
      listingStartDate?: string; // ISO 8601 for scheduled listings
    }
  ): Promise<EbayCreateOfferResponse> {
    if (this.mockMode) {
      const offerId = `mock_offer_${Date.now()}`;
      this.logger.log(`[MOCK] Created offer ${offerId} for SKU: ${data.sku}`);
      return { offerId };
    }
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
  async publishOffer(client: eBayApi, offerId: string): Promise<EbayPublishOfferResponse> {
    if (this.mockMode) {
      const listingId = `mock_listing_${Date.now()}`;
      this.logger.log(`[MOCK] Published offer: ${offerId} → listing ${listingId}`);
      return { listingId };
    }
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
  async getInventoryItem(client: eBayApi, sku: string): Promise<EbayInventoryItem> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched inventory item: ${sku}`);
      return {
        sku,
        product: { title: 'Mock Product', description: 'Mock description', imageUrls: [] },
        condition: 'NEW',
        availability: { shipToLocationAvailability: { quantity: 100 } },
      };
    }
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
  async updateInventoryQuantity(client: eBayApi, sku: string, quantity: number): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Updated quantity for SKU ${sku}: ${quantity}`);
      return;
    }
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
        await client.sell.inventory.createOrReplaceInventoryItem(sku, updatedItem as any);
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
  ): Promise<EbayOrder[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched 0 orders from eBay`);
      return [];
    }
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
  ): Promise<EbayFulfillment> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Created shipping fulfillment for order: ${orderId}`);
      return { fulfillmentId: `mock_fulfill_${Date.now()}` };
    }
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
  ): Promise<EbayInventoryItem[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched 0 active listings`);
      return [];
    }
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
  async withdrawOffer(client: eBayApi, offerId: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Withdrew offer: ${offerId}`);
      return;
    }
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
  async getFulfillmentPolicies(client: eBayApi, marketplaceId: string): Promise<EbayFulfillmentPolicy[]> {
    if (this.mockMode) {
      return [{ fulfillmentPolicyId: 'mock_fp_1', name: 'Mock Fulfillment Policy' }];
    }
    return this.withRateLimitRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
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
  async getPaymentPolicies(client: eBayApi, marketplaceId: string): Promise<EbayPaymentPolicy[]> {
    if (this.mockMode) {
      return [{ paymentPolicyId: 'mock_pp_1', name: 'Mock Payment Policy' }];
    }
    return this.withRateLimitRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
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
  async getReturnPolicies(client: eBayApi, marketplaceId: string): Promise<EbayReturnPolicy[]> {
    if (this.mockMode) {
      return [{ returnPolicyId: 'mock_rp_1', name: 'Mock Return Policy' }];
    }
    return this.withRateLimitRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
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
  async getInventoryLocations(client: eBayApi): Promise<EbayInventoryLocation[]> {
    if (this.mockMode) {
      return [{ merchantLocationKey: 'mock_loc_1', name: 'Mock Location' }];
    }
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

  /**
   * Update an existing offer (price, quantity, etc. on a published listing)
   */
  async updateOffer(
    client: eBayApi,
    offerId: string,
    data: {
      availableQuantity?: number;
      categoryId?: string;
      listingDescription?: string;
      pricingSummary?: {
        price: { value: string; currency: string };
      };
      listingPolicies?: {
        fulfillmentPolicyId: string;
        paymentPolicyId: string;
        returnPolicyId: string;
      };
    }
  ): Promise<unknown> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Updated offer: ${offerId}`);
      return { offerId };
    }
    return this.withRateLimitRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response = await (client.sell.inventory as any).updateOffer(offerId, data);
        this.logger.log(`Updated offer: ${offerId}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to update offer ${offerId}`, error);
        throw error;
      }
    });
  }

  /**
   * Get offers for a SKU
   */
  async getOffers(client: eBayApi, params: { sku?: string; format?: string; limit?: number; offset?: number }): Promise<EbayGetOffersResponse> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched offers`);
      return { offers: [], total: 0 };
    }
    return this.withRateLimitRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response = await (client.sell.inventory as any).getOffers(params);
        this.logger.log(`Fetched ${response.offers?.length || 0} offers`);
        return response;
      } catch (error) {
        this.logger.error('Failed to fetch offers', error);
        throw error;
      }
    });
  }

  // ============================================
  // Multi-Variation Listing Methods
  // ============================================

  /**
   * Create or replace inventory item group (for multi-variation listings)
   */
  async createOrReplaceInventoryItemGroup(
    client: eBayApi,
    inventoryItemGroupKey: string,
    data: {
      title: string;
      description: string;
      imageUrls: string[];
      aspects: Record<string, string[]>;
      variantSKUs: string[];
      variesBy: {
        aspectsImageVariesBy: string[];
        specifications: Array<{ name: string; values: string[] }>;
      };
    }
  ): Promise<unknown> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Created/updated inventory item group: ${inventoryItemGroupKey}`);
      return { inventoryItemGroupKey, statusCode: 204 };
    }
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.inventory.createOrReplaceInventoryItemGroup(
          inventoryItemGroupKey,
          data as any
        );
        this.logger.log(`Created/updated inventory item group: ${inventoryItemGroupKey}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to create/update inventory item group ${inventoryItemGroupKey}`, error);
        throw error;
      }
    });
  }

  /**
   * Get inventory item group
   */
  async getInventoryItemGroup(client: eBayApi, inventoryItemGroupKey: string): Promise<EbayInventoryItemGroup> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched inventory item group: ${inventoryItemGroupKey}`);
      return { inventoryItemGroupKey, title: 'Mock Group', variantSKUs: [] };
    }
    return this.withRateLimitRetry(async () => {
      try {
        const response = await client.sell.inventory.getInventoryItemGroup(inventoryItemGroupKey);
        this.logger.log(`Fetched inventory item group: ${inventoryItemGroupKey}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to fetch inventory item group ${inventoryItemGroupKey}`, error);
        throw error;
      }
    });
  }

  /**
   * Delete inventory item group
   */
  async deleteInventoryItemGroup(client: eBayApi, inventoryItemGroupKey: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Deleted inventory item group: ${inventoryItemGroupKey}`);
      return;
    }
    return this.withRateLimitRetry(async () => {
      try {
        await client.sell.inventory.deleteInventoryItemGroup(inventoryItemGroupKey);
        this.logger.log(`Deleted inventory item group: ${inventoryItemGroupKey}`);
      } catch (error) {
        this.logger.error(`Failed to delete inventory item group ${inventoryItemGroupKey}`, error);
        throw error;
      }
    });
  }

  /**
   * Publish offer by inventory item group (for multi-variation listings)
   */
  async publishOfferByInventoryItemGroup(
    client: eBayApi,
    data: {
      inventoryItemGroupKey: string;
      marketplaceId: string;
      offers: Array<{
        sku: string;
        marketplaceId: string;
        format: string;
        availableQuantity: number;
        categoryId: string;
        listingPolicies: {
          fulfillmentPolicyId: string;
          paymentPolicyId: string;
          returnPolicyId: string;
        };
        pricingSummary: {
          price: { value: string; currency: string };
        };
        merchantLocationKey?: string;
      }>;
    }
  ): Promise<EbayPublishGroupResponse> {
    if (this.mockMode) {
      const listingId = `mock_group_listing_${Date.now()}`;
      this.logger.log(`[MOCK] Published offers by group: ${data.inventoryItemGroupKey} → ${listingId}`);
      return { listingId, offers: data.offers.map((o, i) => ({ offerId: `mock_offer_${i}`, sku: o.sku })) };
    }
    return this.withRateLimitRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response = await (client.sell.inventory as any).publishOfferByInventoryItemGroup(data);
        this.logger.log(`Published offers by group: ${data.inventoryItemGroupKey}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to publish offers by group ${data.inventoryItemGroupKey}`, error);
        throw error;
      }
    });
  }

  // ============================================
  // Trading API Methods
  // ============================================

  /**
   * Get messages from eBay (Trading API)
   */
  async getMyMessages(
    client: eBayApi,
    params: { folder?: string; startTime?: string; endTime?: string; detailLevel?: string }
  ): Promise<EbayGetMyMessagesResponse> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched 0 messages from eBay`);
      return { Messages: { Message: [] } };
    }
    return this.withRateLimitRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response: EbayGetMyMessagesResponse = await (client as any).trading.GetMyMessages({
          Folder: params.folder || 'Inbox',
          StartTime: params.startTime,
          EndTime: params.endTime,
          DetailLevel: params.detailLevel || 'ReturnMessages',
        });
        this.logger.log(`Fetched messages from eBay`);
        return response;
      } catch (error) {
        this.logger.error('Failed to fetch messages from eBay', error);
        throw error;
      }
    });
  }

  /**
   * Send message to buyer (Trading API)
   */
  async addMemberMessageAAQToPartner(
    client: eBayApi,
    data: { itemId: string; recipientId: string; subject: string; body: string }
  ): Promise<EbayTradingResponse> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Sent message to ${data.recipientId}`);
      return { Ack: 'Success' };
    }
    return this.withRateLimitRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response: EbayTradingResponse = await (client as any).trading.AddMemberMessageAAQToPartner({
          ItemID: data.itemId,
          MemberMessage: {
            Body: data.body,
            RecipientID: [data.recipientId],
            Subject: data.subject,
            QuestionType: 'General',
          },
        });
        this.logger.log(`Sent message to ${data.recipientId}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to send message to ${data.recipientId}`, error);
        throw error;
      }
    });
  }

  /**
   * Get best offers for a listing (Trading API)
   */
  async getBestOffers(client: eBayApi, itemId: string, status?: string): Promise<EbayGetBestOffersResponse> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched best offers for item ${itemId}`);
      return { BestOfferArray: { BestOffer: [] } };
    }
    return this.withRateLimitRetry(async () => {
      try {
        const params: Record<string, unknown> = { ItemID: itemId };
        if (status) params.BestOfferStatus = status;
        // TODO: remove when ebay-api types are fixed
        const response: EbayGetBestOffersResponse = await (client as any).trading.GetBestOffers(params);
        this.logger.log(`Fetched best offers for item ${itemId}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to fetch best offers for item ${itemId}`, error);
        throw error;
      }
    });
  }

  /**
   * Respond to best offer (Trading API)
   */
  async respondToBestOffer(
    client: eBayApi,
    itemId: string,
    bestOfferId: string,
    action: 'Accept' | 'Decline' | 'Counter',
    counterAmount?: number,
    sellerMessage?: string
  ): Promise<EbayTradingResponse> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Responded to best offer ${bestOfferId} with ${action}`);
      return { Ack: 'Success' };
    }
    return this.withRateLimitRetry(async () => {
      try {
        const params: Record<string, unknown> = {
          ItemID: itemId,
          BestOfferID: bestOfferId,
          Action: action,
        };
        if (action === 'Counter' && counterAmount !== undefined) {
          params.CounterOfferPrice = { _value: counterAmount, _attrs: { currencyID: 'USD' } };
        }
        if (sellerMessage) params.SellerResponse = sellerMessage;
        // TODO: remove when ebay-api types are fixed
        const response: EbayTradingResponse = await (client as any).trading.RespondToBestOffer(params);
        this.logger.log(`Responded to best offer ${bestOfferId} with ${action}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to respond to best offer ${bestOfferId}`, error);
        throw error;
      }
    });
  }

  /**
   * Get feedback (Trading API)
   */
  async getFeedback(client: eBayApi, params?: { userId?: string; entriesPerPage?: number; pageNumber?: number }): Promise<EbayGetFeedbackResponse> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched feedback`);
      return { FeedbackDetailArray: { FeedbackDetail: [] }, FeedbackScore: 0 };
    }
    return this.withRateLimitRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response: EbayGetFeedbackResponse = await (client as any).trading.GetFeedback({
          DetailLevel: 'ReturnAll',
          Pagination: {
            EntriesPerPage: params?.entriesPerPage || 25,
            PageNumber: params?.pageNumber || 1,
          },
          ...(params?.userId ? { UserID: params.userId } : {}),
        });
        this.logger.log(`Fetched feedback`);
        return response;
      } catch (error) {
        this.logger.error('Failed to fetch feedback', error);
        throw error;
      }
    });
  }
}
