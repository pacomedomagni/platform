import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { EbayStoreService } from './ebay-store.service';
import { EbayClientService } from './ebay-client.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';
import { DistributedLockService } from '../shared/distributed-lock.service';
import { SyncType, SyncDirection, SyncLogStatus, SyncStatus, ListingStatus } from '../shared/marketplace.types';
import type { EbayOrder, MappedOrderLineItem } from './ebay.types';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

/**
 * eBay Order Sync Service
 * Handles syncing orders from eBay, querying synced orders, and pushing fulfillments back to eBay.
 */
@Injectable()
export class EbayOrderSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EbayOrderSyncService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private inventorySyncInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  private readonly INVENTORY_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  // In-memory lock to prevent concurrent inventory updates for the same SKU
  private readonly inventoryLocks = new Map<string, Promise<void>>();

  constructor(
    private prisma: PrismaService,
    private ebayStore: EbayStoreService,
    private ebayClient: EbayClientService,
    private audit: MarketplaceAuditService,
    private distributedLock: DistributedLockService
  ) {}

  onModuleInit() {
    if (process.env.ENABLE_SCHEDULED_TASKS === 'false') {
      this.logger.log('Scheduled tasks disabled via ENABLE_SCHEDULED_TASKS=false');
      return;
    }

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
  private mapEbayOrderStatus(ebayOrder: EbayOrder): {
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
  private extractBuyerInfo(ebayOrder: EbayOrder) {
    const buyer = ebayOrder.buyer || {};
    return {
      buyerUsername: buyer.username || 'unknown',
      buyerEmail: buyer.buyerRegistrationAddress?.email || null,
    };
  }

  /**
   * Extract shipping address from an eBay order
   */
  private extractShippingAddress(ebayOrder: EbayOrder) {
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
  private extractFinancials(ebayOrder: EbayOrder) {
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
  private extractLineItems(ebayOrder: EbayOrder): MappedOrderLineItem[] {
    const lineItems = ebayOrder.lineItems || [];
    return lineItems.map((li) => ({
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

      // H3: Incremental sync using lastSyncAt from connection record.
      // Uses lastModifiedDate filter when available (eBay best practice: never have gaps).
      // Falls back to 30-day window for initial sync.
      const connection = await this.prisma.marketplaceConnection.findUnique({
        where: { id: connectionId },
      });
      const lastSyncAt = connection?.lastSyncAt;

      let filterDate: string;
      let filterField: string;
      if (lastSyncAt) {
        // Incremental: use modification time since last sync (with 5-min overlap for safety)
        const overlapMs = 5 * 60 * 1000;
        filterDate = new Date(lastSyncAt.getTime() - overlapMs).toISOString();
        filterField = 'lastmodifieddate';
      } else {
        // Initial sync: 30-day window by creation date
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        filterDate = thirtyDaysAgo.toISOString();
        filterField = 'creationdate';
      }

      const PAGE_SIZE = 50;
      let offset = 0;
      let allEbayOrders: EbayOrder[] = [];

      // Paginate through all orders
      while (true) {
        const pageOrders = await this.ebayClient.getOrders(client, {
          filter: `${filterField}:[${filterDate}..],orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}`,
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
          const upsertedOrder = await this.prisma.marketplaceOrder.upsert({
            where: { tenantId_externalOrderId: { tenantId, externalOrderId } },
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
              itemsData: lineItems as unknown as Prisma.InputJsonValue,
              syncStatus: SyncStatus.SYNCED,
            },
            update: {
              externalStatus,
              paymentStatus,
              fulfillmentStatus,
              ...shippingAddress,
              ...financials,
              itemsData: lineItems as unknown as Prisma.InputJsonValue,
              syncStatus: SyncStatus.SYNCED,
              errorMessage: null,
            },
          });

          // Auto-create NoSlag Order for paid orders that aren't yet linked
          if (paymentStatus === 'PAID' && !upsertedOrder.orderId) {
            try {
              await this.createNoSlagOrder(tenantId, upsertedOrder.id);
            } catch (orderCreateError) {
              this.logger.warn(
                `Failed to create NoSlag order for marketplace order ${upsertedOrder.id}: ${orderCreateError?.message}`,
              );
              // Non-fatal: the marketplace order is still synced, NoSlag order can be created later
            }
          }

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
          errorMessage: error?.message || String(error) || 'Order sync failed',
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
    const where: Prisma.MarketplaceOrderWhereInput = { tenantId };
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

    return { orders: orders.map(this.enrichOrder), total };
  }

  /**
   * Enrich a raw MarketplaceOrder with a nested shippingAddress object
   * for frontend compatibility (frontend expects nested, Prisma stores flat).
   */
  private enrichOrder = (order: any) => ({
    ...order,
    shippingAddress: {
      name: order.shippingName,
      addressLine1: order.shippingStreet1,
      addressLine2: order.shippingStreet2,
      city: order.shippingCity,
      stateOrProvince: order.shippingState,
      postalCode: order.shippingPostalCode,
      countryCode: order.shippingCountry,
    },
  });

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

    return this.enrichOrder(order);
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
    const lineItems = (order.itemsData as MappedOrderLineItem[]).map((item) => ({
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
          errorMessage: `Fulfillment failed: ${error?.message || String(error)}`,
        },
      });

      throw error;
    }
  }

  /**
   * Issue a refund for a marketplace order via the eBay Fulfillment API.
   * Supports full-order refunds, partial amount refunds, and line-item-level refunds.
   */
  async issueRefund(
    tenantId: string,
    orderId: string,
    data: { amount?: number; comment?: string; lineItemIds?: string[] }
  ): Promise<Record<string, unknown>> {
    const order = await this.getOrder(tenantId, orderId);

    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Issued refund for order ${order.externalOrderId}: amount=${data.amount}, lineItems=${data.lineItemIds?.join(',') || 'all'}`
      );

      const newPaymentStatus = data.amount && data.amount < (order.total?.toNumber?.() || 0)
        ? 'PARTIALLY_REFUNDED'
        : 'REFUNDED';

      await this.prisma.marketplaceOrder.update({
        where: { id: orderId },
        data: {
          paymentStatus: newPaymentStatus,
          syncStatus: SyncStatus.SYNCED,
          errorMessage: null,
        },
      });

      return {
        refundId: `mock_refund_${Date.now()}`,
        orderId: order.externalOrderId,
        refundStatus: 'PENDING',
        amount: data.amount || order.total?.toNumber?.() || 0,
        comment: data.comment || null,
        createdDate: new Date().toISOString(),
      };
    }

    const client = await this.ebayStore.getClient(order.connectionId, tenantId);

    try {
      const refundPayload: Record<string, unknown> = {
        reasonForRefund: 'OTHER',
        comment: data.comment || 'Refund issued by seller',
      };

      if (data.lineItemIds && data.lineItemIds.length > 0) {
        // Line-item-level refund
        const lineItems = (order.itemsData as MappedOrderLineItem[]) || [];
        refundPayload.refundItems = data.lineItemIds.map((lineItemId) => {
          const lineItem = lineItems.find((li) => li.lineItemId === lineItemId);
          return {
            lineItemId,
            legacyReference: {
              legacyItemId: lineItem?.legacyItemId || '',
              legacyTransactionId: lineItem?.transactionId || '',
            },
          };
        });

        if (data.amount) {
          refundPayload.orderLevelRefundAmount = {
            value: data.amount.toFixed(2),
            currency: order.currency || 'USD',
          };
        }
      } else if (data.amount) {
        // Order-level partial refund
        refundPayload.orderLevelRefundAmount = {
          value: data.amount.toFixed(2),
          currency: order.currency || 'USD',
        };
      }

      // TODO: remove when ebay-api types are fixed
      const result = await (client.sell.fulfillment as any).issueRefund(
        order.externalOrderId,
        refundPayload
      );

      // Determine new payment status
      const orderTotal = order.total?.toNumber?.() || 0;
      const newPaymentStatus =
        data.amount && data.amount < orderTotal
          ? 'PARTIALLY_REFUNDED'
          : 'REFUNDED';

      await this.prisma.marketplaceOrder.update({
        where: { id: orderId },
        data: {
          paymentStatus: newPaymentStatus,
          syncStatus: SyncStatus.SYNCED,
          errorMessage: null,
        },
      });

      this.logger.log(
        `Issued refund for eBay order ${order.externalOrderId}: status=${newPaymentStatus}`
      );

      return {
        refundId: result?.refundId || null,
        orderId: order.externalOrderId,
        refundStatus: result?.refundStatus || 'PENDING',
        amount: data.amount || orderTotal,
        comment: data.comment || null,
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to issue refund for eBay order ${order.externalOrderId}`,
        error
      );

      await this.prisma.marketplaceOrder.update({
        where: { id: orderId },
        data: {
          syncStatus: SyncStatus.ERROR,
          errorMessage: `Refund failed: ${error?.message || String(error)}`,
        },
      });

      throw error;
    }
  }

  /**
   * Create a NoSlag Order record from a synced MarketplaceOrder.
   * Links the marketplace order to the core Order system so it appears in the
   * unified orders view, triggers inventory reservations, and can use existing
   * fulfillment workflows (pick, pack, ship).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma Order type varies by include/select
  async createNoSlagOrder(tenantId: string, marketplaceOrderId: string): Promise<any> {
    const mpOrder = await this.prisma.marketplaceOrder.findFirst({
      where: { id: marketplaceOrderId, tenantId },
      include: {
        connection: { select: { id: true, name: true, platform: true } },
      },
    });

    if (!mpOrder) {
      throw new NotFoundException(`Marketplace order ${marketplaceOrderId} not found`);
    }

    if (mpOrder.orderId) {
      // Already linked to a NoSlag order
      return this.prisma.order.findUnique({ where: { id: mpOrder.orderId } });
    }

    // Generate order number and create the order atomically
    const order = await this.prisma.$transaction(async (tx) => {
      // Lock the marketplace order row to prevent concurrent order creation
      const [locked] = await tx.$queryRaw<any[]>`
        SELECT * FROM marketplace_orders WHERE id = ${marketplaceOrderId} FOR UPDATE
      `;
      if (locked.orderId) return; // Already has an order

      // Atomic order number generation (same pattern as checkout service)
      const date = new Date();
      const prefix = `MKT-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
      const result = await tx.$queryRaw<any[]>`
        UPDATE tenants
        SET "nextOrderNumber" = "nextOrderNumber" + 1
        WHERE id = ${tenantId}
        RETURNING "nextOrderNumber"
      `;
      const seq = result[0]?.nextOrderNumber || 1;
      const orderNumber = `${prefix}-${String(seq).padStart(5, '0')}`;

      // Parse name parts from shippingName
      const nameParts = (mpOrder.shippingName || 'Unknown').split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Map eBay payment/fulfillment status to NoSlag enums
      const orderStatus =
        mpOrder.fulfillmentStatus === 'FULFILLED' ? 'SHIPPED' :
        mpOrder.paymentStatus === 'PAID' ? 'CONFIRMED' : 'PENDING';
      const paymentStatus =
        mpOrder.paymentStatus === 'PAID' ? 'CAPTURED' :
        mpOrder.paymentStatus === 'REFUNDED' ? 'REFUNDED' : 'PENDING';

      // Create the NoSlag Order
      const newOrder = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          email: mpOrder.buyerEmail || `${mpOrder.buyerUsername}@ebay.buyer`,
          shippingFirstName: firstName,
          shippingLastName: lastName,
          shippingAddressLine1: mpOrder.shippingStreet1,
          shippingAddressLine2: mpOrder.shippingStreet2,
          shippingCity: mpOrder.shippingCity,
          shippingState: mpOrder.shippingState,
          shippingPostalCode: mpOrder.shippingPostalCode,
          shippingCountry: mpOrder.shippingCountry,
          subtotal: mpOrder.subtotal,
          shippingTotal: mpOrder.shippingCost,
          taxTotal: mpOrder.taxAmount,
          grandTotal: mpOrder.total,
          currency: mpOrder.currency,
          status: orderStatus,
          paymentStatus,
          paymentMethod: 'marketplace',
          internalNotes: `Imported from ${mpOrder.connection.platform} (${mpOrder.connection.name}). External order: ${mpOrder.externalOrderId}`,
          confirmedAt: mpOrder.paymentStatus === 'PAID' ? mpOrder.paymentDate || mpOrder.orderDate : null,
        },
      });

      // Create OrderItem records from itemsData
      const lineItems = (mpOrder.itemsData as MappedOrderLineItem[]) || [];
      for (const item of lineItems) {
        // Try to find the matching ProductListing by SKU (stored as Item.code)
        let productId: string | null = null;
        if (item.sku) {
          const productListing = await tx.productListing.findFirst({
            where: { tenantId, item: { code: item.sku } },
          });
          if (productListing) {
            productId = productListing.id;
          }
        }

        await tx.orderItem.create({
          data: {
            tenantId,
            orderId: newOrder.id,
            productId,
            sku: item.sku || null,
            name: item.title || 'Unknown item',
            quantity: item.quantity || 1,
            unitPrice: new Decimal(item.unitPrice || '0'),
            totalPrice: new Decimal(item.unitPrice || '0').mul(item.quantity || 1),
          },
        });
      }

      // Link the MarketplaceOrder to the new Order
      await tx.marketplaceOrder.update({
        where: { id: marketplaceOrderId },
        data: {
          orderId: newOrder.id,
          syncedToOrderAt: new Date(),
          syncStatus: SyncStatus.SYNCED,
        },
      });

      return newOrder;
    });

    if (!order) {
      // Race condition: another transaction already created the order
      // Look up the marketplace order to get the orderId that was set by the other transaction
      const mpOrder = await this.prisma.marketplaceOrder.findUnique({
        where: { id: marketplaceOrderId },
        select: { orderId: true },
      });
      if (mpOrder?.orderId) {
        return this.prisma.order.findUnique({ where: { id: mpOrder.orderId } });
      }
      return null;
    }

    this.logger.log(
      `Created NoSlag order ${order.orderNumber} from marketplace order ${mpOrder.externalOrderId}`
    );

    return order;
  }

  /**
   * Scheduled sync: sync orders for all active connections with autoSyncOrders=true.
   * Runs outside of CLS context, so tenantId is read from each connection record.
   */
  private async syncAllActiveConnections() {
    // M4: Use distributed lock to prevent concurrent order sync across instances
    const result = await this.distributedLock.withLock('ebay:order-sync', 600, async () => {
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
        }
      }
    });

    if (result === null) {
      this.logger.warn('Order sync already in progress on another instance, skipping this tick');
    }
  }

  /**
   * Acquire a per-SKU lock to prevent concurrent read-modify-write on the same inventory item.
   * Returns a release function.
   */
  private async acquireSkuLock(sku: string): Promise<() => void> {
    // Wait for any existing lock on this SKU
    while (this.inventoryLocks.has(sku)) {
      await this.inventoryLocks.get(sku);
    }
    let release: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.inventoryLocks.set(sku, lockPromise);
    return () => {
      this.inventoryLocks.delete(sku);
      release!();
    };
  }

  /**
   * Update inventory for a single listing with SKU-level locking.
   * Prevents concurrent read-modify-write race conditions.
   */
  private async syncListingInventoryWithLock(
    connection: { id: string; tenantId: string },
    listing: { id: string; sku: string; warehouseId: string | null; productListing: { itemId: string } | null }
  ): Promise<void> {
    if (!listing.warehouseId || !listing.productListing) return;

    const release = await this.acquireSkuLock(listing.sku);
    try {
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
        `Inventory sync: updated listing ${listing.id} (SKU ${listing.sku}) to qty ${availableQty}`
      );
    } finally {
      release();
    }
  }

  /**
   * Scheduled inventory sync: sync inventory for all active connections with autoSyncInventory=true.
   * Runs outside of CLS context, so tenantId is read from each connection record.
   */
  private async syncAllActiveInventory() {
    // M4: Use distributed lock to prevent concurrent inventory sync across instances
    const result = await this.distributedLock.withLock('ebay:inventory-sync', 1200, async () => {
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
          const listings = await this.prisma.marketplaceListing.findMany({
            where: {
              connectionId: connection.id,
              tenantId: connection.tenantId,
              status: ListingStatus.PUBLISHED,
              externalOfferId: { not: null },
              warehouseId: { not: null },
            },
            include: {
              productListing: { select: { itemId: true } },
            },
          });

          for (const listing of listings) {
            try {
              await this.syncListingInventoryWithLock(connection, listing);
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
        }
      }
    });

    if (result === null) {
      this.logger.warn('Inventory sync already in progress on another instance, skipping this tick');
    }
  }
}
