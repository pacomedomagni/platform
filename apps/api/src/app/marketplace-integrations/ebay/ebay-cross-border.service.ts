import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';

/**
 * eBay Cross-Border Trade Service
 * Supports listing inventory items on international eBay marketplaces,
 * retrieving marketplace-specific fulfillment/return/payment policies,
 * and providing exchange rate information for multi-currency pricing.
 */
@Injectable()
export class EbayCrossBorderService {
  private readonly logger = new Logger(EbayCrossBorderService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService
  ) {}

  /**
   * Returns the list of supported eBay global marketplaces with
   * their currency, language, and site display name.
   */
  getSupportedMarketplaces(): any[] {
    return [
      {
        marketplaceId: 'EBAY_US',
        name: 'eBay United States',
        currency: 'USD',
        language: 'en_US',
        siteUrl: 'https://www.ebay.com',
      },
      {
        marketplaceId: 'EBAY_UK',
        name: 'eBay United Kingdom',
        currency: 'GBP',
        language: 'en_GB',
        siteUrl: 'https://www.ebay.co.uk',
      },
      {
        marketplaceId: 'EBAY_DE',
        name: 'eBay Germany',
        currency: 'EUR',
        language: 'de_DE',
        siteUrl: 'https://www.ebay.de',
      },
      {
        marketplaceId: 'EBAY_AU',
        name: 'eBay Australia',
        currency: 'AUD',
        language: 'en_AU',
        siteUrl: 'https://www.ebay.com.au',
      },
      {
        marketplaceId: 'EBAY_CA',
        name: 'eBay Canada',
        currency: 'CAD',
        language: 'en_CA',
        siteUrl: 'https://www.ebay.ca',
      },
      {
        marketplaceId: 'EBAY_FR',
        name: 'eBay France',
        currency: 'EUR',
        language: 'fr_FR',
        siteUrl: 'https://www.ebay.fr',
      },
      {
        marketplaceId: 'EBAY_IT',
        name: 'eBay Italy',
        currency: 'EUR',
        language: 'it_IT',
        siteUrl: 'https://www.ebay.it',
      },
      {
        marketplaceId: 'EBAY_ES',
        name: 'eBay Spain',
        currency: 'EUR',
        language: 'es_ES',
        siteUrl: 'https://www.ebay.es',
      },
    ];
  }

