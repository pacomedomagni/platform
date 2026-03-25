import { Test, TestingModule } from '@nestjs/testing';
import { EbayClientService, EbayApiError } from './ebay-client.service';

describe('EbayClientService', () => {
  let service: EbayClientService;

  beforeEach(async () => {
    process.env.MOCK_EXTERNAL_SERVICES = 'true';

    const module: TestingModule = await Test.createTestingModule({
      providers: [EbayClientService],
    }).compile();

    service = module.get<EbayClientService>(EbayClientService);
  });

  afterEach(() => {
    delete process.env.MOCK_EXTERNAL_SERVICES;
  });

  describe('trackApiCall', () => {
    it('should allow calls under the limit', async () => {
      expect(await service.trackApiCall('sell.inventory')).toBe(true);
    });

    it('should track calls per API group', async () => {
      // First call creates the counter
      await service.trackApiCall('sell.inventory');
      await service.trackApiCall('sell.inventory');
      await service.trackApiCall('sell.account');

      // All should pass - we're well under limits
      expect(await service.trackApiCall('sell.inventory')).toBe(true);
      expect(await service.trackApiCall('sell.account')).toBe(true);
    });

    it('should use default limit for unknown API groups', async () => {
      expect(await service.trackApiCall('unknown.api')).toBe(true);
    });
  });

  describe('checkRevisionLimit', () => {
    it('should allow first revision', async () => {
      expect(await service.checkRevisionLimit('listing-1')).toBe(true);
    });

    it('should track revisions per listing', async () => {
      await service.checkRevisionLimit('listing-1');
      await service.checkRevisionLimit('listing-2');
      expect(await service.checkRevisionLimit('listing-1')).toBe(true);
      expect(await service.checkRevisionLimit('listing-2')).toBe(true);
    });
  });

  describe('mock mode operations', () => {
    const mockClient = {} as any;

    it('should mock createOrReplaceInventoryItem', async () => {
      const result = await service.createOrReplaceInventoryItem(mockClient, 'SKU-1', {
        product: { title: 'Test', description: 'Desc', imageUrls: [] },
        condition: 'NEW',
        availability: { shipToLocationAvailability: { quantity: 10 } },
      });
      expect(result).toEqual({ sku: 'SKU-1', statusCode: 204 });
    });

    it('should mock deleteInventoryItem', async () => {
      await expect(service.deleteInventoryItem(mockClient, 'SKU-1')).resolves.toBeUndefined();
    });

    it('should mock createOffer', async () => {
      const result = await service.createOffer(mockClient, {
        sku: 'SKU-1',
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        availableQuantity: 10,
        categoryId: '9355',
        listingPolicies: {
          fulfillmentPolicyId: 'fp-1',
          paymentPolicyId: 'pp-1',
          returnPolicyId: 'rp-1',
        },
        pricingSummary: { price: { value: '29.99', currency: 'USD' } },
      });
      expect(result.offerId).toContain('mock_offer_');
    });

    it('should mock publishOffer', async () => {
      const result = await service.publishOffer(mockClient, 'offer-1');
      expect(result.listingId).toContain('mock_listing_');
    });

    it('should mock getOrders', async () => {
      const result = await service.getOrders(mockClient, {});
      expect(result).toEqual([]);
    });

    it('should mock getInventoryItem', async () => {
      const result = await service.getInventoryItem(mockClient, 'SKU-1');
      expect(result.sku).toBe('SKU-1');
      expect(result.product.title).toBe('Mock Product');
    });

    it('should mock updateInventoryQuantity', async () => {
      await expect(service.updateInventoryQuantity(mockClient, 'SKU-1', 50)).resolves.toBeUndefined();
    });

    it('should mock withdrawOffer', async () => {
      await expect(service.withdrawOffer(mockClient, 'offer-1')).resolves.toBeUndefined();
    });

    it('should mock getFulfillmentPolicies', async () => {
      const result = await service.getFulfillmentPolicies(mockClient, 'EBAY_US');
      expect(result).toHaveLength(1);
      expect(result[0].fulfillmentPolicyId).toBe('mock_fp_1');
    });

    it('should mock getPaymentPolicies', async () => {
      const result = await service.getPaymentPolicies(mockClient, 'EBAY_US');
      expect(result).toHaveLength(1);
    });

    it('should mock getReturnPolicies', async () => {
      const result = await service.getReturnPolicies(mockClient, 'EBAY_US');
      expect(result).toHaveLength(1);
    });

    it('should mock callPostOrderApi', async () => {
      const result = await service.callPostOrderApi(mockClient, 'GET', '/return/123', 'EBAY_US');
      expect(result).toEqual({});
    });

    it('should mock uploadImagesToEps', async () => {
      const urls = ['http://minio/bucket/img1.jpg', 'http://minio/bucket/img2.jpg'];
      const mediaService = {
        uploadImageFromStorage: jest.fn(),
      };
      const result = await service.uploadImagesToEps('conn-1', urls, mediaService);
      expect(result).toHaveLength(2);
      result.forEach((url) => expect(url).toContain('i.ebayimg.com'));
    });

    it('should mock bulkCreateOrReplaceInventoryItems', async () => {
      const items = [
        { sku: 'SKU-1', data: {} },
        { sku: 'SKU-2', data: {} },
      ];
      const result = await service.bulkCreateOrReplaceInventoryItems(mockClient, items);
      expect(result.responses).toHaveLength(2);
      expect(result.responses[0].statusCode).toBe(200);
    });

    it('should mock getAdRateRecommendations', async () => {
      const result = await service.getAdRateRecommendations(mockClient, ['listing-1']);
      expect(result).toHaveLength(1);
      expect(result[0].suggestedBidPercentage).toBe('8.5');
    });
  });

  describe('EbayApiError', () => {
    it('should create structured error', () => {
      const error = new EbayApiError('Test error', 429, 'APPLICATION', 1001);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(429);
      expect(error.category).toBe('APPLICATION');
      expect(error.errorId).toBe(1001);
      expect(error.name).toBe('EbayApiError');
    });
  });
});
