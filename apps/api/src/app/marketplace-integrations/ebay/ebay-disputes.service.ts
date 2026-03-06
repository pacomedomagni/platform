import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';

/**
 * eBay Payment Disputes Service
 * Manages payment disputes via the eBay Fulfillment API
 * (sell.fulfillment.getPaymentDisputeSummaries, etc.)
 */
@Injectable()
export class EbayDisputesService {
  private readonly logger = new Logger(EbayDisputesService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService
  ) {}

  /**
   * Get payment dispute summaries via eBay Fulfillment API.
   */
  async getDisputes(
    connectionId: string,
    params?: { status?: string; limit?: number; offset?: number }
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock disputes for connection ${connectionId}`);
      return this.getMockDisputes(params);
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const queryParams: any = {};
      if (params?.status) queryParams.payment_dispute_status = params.status;
      if (params?.limit) queryParams.limit = params.limit;
      if (params?.offset) queryParams.offset = params.offset;

      const response = await (client.sell.fulfillment as any).getPaymentDisputeSummaries(queryParams);

      this.logger.log(`Fetched payment disputes for connection ${connectionId}`);
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch payment disputes for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get payment dispute detail by dispute ID.
   */
  async getDispute(connectionId: string, disputeId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock dispute ${disputeId} for connection ${connectionId}`);
      return this.getMockDispute(disputeId);
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell.fulfillment as any).getPaymentDispute(disputeId);

      this.logger.log(`Fetched payment dispute ${disputeId} for connection ${connectionId}`);
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch payment dispute ${disputeId} for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Accept (absorb) a payment dispute.
   */
  async acceptDispute(
    connectionId: string,
    disputeId: string,
    revision?: number
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Accepted payment dispute ${disputeId}`);
      return { success: true, disputeId, accepted: true };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body: any = {};
      if (revision !== undefined) body.revision = revision;

      const response = await (client.sell.fulfillment as any).acceptPaymentDispute(disputeId, body);

      this.logger.log(`Accepted payment dispute ${disputeId} for connection ${connectionId}`);
      return response || { success: true, disputeId };
    } catch (error: any) {
      this.logger.error(
        `Failed to accept payment dispute ${disputeId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Contest a payment dispute.
   */
  async contestDispute(
    connectionId: string,
    disputeId: string,
    data: { reason: string; revision?: number }
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Contested payment dispute ${disputeId}: ${data.reason}`);
      return { success: true, disputeId, contested: true, reason: data.reason };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body: any = {
        contestReasonCode: data.reason,
      };
      if (data.revision !== undefined) body.revision = data.revision;

      const response = await (client.sell.fulfillment as any).contestPaymentDispute(disputeId, body);

      this.logger.log(`Contested payment dispute ${disputeId} for connection ${connectionId}`);
      return response || { success: true, disputeId };
    } catch (error: any) {
      this.logger.error(
        `Failed to contest payment dispute ${disputeId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Add evidence to a payment dispute.
   */
  async addEvidence(
    connectionId: string,
    disputeId: string,
    data: { evidenceType: string; lineItems?: string[]; evidenceIds?: string[] }
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Added evidence to dispute ${disputeId}: type=${data.evidenceType}`);
      return { success: true, disputeId, evidenceType: data.evidenceType };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body: any = {
        evidenceType: data.evidenceType,
      };
      if (data.lineItems?.length) {
        body.lineItems = data.lineItems.map((itemId) => ({ lineItemId: itemId }));
      }
      if (data.evidenceIds?.length) {
        body.files = data.evidenceIds.map((id) => ({ fileId: id }));
      }

      const response = await (client.sell.fulfillment as any).addEvidence(disputeId, body);

      this.logger.log(`Added evidence to payment dispute ${disputeId} for connection ${connectionId}`);
      return response || { success: true, disputeId };
    } catch (error: any) {
      this.logger.error(
        `Failed to add evidence to payment dispute ${disputeId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get activity log for a payment dispute.
   */
  async getDisputeActivities(connectionId: string, disputeId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock activities for dispute ${disputeId}`);
      return this.getMockDisputeActivities(disputeId);
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell.fulfillment as any).getActivities(disputeId);

      this.logger.log(`Fetched activities for dispute ${disputeId} on connection ${connectionId}`);
      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch activities for dispute ${disputeId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Mock data helpers
  // ---------------------------------------------------------------------------

  private getMockDisputes(params?: { status?: string; limit?: number; offset?: number }): any {
    const now = new Date();
    const disputes = [
      {
        paymentDisputeId: 'DISP-9001',
        paymentDisputeStatus: 'OPEN',
        reason: 'ITEM_NOT_RECEIVED',
        openDate: new Date(now.getTime() - 3 * 86400000).toISOString(),
        closedDate: null,
        buyerUsername: 'mock_buyer_tom',
        amount: { value: '129.99', currency: 'USD' },
        orderId: '12-34567-89012',
        itemId: '110444555666',
        respondByDate: new Date(now.getTime() + 7 * 86400000).toISOString(),
      },
      {
        paymentDisputeId: 'DISP-9002',
        paymentDisputeStatus: 'OPEN',
        reason: 'UNAUTHORIZED_PAYMENT',
        openDate: new Date(now.getTime() - 5 * 86400000).toISOString(),
        closedDate: null,
        buyerUsername: 'mock_buyer_rachel',
        amount: { value: '249.00', currency: 'USD' },
        orderId: '12-34567-89013',
        itemId: '110777888999',
        respondByDate: new Date(now.getTime() + 5 * 86400000).toISOString(),
      },
      {
        paymentDisputeId: 'DISP-9003',
        paymentDisputeStatus: 'CLOSED',
        reason: 'ITEM_NOT_AS_DESCRIBED',
        openDate: new Date(now.getTime() - 30 * 86400000).toISOString(),
        closedDate: new Date(now.getTime() - 15 * 86400000).toISOString(),
        buyerUsername: 'mock_buyer_kevin',
        amount: { value: '75.50', currency: 'USD' },
        orderId: '12-34567-89014',
        itemId: '110111222333',
        outcome: 'SELLER_LOST',
      },
      {
        paymentDisputeId: 'DISP-9004',
        paymentDisputeStatus: 'ACTION_NEEDED',
        reason: 'ITEM_NOT_RECEIVED',
        openDate: new Date(now.getTime() - 1 * 86400000).toISOString(),
        closedDate: null,
        buyerUsername: 'mock_buyer_anna',
        amount: { value: '59.99', currency: 'USD' },
        orderId: '12-34567-89015',
        itemId: '110999000111',
        respondByDate: new Date(now.getTime() + 10 * 86400000).toISOString(),
      },
    ];

    const filtered = params?.status
      ? disputes.filter((d) => d.paymentDisputeStatus === params.status)
      : disputes;

    const offset = params?.offset || 0;
    const limit = params?.limit || 50;

    return {
      paymentDisputeSummaries: filtered.slice(offset, offset + limit),
      total: filtered.length,
      offset,
      limit,
    };
  }

  private getMockDispute(disputeId: string): any {
    const now = new Date();
    return {
      paymentDisputeId: disputeId,
      paymentDisputeStatus: 'OPEN',
      reason: 'ITEM_NOT_RECEIVED',
      openDate: new Date(now.getTime() - 3 * 86400000).toISOString(),
      closedDate: null,
      buyerUsername: 'mock_buyer_tom',
      amount: { value: '129.99', currency: 'USD' },
      orderId: '12-34567-89012',
      itemId: '110444555666',
      respondByDate: new Date(now.getTime() + 7 * 86400000).toISOString(),
      revision: 1,
      evidence: [],
      note: 'Buyer claims item was not delivered.',
      sellerResponse: null,
      eligibleForContest: true,
    };
  }

  private getMockDisputeActivities(disputeId: string): any {
    const now = new Date();
    return {
      activities: [
        {
          activityDate: new Date(now.getTime() - 3 * 86400000).toISOString(),
          activityType: 'DISPUTE_OPENED',
          actor: 'BUYER',
          description: 'Payment dispute opened by buyer.',
        },
        {
          activityDate: new Date(now.getTime() - 2 * 86400000).toISOString(),
          activityType: 'SELLER_NOTIFIED',
          actor: 'EBAY',
          description: 'Seller notified of the payment dispute.',
        },
        {
          activityDate: new Date(now.getTime() - 1 * 86400000).toISOString(),
          activityType: 'EVIDENCE_REQUESTED',
          actor: 'EBAY',
          description: 'Seller requested to provide evidence.',
        },
      ],
      disputeId,
    };
  }
}
