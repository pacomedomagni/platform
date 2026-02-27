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
import { SyncType, SyncDirection, SyncLogStatus, SyncStatus } from '../shared/marketplace.types';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

/**
 * eBay Order Sync Service
 * Handles syncing orders from eBay, querying synced orders, and pushing fulfillments back to eBay.
 *
 * TODO: Implement eBay Platform Notifications (webhook/push-based order sync)
 * instead of relying solely on polling. This would reduce latency and API calls.
 * See: https://developer.ebay.com/marketplace-account-deletion
 */
@Injectable()
export class EbayOrderSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EbayOrderSyncService.name);
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private inventorySyncInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  private readonly INVENTORY_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private ebayClient: EbayClientService,
    private audit: MarketplaceAuditService
  ) {}

  onModuleInit() {
    // Start scheduled sync for all active connections with autoSyncOrders enabled
    this.syncInterval = setInterval(() => this.syncAllActiveConnections(), this.SYNC_INTERVAL_MS);
    this.logger.log('eBay order sync scheduler started (every 15 minutes)');

    // Start scheduled inventory sync for connections with autoSyncInventory enabled
    this.inventorySyncInterval = setInterval(() => this.syncAllActiveInventory(), this.INVENTORY_SYNC_INTERVAL_MS);
    this.logger.log('eBay inventory sync scheduler started (every 30 minutes)');
  }

  onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.inventorySyncInterval) {
      clearInterval(this.inventorySyncInterval);
      this.inventorySyncInterval = null;
    }
  }

  /**
   * Map eBay order status to local status values.
   * eBay Fulfillment API uses orderFulfillmentStatus and orderPaymentStatus.
   */
  private mapEbayOrderStatus(ebayOrder: any): {
    externalStatus: string;
    paymentStatus: string;
    fulfillmentStatus: string;
  } {
    // eBay order statuses from Fulfillment API:
    //   orderFulfillmentStatus: NOT_STARTED, IN_PROGRESS, FULFILLED
    //   orderPaymentStatus: PAID, PENDING, FAILED, REFUNDED
    const externalStatus = ebayOrder.orderFulfillmentStatus || 'UNKNOWN';
    const paymentStatus = ebayOrder.orderPaymentStatus || 'UNKNOWN';
    const fulfillmentStatus = ebayOrder.orderFulfillmentStatus || 'NOT_STARTED';

    return { externalStatus, paymentStatus, fulfillmentStatus };
  }

  /**
   * Extract buyer information from an eBay order
   */
  private extractBuyerInfo(ebayOrder: any) {
    const buyer = ebayOrder.buyer || {};
    return {
      buyerUsername: buyer.username || 'unknown',
      buyerEmail: buyer.buyerRegistrationAddress?.email || null,
    };
  }

  /**
   * Extract shipping address from an eBay order
   */
  private extractShippingAddress(ebayOrder: any) {
    const fulfillmentStartInstructions = ebayOrder.fulfillmentStartInstructions || [];
    const shippingStep = fulfillmentStartInstructions[0]?.shippingStep;
    const address = shippingStep?.shipTo?.contactAddress || {};
    const fullName = shippingStep?.shipTo?.fullName || 'Unknown';

    return {
      shippingName: fullName,
      shippingStreet1: address.addressLine1 || '',
      shippingStreet2: address.addressLine2 || null,
      shippingCity: address.city || '',
      shippingState: address.stateOrProvince || null,
      shippingPostalCode: address.postalCode || '',
      shippingCountry: address.countryCode || 'US',
    };
  }

  /**
   * Extract financial data from an eBay order
   */
  private extractFinancials(ebayOrder: any) {
    const pricingSummary = ebayOrder.pricingSummary || {};
    return {
      subtotal: new Decimal(pricingSummary.priceSubtotal?.value || '0'),
      shippingCost: new Decimal(pricingSummary.deliveryCost?.value || '0'),
      taxAmount: new Decimal(pricingSummary.tax?.value || '0'),
      total: new Decimal(pricingSummary.total?.value || '0'),
      currency: pricingSummary.total?.currency || 'USD',
    };
  }

  /**
   * Extract line items from an eBay order as JSON-serializable data
   */
  private extractLineItems(ebayOrder: any): any[] {
    const lineItems = ebayOrder.lineItems || [];
    return lineItems.map((li: any) => ({
      lineItemId: li.lineItemId,
      title: li.title,
      sku: li.sku || null,
      quantity: li.quantity,
      unitPrice: li.lineItemCost?.value || '0',
      currency: li.lineItemCost?.currency || 'USD',
      legacyItemId: li.legacyItemId || null,
      legacyVariationId: li.legacyVariationId || null,
    }));
  }

  /**
   * Sync orders from eBay for a specific connection.
   * Fetches orders from eBay Fulfillment API with pagination, upserts them into MarketplaceOrder records.
   * tenantId is passed explicitly so this works both from CLS-based requests and scheduled jobs.
   */
  async syncOrders(tenantId: string, connectionId: string) {
    const startedAt = new Date();
    let itemsTotal = 0;
    let itemsSuccess = 0;
    let itemsFailed = 0;

    // Create sync log entry
    const syncLog = await this.prisma.marketplaceSyncLog.create({
      data: {
        tenantId,
        connectionId,
        syncType: SyncType.ORDER_SYNC,
        direction: SyncDirection.FROM_MARKETPLACE,
        status: SyncLogStatus.SUCCESS, // will update on completion
        startedAt,
      },
    });

    try {
      // Get authenticated eBay client (pass tenantId explicitly to avoid CLS dependency)
      const client = await this.ebayStore.getClient(connectionId, tenantId);

      // Fetch orders from eBay (last 30 days by default) with pagination
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const filterDate = thirtyDaysAgo.toISOString();

      const PAGE_SIZE = 50;
      let offset = 0;
      let allEbayOrders: any[] = [];

      // Paginate through all orders
      while (true) {
        const pageOrders = await this.ebayClient.getOrders(client, {
          filter: `creationdate:[${filterDate}..],orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}`,
          limit: PAGE_SIZE,
          offset,
        });

        allEbayOrders = allEbayOrders.concat(pageOrders);

        if (pageOrders.length < PAGE_SIZE) {
          break; // No more pages
        }

        offset += PAGE_SIZE;
      }

      itemsTotal = allEbayOrders.length;

      for (const ebayOrder of allEbayOrders) {
        try {
          const externalOrderId = ebayOrder.orderId;
          if (!externalOrderId) {
            itemsFailed++;
            continue;
          }

          const { externalStatus, paymentStatus, fulfillmentStatus } =
            this.mapEbayOrderStatus(ebayOrder);
          const buyerInfo = this.extractBuyerInfo(ebayOrder);
          const shippingAddress = this.extractShippingAddress(ebayOrder);
          const financials = this.extractFinancials(ebayOrder);
          const lineItems = this.extractLineItems(ebayOrder);

          const orderDate = ebayOrder.creationDate
            ? new Date(ebayOrder.creationDate)
            : new Date();

          const paymentDate =
            paymentStatus === 'PAID' && ebayOrder.paymentSummary?.payments?.[0]?.paymentDate
              ? new Date(ebayOrder.paymentSummary.payments[0].paymentDate)
              : null;

          // Upsert into MarketplaceOrder
          await this.prisma.marketplaceOrder.upsert({
            where: { externalOrderId },
            create: {
              tenantId,
              connectionId,
              externalOrderId,
              ...buyerInfo,
              ...shippingAddress,
              ...financials,
              externalStatus,
              paymentStatus,
              fulfillmentStatus,
              orderDate,
              paymentDate,
              itemsData: lineItems,
              syncStatus: SyncStatus.SYNCED,
              // TODO (L6): Map eBay orders to local Order records.
              // When a marketplace order is created, a corresponding local Order should be
              // created (or linked) so that fulfillment, invoicing, and reporting workflows
              // can operate on marketplace orders seamlessly.
            },
            update: {
              externalStatus,
              paymentStatus,
              fulfillmentStatus,
              ...shippingAddress,
              ...financials,
              itemsData: lineItems,
              syncStatus: SyncStatus.SYNCED,
              errorMessage: null,
            },
          });

          itemsSuccess++;
        } catch (orderError) {
          itemsFailed++;
          this.logger.error(
            `Failed to sync eBay order ${ebayOrder.orderId}`,
            orderError
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
          details: `Synced ${itemsSuccess}/${itemsTotal} orders from eBay`,
        },
      });

      this.logger.log(
        `Order sync complete for connection ${connectionId}: ${itemsSuccess}/${itemsTotal} succeeded`
      );

      return {
        syncLogId: syncLog.id,
        itemsTotal,
        itemsSuccess,
        itemsFailed,
      };
    } catch (error) {
      this.logger.error(`Order sync failed for connection ${connectionId}`, error);

      await this.prisma.marketplaceSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: SyncLogStatus.FAILED,
          itemsTotal,
          itemsSuccess,
          itemsFailed,
          completedAt: new Date(),
          errorMessage: error.message || 'Order sync failed',
          details: 'Order sync failed with an unexpected error',
        },
      });

      throw error;
    }
  }

  /**
   * Get synced marketplace orders from the database.
   */
  async getOrders(
    tenantId: string,
    connectionId?: string,
    filters?: {
      fulfillmentStatus?: string;
      paymentStatus?: string;
      syncStatus?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (filters?.fulfillmentStatus) where.fulfillmentStatus = filters.fulfillmentStatus;
    if (filters?.paymentStatus) where.paymentStatus = filters.paymentStatus;
    if (filters?.syncStatus) where.syncStatus = filters.syncStatus;

    const [orders, total] = await Promise.all([
      this.prisma.marketplaceOrder.findMany({
        where,
        include: {
          connection: {
            select: { id: true, name: true, platform: true, marketplaceId: true },
          },
        },
        orderBy: { orderDate: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      this.prisma.marketplaceOrder.count({ where }),
    ]);

    return { orders, total };
  }

  /**
   * Get a single synced order by ID.
   */
  async getOrder(tenantId: string, orderId: string) {
    const order = await this.prisma.marketplaceOrder.findFirst({
      where: { id: orderId, tenantId },
      include: {
        connection: {
          select: { id: true, name: true, platform: true, marketplaceId: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Marketplace order ${orderId} not found`);
    }

    return order;
  }

  /**
   * Push fulfillment (shipping) info to eBay for a synced order.
   * Calls eBay Fulfillment API's createShippingFulfillment.
   */
  async fulfillOrder(
    tenantId: string,
    orderId: string,
    trackingNumber: string,
    carrier: string
  ) {
    const order = await this.getOrder(tenantId, orderId);

    if (order.fulfillmentStatus === 'FULFILLED') {
      throw new BadRequestException('Order is already fulfilled');
    }

    // Get eBay client for this connection (pass tenantId explicitly)
    const client = await this.ebayStore.getClient(order.connectionId, tenantId);

    // Build line items for fulfillment (all items in the order)
    const lineItems = (order.itemsData as any[]).map((item: any) => ({
      lineItemId: item.lineItemId,
      quantity: item.quantity,
    }));

    try {
      const result = await this.ebayClient.createShippingFulfillment(
        client,
        order.externalOrderId,
        {
          lineItems,
          shippingCarrierCode: carrier,
          trackingNumber,
        }
      );

      // Update local order record
      await this.prisma.marketplaceOrder.update({
        where: { id: orderId },
        data: {
          fulfillmentStatus: 'FULFILLED',
          externalStatus: 'FULFILLED',
          syncStatus: SyncStatus.SYNCED,
          errorMessage: null,
        },
      });

      this.logger.log(
        `Fulfilled eBay order ${order.externalOrderId} with tracking ${trackingNumber} (${carrier})`
      );

      return {
        success: true,
        fulfillmentId: result?.fulfillmentId || null,
        trackingNumber,
        carrier,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fulfill eBay order ${order.externalOrderId}`,
        error
      );

      await this.prisma.marketplaceOrder.update({
        where: { id: orderId },
        data: {
          syncStatus: SyncStatus.ERROR,
          errorMessage: `Fulfillment failed: ${error.message}`,
        },
      });

      throw error;
    }
  }

  /**
   * Scheduled sync: sync orders for all active connections with autoSyncOrders=true.
   * Runs outside of CLS context, so tenantId is read from each connection record.
   */
  private async syncAllActiveConnections() {
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
        `Scheduled order sync: found ${connections.length} active connection(s)`
      );

      for (const connection of connections) {
        try {
          await this.syncOrders(connection.tenantId, connection.id);
        } catch (error) {
          this.logger.error(
            `Scheduled order sync failed for connection ${connection.id} (tenant ${connection.tenantId})`,
            error
          );
          // Continue to next connection on failure
        }
      }
    } catch (error) {
      this.logger.error('Scheduled order sync global error', error);
    }
  }

  /**
   * Scheduled inventory sync: sync inventory for all active connections with autoSyncInventory=true.
   * Runs outside of CLS context, so tenantId is read from each connection record.
   */
  private async syncAllActiveInventory() {
    try {
      const connections = await this.prisma.marketplaceConnection.findMany({
        where: {
          platform: 'EBAY',
          isActive: true,
          isConnected: true,
          autoSyncInventory: true,
        },
      });

      this.logger.log(
        `Scheduled inventory sync: found ${connections.length} active connection(s)`
      );

      for (const connection of connections) {
        try {
          // Find all published listings for this connection
          const listings = await this.prisma.marketplaceListing.findMany({
            where: {
              connectionId: connection.id,
              tenantId: connection.tenantId,
              status: 'published',
              externalOfferId: { not: null },
              warehouseId: { not: null },
            },
            include: {
              productListing: { select: { itemId: true } },
            },
          });

          for (const listing of listings) {
            try {
              if (!listing.warehouseId || !listing.productListing) continue;

              const balance = await this.prisma.warehouseItemBalance.findUnique({
                where: {
                  tenantId_itemId_warehouseId: {
                    tenantId: connection.tenantId,
                    itemId: listing.productListing.itemId,
                    warehouseId: listing.warehouseId,
                  },
                },
              });

              const availableQty = balance
                ? Math.max(0, balance.actualQty.toNumber() - balance.reservedQty.toNumber())
                : 0;

              // Update eBay
              const client = await this.ebayStore.getClient(connection.id, connection.tenantId);
              await this.ebayClient.updateInventoryQuantity(client, listing.sku, availableQty);

              // Update local listing
              await this.prisma.marketplaceListing.update({
                where: { id: listing.id },
                data: {
                  quantity: availableQty,
                  syncStatus: SyncStatus.SYNCED,
                  errorMessage: null,
                },
              });

              this.logger.log(
                `Scheduled inventory sync: updated listing ${listing.id} to qty ${availableQty}`
              );
            } catch (listingError) {
              this.logger.error(
                `Scheduled inventory sync failed for listing ${listing.id}`,
                listingError
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `Scheduled inventory sync failed for connection ${connection.id} (tenant ${connection.tenantId})`,
            error
          );
          // Continue to next connection on failure
        }
      }
    } catch (error) {
      this.logger.error('Scheduled inventory sync global error', error);
    }
  }
}
