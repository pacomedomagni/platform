import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';

/**
 * eBay Inquiries & Case Management Service
 * Manages INR (Item Not Received) inquiries and eBay cases via the Post-Order API.
 */
@Injectable()
export class EbayInquiriesService {
  private readonly logger = new Logger(EbayInquiriesService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService
  ) {}

  /**
   * Search inquiries via eBay Post-Order API.
   * POST https://api.ebay.com/post-order/v2/inquiry/search
   */
  async getInquiries(
    connectionId: string,
    params?: { status?: string; limit?: number; offset?: number }
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock inquiries for connection ${connectionId}`);
      return this.getMockInquiries(params);
    }

    const connection = await this.ebayStore.getConnection(connectionId);
    const client = await this.ebayStore.getClient(connectionId);

    try {
      const accessToken = (client as any).authToken || (client as any).auth?.oAuth2?.accessToken;
      const response = await fetch('https://api.ebay.com/post-order/v2/inquiry/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': connection.marketplaceId || 'EBAY_US',
        },
        body: JSON.stringify({
          inquiryStatusFilter: params?.status ? [params.status] : undefined,
          paginationInput: {
            entriesPerPage: params?.limit || 50,
            pageNumber: params?.offset ? Math.floor(params.offset / (params?.limit || 50)) + 1 : 1,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`eBay Post-Order API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.log(`Fetched inquiries for connection ${connectionId}`);
      return data;
    } catch (error: any) {
      // Fall back to client SDK if available
      try {
        const sdkResponse = await (client as any).postOrder?.inquiry?.search({
          inquiryStatusFilter: params?.status ? [params.status] : undefined,
          limit: params?.limit || 50,
          offset: params?.offset || 0,
        });
        if (sdkResponse) return sdkResponse;
      } catch {
        // SDK not available, rethrow original error
      }

      this.logger.error(
        `Failed to fetch inquiries for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get inquiry details by inquiry ID.
   */
  async getInquiry(connectionId: string, inquiryId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock inquiry ${inquiryId} for connection ${connectionId}`);
      return this.getMockInquiry(inquiryId);
    }

    const connection = await this.ebayStore.getConnection(connectionId);
    const client = await this.ebayStore.getClient(connectionId);

