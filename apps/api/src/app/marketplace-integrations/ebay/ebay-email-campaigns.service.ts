import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';

/**
 * eBay Email Campaigns Service
 * Manages store email campaigns via the eBay Sell Marketing API (Stores Email Campaigns).
 * Supports listing campaigns, creating/deleting campaigns, viewing performance reports,
 * and retrieving available audience segments (opt-in subscribers).
 */
@Injectable()
export class EbayEmailCampaignsService {
  private readonly logger = new Logger(EbayEmailCampaignsService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private audit: MarketplaceAuditService
  ) {}

  /**
   * List email campaigns for a connection.
   * Supports filtering by status and pagination via limit/offset.
   */
  async getEmailCampaigns(
    tenantId: string,
    connectionId: string,
    params?: { status?: string; limit?: number; offset?: number }
  ): Promise<{ campaigns: any[]; total: number }> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched email campaigns for connection ${connectionId}`);
      const mockCampaigns = this.getMockEmailCampaigns();
      let filtered = mockCampaigns;

      if (params?.status) {
        filtered = filtered.filter((c) => c.status === params.status);
      }

      const offset = params?.offset || 0;
      const limit = params?.limit || 50;
      const paged = filtered.slice(offset, offset + limit);

      return { campaigns: paged, total: filtered.length };
    }

    const client = await this.ebayStore.getClient(connectionId, tenantId);

    try {
      const queryParams: any = {};
      if (params?.status) queryParams.status = params.status;
      if (params?.limit) queryParams.limit = params.limit;
      if (params?.offset) queryParams.offset = params.offset;

      const response = await (client.sell as any).marketing.getEmailCampaigns(queryParams);

      const campaigns = response?.emailCampaigns || response?.campaigns || [];
      const total = response?.total || campaigns.length;

      this.logger.log(
        `Fetched ${campaigns.length} email campaigns for connection ${connectionId}`
      );

      return { campaigns, total };
    } catch (error) {
      this.logger.error(
        `Failed to fetch email campaigns for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a single email campaign by ID.
   */
  async getEmailCampaign(
    tenantId: string,
    connectionId: string,
    campaignId: string
  ): Promise<any> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched email campaign ${campaignId}`);
      const mock = this.getMockEmailCampaigns().find((c) => c.emailCampaignId === campaignId);
      return (
        mock || {
          emailCampaignId: campaignId,
          subject: 'Mock Campaign',
          body: '<p>Mock campaign body content</p>',
          audienceType: 'ALL_SUBSCRIBERS',
          status: 'DRAFT',
          scheduledDate: null,
          createdDate: new Date().toISOString(),
        }
      );
    }

    const client = await this.ebayStore.getClient(connectionId, tenantId);

    try {
      const campaign = await (client.sell as any).marketing.getEmailCampaign(campaignId);

      this.logger.log(`Fetched email campaign ${campaignId}`);
      return campaign;
    } catch (error) {
      this.logger.error(`Failed to fetch email campaign ${campaignId}`, error);
      throw error;
    }
  }

  /**
   * Create a new email campaign.
   */
  async createEmailCampaign(
    tenantId: string,
    connectionId: string,
    data: {
      subject: string;
      body: string;
      audienceType: string;
      scheduledDate?: string;
    }
  ): Promise<any> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      const mockId = `mock_email_campaign_${Date.now()}`;
      this.logger.log(`[MOCK] Created email campaign: ${data.subject} (${mockId})`);

      const campaign = {
        emailCampaignId: mockId,
        subject: data.subject,
        body: data.body,
        audienceType: data.audienceType,
        status: data.scheduledDate ? 'SCHEDULED' : 'DRAFT',
        scheduledDate: data.scheduledDate || null,
        createdDate: new Date().toISOString(),
      };

      try {
        await this.audit.logCampaignAction(mockId, data.subject, 'CREATE_EMAIL_CAMPAIGN');
      } catch {
        // Non-critical
      }

      return campaign;
    }

    const client = await this.ebayStore.getClient(connectionId, tenantId);

    try {
      const requestBody: any = {
        subject: data.subject,
        emailBody: data.body,
        audienceType: data.audienceType,
      };

      if (data.scheduledDate) {
        requestBody.scheduledDate = data.scheduledDate;
      }

      const response = await (client.sell as any).marketing.createEmailCampaign(requestBody);

      const campaignId =
        response?.emailCampaignId ||
        response?.campaignId ||
        `ebay_email_campaign_${Date.now()}`;

      this.logger.log(`Created email campaign: ${data.subject} (${campaignId})`);

      try {
        await this.audit.logCampaignAction(campaignId, data.subject, 'CREATE_EMAIL_CAMPAIGN');
      } catch {
        // Non-critical
      }

      return {
        emailCampaignId: campaignId,
        subject: data.subject,
        body: data.body,
        audienceType: data.audienceType,
        status: data.scheduledDate ? 'SCHEDULED' : 'DRAFT',
        scheduledDate: data.scheduledDate || null,
        createdDate: new Date().toISOString(),
        ...response,
      };
    } catch (error) {
      this.logger.error(`Failed to create email campaign: ${data.subject}`, error);
      throw error;
    }
  }

  /**
   * Delete an email campaign by ID.
   */
  async deleteEmailCampaign(
    tenantId: string,
    connectionId: string,
    campaignId: string
  ): Promise<void> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(`[MOCK] Deleted email campaign ${campaignId}`);

      try {
        await this.audit.logCampaignAction(campaignId, campaignId, 'DELETE_EMAIL_CAMPAIGN');
      } catch {
        // Non-critical
      }

      return;
    }

    const client = await this.ebayStore.getClient(connectionId, tenantId);

    try {
      await (client.sell as any).marketing.deleteEmailCampaign(campaignId);

      this.logger.log(`Deleted email campaign ${campaignId}`);

      try {
        await this.audit.logCampaignAction(campaignId, campaignId, 'DELETE_EMAIL_CAMPAIGN');
      } catch {
        // Non-critical
      }
    } catch (error) {
      this.logger.error(`Failed to delete email campaign ${campaignId}`, error);
      throw error;
    }
  }

  /**
   * Get performance metrics report for an email campaign.
   * Returns sent, opened, clicked, bounced counts and rates.
   */
  async getEmailCampaignReport(
    tenantId: string,
    connectionId: string,
    campaignId: string
  ): Promise<any> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched report for email campaign ${campaignId}`);
      return {
        emailCampaignId: campaignId,
        sent: 1250,
        opened: 487,
        clicked: 132,
        bounced: 23,
        unsubscribed: 8,
        openRate: 38.96,
        clickRate: 10.56,
        bounceRate: 1.84,
        unsubscribeRate: 0.64,
        lastUpdated: new Date().toISOString(),
      };
    }

    const client = await this.ebayStore.getClient(connectionId, tenantId);

    try {
      const report = await (client.sell as any).marketing.getEmailCampaignReport(campaignId);

      this.logger.log(`Fetched report for email campaign ${campaignId}`);

      return {
        emailCampaignId: campaignId,
        ...report,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch report for email campaign ${campaignId}`, error);
      throw error;
    }
  }

  /**
   * List available audience segments (opt-in subscriber lists).
   */
  async getAudiences(
    tenantId: string,
    connectionId: string
  ): Promise<any[]> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched audiences for connection ${connectionId}`);
      return [
        {
          audienceId: 'aud_all_subscribers',
          audienceType: 'ALL_SUBSCRIBERS',
          name: 'All Subscribers',
          subscriberCount: 3420,
          description: 'All opt-in email subscribers for your store',
        },
        {
          audienceId: 'aud_recent_buyers',
          audienceType: 'RECENT_BUYERS',
          name: 'Recent Buyers',
          subscriberCount: 856,
          description: 'Buyers who purchased in the last 90 days',
        },
        {
          audienceId: 'aud_repeat_buyers',
          audienceType: 'REPEAT_BUYERS',
          name: 'Repeat Buyers',
          subscriberCount: 312,
          description: 'Buyers who have purchased more than once',
        },
        {
          audienceId: 'aud_watchers',
          audienceType: 'ITEM_WATCHERS',
          name: 'Item Watchers',
          subscriberCount: 1045,
          description: 'Users watching items in your store',
        },
      ];
    }

    const client = await this.ebayStore.getClient(connectionId, tenantId);

    try {
      const response = await (client.sell as any).marketing.getEmailCampaignAudiences();

      const audiences = response?.audiences || response?.audienceSegments || [];

      this.logger.log(
        `Fetched ${audiences.length} audiences for connection ${connectionId}`
      );

      return audiences;
    } catch (error) {
      this.logger.error(
        `Failed to fetch audiences for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Return mock email campaigns for development/testing.
   */
  private getMockEmailCampaigns(): any[] {
    const now = new Date();
    return [
      {
        emailCampaignId: 'mock_ec_001',
        subject: 'Spring Sale - Up to 40% Off!',
        body: '<h1>Spring Sale</h1><p>Don\'t miss our biggest spring sale. Up to 40% off select items!</p>',
        audienceType: 'ALL_SUBSCRIBERS',
        status: 'SENT',
        scheduledDate: new Date(now.getTime() - 7 * 86400000).toISOString(),
        sentDate: new Date(now.getTime() - 7 * 86400000).toISOString(),
        createdDate: new Date(now.getTime() - 10 * 86400000).toISOString(),
      },
      {
        emailCampaignId: 'mock_ec_002',
        subject: 'New Arrivals This Week',
        body: '<h1>New Arrivals</h1><p>Check out the latest additions to our store. Fresh inventory just listed!</p>',
        audienceType: 'RECENT_BUYERS',
        status: 'SCHEDULED',
        scheduledDate: new Date(now.getTime() + 2 * 86400000).toISOString(),
        sentDate: null,
        createdDate: new Date(now.getTime() - 1 * 86400000).toISOString(),
      },
      {
        emailCampaignId: 'mock_ec_003',
        subject: 'Exclusive Offer for Loyal Customers',
        body: '<h1>Thank You!</h1><p>As a valued repeat customer, enjoy 15% off your next purchase with code LOYAL15.</p>',
        audienceType: 'REPEAT_BUYERS',
        status: 'DRAFT',
        scheduledDate: null,
        sentDate: null,
        createdDate: new Date(now.getTime() - 3600000).toISOString(),
      },
      {
        emailCampaignId: 'mock_ec_004',
        subject: 'Items You\'re Watching Are On Sale',
        body: '<h1>Price Drop Alert</h1><p>Great news! Items on your watchlist have been reduced in price.</p>',
        audienceType: 'ITEM_WATCHERS',
        status: 'SENT',
        scheduledDate: new Date(now.getTime() - 14 * 86400000).toISOString(),
        sentDate: new Date(now.getTime() - 14 * 86400000).toISOString(),
        createdDate: new Date(now.getTime() - 15 * 86400000).toISOString(),
      },
    ];
  }
}
