import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';

/**
 * eBay Cancellations Service
 * Manages order cancellation requests via the eBay Post-Order API.
 * Supports searching, creating, approving, and rejecting cancellation requests.
 */
@Injectable()
export class EbayCancellationsService {
  private readonly logger = new Logger(EbayCancellationsService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService
  ) {}

  /**
   * Search cancellation requests for a connection.
   * Uses eBay Post-Order API: POST /post-order/v2/cancellation/search
   */
  async getCancellations(
    connectionId: string,
    params?: { status?: string; limit?: number; offset?: number }
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched cancellations for connection ${connectionId}`);
      return {
        cancellations: [
          {
            cancelId: 'mock_cancel_001',
            legacyOrderId: '110451234567-0',
            reason: 'BUYER_ASKED_CANCEL',
            cancelState: 'CANCEL_REQUESTED',
            requestDate: '2026-02-15T10:30:00.000Z',
            buyerLoginName: 'mock_buyer_1',
            sellerResponseDueDate: '2026-02-18T10:30:00.000Z',
          },
          {
            cancelId: 'mock_cancel_002',
            legacyOrderId: '110451234568-0',
            reason: 'OUT_OF_STOCK',
            cancelState: 'CANCEL_CLOSED',
            requestDate: '2026-02-10T14:00:00.000Z',
            buyerLoginName: 'mock_buyer_2',
            cancelCloseDate: '2026-02-11T09:00:00.000Z',
          },
          {
            cancelId: 'mock_cancel_003',
            legacyOrderId: '110451234569-0',
            reason: 'ADDRESS_ISSUES',
            cancelState: 'CANCEL_REQUESTED',
            requestDate: '2026-03-01T08:15:00.000Z',
            buyerLoginName: 'mock_buyer_3',
            sellerResponseDueDate: '2026-03-04T08:15:00.000Z',
          },
        ],
        total: 3,
        offset: params?.offset || 0,
        limit: params?.limit || 50,
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const searchBody: any = {
        offset: params?.offset || 0,
        limit: params?.limit || 50,
      };

      if (params?.status) {
        searchBody.cancel_status = params.status;
      }

      const response = await (client as any).post('/post-order/v2/cancellation/search', {
        body: searchBody,
      });

      const cancellations = response?.cancellations || [];
      this.logger.log(
        `Fetched ${cancellations.length} cancellations for connection ${connectionId}`
      );

      return {
        cancellations,
        total: response?.total || cancellations.length,
        offset: params?.offset || 0,
        limit: params?.limit || 50,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch cancellations for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a single cancellation detail by cancel ID.
   * Uses eBay Post-Order API: GET /post-order/v2/cancellation/{cancelId}
   */
  async getCancellation(connectionId: string, cancelId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched cancellation ${cancelId}`);
      return {
        cancelId,
        legacyOrderId: '110451234567-0',
        reason: 'BUYER_ASKED_CANCEL',
        cancelState: 'CANCEL_REQUESTED',
        requestDate: '2026-02-15T10:30:00.000Z',
        buyerLoginName: 'mock_buyer_1',
        sellerResponseDueDate: '2026-02-18T10:30:00.000Z',
        lineItems: [
          {
            itemId: '254987654321',
            transactionId: '1234567890',
            title: 'Vintage Watch - Gold Edition',
            quantity: 1,
            amount: { value: '149.99', currency: 'USD' },
          },
        ],
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client as any).get(`/post-order/v2/cancellation/${cancelId}`);

      if (!response) {
        throw new NotFoundException(`Cancellation ${cancelId} not found`);
      }

      this.logger.log(`Fetched cancellation ${cancelId}`);
      return response;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to fetch cancellation ${cancelId}`, error);
      throw error;
    }
  }

  /**
   * Seller initiates a cancellation request for an order.
   * Uses eBay Post-Order API: POST /post-order/v2/cancellation
   */
  async requestCancellation(
    connectionId: string,
    orderId: string,
    reason: 'BUYER_ASKED_CANCEL' | 'OUT_OF_STOCK' | 'ADDRESS_ISSUES'
  ): Promise<any> {
    if (this.mockMode) {
      const cancelId = `mock_cancel_${Date.now()}`;
      this.logger.log(
        `[MOCK] Requested cancellation for order ${orderId}: ${reason} (${cancelId})`
      );
      return {
        cancelId,
        legacyOrderId: orderId,
        reason,
        cancelState: 'CANCEL_REQUESTED',
        requestDate: new Date().toISOString(),
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client as any).post('/post-order/v2/cancellation', {
        body: {
          legacyOrderId: orderId,
          reason,
        },
      });

      const cancelId =
        response?.cancelId ||
        response?.cancellationId ||
        `ebay_cancel_${Date.now()}`;

      this.logger.log(
        `Requested cancellation for order ${orderId}: ${reason} (${cancelId})`
      );

      return {
        cancelId,
        legacyOrderId: orderId,
        reason,
        cancelState: 'CANCEL_REQUESTED',
        requestDate: new Date().toISOString(),
        ...response,
      };
    } catch (error) {
      this.logger.error(
        `Failed to request cancellation for order ${orderId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Approve a buyer's cancellation request.
   * Uses eBay Post-Order API: POST /post-order/v2/cancellation/{cancelId}/approve
   */
  async approveCancellation(connectionId: string, cancelId: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Approved cancellation ${cancelId}`);
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client as any).post(`/post-order/v2/cancellation/${cancelId}/approve`, {
        body: {},
      });

      this.logger.log(`Approved cancellation ${cancelId}`);
    } catch (error) {
      this.logger.error(`Failed to approve cancellation ${cancelId}`, error);
      throw error;
    }
  }

  /**
   * Reject a buyer's cancellation request.
   * Uses eBay Post-Order API: POST /post-order/v2/cancellation/{cancelId}/reject
   */
  async rejectCancellation(connectionId: string, cancelId: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Rejected cancellation ${cancelId}`);
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client as any).post(`/post-order/v2/cancellation/${cancelId}/reject`, {
        body: {},
      });

      this.logger.log(`Rejected cancellation ${cancelId}`);
    } catch (error) {
      this.logger.error(`Failed to reject cancellation ${cancelId}`, error);
      throw error;
    }
  }
}
