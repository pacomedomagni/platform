import { Injectable, Logger } from '@nestjs/common';
import { EbayStoreService } from './ebay-store.service';

/**
 * eBay Product Catalog Matching Service
 * Provides product search and matching via the eBay Commerce Catalog API.
 * Useful for linking NoSlag products to eBay catalog entries (ePIDs) to
 * improve listing quality and search visibility.
 */
@Injectable()
export class EbayCatalogService {
  private readonly logger = new Logger(EbayCatalogService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(private ebayStore: EbayStoreService) {}

  /**
   * Search eBay product catalog by keyword, GTIN (UPC/EAN/ISBN), or ePID.
   * Returns product matches with ePID, title, aspects, and image.
   */
  async searchProducts(
    connectionId: string,
    params: { q?: string; gtin?: string; epid?: string; limit?: number }
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Searching catalog products: q=${params.q}, gtin=${params.gtin}, epid=${params.epid}`
      );
      return {
        total: 3,
        products: [
          {
            epid: 'ePID_001',
            title: 'Apple iPhone 15 Pro 256GB Natural Titanium',
            aspects: {
              Brand: ['Apple'],
              Model: ['iPhone 15 Pro'],
              'Storage Capacity': ['256 GB'],
              Color: ['Natural Titanium'],
            },
            image: 'https://i.ebayimg.com/images/g/mock/iphone15pro.jpg',
            categoryId: '9355',
          },
          {
            epid: 'ePID_002',
            title: 'Samsung Galaxy S24 Ultra 512GB Titanium Black',
            aspects: {
              Brand: ['Samsung'],
              Model: ['Galaxy S24 Ultra'],
              'Storage Capacity': ['512 GB'],
              Color: ['Titanium Black'],
            },
            image: 'https://i.ebayimg.com/images/g/mock/galaxys24ultra.jpg',
            categoryId: '9355',
          },
          {
            epid: 'ePID_003',
            title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones Black',
            aspects: {
              Brand: ['Sony'],
              Model: ['WH-1000XM5'],
              Type: ['Over-Ear'],
              Color: ['Black'],
            },
            image: 'https://i.ebayimg.com/images/g/mock/sonywh1000xm5.jpg',
            categoryId: '112529',
          },
        ],
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const queryParams: Record<string, any> = {};
      if (params.q) queryParams.q = params.q;
      if (params.gtin) queryParams.gtin = params.gtin;
      if (params.epid) queryParams.epid = params.epid;
      if (params.limit) queryParams.limit = params.limit;

      const response = await (client.commerce as any).catalog.search(queryParams);

      this.logger.log(
        `Searched catalog products: ${response?.total || 0} results for q=${params.q}, gtin=${params.gtin}`
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to search catalog products for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get product details by ePID.
   * Returns full product info including aspects and images.
   */
  async getProduct(connectionId: string, epid: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched catalog product ${epid}`);
      return {
        epid,
        title: 'Apple iPhone 15 Pro 256GB Natural Titanium',
        aspects: {
          Brand: ['Apple'],
          Model: ['iPhone 15 Pro'],
          'Storage Capacity': ['256 GB'],
          Color: ['Natural Titanium'],
          'Network': ['Unlocked'],
          'Operating System': ['iOS'],
        },
        image: 'https://i.ebayimg.com/images/g/mock/iphone15pro.jpg',
        additionalImages: [
          'https://i.ebayimg.com/images/g/mock/iphone15pro_side.jpg',
          'https://i.ebayimg.com/images/g/mock/iphone15pro_back.jpg',
        ],
        categoryId: '9355',
        description: 'Apple iPhone 15 Pro with A17 Pro chip, titanium design.',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.commerce as any).catalog.getProduct(epid);

      this.logger.log(`Fetched catalog product ${epid}`);
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to get catalog product ${epid} for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get product metadata including compatible categories and required aspects.
   */
  async getProductMetadata(connectionId: string, epid: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched catalog product metadata for ${epid}`);
      return {
        epid,
        compatibleCategories: [
          { categoryId: '9355', categoryName: 'Cell Phones & Smartphones' },
          { categoryId: '15032', categoryName: 'Cell Phones & Accessories' },
        ],
        requiredAspects: [
          { name: 'Brand', dataType: 'STRING' },
          { name: 'Model', dataType: 'STRING' },
          { name: 'Storage Capacity', dataType: 'STRING' },
          { name: 'Color', dataType: 'STRING' },
          { name: 'MPN', dataType: 'STRING' },
        ],
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.commerce as any).catalog.getProductMetadata(epid);

      this.logger.log(`Fetched catalog product metadata for ${epid}`);
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to get catalog product metadata for ${epid} on connection ${connectionId}`,
        error
      );
      throw error;
    }
  }
}