    try {
      const accessToken = (client as any).authToken || (client as any).auth?.oAuth2?.accessToken;
      const response = await fetch(`https://api.ebay.com/post-order/v2/inquiry/${inquiryId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': connection.marketplaceId || 'EBAY_US',
        },
      });

      if (!response.ok) {
        throw new Error(`eBay Post-Order API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.log(`Fetched inquiry ${inquiryId} for connection ${connectionId}`);
      return data;
    } catch (error: any) {
      try {
        const sdkResponse = await (client as any).postOrder?.inquiry?.getInquiry(inquiryId);
        if (sdkResponse) return sdkResponse;
      } catch {
        // SDK not available
      }

      this.logger.error(
        `Failed to fetch inquiry ${inquiryId} for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Provide shipment tracking info to resolve an INR inquiry.
   */
  async provideShipmentInfo(
    connectionId: string,
    inquiryId: string,
    trackingNumber: string,
    carrier: string
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Provided shipment info for inquiry ${inquiryId}: ${carrier} ${trackingNumber}`
      );
      return { success: true, inquiryId, trackingNumber, carrier };
    }

    const connection = await this.ebayStore.getConnection(connectionId);
    const client = await this.ebayStore.getClient(connectionId);

    try {
      const accessToken = (client as any).authToken || (client as any).auth?.oAuth2?.accessToken;
      const response = await fetch(
        `https://api.ebay.com/post-order/v2/inquiry/${inquiryId}/provide_shipment_info`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': connection.marketplaceId || 'EBAY_US',
          },
          body: JSON.stringify({
            shipmentTracking: {
              trackingNumber,
              shippingCarrierCode: carrier,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`eBay Post-Order API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json().catch(() => ({}));
      this.logger.log(`Provided shipment info for inquiry ${inquiryId} on connection ${connectionId}`);
      return data;
    } catch (error: any) {
      try {
        const sdkResponse = await (client as any).postOrder?.inquiry?.provideShipmentInfo(inquiryId, {
          shipmentTracking: { trackingNumber, shippingCarrierCode: carrier },
        });
        if (sdkResponse) return sdkResponse;
      } catch {
        // SDK not available
      }

      this.logger.error(
        `Failed to provide shipment info for inquiry ${inquiryId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Issue a refund on an inquiry.
   */
  async issueInquiryRefund(
    connectionId: string,
    inquiryId: string,
    amount?: number,
    comment?: string
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Issued refund on inquiry ${inquiryId}${amount ? ` for $${amount.toFixed(2)}` : ''}`
      );
      return { success: true, inquiryId, amount, comment };
    }

    const connection = await this.ebayStore.getConnection(connectionId);
    const client = await this.ebayStore.getClient(connectionId);

    try {
      const accessToken = (client as any).authToken || (client as any).auth?.oAuth2?.accessToken;
      const body: any = {};
      if (amount !== undefined) {
        body.refundAmount = { value: amount.toFixed(2), currency: 'USD' };
      }
      if (comment) {
        body.comments = { content: [{ text: comment }] };
      }

      const response = await fetch(
        `https://api.ebay.com/post-order/v2/inquiry/${inquiryId}/issue_refund`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': connection.marketplaceId || 'EBAY_US',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error(`eBay Post-Order API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json().catch(() => ({}));
      this.logger.log(`Issued refund on inquiry ${inquiryId} for connection ${connectionId}`);
      return data;
    } catch (error: any) {
      try {
        const sdkResponse = await (client as any).postOrder?.inquiry?.issueRefund(inquiryId, {
          ...(amount !== undefined && { refundAmount: { value: amount.toFixed(2), currency: 'USD' } }),
          ...(comment && { comments: { content: [{ text: comment }] } }),
        });
        if (sdkResponse) return sdkResponse;
      } catch {
        // SDK not available
      }

      this.logger.error(
        `Failed to issue refund on inquiry ${inquiryId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Escalate an inquiry to an eBay case.
   */
  async escalateInquiry(connectionId: string, inquiryId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Escalated inquiry ${inquiryId} to eBay case`);
      return { success: true, inquiryId, escalated: true };
    }

    const connection = await this.ebayStore.getConnection(connectionId);
    const client = await this.ebayStore.getClient(connectionId);

    try {
      const accessToken = (client as any).authToken || (client as any).auth?.oAuth2?.accessToken;
      const response = await fetch(
        `https://api.ebay.com/post-order/v2/inquiry/${inquiryId}/escalate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': connection.marketplaceId || 'EBAY_US',
          },
          body: JSON.stringify({
            escalateInquiryReason: 'SELLER_NO_RESPONSE',
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`eBay Post-Order API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json().catch(() => ({}));
      this.logger.log(`Escalated inquiry ${inquiryId} to case for connection ${connectionId}`);
      return data;
    } catch (error: any) {
      try {
        const sdkResponse = await (client as any).postOrder?.inquiry?.escalate(inquiryId, {
          escalateInquiryReason: 'SELLER_NO_RESPONSE',
        });
        if (sdkResponse) return sdkResponse;
      } catch {
        // SDK not available
      }

      this.logger.error(
        `Failed to escalate inquiry ${inquiryId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Send a message on an inquiry.
   */
  async sendInquiryMessage(
    connectionId: string,
    inquiryId: string,
    message: string
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Sent message on inquiry ${inquiryId}: ${message.substring(0, 80)}`);
      return { success: true, inquiryId, messageSent: true };
    }

    const connection = await this.ebayStore.getConnection(connectionId);
    const client = await this.ebayStore.getClient(connectionId);

    try {
      const accessToken = (client as any).authToken || (client as any).auth?.oAuth2?.accessToken;
      const response = await fetch(
        `https://api.ebay.com/post-order/v2/inquiry/${inquiryId}/send_message`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': connection.marketplaceId || 'EBAY_US',
          },
          body: JSON.stringify({
            message: { content: [{ text: message }] },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`eBay Post-Order API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json().catch(() => ({}));
      this.logger.log(`Sent message on inquiry ${inquiryId} for connection ${connectionId}`);
      return data;
    } catch (error: any) {
      try {
        const sdkResponse = await (client as any).postOrder?.inquiry?.sendMessage(inquiryId, {
          message: { content: [{ text: message }] },
        });
        if (sdkResponse) return sdkResponse;
      } catch {
        // SDK not available
      }

      this.logger.error(
        `Failed to send message on inquiry ${inquiryId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Search cases via eBay Post-Order API.
   * POST https://api.ebay.com/post-order/v2/casemanagement/search
   */
  async getCases(
    connectionId: string,
    params?: { status?: string; limit?: number; offset?: number }
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock cases for connection ${connectionId}`);
      return this.getMockCases(params);
    }

    const connection = await this.ebayStore.getConnection(connectionId);
    const client = await this.ebayStore.getClient(connectionId);

    try {
      const accessToken = (client as any).authToken || (client as any).auth?.oAuth2?.accessToken;
      const response = await fetch('https://api.ebay.com/post-order/v2/casemanagement/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': connection.marketplaceId || 'EBAY_US',
        },
        body: JSON.stringify({
          caseStatusFilter: params?.status || undefined,
          paginationInput: {
            entriesPerPage: params?.limit || 50,
            pageNumber: params?.offset ? Math.floor(params.offset / (params?.limit || 50)) + 1 : 1,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`eBay Post-Order API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.log(`Fetched cases for connection ${connectionId}`);
      return data;
    } catch (error: any) {
      try {
        const sdkResponse = await (client as any).postOrder?.casemanagement?.search({
          caseStatusFilter: params?.status,
          limit: params?.limit || 50,
          offset: params?.offset || 0,
        });
        if (sdkResponse) return sdkResponse;
      } catch {
        // SDK not available
      }

      this.logger.error(
        `Failed to fetch cases for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get case details by case ID.
   */
  async getCase(connectionId: string, caseId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Returning mock case ${caseId} for connection ${connectionId}`);
      return this.getMockCase(caseId);
    }

    const connection = await this.ebayStore.getConnection(connectionId);
    const client = await this.ebayStore.getClient(connectionId);

    try {
      const accessToken = (client as any).authToken || (client as any).auth?.oAuth2?.accessToken;
      const response = await fetch(`https://api.ebay.com/post-order/v2/casemanagement/${caseId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': connection.marketplaceId || 'EBAY_US',
        },
      });

      if (!response.ok) {
        throw new Error(`eBay Post-Order API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.log(`Fetched case ${caseId} for connection ${connectionId}`);
      return data;
    } catch (error: any) {
      try {
        const sdkResponse = await (client as any).postOrder?.casemanagement?.getCase(caseId);
        if (sdkResponse) return sdkResponse;
      } catch {
        // SDK not available
      }

      this.logger.error(
        `Failed to fetch case ${caseId} for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Appeal a case decision.
   */
  async appealCase(
    connectionId: string,
    caseId: string,
    comments: string
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Appealed case ${caseId}: ${comments.substring(0, 80)}`);
      return { success: true, caseId, appealed: true };
    }

    const connection = await this.ebayStore.getConnection(connectionId);
    const client = await this.ebayStore.getClient(connectionId);

    try {
      const accessToken = (client as any).authToken || (client as any).auth?.oAuth2?.accessToken;
      const response = await fetch(
        `https://api.ebay.com/post-order/v2/casemanagement/${caseId}/appeal`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': connection.marketplaceId || 'EBAY_US',
          },
          body: JSON.stringify({
            appealComments: { content: [{ text: comments }] },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`eBay Post-Order API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json().catch(() => ({}));
      this.logger.log(`Appealed case ${caseId} for connection ${connectionId}`);
      return data;
    } catch (error: any) {
      try {
        const sdkResponse = await (client as any).postOrder?.casemanagement?.appeal(caseId, {
          appealComments: { content: [{ text: comments }] },
        });
        if (sdkResponse) return sdkResponse;
      } catch {
        // SDK not available
      }

      this.logger.error(
        `Failed to appeal case ${caseId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Mock data helpers
  // ---------------------------------------------------------------------------

  private getMockInquiries(params?: { status?: string; limit?: number; offset?: number }): any {
    const now = new Date();
    const inquiries = [
      {
        inquiryId: 'INQ-5001',
        itemId: '110123456789',
        transactionId: 'TXN-8001',
        creationDate: new Date(now.getTime() - 2 * 86400000).toISOString(),
        status: 'OPEN',
        type: 'INR',
        buyerUsername: 'mock_buyer_sarah',
        itemTitle: 'Wireless Bluetooth Headphones',
        lastModifiedDate: new Date(now.getTime() - 86400000).toISOString(),
      },
      {
        inquiryId: 'INQ-5002',
        itemId: '110987654321',
        transactionId: 'TXN-8002',
        creationDate: new Date(now.getTime() - 5 * 86400000).toISOString(),
        status: 'WAITING_SELLER_RESPONSE',
        type: 'INR',
        buyerUsername: 'mock_buyer_mike',
        itemTitle: 'USB-C Docking Station',
        lastModifiedDate: new Date(now.getTime() - 3 * 86400000).toISOString(),
      },
      {
        inquiryId: 'INQ-5003',
        itemId: '110555666777',
        transactionId: 'TXN-8003',
        creationDate: new Date(now.getTime() - 10 * 86400000).toISOString(),
        status: 'CLOSED',
        type: 'INR',
        buyerUsername: 'mock_buyer_emma',
        itemTitle: 'Portable Charger 20000mAh',
        lastModifiedDate: new Date(now.getTime() - 7 * 86400000).toISOString(),
        closedReason: 'REFUND_ISSUED',
      },
    ];

    const filtered = params?.status
      ? inquiries.filter((i) => i.status === params.status)
      : inquiries;

    const offset = params?.offset || 0;
    const limit = params?.limit || 50;

    return {
      members: filtered.slice(offset, offset + limit),
      total: filtered.length,
      offset,
      limit,
    };
  }

  private getMockInquiry(inquiryId: string): any {
    const now = new Date();
    return {
      inquiryId,
      itemId: '110123456789',
      transactionId: 'TXN-8001',
      creationDate: new Date(now.getTime() - 2 * 86400000).toISOString(),
      status: 'OPEN',
      type: 'INR',
      buyerUsername: 'mock_buyer_sarah',
      itemTitle: 'Wireless Bluetooth Headphones',
      lastModifiedDate: new Date(now.getTime() - 86400000).toISOString(),
      shipmentTracking: null,
      messages: [
        {
          sender: 'BUYER',
          date: new Date(now.getTime() - 2 * 86400000).toISOString(),
          text: 'I have not received my item yet. It was supposed to arrive 5 days ago.',
        },
      ],
      refundAmount: null,
      escalationDetails: null,
    };
  }

  private getMockCases(params?: { status?: string; limit?: number; offset?: number }): any {
    const now = new Date();
    const cases = [
      {
        caseId: 'CASE-7001',
        inquiryId: 'INQ-4999',
        itemId: '110333444555',
        creationDate: new Date(now.getTime() - 15 * 86400000).toISOString(),
        status: 'OPEN',
        type: 'INR',
        buyerUsername: 'mock_buyer_david',
        itemTitle: 'Mechanical Keyboard RGB',
        lastModifiedDate: new Date(now.getTime() - 2 * 86400000).toISOString(),
        caseAmount: { value: '89.99', currency: 'USD' },
      },
      {
        caseId: 'CASE-7002',
        inquiryId: 'INQ-4998',
        itemId: '110222333444',
        creationDate: new Date(now.getTime() - 20 * 86400000).toISOString(),
        status: 'CLOSED',
        type: 'SNAD',
        buyerUsername: 'mock_buyer_lisa',
        itemTitle: 'Vintage Leather Wallet',
        lastModifiedDate: new Date(now.getTime() - 10 * 86400000).toISOString(),
        caseAmount: { value: '45.00', currency: 'USD' },
        closedReason: 'SELLER_RESOLVED',
      },
    ];

    const filtered = params?.status
      ? cases.filter((c) => c.status === params.status)
      : cases;

    const offset = params?.offset || 0;
    const limit = params?.limit || 50;

    return {
      members: filtered.slice(offset, offset + limit),
      total: filtered.length,
      offset,
      limit,
    };
  }

  private getMockCase(caseId: string): any {
    const now = new Date();
    return {
      caseId,
      inquiryId: 'INQ-4999',
      itemId: '110333444555',
      creationDate: new Date(now.getTime() - 15 * 86400000).toISOString(),
      status: 'OPEN',
      type: 'INR',
      buyerUsername: 'mock_buyer_david',
      itemTitle: 'Mechanical Keyboard RGB',
      lastModifiedDate: new Date(now.getTime() - 2 * 86400000).toISOString(),
      caseAmount: { value: '89.99', currency: 'USD' },
      messages: [
        {
          sender: 'BUYER',
          date: new Date(now.getTime() - 15 * 86400000).toISOString(),
          text: 'Item never arrived. Tracking shows delivered but I did not receive it.',
        },
        {
          sender: 'SELLER',
          date: new Date(now.getTime() - 14 * 86400000).toISOString(),
          text: 'I have checked with the carrier. They confirmed delivery to the address on file.',
        },
      ],
      appealEligible: true,
      escalationDetails: {
        escalatedDate: new Date(now.getTime() - 10 * 86400000).toISOString(),
        escalatedBy: 'BUYER',
      },
    };
  }
}
