import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';

/**
 * eBay Keywords Service
 * Manages keywords for Promoted Listings Advanced (PLS Advanced / CPC) campaigns
 * via the eBay Marketing API. Supports creating, deleting, and suggesting keywords
 * and bid amounts for ad groups within a campaign.
 */
@Injectable()
export class EbayKeywordsService {
  private readonly logger = new Logger(EbayKeywordsService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService
  ) {}

  /**
   * List keywords in a campaign, optionally filtered by ad group.
   */
  async getKeywords(
    connectionId: string,
    campaignId: string,
    adGroupId?: string
  ): Promise<any[]> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Fetched keywords for campaign ${campaignId}${adGroupId ? ` adGroup ${adGroupId}` : ''}`
      );
      return [
        {
          keywordId: 'mock_keyword_001',
          adGroupId: adGroupId || 'mock_ad_group_001',
          keywordText: 'vintage electronics',
          matchType: 'BROAD',
          bid: { value: '0.75', currency: 'USD' },
          keywordStatus: 'ACTIVE',
        },
        {
          keywordId: 'mock_keyword_002',
          adGroupId: adGroupId || 'mock_ad_group_001',
          keywordText: 'collectible items',
          matchType: 'EXACT',
          bid: { value: '1.25', currency: 'USD' },
          keywordStatus: 'ACTIVE',
        },
        {
          keywordId: 'mock_keyword_003',
          adGroupId: adGroupId || 'mock_ad_group_001',
          keywordText: 'rare antiques',
          matchType: 'PHRASE',
          bid: { value: '0.90', currency: 'USD' },
          keywordStatus: 'ACTIVE',
        },
      ];
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).marketing.getKeywords(campaignId, {
        ...(adGroupId ? { ad_group_ids: adGroupId } : {}),
      });

      const keywords = response?.keywords || [];

      this.logger.log(
        `Fetched ${keywords.length} keywords for campaign ${campaignId}${adGroupId ? ` adGroup ${adGroupId}` : ''}`
      );

      return keywords.map((kw: any) => ({
        keywordId: kw.keywordId,
        adGroupId: kw.adGroupId,
        keywordText: kw.keywordText,
        matchType: kw.matchType,
        bid: kw.bid || null,
        keywordStatus: kw.keywordStatus,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to fetch keywords for campaign ${campaignId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Create a single keyword in a campaign ad group.
   */
  async createKeyword(
    connectionId: string,
    campaignId: string,
    data: {
      adGroupId: string;
      keyword: string;
      matchType: 'BROAD' | 'EXACT' | 'PHRASE';
      bid?: { value: string; currency: string };
    }
  ): Promise<any> {
    if (this.mockMode) {
      const mockId = `mock_keyword_${Date.now()}`;
      this.logger.log(
        `[MOCK] Created keyword "${data.keyword}" (${data.matchType}) in campaign ${campaignId} adGroup ${data.adGroupId} (${mockId})`
      );
      return {
        keywordId: mockId,
        adGroupId: data.adGroupId,
        keywordText: data.keyword,
        matchType: data.matchType,
        bid: data.bid || null,
        keywordStatus: 'ACTIVE',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body: any = {
        adGroupId: data.adGroupId,
        keywordText: data.keyword,
        matchType: data.matchType,
      };

      if (data.bid) {
        body.bid = data.bid;
      }

      const response = await (client.sell as any).marketing.createKeyword(
        campaignId,
        body
      );

      const keywordId =
        response?.keywordId ||
        response?.href?.split('/').pop() ||
        `ebay_keyword_${Date.now()}`;

      this.logger.log(
        `Created keyword "${data.keyword}" (${data.matchType}) in campaign ${campaignId} adGroup ${data.adGroupId} (${keywordId})`
      );

      return {
        keywordId,
        adGroupId: data.adGroupId,
        keywordText: data.keyword,
        matchType: data.matchType,
        bid: data.bid || null,
        keywordStatus: 'ACTIVE',
      };
    } catch (error) {
      this.logger.error(
        `Failed to create keyword "${data.keyword}" in campaign ${campaignId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Bulk create keywords in a campaign.
   */
  async bulkCreateKeywords(
    connectionId: string,
    campaignId: string,
    keywords: Array<{
      adGroupId: string;
      keyword: string;
      matchType: string;
      bid?: any;
    }>
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Bulk created ${keywords.length} keywords in campaign ${campaignId}`
      );
      return {
        responses: keywords.map((kw, i) => ({
          statusCode: 201,
          keywordId: `mock_keyword_bulk_${Date.now()}_${i}`,
          keywordText: kw.keyword,
          matchType: kw.matchType,
        })),
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const requests = keywords.map((kw) => ({
        adGroupId: kw.adGroupId,
        keywordText: kw.keyword,
        matchType: kw.matchType,
        ...(kw.bid ? { bid: kw.bid } : {}),
      }));

      const response = await (client.sell as any).marketing.bulkCreateKeyword(
        campaignId,
        { requests }
      );

      this.logger.log(
        `Bulk created ${keywords.length} keywords in campaign ${campaignId}`
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to bulk create ${keywords.length} keywords in campaign ${campaignId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete a keyword from a campaign.
   */
  async deleteKeyword(
    connectionId: string,
    campaignId: string,
    keywordId: string
  ): Promise<void> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Deleted keyword ${keywordId} from campaign ${campaignId}`
      );
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client.sell as any).marketing.deleteKeyword(campaignId, keywordId);