  /**
   * Get fulfillment (shipping) policies for a specific marketplace.
   * Uses the Account API getFulfillmentPolicies call scoped to the marketplace.
   */
  async getShippingPolicies(connectionId: string, marketplaceId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Returning mock shipping policies for marketplace ${marketplaceId} on connection ${connectionId}`
      );
      return this.getMockShippingPolicies(marketplaceId);
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).account.getFulfillmentPolicies({
        marketplace_id: marketplaceId,
      });

      this.logger.log(
        `Fetched ${response?.fulfillmentPolicies?.length || 0} shipping policies for marketplace ${marketplaceId}`
      );
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch shipping policies for marketplace ${marketplaceId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get return policies for a specific marketplace.
   * Uses the Account API getReturnPolicies call scoped to the marketplace.
   */
  async getReturnPolicies(connectionId: string, marketplaceId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Returning mock return policies for marketplace ${marketplaceId} on connection ${connectionId}`
      );
      return this.getMockReturnPolicies(marketplaceId);
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).account.getReturnPolicies({
        marketplace_id: marketplaceId,
      });

      this.logger.log(
        `Fetched ${response?.returnPolicies?.length || 0} return policies for marketplace ${marketplaceId}`
      );
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch return policies for marketplace ${marketplaceId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get payment policies for a specific marketplace.
   * Uses the Account API getPaymentPolicies call scoped to the marketplace.
   */
  async getPaymentPolicies(connectionId: string, marketplaceId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Returning mock payment policies for marketplace ${marketplaceId} on connection ${connectionId}`
      );
      return this.getMockPaymentPolicies(marketplaceId);
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).account.getPaymentPolicies({
        marketplace_id: marketplaceId,
      });

      this.logger.log(
        `Fetched ${response?.paymentPolicies?.length || 0} payment policies for marketplace ${marketplaceId}`
      );
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch payment policies for marketplace ${marketplaceId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * List an existing inventory item on a target international marketplace.
   * Creates an offer on the target marketplace for the given SKU, then publishes it.
   * The inventory item must already exist (created via the Inventory API).
   */
  async listItemCrossBorder(
    connectionId: string,
    data: {
      sku: string;
      targetMarketplace: string;
      price: { value: string; currency: string };
      fulfillmentPolicyId: string;
      returnPolicyId: string;
      paymentPolicyId?: string;
      categoryId: string;
    }
  ): Promise<any> {
    if (this.mockMode) {
      const mockOfferId = `mock_offer_${data.targetMarketplace}_${Date.now()}`;
      const mockListingId = `mock_listing_${data.targetMarketplace}_${Date.now()}`;
      this.logger.log(
        `[MOCK] Created cross-border listing for SKU ${data.sku} on ${data.targetMarketplace} ` +
        `(offerId: ${mockOfferId}, listingId: ${mockListingId})`
      );
      return {
        offerId: mockOfferId,
        listingId: mockListingId,
        sku: data.sku,
        targetMarketplace: data.targetMarketplace,
        price: data.price,
        status: 'PUBLISHED',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      // Build the offer payload targeting the international marketplace
      const offerPayload: any = {
        sku: data.sku,
        marketplaceId: data.targetMarketplace,
        format: 'FIXED_PRICE',
        availableQuantity: 1,
        categoryId: data.categoryId,
        listingPolicies: {
          fulfillmentPolicyId: data.fulfillmentPolicyId,
          returnPolicyId: data.returnPolicyId,
          ...(data.paymentPolicyId && { paymentPolicyId: data.paymentPolicyId }),
        },
        pricingSummary: {
          price: {
            value: data.price.value,
            currency: data.price.currency,
          },
        },
      };

      // Create the offer on the target marketplace
      const offerResponse = await (client.sell as any).offer.createOffer(offerPayload);
      const offerId = offerResponse?.offerId || (offerResponse as any)?.offerId;

      this.logger.log(
        `Created cross-border offer ${offerId} for SKU ${data.sku} on ${data.targetMarketplace}`
      );

      // Publish the offer to make it a live listing
      let listingId: string | undefined;
      try {
        const publishResponse = await (client.sell as any).offer.publishOffer(offerId);
        listingId = publishResponse?.listingId || (publishResponse as any)?.listingId;

        this.logger.log(
          `Published cross-border offer ${offerId} as listing ${listingId} on ${data.targetMarketplace}`
        );
      } catch (publishError: any) {
        this.logger.error(
          `Failed to publish cross-border offer ${offerId} on ${data.targetMarketplace}: ${publishError?.message || String(publishError)}`,
          publishError
        );
        // Return the offer even if publishing fails so the caller can retry
        return {
          offerId,
          listingId: null,
          sku: data.sku,
          targetMarketplace: data.targetMarketplace,
          price: data.price,
          status: 'UNPUBLISHED',
          error: publishError?.message || 'Failed to publish offer',
        };
      }

      return {
        offerId,
        listingId,
        sku: data.sku,
        targetMarketplace: data.targetMarketplace,
        price: data.price,
        status: 'PUBLISHED',
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to create cross-border listing for SKU ${data.sku} on ${data.targetMarketplace}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get mock exchange rates for price conversion assistance.
   * Returns approximate rates from the base currency to each target currency.
   * In production this could integrate with a real FX rate provider; for now
   * it returns static representative rates.
   */
  getExchangeRates(
    baseCurrency: string,
    targetCurrencies: string[]
  ): any {
    this.logger.warn(
      'Using static exchange rates. These are approximations only — integrate a live FX provider (e.g. Open Exchange Rates) for production use.'
    );

    const rates: Record<string, Record<string, number>> = {
      USD: { GBP: 0.79, EUR: 0.92, AUD: 1.53, CAD: 1.36, USD: 1.0 },
      GBP: { USD: 1.27, EUR: 1.17, AUD: 1.94, CAD: 1.72, GBP: 1.0 },
      EUR: { USD: 1.09, GBP: 0.86, AUD: 1.66, CAD: 1.48, EUR: 1.0 },
      AUD: { USD: 0.65, GBP: 0.52, EUR: 0.60, CAD: 0.89, AUD: 1.0 },
      CAD: { USD: 0.74, GBP: 0.58, EUR: 0.68, AUD: 1.12, CAD: 1.0 },
    };

    const baseRates = rates[baseCurrency.toUpperCase()];
    if (!baseRates) {
      this.logger.warn(`Unsupported base currency: ${baseCurrency}`);
      return {
        baseCurrency: baseCurrency.toUpperCase(),
        rates: {},
        disclaimer: 'Unsupported base currency. Supported: USD, GBP, EUR, AUD, CAD.',
      };
    }

    const result: Record<string, number> = {};
    for (const target of targetCurrencies) {
      const upper = target.toUpperCase();
      if (baseRates[upper] !== undefined) {
        result[upper] = baseRates[upper];
      } else {
        this.logger.warn(`Unsupported target currency: ${upper}`);
      }
    }

    return {
      baseCurrency: baseCurrency.toUpperCase(),
      rates: result,
      disclaimer:
        'These are approximate exchange rates for estimation purposes only. Actual eBay conversion rates may differ.',
    };
  }

  // ---------------------------------------------------------------------------
  // Mock data generators
  // ---------------------------------------------------------------------------

  private getMockShippingPolicies(marketplaceId: string): any {
    return {
      total: 2,
      fulfillmentPolicies: [
        {
          fulfillmentPolicyId: `mock_ship_standard_${marketplaceId}`,
          name: 'Standard Shipping',
          marketplaceId,
          description: 'Standard international shipping, 7-14 business days',
          handlingTime: { value: 2, unit: 'DAY' },
          shippingOptions: [
            {
              optionType: 'DOMESTIC',
              costType: 'FLAT_RATE',
              shippingServices: [
                {
                  shippingServiceCode: 'StandardShippingFromOutsideUS',
                  shippingCost: { value: '9.99', currency: 'USD' },
                  sortOrder: 1,
                },
              ],
            },
          ],
          globalShipping: false,
        },
        {
          fulfillmentPolicyId: `mock_ship_express_${marketplaceId}`,
          name: 'Express Shipping',
          marketplaceId,
          description: 'Express international shipping, 3-5 business days',
          handlingTime: { value: 1, unit: 'DAY' },
          shippingOptions: [
            {
              optionType: 'DOMESTIC',
              costType: 'FLAT_RATE',
              shippingServices: [
                {
                  shippingServiceCode: 'ExpeditedShippingFromOutsideUS',
                  shippingCost: { value: '24.99', currency: 'USD' },
                  sortOrder: 1,
                },
              ],
            },
          ],
          globalShipping: false,
        },
      ],
    };
  }

  private getMockReturnPolicies(marketplaceId: string): any {
    return {
      total: 2,
      returnPolicies: [
        {
          returnPolicyId: `mock_return_30day_${marketplaceId}`,
          name: '30-Day Returns',
          marketplaceId,
          description: '30-day money-back guarantee',
          returnsAccepted: true,
          returnPeriod: { value: 30, unit: 'DAY' },
          returnShippingCostPayer: 'BUYER',
          refundMethod: 'MONEY_BACK',
        },
        {
          returnPolicyId: `mock_return_60day_${marketplaceId}`,
          name: '60-Day Returns',
          marketplaceId,
          description: '60-day money-back guarantee with free return shipping',
          returnsAccepted: true,
          returnPeriod: { value: 60, unit: 'DAY' },
          returnShippingCostPayer: 'SELLER',
          refundMethod: 'MONEY_BACK',
        },
      ],
    };
  }

  private getMockPaymentPolicies(marketplaceId: string): any {
    return {
      total: 1,
      paymentPolicies: [
        {
          paymentPolicyId: `mock_payment_default_${marketplaceId}`,
          name: 'Default Payment Policy',
          marketplaceId,
          description: 'eBay managed payments',
          immediatePay: true,
          paymentMethods: [
            { paymentMethodType: 'PERSONAL_CHECK' },
            { paymentMethodType: 'CASH_ON_PICKUP' },
          ],
        },
      ],
    };
  }
}
