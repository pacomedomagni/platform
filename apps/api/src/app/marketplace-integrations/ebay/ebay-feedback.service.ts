import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';

/**
 * eBay Feedback Service
 * Manages seller feedback via the eBay Trading API (SOAP).
 * Supports retrieving feedback, responding to feedback, leaving feedback for buyers,
 * and getting feedback summary counts.
 */
@Injectable()
export class EbayFeedbackService {
  private readonly logger = new Logger(EbayFeedbackService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private audit: MarketplaceAuditService
  ) {}

  /**
   * Get feedback entries from eBay via the Trading API GetFeedback call.
   * Returns paginated feedback data.
   */
  async getFeedback(
    connectionId: string,
    tenantId: string,
    params?: { page?: number; entriesPerPage?: number }
  ): Promise<any> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock feedback for connection ${connectionId}`);
      return this.getMockFeedback();
    }

    const client = await this.ebayStore.getClient(connectionId, tenantId);

    try {
      const requestParams: any = {
        DetailLevel: 'ReturnAll',
      };

      if (params?.page) {
        requestParams.Pagination = {
          PageNumber: params.page,
          EntriesPerPage: params.entriesPerPage || 25,
        };
      } else if (params?.entriesPerPage) {
        requestParams.Pagination = {
          PageNumber: 1,
          EntriesPerPage: params.entriesPerPage,
        };
      }

      const response = await (client as any).trading.GetFeedback(requestParams);

      this.logger.log(`Fetched feedback for connection ${connectionId}`);

      return {
        feedbackEntries: response?.FeedbackDetailArray?.FeedbackDetail || [],
        totalEntries: response?.FeedbackDetailItemTotal || 0,
        paginationResult: response?.PaginationResult || null,
        feedbackScore: response?.FeedbackScore || 0,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch feedback for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Respond to feedback left by a buyer via the Trading API RespondToFeedback call.
   */
  async respondToFeedback(
    connectionId: string,
    tenantId: string,
    params: { feedbackId: string; responseText: string }
  ): Promise<void> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Responded to feedback ${params.feedbackId} on connection ${connectionId}`
      );
    } else {
      const client = await this.ebayStore.getClient(connectionId, tenantId);

      try {
        await (client as any).trading.RespondToFeedback({
          FeedbackID: params.feedbackId,
          ResponseText: params.responseText,
          ResponseType: 'Reply',
        });

        this.logger.log(
          `Responded to feedback ${params.feedbackId} on connection ${connectionId}`
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to respond to feedback ${params.feedbackId}: ${error?.message || String(error)}`,
          error
        );
        throw error;
      }
    }

    try {
      await this.audit.logReturnProcessed(params.feedbackId, 'RESPOND_TO_FEEDBACK', {
        connectionId,
        feedbackId: params.feedbackId,
        responsePreview: params.responseText.substring(0, 100),
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Leave feedback for a buyer via the Trading API LeaveFeedback call.
   */
  async leaveFeedback(
    connectionId: string,
    tenantId: string,
    params: {
      orderId: string;
      buyerUsername: string;
      rating: 'Positive' | 'Neutral' | 'Negative';
      comment: string;
    }
  ): Promise<void> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Left ${params.rating} feedback for buyer ${params.buyerUsername} on connection ${connectionId}`
      );
    } else {
      const client = await this.ebayStore.getClient(connectionId, tenantId);

      try {
        await (client as any).trading.LeaveFeedback({
          OrderLineItemID: params.orderId,
          TargetUser: params.buyerUsername,
          CommentType: params.rating,
          CommentText: params.comment,
        });

        this.logger.log(
          `Left ${params.rating} feedback for buyer ${params.buyerUsername} on connection ${connectionId}`
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to leave feedback for buyer ${params.buyerUsername}: ${error?.message || String(error)}`,
          error
        );
        throw error;
      }
    }

    try {
      await this.audit.logReturnProcessed(params.orderId, 'LEAVE_FEEDBACK', {
        connectionId,
        buyerUsername: params.buyerUsername,
        rating: params.rating,
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Get feedback summary counts (positive, neutral, negative) for the seller
   * via the Trading API GetFeedback call with summary detail level.
   */
  async getFeedbackSummary(
    connectionId: string,
    tenantId: string
  ): Promise<any> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Returning mock feedback summary for connection ${connectionId}`
      );
      return this.getMockFeedbackSummary();
    }

    const client = await this.ebayStore.getClient(connectionId, tenantId);

    try {
      const response = await (client as any).trading.GetFeedback({
        DetailLevel: 'ReturnAll',
        Pagination: {
          PageNumber: 1,
          EntriesPerPage: 1,
        },
      });

      this.logger.log(`Fetched feedback summary for connection ${connectionId}`);

      return {
        feedbackScore: response?.FeedbackScore || 0,
        positiveFeedbackPercent: response?.PositiveFeedbackPercent || 0,
        uniquePositiveCount: response?.UniquePositiveFeedbackCount || 0,
        uniqueNegativeCount: response?.UniqueNegativeFeedbackCount || 0,
        uniqueNeutralCount: response?.UniqueNeutralFeedbackCount || 0,
        totalEntries: response?.FeedbackDetailItemTotal || 0,
        recentRatings: {
          positive: response?.BuyerRoleMetrics?.PositiveFeedbackLeftCount || 0,
          neutral: response?.BuyerRoleMetrics?.NeutralFeedbackLeftCount || 0,
          negative: response?.BuyerRoleMetrics?.NegativeFeedbackLeftCount || 0,
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch feedback summary for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Return mock feedback entries for development/testing.
   */
  private getMockFeedback(): any {
    const now = new Date();
    return {
      feedbackEntries: [
        {
          FeedbackID: 'mock_fb_001',
          CommentingUser: 'mock_buyer_jane',
          CommentText: 'Great item, fast shipping! Would buy again.',
          CommentType: 'Positive',
          CommentTime: new Date(now.getTime() - 86400000).toISOString(),
          ItemID: '110123456789',
          ItemTitle: 'Vintage Watch - Excellent Condition',
          Role: 'Buyer',
        },
        {
          FeedbackID: 'mock_fb_002',
          CommentingUser: 'mock_buyer_john',
          CommentText: 'Item as described. Good seller.',
          CommentType: 'Positive',
          CommentTime: new Date(now.getTime() - 172800000).toISOString(),
          ItemID: '110987654321',
          ItemTitle: 'Collectible Card Set - Complete',
          Role: 'Buyer',
        },
        {
          FeedbackID: 'mock_fb_003',
          CommentingUser: 'mock_buyer_alice',
          CommentText: 'Shipping was slow but item is fine.',
          CommentType: 'Neutral',
          CommentTime: new Date(now.getTime() - 259200000).toISOString(),
          ItemID: '110111222333',
          ItemTitle: 'Handmade Ceramic Mug',
          Role: 'Buyer',
        },
      ],
      totalEntries: 3,
      paginationResult: { totalNumberOfEntries: 3, totalNumberOfPages: 1 },
      feedbackScore: 142,
    };
  }

  /**
   * Return mock feedback summary for development/testing.
   */
  private getMockFeedbackSummary(): any {
    return {
      feedbackScore: 142,
      positiveFeedbackPercent: 98.6,
      uniquePositiveCount: 138,
      uniqueNegativeCount: 2,
      uniqueNeutralCount: 2,
      totalEntries: 142,
      recentRatings: {
        positive: 45,
        neutral: 1,
        negative: 0,
      },
    };
  }
}
