import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { EbayClientService } from './ebay-client.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';
import { SyncType, SyncDirection, SyncLogStatus, ReturnStatus } from '../shared/marketplace.types';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

interface SyncResult {
  syncLogId: string;
  itemsTotal: number;
  itemsSuccess: number;
  itemsFailed: number;
}

/**
 * eBay Returns Service
 * Manages return sync from eBay Post-Order API and return lifecycle actions.
 */
@Injectable()
export class EbayReturnsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EbayReturnsService.name);
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';
  private isSyncing = false;

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private ebayClient: EbayClientService,
    private audit: MarketplaceAuditService
  ) {}

  onModuleInit() {
    if (process.env.ENABLE_SCHEDULED_TASKS === 'false') {
      this.logger.log('Scheduled tasks disabled via ENABLE_SCHEDULED_TASKS=false');
      return;
    }
    this.syncInterval = setInterval(() => this.syncAllActiveReturns(), this.SYNC_INTERVAL_MS);
    this.logger.log('eBay return sync scheduler started (every 30 minutes)');
  }

  onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Scheduled sync: sync returns for all active connections with autoSyncOrders=true.
   * Runs outside of CLS context, so tenantId is read from each connection record.
   */
  private async syncAllActiveReturns() {
    if (this.isSyncing) {
      this.logger.warn('Return sync already in progress, skipping this tick');
      return;
    }
    this.isSyncing = true;
    try {
      const connections = await this.prisma.marketplaceConnection.findMany({
        where: {
          platform: 'EBAY',
          isActive: true,
          isConnected: true,
          autoSyncOrders: true,
        },
      });

      this.logger.log(
        `Scheduled return sync: found ${connections.length} active connection(s)`
      );

      for (const connection of connections) {
        try {
          await this.syncReturns(connection.tenantId, connection.id);
        } catch (error) {
          this.logger.error(
            `Scheduled return sync failed for connection ${connection.id} (tenant ${connection.tenantId})`,
            error
          );
          // Continue to next connection on failure
        }
      }
    } catch (error) {
      this.logger.error('Scheduled return sync global error', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Fetch returns from eBay Post-Order API and upsert into MarketplaceReturn records.
   * tenantId is passed explicitly so this works both from CLS-based requests and scheduled jobs.
   */
  async syncReturns(tenantId: string, connectionId: string): Promise<SyncResult> {
    const startedAt = new Date();
    let itemsTotal = 0;
    let itemsSuccess = 0;
    let itemsFailed = 0;

    // Create sync log entry
    const syncLog = await this.prisma.marketplaceSyncLog.create({
      data: {
        tenantId,
        connectionId,
        syncType: SyncType.ORDER_SYNC, // Returns are part of order lifecycle
        direction: SyncDirection.FROM_MARKETPLACE,
        status: SyncLogStatus.SUCCESS, // will update on completion
        startedAt,
        details: 'Return sync started',
      },
    });

    try {
      if (this.mockMode) {
        this.logger.log(`[MOCK] Return sync for connection ${connectionId}: 0 returns`);
        await this.prisma.marketplaceSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: SyncLogStatus.SUCCESS,
            itemsTotal: 0,
            itemsSuccess: 0,
            itemsFailed: 0,
            completedAt: new Date(),
            details: '[MOCK] Return sync complete — 0 returns',
          },
        });
        return { syncLogId: syncLog.id, itemsTotal: 0, itemsSuccess: 0, itemsFailed: 0 };
      }

      // Get authenticated eBay client (pass tenantId explicitly to avoid CLS dependency)
      const client = await this.ebayStore.getClient(connectionId, tenantId);

      // Fetch returns from eBay Post-Order API
      // The ebay-api package supports generic REST calls via client.post()
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let allReturns: any[] = [];
      let offset = 0;
      const PAGE_SIZE = 50;

      while (true) {
        let returnResponse: any;
        try {
          // Use the Post-Order API return search endpoint
          returnResponse = await (client as any).post('/post-order/v2/return/search', {
            body: {
              creation_date_range_from: thirtyDaysAgo.toISOString(),
              creation_date_range_to: new Date().toISOString(),
              offset,
              limit: PAGE_SIZE,
              sort: 'RETURN_CREATION_DATE_DESC',
            },
          });
        } catch (apiError: any) {
          // If the Post-Order API is unavailable, fall back to empty result
          // This can happen if the seller does not have Post-Order API access
          this.logger.warn(
            `Post-Order API return search failed for connection ${connectionId}: ${apiError?.message || String(apiError)}`
          );
          break;
        }

        const returns = returnResponse?.members || returnResponse?.returns || [];
        allReturns = allReturns.concat(returns);

        if (returns.length < PAGE_SIZE) {
          break;
        }

        offset += PAGE_SIZE;
      }

      itemsTotal = allReturns.length;

      for (const ebayReturn of allReturns) {
        try {
          const externalReturnId =
            ebayReturn.returnId || ebayReturn.returnRequest?.returnId;
          if (!externalReturnId) {
            itemsFailed++;
            continue;
          }

          const externalOrderId =
            ebayReturn.orderId ||
            ebayReturn.returnRequest?.orderId ||
            'UNKNOWN';

          const status = this.mapReturnStatus(
            ebayReturn.state ||
            ebayReturn.returnRequest?.state ||
            ebayReturn.status
          );

          const reason =
            ebayReturn.returnRequest?.reason ||
            ebayReturn.reason ||
            'UNKNOWN';

          const buyerUsername =
            ebayReturn.buyerLoginName ||
            ebayReturn.returnRequest?.buyerLoginName ||
            'unknown';

          const buyerComments =
            ebayReturn.returnRequest?.comments?.content?.[0]?.text ||
            ebayReturn.buyerComments ||
            null;

          const itemsData = this.extractReturnItems(ebayReturn);

          const refundAmount = ebayReturn.refundAmount?.value
            ? new Decimal(ebayReturn.refundAmount.value)
            : ebayReturn.estimatedRefundAmount?.value
              ? new Decimal(ebayReturn.estimatedRefundAmount.value)
              : null;

          const refundCurrency =
            ebayReturn.refundAmount?.currency ||
            ebayReturn.estimatedRefundAmount?.currency ||
            'USD';

          const requestDate = ebayReturn.creationDate
            ? new Date(ebayReturn.creationDate)
            : ebayReturn.returnRequest?.creationDate
              ? new Date(ebayReturn.returnRequest.creationDate)
              : new Date();

          const responseDate = ebayReturn.responseDate
            ? new Date(ebayReturn.responseDate)
            : null;

          const receivedDate = ebayReturn.receivedDate
            ? new Date(ebayReturn.receivedDate)
            : null;

          const refundDate = ebayReturn.refundDate
            ? new Date(ebayReturn.refundDate)
            : null;

          const refundStatus = ebayReturn.refundStatus || null;

          // Try to link to local marketplace order
          const localOrder = await this.prisma.marketplaceOrder.findFirst({
            where: { externalOrderId, tenantId },
            select: { id: true },
          });

          await this.prisma.marketplaceReturn.upsert({
            where: { externalReturnId: String(externalReturnId) },
            create: {
              tenantId,
              connectionId,
              marketplaceOrderId: localOrder?.id || null,
              externalReturnId: String(externalReturnId),
              externalOrderId,
              reason,
              buyerComments,
              status,
              buyerUsername,
              itemsData,
              refundAmount,
              refundCurrency,
              refundStatus,
              requestDate,
              responseDate,
              receivedDate,
              refundDate,
              syncStatus: 'synced',
            },
            update: {
              status,
              buyerComments,
              itemsData,
              refundAmount,
              refundCurrency,
              refundStatus,
              responseDate,
              receivedDate,
              refundDate,
              syncStatus: 'synced',
              errorMessage: null,
            },
          });

          itemsSuccess++;
        } catch (returnError) {
          itemsFailed++;
          this.logger.error(
            `Failed to sync eBay return ${ebayReturn.returnId || 'unknown'}`,
            returnError
          );
        }
      }

      // Update connection lastSyncAt
      await this.prisma.marketplaceConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date() },
      });

      // Finalize sync log
      const status =
        itemsFailed === 0
          ? SyncLogStatus.SUCCESS
          : itemsSuccess > 0
            ? SyncLogStatus.PARTIAL
            : SyncLogStatus.FAILED;

      await this.prisma.marketplaceSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status,
          itemsTotal,
          itemsSuccess,
          itemsFailed,
          completedAt: new Date(),
          details: `Synced ${itemsSuccess}/${itemsTotal} returns from eBay`,
        },
      });

      this.logger.log(
        `Return sync complete for connection ${connectionId}: ${itemsSuccess}/${itemsTotal} succeeded`
      );

      return {
        syncLogId: syncLog.id,
        itemsTotal,
        itemsSuccess,
        itemsFailed,
      };
    } catch (error) {
      this.logger.error(`Return sync failed for connection ${connectionId}`, error);

      await this.prisma.marketplaceSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: SyncLogStatus.FAILED,
          itemsTotal,
          itemsSuccess,
          itemsFailed,
          completedAt: new Date(),
          errorMessage: error?.message || String(error) || 'Return sync failed',
          details: 'Return sync failed with an unexpected error',
        },
      });

      throw error;
    }
  }

  /**
   * Map eBay return state/status to local ReturnStatus enum values.
   */
  private mapReturnStatus(ebayState: string | undefined): string {
    if (!ebayState) return ReturnStatus.RETURN_REQUESTED;

    const normalized = ebayState.toUpperCase().replace(/\s+/g, '_');
    const statusMap: Record<string, string> = {
      RETURN_REQUESTED: ReturnStatus.RETURN_REQUESTED,
      RETURN_WAITING_FOR_SELLER_INFO: ReturnStatus.RETURN_REQUESTED,
      RETURN_ACCEPTED: ReturnStatus.RETURN_ACCEPTED,
      RETURN_DECLINED: ReturnStatus.RETURN_DECLINED,
      RETURN_REJECTED: ReturnStatus.RETURN_DECLINED,
      ITEM_SHIPPED: ReturnStatus.ITEM_SHIPPED,
      ITEM_DELIVERED: ReturnStatus.ITEM_RECEIVED,
      ITEM_RECEIVED: ReturnStatus.ITEM_RECEIVED,
      REFUND_ISSUED: ReturnStatus.REFUND_ISSUED,
      REFUNDED: ReturnStatus.REFUND_ISSUED,
      CLOSED: ReturnStatus.CLOSED,
      RETURN_CLOSED: ReturnStatus.CLOSED,
    };

    return statusMap[normalized] || ReturnStatus.RETURN_REQUESTED;
  }

  /**
   * Extract return items from an eBay return response as JSON-serializable data.
   */
  private extractReturnItems(ebayReturn: any): any[] {
    const items =
      ebayReturn.returnRequest?.itemList ||
      ebayReturn.lineItems ||
      ebayReturn.returnItems ||
      [];

    return items.map((item: any) => ({
      lineItemId: item.lineItemId || item.itemId,
      title: item.title || item.itemTitle || '',
      quantity: item.quantity || item.returnQuantity || 1,
      transactionId: item.transactionId || null,
      legacyItemId: item.legacyItemId || item.itemId || null,
    }));
  }

  /**
   * Get synced marketplace returns from the database.
   */
  async getReturns(
    tenantId: string,
    filters?: {
      connectionId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ returns: any[]; total: number }> {
    const where: Prisma.MarketplaceReturnWhereInput = { tenantId };
    if (filters?.connectionId) where.connectionId = filters.connectionId;
    if (filters?.status) where.status = filters.status;

    const [returns, total] = await Promise.all([
      this.prisma.marketplaceReturn.findMany({
        where,
        include: {
          connection: {
            select: { id: true, name: true, platform: true, marketplaceId: true },
          },
          marketplaceOrder: {
            select: { id: true, externalOrderId: true, buyerUsername: true },
          },
        },
        orderBy: { requestDate: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      this.prisma.marketplaceReturn.count({ where }),
    ]);

    return { returns, total };
  }

  /**
   * Get a single synced return by ID.
   */
  async getReturn(tenantId: string, returnId: string): Promise<any> {
    const returnRecord = await this.prisma.marketplaceReturn.findFirst({
      where: { id: returnId, tenantId },
      include: {
        connection: {
          select: { id: true, name: true, platform: true, marketplaceId: true },
        },
        marketplaceOrder: {
          select: { id: true, externalOrderId: true, buyerUsername: true },
        },
      },
    });

    if (!returnRecord) {
      throw new NotFoundException(`Marketplace return ${returnId} not found`);
    }

    return returnRecord;
  }

  /**
   * Approve a return on eBay.
   */
  async approveReturn(tenantId: string, returnId: string): Promise<void> {
    const returnRecord = await this.getReturn(tenantId, returnId);

    if (returnRecord.status !== ReturnStatus.RETURN_REQUESTED) {
      throw new BadRequestException('Only returns in RETURN_REQUESTED status can be approved');
    }

    if (!this.mockMode) {
      const client = await this.ebayStore.getClient(returnRecord.connectionId, tenantId);
      try {
        await (client as any).post(
          `/post-order/v2/return/${returnRecord.externalReturnId}/decide`,
          {
            body: {
              decision: 'ACCEPT',
              keepOriginalItem: false,
            },
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to approve return ${returnRecord.externalReturnId} on eBay`,
          error
        );
        throw error;
      }
    } else {
      this.logger.log(`[MOCK] Approved return ${returnRecord.externalReturnId}`);
    }

    await this.prisma.marketplaceReturn.update({
      where: { id: returnId },
      data: {
        status: ReturnStatus.RETURN_ACCEPTED,
        responseDate: new Date(),
        syncStatus: 'synced',
        errorMessage: null,
      },
    });

    this.logger.log(`Approved return ${returnId} (eBay: ${returnRecord.externalReturnId})`);

    try {
      await this.audit.logReturnProcessed(returnId, 'APPROVE_RETURN', {
        externalReturnId: returnRecord.externalReturnId,
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Decline a return on eBay.
   */
  async declineReturn(tenantId: string, returnId: string, reason: string): Promise<void> {
    const returnRecord = await this.getReturn(tenantId, returnId);

    if (returnRecord.status !== ReturnStatus.RETURN_REQUESTED) {
      throw new BadRequestException('Only returns in RETURN_REQUESTED status can be declined');
    }

    if (!this.mockMode) {
      const client = await this.ebayStore.getClient(returnRecord.connectionId, tenantId);
      try {
        await (client as any).post(
          `/post-order/v2/return/${returnRecord.externalReturnId}/decide`,
          {
            body: {
              decision: 'DECLINE',
              comments: { content: [{ text: reason }] },
            },
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to decline return ${returnRecord.externalReturnId} on eBay`,
          error
        );
        throw error;
      }
    } else {
      this.logger.log(`[MOCK] Declined return ${returnRecord.externalReturnId}: ${reason}`);
    }

    await this.prisma.marketplaceReturn.update({
      where: { id: returnId },
      data: {
        status: ReturnStatus.RETURN_DECLINED,
        sellerComments: reason,
        responseDate: new Date(),
        syncStatus: 'synced',
        errorMessage: null,
      },
    });

    this.logger.log(`Declined return ${returnId} (eBay: ${returnRecord.externalReturnId})`);

    try {
      await this.audit.logReturnProcessed(returnId, 'DECLINE_RETURN', {
        externalReturnId: returnRecord.externalReturnId,
        reason,
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Issue a refund for a return on eBay.
   */
  async issueRefund(
    tenantId: string,
    returnId: string,
    amount: number,
    comment?: string
  ): Promise<void> {
    const returnRecord = await this.getReturn(tenantId, returnId);

    const refundableStatuses = [
      ReturnStatus.RETURN_ACCEPTED,
      ReturnStatus.ITEM_SHIPPED,
      ReturnStatus.ITEM_RECEIVED,
    ];
    if (!refundableStatuses.includes(returnRecord.status as ReturnStatus)) {
      throw new BadRequestException(
        'Refund can only be issued for accepted, shipped, or received returns'
      );
    }

    if (!this.mockMode) {
      const client = await this.ebayStore.getClient(returnRecord.connectionId, tenantId);
      try {
        await (client as any).post(
          `/post-order/v2/return/${returnRecord.externalReturnId}/issue_refund`,
          {
            body: {
              refundAmount: {
                value: amount.toFixed(2),
                currency: returnRecord.refundCurrency || 'USD',
              },
              ...(comment && {
                comments: { content: [{ text: comment }] },
              }),
            },
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to issue refund for return ${returnRecord.externalReturnId} on eBay`,
          error
        );
        throw error;
      }
    } else {
      this.logger.log(
        `[MOCK] Issued refund $${amount.toFixed(2)} for return ${returnRecord.externalReturnId}`
      );
    }

    await this.prisma.marketplaceReturn.update({
      where: { id: returnId },
      data: {
        status: ReturnStatus.REFUND_ISSUED,
        refundAmount: new Decimal(amount),
        refundStatus: 'ISSUED',
        refundDate: new Date(),
        sellerComments: comment || returnRecord.sellerComments,
        syncStatus: 'synced',
        errorMessage: null,
      },
    });

    this.logger.log(
      `Issued refund $${amount.toFixed(2)} for return ${returnId} (eBay: ${returnRecord.externalReturnId})`
    );

    try {
      await this.audit.logReturnProcessed(returnId, 'ISSUE_REFUND', {
        externalReturnId: returnRecord.externalReturnId,
        amount,
        comment,
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Mark a return as received (item received by seller).
   */
  async markReturnReceived(tenantId: string, returnId: string): Promise<void> {
    const returnRecord = await this.getReturn(tenantId, returnId);

    const receivableStatuses = [
      ReturnStatus.RETURN_ACCEPTED,
      ReturnStatus.ITEM_SHIPPED,
    ];
    if (!receivableStatuses.includes(returnRecord.status as ReturnStatus)) {
      throw new BadRequestException(
        'Only accepted or shipped returns can be marked as received'
      );
    }

    if (!this.mockMode) {
      const client = await this.ebayStore.getClient(returnRecord.connectionId, tenantId);
      try {
        await (client as any).post(
          `/post-order/v2/return/${returnRecord.externalReturnId}/mark_as_received`,
          {
            body: {},
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to mark return ${returnRecord.externalReturnId} as received on eBay`,
          error
        );
        throw error;
      }
    } else {
      this.logger.log(`[MOCK] Marked return ${returnRecord.externalReturnId} as received`);
    }

    await this.prisma.marketplaceReturn.update({
      where: { id: returnId },
      data: {
        status: ReturnStatus.ITEM_RECEIVED,
        receivedDate: new Date(),
        syncStatus: 'synced',
        errorMessage: null,
      },
    });

    this.logger.log(
      `Marked return ${returnId} as received (eBay: ${returnRecord.externalReturnId})`
    );

    try {
      await this.audit.logReturnProcessed(returnId, 'MARK_RECEIVED', {
        externalReturnId: returnRecord.externalReturnId,
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Send a message on a return to the buyer via eBay Post-Order API.
   */
  async sendReturnMessage(
    tenantId: string,
    returnId: string,
    message: string
  ): Promise<void> {
    const returnRecord = await this.getReturn(tenantId, returnId);

    if (returnRecord.status === ReturnStatus.CLOSED) {
      throw new BadRequestException('Cannot send messages on closed returns');
    }

    if (!this.mockMode) {
      const client = await this.ebayStore.getClient(returnRecord.connectionId, tenantId);
      try {
        await (client as any).post(
          `/post-order/v2/return/${returnRecord.externalReturnId}/send_message`,
          {
            body: {
              comments: {
                content: [{ text: message }],
              },
            },
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to send message on return ${returnRecord.externalReturnId} on eBay`,
          error
        );
        throw error;
      }
    } else {
      this.logger.log(
        `[MOCK] Sent message on return ${returnRecord.externalReturnId}: ${message}`
      );
    }

    this.logger.log(
      `Sent message on return ${returnId} (eBay: ${returnRecord.externalReturnId})`
    );

    try {
      await this.audit.logReturnProcessed(returnId, 'SEND_MESSAGE', {
        externalReturnId: returnRecord.externalReturnId,
        messagePreview: message.substring(0, 100),
      });
    } catch {
      // Non-critical
    }
  }
}