      this.logger.log(
        `Deleted keyword ${keywordId} from campaign ${campaignId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete keyword ${keywordId} from campaign ${campaignId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Create a negative keyword for a campaign or ad group.
   * Negative keywords prevent ads from showing for specific search terms.
   */
  async createNegativeKeyword(
    connectionId: string,
    campaignId: string,
    data: {
      adGroupId?: string;
      keyword: string;
      matchType: string;
    }
  ): Promise<any> {
    if (this.mockMode) {
      const mockId = `mock_neg_keyword_${Date.now()}`;
      this.logger.log(
        `[MOCK] Created negative keyword "${data.keyword}" (${data.matchType}) in campaign ${campaignId} (${mockId})`
      );
      return {
        negativeKeywordId: mockId,
        campaignId,
        adGroupId: data.adGroupId || null,
        keywordText: data.keyword,
        matchType: data.matchType,
        keywordStatus: 'ACTIVE',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body: any = {
        campaignId,
        keywordText: data.keyword,
        matchType: data.matchType,
      };

      if (data.adGroupId) {
        body.adGroupId = data.adGroupId;
      }

      const response = await (client.sell as any).marketing.createNegativeKeyword(body);

      const negativeKeywordId =
        response?.negativeKeywordId ||
        response?.href?.split('/').pop() ||
        `ebay_neg_keyword_${Date.now()}`;

      this.logger.log(
        `Created negative keyword "${data.keyword}" (${data.matchType}) in campaign ${campaignId} (${negativeKeywordId})`
      );

      return {
        negativeKeywordId,
        campaignId,
        adGroupId: data.adGroupId || null,
        keywordText: data.keyword,
        matchType: data.matchType,
        keywordStatus: 'ACTIVE',
      };
    } catch (error) {
      this.logger.error(
        `Failed to create negative keyword "${data.keyword}" in campaign ${campaignId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get keyword suggestions for listings in an ad group.
   * Uses eBay's keyword suggestion API to find relevant keywords.
   */
  async suggestKeywords(
    connectionId: string,
    campaignId: string,
    adGroupId: string,
    listingIds: string[]
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Fetched keyword suggestions for campaign ${campaignId} adGroup ${adGroupId} (${listingIds.length} listings)`
      );
      return {
        suggestions: [
          { keywordText: 'vintage collectible', matchType: 'BROAD', suggestedBid: { value: '0.85', currency: 'USD' } },
          { keywordText: 'rare antique item', matchType: 'PHRASE', suggestedBid: { value: '1.10', currency: 'USD' } },
          { keywordText: 'electronics accessories', matchType: 'BROAD', suggestedBid: { value: '0.65', currency: 'USD' } },
        ],
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).marketing.suggestKeywords(campaignId, {
        adGroupId,
        listingIds,
      });

      this.logger.log(
        `Fetched keyword suggestions for campaign ${campaignId} adGroup ${adGroupId}`
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to fetch keyword suggestions for campaign ${campaignId} adGroup ${adGroupId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get bid suggestions for keywords in an ad group.
   * Returns recommended bid amounts based on competition and relevance.
   */
  async suggestBids(
    connectionId: string,
    campaignId: string,
    adGroupId: string,
    keywords: string[]
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Fetched bid suggestions for ${keywords.length} keywords in campaign ${campaignId} adGroup ${adGroupId}`
      );
      return {
        suggestions: keywords.map((kw) => ({
          keywordText: kw,
          suggestedBid: {
            value: (Math.random() * 2 + 0.25).toFixed(2),
            currency: 'USD',
          },
        })),
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).marketing.suggestBids(campaignId, {
        adGroupId,
        keywords: keywords.map((kw) => ({ keywordText: kw })),
      });

      this.logger.log(
        `Fetched bid suggestions for ${keywords.length} keywords in campaign ${campaignId} adGroup ${adGroupId}`
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to fetch bid suggestions for campaign ${campaignId} adGroup ${adGroupId}`,
        error
      );
      throw error;
    }
  }
}
