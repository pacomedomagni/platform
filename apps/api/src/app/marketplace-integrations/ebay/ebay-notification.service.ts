import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, bypassTenantGuard, runWithTenant } from '@platform/db';
import { DistributedLockService } from '@platform/queue';
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
   *
   * Resolves which tenant + connection the notification belongs to by the
   * seller's ebayUserId (persisted at OAuth callback). Once we have the
   * tenant we kick off an incremental sync that will upsert the order.
   *
   * Doing it seller-first — instead of looking up the order by
   * externalOrderId across all tenants — keeps every read tenant-scoped
   * and avoids the structural unsoundness of `findFirst` against a
   * (tenantId, externalOrderId) composite-unique row without supplying
   * the tenant.
   */
  async handleOrderNotification(payload: any): Promise<void> {
    const externalOrderId = payload?.metadata?.orderId || payload?.resource?.orderId;
    if (!externalOrderId) {
      this.logger.warn('Order notification missing orderId in payload');
      return;
    }

    const sellerUserId =
      payload?.metadata?.userId ||
      payload?.resource?.seller?.username;

    if (!sellerUserId) {
      this.logger.warn(
        `Order notification for ${externalOrderId} dropped — no seller identifier in payload`
      );
      return;
    }

    this.logger.log(`Handling order notification for eBay order ${externalOrderId} (seller=${sellerUserId})`);

    // Cross-tenant lookup keyed only on platformConfig.ebayUserId, which
    // is the canonical seller key written at OAuth callback time.
    const connection = await bypassTenantGuard(() =>
      this.prisma.marketplaceConnection.findFirst({
        where: {
          platform: 'EBAY',
          isActive: true,
          isConnected: true,
          platformConfig: { path: ['ebayUserId'], equals: sellerUserId },
        },
        select: { id: true, tenantId: true },
      }),
    );

    if (!connection) {
      this.logger.warn(
        `Order notification for order ${externalOrderId}: no eBay connection matches seller ${sellerUserId}`
      );
      return;
    }

    try {
      await runWithTenant(connection.tenantId, () =>
        this.orderSync.syncOrders(connection.tenantId, connection.id),
      );
    } catch (error) {
      this.logger.error(
        `Incremental order sync failed for connection ${connection.id}`,
        error
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

    // Lookup is cross-tenant (external item id is global on eBay's side);
    // wrap in bypass for the find, then pin the tenant for the update.
    const listing = await bypassTenantGuard(() =>
      this.prisma.marketplaceListing.findFirst({
        where: {
          OR: [
            { externalListingId: itemId },
            { externalListingId: String(itemId) },
          ],
          status: 'published',
        },
      }),
    );

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
      await runWithTenant(listing.tenantId, () =>
        this.prisma.marketplaceListing.update({
          where: { id: listing.id },
          data: updateData,
        }),
      );

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
      const existingReturn = await bypassTenantGuard(() =>
        this.prisma.marketplaceReturn.findFirst({
          where: { externalReturnId: String(returnId) },
        }),
      );

      if (existingReturn) {
        await runWithTenant(existingReturn.tenantId, () =>
          this.prisma.marketplaceReturn.update({
            where: { id: existingReturn.id },
            data: {
              syncStatus: 'pending',
              errorMessage: null,
            },
          }),
        );

        this.logger.log(
          `Marked return ${existingReturn.id} for re-sync due to notification`
        );
      }
    }
  }
}
