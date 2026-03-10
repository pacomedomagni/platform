import { Test, TestingModule } from '@nestjs/testing';
import { EbayTaxonomyService } from './ebay-taxonomy.service';
import { EbayStoreService } from './ebay-store.service';

describe('EbayTaxonomyService', () => {
  let service: EbayTaxonomyService;

  beforeEach(async () => {
    process.env.MOCK_EXTERNAL_SERVICES = 'true';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EbayTaxonomyService,
        {
          provide: EbayStoreService,
          useValue: { getClient: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get<EbayTaxonomyService>(EbayTaxonomyService);
  });

  afterEach(() => {
    delete process.env.MOCK_EXTERNAL_SERVICES;
  });

  describe('searchCategories (mock)', () => {
    it('should return mock category suggestions', async () => {
      const results = await service.searchCategories('conn-1', 'EBAY_US', 'laptop');
      expect(results).toHaveLength(3);
      expect(results[0].category.categoryId).toBe('9355');
      expect(results[0].category.categoryName).toBe('Laptop & Desktop Accessories');
    });
  });

  describe('getCategorySubtree (mock)', () => {
    it('should return mock subtree', async () => {
      const result = await service.getCategorySubtree('conn-1', 'EBAY_US', '9355');
      expect(result.categorySubtreeNode.category.categoryId).toBe('9355');
      expect(result.categorySubtreeNode.childCategoryTreeNodes).toHaveLength(2);
    });
  });

  describe('getItemAspectsForCategory (mock)', () => {
    it('should return mock aspects with required fields', async () => {
      const aspects = await service.getItemAspectsForCategory('conn-1', 'EBAY_US', '9355');
      expect(aspects.length).toBeGreaterThan(0);

      const brand = aspects.find((a: any) => a.localizedAspectName === 'Brand');
      expect(brand).toBeDefined();
      expect(brand.aspectConstraint.aspectRequired).toBe(true);

      const color = aspects.find((a: any) => a.localizedAspectName === 'Color');
      expect(color).toBeDefined();
      expect(color.aspectConstraint.aspectMode).toBe('SELECTION_ONLY');
      expect(color.aspectValues.length).toBeGreaterThan(0);
    });
  });

  describe('getConditionsForCategory (mock)', () => {
    it('should return mock conditions', async () => {
      const conditions = await service.getConditionsForCategory('conn-1', 'EBAY_US', '9355');
      expect(conditions.length).toBeGreaterThan(0);
      expect(conditions[0].conditionId).toBe('1000');
      expect(conditions[0].conditionDescription).toBe('New');
    });
  });

  describe('fetchItemAspects (mock)', () => {
    it('should return zero categories in mock mode', async () => {
      const result = await service.fetchItemAspects('conn-1', 'EBAY_US');
      expect(result.categoriesLoaded).toBe(0);
      expect(result.cachedUntil).toBeDefined();
    });
  });

  describe('bulk aspects cache', () => {
    it('should return cached aspects when available', async () => {
      // Manually populate the cache via reflection
      const cache = (service as any).bulkAspectsCache;
      cache.set('EBAY_US:12345', {
        aspects: [{ localizedAspectName: 'CachedBrand', aspectConstraint: { aspectRequired: true } }],
        expiry: Date.now() + 86400000,
      });

      const aspects = await service.getItemAspectsForCategory('conn-1', 'EBAY_US', '12345');
      expect(aspects).toHaveLength(1);
      expect(aspects[0].localizedAspectName).toBe('CachedBrand');
    });

    it('should skip expired cache entries', async () => {
      const cache = (service as any).bulkAspectsCache;
      cache.set('EBAY_US:99999', {
        aspects: [{ localizedAspectName: 'ExpiredBrand' }],
        expiry: Date.now() - 1000, // Expired
      });

      // Should fall through to mock data since cache is expired
      const aspects = await service.getItemAspectsForCategory('conn-1', 'EBAY_US', '99999');
      expect(aspects[0].localizedAspectName).toBe('Brand'); // Mock data, not cached
    });
  });
});
