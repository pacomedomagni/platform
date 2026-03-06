import { Injectable, Logger } from '@nestjs/common';
import { EbayStoreService } from './ebay-store.service';
import { EbayClientService } from './ebay-client.service';

/**
 * eBay Store Categories Service
 * Manages eBay store custom categories via the Trading API (SOAP).
 * Supports fetching, creating, updating, and deleting store categories.
 */
@Injectable()
export class EbayStoreCategoriesService {
  private readonly logger = new Logger(EbayStoreCategoriesService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private ebayStore: EbayStoreService,
    private ebayClient: EbayClientService
  ) {}

  /**
   * Get all store custom categories for a connection.
   * Calls GetStore with CategoryStructureOnly to retrieve the category tree.
   */
  async getStoreCategories(connectionId: string): Promise<any[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched store categories for connection ${connectionId}`);
      return [
        {
          categoryId: 1,
          name: 'Electronics',
          order: 1,
          children: [
            { categoryId: 10, name: 'Phones & Accessories', order: 1, children: [] },
            { categoryId: 11, name: 'Computers & Tablets', order: 2, children: [] },
          ],
        },
        {
          categoryId: 2,
          name: 'Home & Garden',
          order: 2,
          children: [
            { categoryId: 20, name: 'Kitchen', order: 1, children: [] },
            { categoryId: 21, name: 'Outdoor', order: 2, children: [] },
          ],
        },
        {
          categoryId: 3,
          name: 'Collectibles',
          order: 3,
          children: [],
        },
      ];
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client as any).trading.GetStore({
        CategoryStructureOnly: true,
      });

      const customCategories =
        response?.Store?.CustomCategories?.CustomCategory || [];

      // Normalize to array (eBay may return a single object or an array)
      const categories = Array.isArray(customCategories)
        ? customCategories
        : [customCategories];

      this.logger.log(
        `Fetched ${categories.length} store categories for connection ${connectionId}`
      );

      return categories.map((cat: any) => this.mapCategory(cat));
    } catch (error) {
      this.logger.error(
        `Failed to fetch store categories for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Recursively map an eBay store category to a simplified structure.
   */
  private mapCategory(cat: any): any {
    const children = cat.ChildCategory
      ? Array.isArray(cat.ChildCategory)
        ? cat.ChildCategory.map((c: any) => this.mapCategory(c))
        : [this.mapCategory(cat.ChildCategory)]
      : [];

    return {
      categoryId: cat.CategoryID,
      name: cat.Name,
      order: cat.Order || 0,
      children,
    };
  }

  /**
   * Set (add, rename, move) store categories.
   * Accepts an array of category definitions and determines the appropriate
   * action for each: Add for new categories, Rename for existing ones.
   */
  async setStoreCategories(
    connectionId: string,
    categories: Array<{
      categoryId?: number;
      name: string;
      order?: number;
      parentId?: number;
    }>
  ): Promise<void> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Set ${categories.length} store categories for connection ${connectionId}`
      );
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    // Separate categories into add/rename/move operations
    const toAdd = categories.filter((c) => !c.categoryId);
    const toUpdate = categories.filter((c) => !!c.categoryId);

    try {
      // Add new categories
      if (toAdd.length > 0) {
        const addPayload: any = {
          Action: 'Add',
          StoreCategories: {
            CustomCategory: toAdd.map((cat) => ({
              Name: cat.name,
              Order: cat.order || 0,
              ...(cat.parentId ? { CategoryID: cat.parentId } : {}),
            })),
          },
        };

        // If adding under a parent, we need to set the parent explicitly
        if (toAdd.some((c) => c.parentId)) {
          addPayload.DestinationParentCategoryID = toAdd.find(
            (c) => c.parentId
          )?.parentId;
        }

        await (client as any).trading.SetStoreCategories(addPayload);
        this.logger.log(`Added ${toAdd.length} store categories`);
      }

      // Rename/move existing categories
      if (toUpdate.length > 0) {
        const renamePayload: any = {
          Action: 'Rename',
          StoreCategories: {
            CustomCategory: toUpdate.map((cat) => ({
              CategoryID: cat.categoryId,
              Name: cat.name,
              Order: cat.order || 0,
            })),
          },
        };

        await (client as any).trading.SetStoreCategories(renamePayload);
        this.logger.log(`Updated ${toUpdate.length} store categories`);

        // Handle move operations (categories with parentId that already exist)
        const toMove = toUpdate.filter((c) => c.parentId !== undefined);
        for (const cat of toMove) {
          const movePayload: any = {
            Action: 'Move',
            StoreCategories: {
              CustomCategory: [
                {
                  CategoryID: cat.categoryId,
                },
              ],
            },
            DestinationParentCategoryID: cat.parentId || -999, // -999 means root in eBay
          };

          await (client as any).trading.SetStoreCategories(movePayload);
          this.logger.log(
            `Moved category ${cat.categoryId} to parent ${cat.parentId || 'root'}`
          );
        }
      }

      this.logger.log(
        `Set store categories complete for connection ${connectionId}: ${toAdd.length} added, ${toUpdate.length} updated`
      );
    } catch (error) {
      this.logger.error(
        `Failed to set store categories for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get custom store pages via Trading API GetStoreCustomPage.
   */
  async getCustomPages(connectionId: string): Promise<any[]> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Fetched custom pages for connection ${connectionId}`
      );
      return [
        {
          pageId: 'page_001',
          name: 'About Our Store',
          content: '<h1>Welcome</h1><p>We sell quality electronics and accessories.</p>',
          leftNav: true,
          status: 'ACTIVE',
        },
        {
          pageId: 'page_002',
          name: 'Shipping Policy',
          content: '<h1>Shipping</h1><p>Free shipping on orders over $50.</p>',
          leftNav: false,
          status: 'ACTIVE',
        },
      ];
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client as any).trading.GetStoreCustomPage({});

      const pages = response?.CustomPageArray?.CustomPage || [];
      const normalizedPages = Array.isArray(pages) ? pages : [pages];

      this.logger.log(
        `Fetched ${normalizedPages.length} custom pages for connection ${connectionId}`
      );

      return normalizedPages.map((page: any) => ({
        pageId: page.PageID,
        name: page.Name,
        content: page.Content,
        leftNav: page.LeftNav === true || page.LeftNav === 'true',
        status: page.Status || 'ACTIVE',
      }));
    } catch (error) {
      this.logger.error(
        `Failed to fetch custom pages for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Create a custom store page via Trading API SetStoreCustomPage.
   */
  async createCustomPage(
    connectionId: string,
    data: { name: string; content: string; leftNav?: boolean }
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Created custom page "${data.name}" for connection ${connectionId}`
      );
      return {
        pageId: `page_mock_${Date.now()}`,
        name: data.name,
        content: data.content,
        leftNav: data.leftNav || false,
        status: 'ACTIVE',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client as any).trading.SetStoreCustomPage({
        CustomPage: {
          Name: data.name,
          Content: data.content,
          LeftNav: data.leftNav || false,
          Status: 'Active',
        },
      });

      const page = response?.CustomPage || {};

      this.logger.log(
        `Created custom page "${data.name}" for connection ${connectionId}`
      );

      return {
        pageId: page.PageID,
        name: page.Name || data.name,
        content: page.Content || data.content,
        leftNav: page.LeftNav === true || page.LeftNav === 'true',
        status: page.Status || 'ACTIVE',
      };
    } catch (error) {
      this.logger.error(
        `Failed to create custom page "${data.name}" for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete a custom store page via Trading API SetStoreCustomPage.
   */
  async deleteCustomPage(connectionId: string, pageId: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Deleted custom page ${pageId} for connection ${connectionId}`
      );
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client as any).trading.SetStoreCustomPage({
        CustomPage: {
          PageID: pageId,
          Status: 'Delete',
        },
      });

      this.logger.log(
        `Deleted custom page ${pageId} for connection ${connectionId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete custom page ${pageId} for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete a store category by ID.
   * Uses SetStoreCategories with Action: 'Delete'.
   */
  async deleteStoreCategory(
    connectionId: string,
    categoryId: number
  ): Promise<void> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Deleted store category ${categoryId} for connection ${connectionId}`
      );
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client as any).trading.SetStoreCategories({
        Action: 'Delete',
        StoreCategories: {
          CustomCategory: [
            {
              CategoryID: categoryId,
            },
          ],
        },
      });

      this.logger.log(
        `Deleted store category ${categoryId} for connection ${connectionId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete store category ${categoryId} for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }
}
