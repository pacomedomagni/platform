import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { EbayClientService } from './ebay-client.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';

/**
 * eBay Campaigns Service
 * Manages Promoted Listings Standard (PLS) campaigns via the eBay Marketing API.
 * Supports creating campaigns, managing ads within campaigns, and retrieving
 * campaign performance reports.
 */
@Injectable()
export class EbayCampaignsService {
  private readonly logger = new Logger(EbayCampaignsService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  /** M2: Max ads per campaign (eBay limit) */
  private readonly MAX_ADS_PER_CAMPAIGN = 50_000;

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private ebayClient: EbayClientService,
    private audit: MarketplaceAuditService
  ) {}

  /**
   * Create a Promoted Listings Standard campaign on eBay and save it locally.
   */
  async createCampaign(
    tenantId: string,
    data: {
      connectionId: string;
      name: string;
      marketplaceId: string;
      bidPercentage: number;
      budgetAmount?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<any> {
    // Verify connection belongs to the tenant
    await this.ebayStore.getConnection(data.connectionId, tenantId);

    let externalCampaignId: string;

    if (this.mockMode) {
      externalCampaignId = `mock_campaign_${Date.now()}`;
      this.logger.log(`[MOCK] Created campaign: ${data.name} (${externalCampaignId})`);
    } else {
      const client = await this.ebayStore.getClient(data.connectionId, tenantId);

      try {
        const body: any = {
          campaignName: data.name,
          marketplaceId: data.marketplaceId,
          campaignCriterion: {
            autoSelectFutureInventory: false,
            criterionType: 'INVENTORY_PARTITION',
          },
          fundingStrategy: {
            fundingModel: 'COST_PER_SALE',
            bidPercentage: String(data.bidPercentage),
          },
        };

        if (data.budgetAmount) {
          body.budget = {
            daily: false,
            amount: {
              value: String(data.budgetAmount),
              currency: 'USD',
            },
          };
        }

        if (data.startDate) {
          body.startDate = data.startDate;
        }

        if (data.endDate) {
          body.endDate = data.endDate;
        }

        const response = await (client.sell as any).marketing.createCampaign(body);

        // The campaign ID is typically returned in the response or Location header
        externalCampaignId =
          response?.campaignId ||
          response?.campaignHref?.split('/').pop() ||
          `ebay_campaign_${Date.now()}`;

        this.logger.log(`Created eBay campaign: ${data.name} (${externalCampaignId})`);
      } catch (error) {
        this.logger.error(`Failed to create eBay campaign: ${data.name}`, error);
        throw error;
      }
    }

    // Save campaign locally
    const campaign = await this.prisma.marketplaceCampaign.create({
      data: {
        tenantId,
        connectionId: data.connectionId,
        externalCampaignId,
        name: data.name,
        campaignType: 'COST_PER_SALE',
        bidPercentage: data.bidPercentage,
        budgetAmount: data.budgetAmount || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: 'RUNNING',
      },
    });

    // Audit log
    try {
      await this.audit.logCampaignAction(campaign.id, data.name, 'CREATE_CAMPAIGN');
    } catch {
      // Non-critical
    }

    return campaign;
  }

  /**
   * Get all campaigns for a connection from the local database.
   * Optionally syncs from eBay to refresh local data.
   */
  async getCampaigns(tenantId: string, connectionId: string): Promise<any[]> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    const campaigns = await this.prisma.marketplaceCampaign.findMany({
      where: { tenantId, connectionId },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns;
  }

  /**
   * Get a single campaign by ID.
   */
  async getCampaign(tenantId: string, campaignId: string): Promise<any> {
    const campaign = await this.prisma.marketplaceCampaign.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    return campaign;
  }

  /**
   * M1: Get bid percentage recommendations for listings.
   * Uses the eBay Recommendation API to suggest optimal bid percentages.
   */
  async getBidRecommendations(
    tenantId: string,
    connectionId: string,
    listingIds: string[]
  ): Promise<Array<{ listingId: string; suggestedBidPercentage: string; trendingBidPercentage?: string }>> {
    await this.ebayStore.getConnection(connectionId, tenantId);
    const client = await this.ebayStore.getClient(connectionId, tenantId);
    return this.ebayClient.getAdRateRecommendations(client, listingIds);
  }

  /**
   * Add a listing to a campaign as a promoted ad.
   * M2: Enforces the 50,000 ad limit per campaign.
   */
  async addListingToCampaign(
    tenantId: string,
    campaignId: string,
    listingId: string,
    bidPercentage: number
  ): Promise<void> {
    const campaign = await this.getCampaign(tenantId, campaignId);
    await this.ebayStore.getConnection(campaign.connectionId, tenantId);

    // M2: Check ad count limit
    if (!this.mockMode) {
      try {
        const client = await this.ebayStore.getClient(campaign.connectionId, tenantId);
        const adsResponse = await (client.sell as any).marketing.getAds(
          campaign.externalCampaignId, { limit: 1 }
        );
        const currentAdCount = adsResponse?.total || 0;
        if (currentAdCount >= this.MAX_ADS_PER_CAMPAIGN) {
          throw new BadRequestException(
            `Campaign has reached the maximum of ${this.MAX_ADS_PER_CAMPAIGN} ads. Remove existing ads before adding new ones.`
          );
        }
      } catch (error: any) {
        if (error instanceof BadRequestException) throw error;
        // If ad count check fails, proceed anyway (best effort)
        this.logger.warn(`Could not verify ad count for campaign ${campaignId}: ${error?.message}`);
      }
    }

    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Added listing ${listingId} to campaign ${campaign.externalCampaignId} with bid ${bidPercentage}%`
      );
      return;
    }

    const client = await this.ebayStore.getClient(campaign.connectionId, tenantId);

    try {
      await (client.sell as any).marketing.createAdByListingId(
        campaign.externalCampaignId,
        {
          listingId,
          bidPercentage: String(bidPercentage),
        }
      );

      this.logger.log(
        `Added listing ${listingId} to campaign ${campaign.externalCampaignId} with bid ${bidPercentage}%`
      );
    } catch (error) {
      this.logger.error(
        `Failed to add listing ${listingId} to campaign ${campaign.externalCampaignId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Remove an ad from a campaign.
   */
  async removeAdFromCampaign(
    tenantId: string,
    campaignId: string,
    adId: string
  ): Promise<void> {
    const campaign = await this.getCampaign(tenantId, campaignId);
    await this.ebayStore.getConnection(campaign.connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Removed ad ${adId} from campaign ${campaign.externalCampaignId}`
      );
      return;
    }

    const client = await this.ebayStore.getClient(campaign.connectionId, tenantId);

    try {
      await (client.sell as any).marketing.deleteAd(
        campaign.externalCampaignId,
        adId
      );

      this.logger.log(
        `Removed ad ${adId} from campaign ${campaign.externalCampaignId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to remove ad ${adId} from campaign ${campaign.externalCampaignId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Pause a running campaign.
   */
  async pauseCampaign(tenantId: string, campaignId: string): Promise<void> {
    const campaign = await this.getCampaign(tenantId, campaignId);
    await this.ebayStore.getConnection(campaign.connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(`[MOCK] Paused campaign ${campaign.externalCampaignId}`);
    } else {
      const client = await this.ebayStore.getClient(campaign.connectionId, tenantId);

      try {
        await (client.sell as any).marketing.pauseCampaign(
          campaign.externalCampaignId
        );

        this.logger.log(`Paused campaign ${campaign.externalCampaignId}`);
      } catch (error) {
        this.logger.error(
          `Failed to pause campaign ${campaign.externalCampaignId}`,
          error
        );
        throw error;
      }
    }

    await this.prisma.marketplaceCampaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    });

    try {
      await this.audit.logCampaignAction(campaignId, campaign.name, 'PAUSE_CAMPAIGN');
    } catch {
      // Non-critical
    }
  }

  /**
   * Resume a paused campaign.
   */
  async resumeCampaign(tenantId: string, campaignId: string): Promise<void> {
    const campaign = await this.getCampaign(tenantId, campaignId);
    await this.ebayStore.getConnection(campaign.connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(`[MOCK] Resumed campaign ${campaign.externalCampaignId}`);
    } else {
      const client = await this.ebayStore.getClient(campaign.connectionId, tenantId);

      try {
        await (client.sell as any).marketing.resumeCampaign(
          campaign.externalCampaignId
        );

        this.logger.log(`Resumed campaign ${campaign.externalCampaignId}`);
      } catch (error) {
        this.logger.error(
          `Failed to resume campaign ${campaign.externalCampaignId}`,
          error
        );
        throw error;
      }
    }

    await this.prisma.marketplaceCampaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
    });

    try {
      await this.audit.logCampaignAction(campaignId, campaign.name, 'RESUME_CAMPAIGN');
    } catch {
      // Non-critical
    }
  }

  /**
   * End a campaign permanently.
   */
  async endCampaign(tenantId: string, campaignId: string): Promise<void> {
    const campaign = await this.getCampaign(tenantId, campaignId);
    await this.ebayStore.getConnection(campaign.connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(`[MOCK] Ended campaign ${campaign.externalCampaignId}`);
    } else {
      const client = await this.ebayStore.getClient(campaign.connectionId, tenantId);

      try {
        await (client.sell as any).marketing.endCampaign(
          campaign.externalCampaignId
        );

        this.logger.log(`Ended campaign ${campaign.externalCampaignId}`);
      } catch (error) {
        this.logger.error(
          `Failed to end campaign ${campaign.externalCampaignId}`,
          error
        );
        throw error;
      }
    }

    await this.prisma.marketplaceCampaign.update({
      where: { id: campaignId },
      data: { status: 'ENDED' },
    });

    try {
      await this.audit.logCampaignAction(campaignId, campaign.name, 'END_CAMPAIGN');
    } catch {
      // Non-critical
    }
  }

  /**
   * Get campaign performance report data.
   */
  async getCampaignReport(tenantId: string, campaignId: string): Promise<any> {
    const campaign = await this.getCampaign(tenantId, campaignId);
    await this.ebayStore.getConnection(campaign.connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched report for campaign ${campaign.externalCampaignId}`);
      return {
        campaignId: campaign.id,
        externalCampaignId: campaign.externalCampaignId,
        name: campaign.name,
        impressions: 1250,
        clicks: 87,
        totalSpend: { value: '42.50', currency: 'USD' },
        totalSales: { value: '385.00', currency: 'USD' },
        listings: [
          {
            listingId: 'mock_listing_001',
            impressions: 650,
            clicks: 45,
            spend: { value: '22.00', currency: 'USD' },
            sales: { value: '210.00', currency: 'USD' },
          },
          {
            listingId: 'mock_listing_002',
            impressions: 600,
            clicks: 42,
            spend: { value: '20.50', currency: 'USD' },
            sales: { value: '175.00', currency: 'USD' },
          },
        ],
      };
    }

    const client = await this.ebayStore.getClient(campaign.connectionId, tenantId);

    try {
      const report = await (client.sell as any).marketing.getCampaign(
        campaign.externalCampaignId
      );

      this.logger.log(`Fetched report for campaign ${campaign.externalCampaignId}`);

      return {
        campaignId: campaign.id,
        externalCampaignId: campaign.externalCampaignId,
        name: campaign.name,
        ...report,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch report for campaign ${campaign.externalCampaignId}`,
        error
      );
      throw error;
    }
  }
}
