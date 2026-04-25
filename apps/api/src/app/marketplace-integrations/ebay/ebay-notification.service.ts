import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { DistributedLockService } from '@platform/queue';
import { EbayStoreService } from './ebay-store.service';
import { EbayOrderSyncService } from './ebay-order-sync.service';
import { EbayWebhookService } from './ebay-webhook.service';

/**
 * eBay Notification Service.
 *
 * Phase 3 W3.4: deduplication moved from an in-memory Map to Redis. The
 * previous Map was per-pod and lost on restart, so a notificationId could
 * be processed N times across N pods (or after a redeploy). Redis with
 * SET NX EX gives durable, cross-pod dedup.
 */
@Injectable()
export class EbayNotificationService {
  private readonly logger = new Logger(EbayNotificationService.name);

  // 24h matches eBay's typical retry window. Old enough to absorb their
  // exponential backoff; short enough that the keyspace stays small.
  private readonly DEDUP_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private ebayStore: EbayStoreService,
    private orderSync: EbayOrderSyncService,
    private webhookService: EbayWebhookService,
    private lockService: DistributedLockService,
  ) {}

  /**
   * Extract a unique notification ID from the payload for deduplication.
   */
  private getNotificationId(payload: any): string | null {
    return (
      payload?.metadata?.notificationId ||
      payload?.metadata?.eventId ||
      payload?.notificationId ||
      null
    );
  }

  /**
   * Atomic claim of a notificationId — returns true on first sight, false on
   * duplicate. Uses the W3.2 distributed-lock primitive's underlying
   * SET NX PX.
   */
  private async claimNotificationId(notificationId: string): Promise<boolean> {
    const key = `ebay:notif:dedup:${notificationId}`;
    const token = await this.lockService.tryAcquire(key, this.DEDUP_TTL_MS);
    return token !== null;
  }

  /**
   * Route an incoming notification to the appropriate handler based on topic.
   * Includes deduplication to prevent reprocessing on eBay retries.
   */
  async processNotification(topic: string, payload: any): Promise<void> {
    // Deduplication check (Redis-backed, cross-pod, survives restart)
    const notificationId = this.getNotificationId(payload);
    if (notificationId) {
      const isFirstSeen = await this.claimNotificationId(notificationId);
      if (!isFirstSeen) {
        this.logger.log(`Skipping duplicate eBay notification: ${topic} (id=${notificationId})`);
        return;
      }
    }

    this.logger.log(`Processing eBay notification: ${topic}${notificationId ? ` (id=${notificationId})` : ''}`);

    try {
      switch (topic) {
        case 'MARKETPLACE_ACCOUNT_DELETION':
          this.logger.warn(
            `Received MARKETPLACE_ACCOUNT_DELETION notification`
          );
          // Route to webhook service for actual account anonymization
          await this.webhookService.handleAccountDeletion(payload);
          break;

        case 'ORDER_CREATED':
        case 'ORDER_UPDATED':
          await this.handleOrderNotification(payload);
          break;

        case 'ITEM_SOLD':
        case 'ITEM_OUT_OF_STOCK':
          await this.handleItemNotification(payload);
          break;

        case 'RETURN_CREATED':
        case 'RETURN_UPDATED':
          await this.handleReturnNotification(payload);
          break;

        default:
          this.logger.warn(`Unhandled eBay notification topic: ${topic}`);
          break;
      }
    } catch (error) {
      this.logger.error(
        `Failed to process eBay notification (topic=${topic})`,
        error
      );
      throw error;
    }
  }

  /**
   * Handle order-related notifications.
   * Looks up the connection by the eBay user ID or order reference in the payload,
   * then triggers an incremental order sync for the matching connection.
   */
  async handleOrderNotification(payload: any): Promise<void> {
    const externalOrderId = payload?.metadata?.orderId || payload?.resource?.orderId;
    if (!externalOrderId) {
      this.logger.warn('Order notification missing orderId in payload');
      return;
    }

    this.logger.log(`Handling order notification for eBay order ${externalOrderId}`);

    // Try to find the connection via an existing synced order
    const existingOrder = await this.prisma.marketplaceOrder.findFirst({
      where: { externalOrderId },
      select: { connectionId: true, tenantId: true },
    });

    if (existingOrder) {
      try {
        await this.orderSync.syncOrders(existingOrder.tenantId, existingOrder.connectionId);
      } catch (error) {
        this.logger.error(
          `Incremental order sync failed for connection ${existingOrder.connectionId}`,
          error
        );
      }
      return;
    }

    // Order not yet synced — attempt to find the connection by the eBay username in the payload
    const username =
      payload?.resource?.buyer?.username ||
      payload?.metadata?.username;

    if (username) {
      const connections = await this.prisma.marketplaceConnection.findMany({
        where: {
          platform: 'EBAY',
          isActive: true,
          isConnected: true,
        },
      });

      // Trigger sync on all active eBay connections (the sync is idempotent)
      for (const connection of connections) {
        try {
          await this.orderSync.syncOrders(connection.tenantId, connection.id);
        } catch (error) {
          this.logger.error(
            `Incremental order sync failed for connection ${connection.id}`,
            error
          );
          // Continue to next connection
        }
      }
    } else {
      this.logger.warn(
        `Order notification for unknown order ${externalOrderId} — no matching connection found`
      );
    }
  }

  /**
   * Handle item-related notifications (ITEM_SOLD, ITEM_OUT_OF_STOCK).
   * Updates the local listing status and/or quantity based on the event.
   */
  async handleItemNotification(payload: any): Promise<void> {
    const itemId =
      payload?.metadata?.itemId ||
      payload?.resource?.itemId ||
      payload?.resource?.legacyItemId;

    if (!itemId) {
      this.logger.warn('Item notification missing itemId in payload');
      return;
    }

    this.logger.log(`Handling item notification for eBay item ${itemId}`);

    // Find the local listing matching this external item
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: {
        OR: [
          { externalListingId: itemId },
          { externalListingId: String(itemId) },
        ],
        status: 'published',
      },
    });

    if (!listing) {
      this.logger.warn(`No local listing found for eBay item ${itemId}`);
      return;
    }

    // Determine the quantity update from the notification payload
    const quantitySold = payload?.resource?.quantitySold ?? 0;
    const quantityRemaining = payload?.resource?.quantityRemaining;

    const updateData: Record<string, any> = {};

    if (quantityRemaining !== undefined && quantityRemaining !== null) {
      updateData.quantity = Math.max(0, Number(quantityRemaining));
    } else if (quantitySold > 0) {
      updateData.quantity = Math.max(0, listing.quantity - Number(quantitySold));
    }

    // If item is out of stock, reflect that
    if (
      payload?.metadata?.topic === 'ITEM_OUT_OF_STOCK' ||
      updateData.quantity === 0
    ) {
      updateData.quantity = 0;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.marketplaceListing.update({
        where: { id: listing.id },
        data: updateData,
      });

      this.logger.log(
        `Updated listing ${listing.id} from item notification: ${JSON.stringify(updateData)}`
      );
    }
  }

  /**
   * Handle return-related notifications (RETURN_CREATED, RETURN_UPDATED).
   * Logs the event for pickup by the return sync scheduler.
   * The actual return data will be fetched during the next scheduled return sync cycle.
   */
  async handleReturnNotification(payload: any): Promise<void> {
    const returnId =
      payload?.metadata?.returnId ||
      payload?.resource?.returnId;

    const orderId =
      payload?.metadata?.orderId ||
      payload?.resource?.orderId;

    this.logger.log(
      `Return notification received — returnId=${returnId || 'unknown'}, orderId=${orderId || 'unknown'}. ` +
        'Will be picked up by next return sync cycle.'
    );

    // If we have an existing return record, update its sync status to trigger re-sync
    if (returnId) {
      const existingReturn = await this.prisma.marketplaceReturn.findFirst({
        where: { externalReturnId: String(returnId) },
      });

      if (existingReturn) {
        await this.prisma.marketplaceReturn.update({
          where: { id: existingReturn.id },
          data: {
            syncStatus: 'pending',
            errorMessage: null,
          },
        });

        this.logger.log(
          `Marked return ${existingReturn.id} for re-sync due to notification`
        );
      }
    }
  }
}
