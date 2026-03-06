import { Injectable, Logger } from '@nestjs/common';
import { EbayStoreService } from './ebay-store.service';

/**
 * eBay Taxonomy & Metadata Service
 * Provides category tree lookup, item specifics, and condition policies
 * via the eBay Taxonomy API and Sell Metadata API.
 * Uses an in-memory cache with 24-hour TTL for category tree IDs.
 */
@Injectable()
export class EbayTaxonomyService {
  private readonly logger = new Logger(EbayTaxonomyService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  /** Cache: marketplace key -> { treeId, expiry } */
  private readonly treeIdCache = new Map<string, { treeId: string; expiry: number }>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private ebayStore: EbayStoreService) {}

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Search categories by keyword using the eBay Taxonomy API.
   * Returns an array of category suggestions.
   */
  async searchCategories(
    connectionId: string,
    marketplaceId: string,
    query: string
  ): Promise<any[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Searching categories for "${query}" on ${marketplaceId}`);
      return [
        {
          category: {
            categoryId: '9355',
            categoryName: 'Laptop & Desktop Accessories',
          },
          categoryTreeNodeAncestors: [
            { categoryId: '58058', categoryName: 'Computers/Tablets & Networking' },
          ],
          categoryTreeNodeLevel: 3,
        },
        {
          category: {
            categoryId: '175673',
            categoryName: 'Cell Phone Accessories',
          },
          categoryTreeNodeAncestors: [
            { categoryId: '15032', categoryName: 'Cell Phones & Accessories' },
          ],
          categoryTreeNodeLevel: 2,
        },
        {
          category: {
            categoryId: '11450',
            categoryName: 'Clothing, Shoes & Accessories',
          },
          categoryTreeNodeAncestors: [],
          categoryTreeNodeLevel: 1,
        },
      ];
    }

    try {
      const categoryTreeId = await this.getCategoryTreeId(connectionId, marketplaceId);
      const client = await this.ebayStore.getClient(connectionId);

      const response = await client.commerce.taxonomy.getCategorySuggestions(
        categoryTreeId,
        query
      );

      const suggestions = response.categorySuggestions || [];
      this.logger.log(
        `Found ${suggestions.length} category suggestions for "${query}" (tree ${categoryTreeId})`
      );
      return suggestions;
    } catch (error) {
      this.logger.error(`Failed to search categories for "${query}" on ${marketplaceId}`, error);
      throw error;
    }
  }

  /**
   * Get category subtree for a given category ID.
   */
  async getCategorySubtree(
    connectionId: string,
    marketplaceId: string,
    categoryId: string
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Getting subtree for category ${categoryId} on ${marketplaceId}`);
      return {
        categorySubtreeNode: {
          category: {
            categoryId,
            categoryName: 'Mock Category',
          },
          childCategoryTreeNodes: [
            {
              category: {
                categoryId: `${categoryId}-child-1`,
                categoryName: 'Mock Subcategory 1',
              },
              leafCategoryTreeNode: true,
            },
            {
              category: {
                categoryId: `${categoryId}-child-2`,
                categoryName: 'Mock Subcategory 2',
              },
              leafCategoryTreeNode: true,
            },
          ],
          categoryTreeNodeLevel: 2,
        },
        categoryTreeId: 'mock-tree-0',
        categorySubtreeNodeHref: `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=${categoryId}`,
      };
    }

    try {
      const categoryTreeId = await this.getCategoryTreeId(connectionId, marketplaceId);
      const client = await this.ebayStore.getClient(connectionId);

      const response = await client.commerce.taxonomy.getCategorySubtree(
        categoryTreeId,
        categoryId
      );

      this.logger.log(`Fetched subtree for category ${categoryId} (tree ${categoryTreeId})`);
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to get subtree for category ${categoryId} on ${marketplaceId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get required and recommended item specifics (aspects) for a category.
   * Returns an array of aspect metadata including name, data type,
   * whether the aspect is required, and allowed values.
   */
  async getItemAspectsForCategory(
    connectionId: string,
    marketplaceId: string,
    categoryId: string
  ): Promise<any[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Getting item aspects for category ${categoryId} on ${marketplaceId}`);
      return [
        {
          localizedAspectName: 'Brand',
          aspectConstraint: {
            aspectRequired: true,
            aspectMode: 'FREE_TEXT',
            aspectDataType: 'STRING',
          },
          aspectValues: [
            { localizedValue: 'Apple' },
            { localizedValue: 'Samsung' },
            { localizedValue: 'Sony' },
          ],
        },
        {
          localizedAspectName: 'Model',
          aspectConstraint: {
            aspectRequired: false,
            aspectMode: 'FREE_TEXT',
            aspectDataType: 'STRING',
          },
          aspectValues: [],
        },
        {
          localizedAspectName: 'Color',
          aspectConstraint: {
            aspectRequired: false,
            aspectMode: 'SELECTION_ONLY',
            aspectDataType: 'STRING',
          },
          aspectValues: [
            { localizedValue: 'Black' },
            { localizedValue: 'White' },
            { localizedValue: 'Silver' },
            { localizedValue: 'Blue' },
          ],
        },
        {
          localizedAspectName: 'MPN',
          aspectConstraint: {
            aspectRequired: true,
            aspectMode: 'FREE_TEXT',
            aspectDataType: 'STRING',
          },
          aspectValues: [],
        },
      ];
    }

    try {
      const categoryTreeId = await this.getCategoryTreeId(connectionId, marketplaceId);
      const client = await this.ebayStore.getClient(connectionId);

      const response = await client.commerce.taxonomy.getItemAspectsForCategory(
        categoryTreeId,
        categoryId
      );

      const aspects = response.aspects || [];
      this.logger.log(
        `Fetched ${aspects.length} item aspects for category ${categoryId} (tree ${categoryTreeId})`
      );
      return aspects;
    } catch (error) {
      this.logger.error(
        `Failed to get item aspects for category ${categoryId} on ${marketplaceId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get valid listing conditions for a category.
   * Uses the Sell Metadata API (getItemConditionPolicies) and filters
   * the result set to the specified categoryId.
   */
  async getConditionsForCategory(
    connectionId: string,
    marketplaceId: string,
    categoryId: string
  ): Promise<any[]> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Getting conditions for category ${categoryId} on ${marketplaceId}`
      );
      return [
        { conditionId: '1000', conditionDescription: 'New' },
        { conditionId: '1500', conditionDescription: 'New other' },
        { conditionId: '2000', conditionDescription: 'Certified refurbished' },
        { conditionId: '2500', conditionDescription: 'Seller refurbished' },
        { conditionId: '3000', conditionDescription: 'Used' },
        { conditionId: '7000', conditionDescription: 'For parts or not working' },
      ];
    }

    try {
      const client = await this.ebayStore.getClient(connectionId);

      const response = await (client.sell as any).metadata.getItemConditionPolicies(marketplaceId);

      const allPolicies = response.itemConditionPolicies || [];
      const matched = allPolicies.find(
        (policy: any) => policy.categoryId === categoryId
      );

      const conditions = matched?.itemConditions || [];
      this.logger.log(
        `Fetched ${conditions.length} conditions for category ${categoryId} on ${marketplaceId}`
      );
      return conditions;
    } catch (error) {
      this.logger.error(
        `Failed to get conditions for category ${categoryId} on ${marketplaceId}`,
        error
      );
      throw error;
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Get the default category tree ID for a marketplace.
   * Results are cached in memory with a 24-hour TTL.
   */
  private async getCategoryTreeId(
    connectionId: string,
    marketplaceId: string
  ): Promise<string> {
    const cacheKey = `${connectionId}:${marketplaceId}`;

    const cached = this.treeIdCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.treeId;
    }

    if (this.mockMode) {
      const mockTreeId = '0'; // EBAY_US default tree ID
      this.treeIdCache.set(cacheKey, {
        treeId: mockTreeId,
        expiry: Date.now() + this.CACHE_TTL_MS,
      });
      return mockTreeId;
    }

    try {
      const client = await this.ebayStore.getClient(connectionId);
      const response = await client.commerce.taxonomy.getDefaultCategoryTreeId(marketplaceId);

      const treeId = response.categoryTreeId;
      if (!treeId) {
        throw new Error(
          `No category tree ID returned for marketplace ${marketplaceId}`
        );
      }

      this.treeIdCache.set(cacheKey, {
        treeId,
        expiry: Date.now() + this.CACHE_TTL_MS,
      });

      this.logger.log(
        `Cached category tree ID ${treeId} for ${marketplaceId} (connection ${connectionId})`
      );
      return treeId;
    } catch (error) {
      this.logger.error(
        `Failed to get category tree ID for ${marketplaceId}`,
        error
      );
      throw error;
    }
  }
}
