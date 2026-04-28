import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { bypassTenantGuard, runWithTenant } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';
import { DistributedLockService } from '../shared/distributed-lock.service';
import {
  SyncType,
  SyncDirection,
  SyncLogStatus,
  SyncStatus,
  MessageThreadStatus,
  MessageSender,
} from '../shared/marketplace.types';
import { Prisma } from '@prisma/client';

interface SyncResult {
  syncLogId: string;
  itemsTotal: number;
  itemsSuccess: number;
  itemsFailed: number;
}

/**
 * eBay Messaging Service
 * Handles syncing buyer-seller messages from eBay Trading API (SOAP),
 * querying local message threads, and sending replies.
 */
@Injectable()
export class EbayMessagingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EbayMessagingService.name);
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private audit: MarketplaceAuditService,
    private distributedLock: DistributedLockService
  ) {}

  onModuleInit() {
    if (process.env.ENABLE_SCHEDULED_TASKS === 'false') {
      this.logger.log('Scheduled tasks disabled via ENABLE_SCHEDULED_TASKS=false');
      return;
    }
    this.syncInterval = setInterval(
      () => this.syncAllActiveMessages(),
      this.SYNC_INTERVAL_MS
    );
    this.logger.log('eBay message sync scheduler started (every 10 minutes)');
  }

  onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Scheduled sync: sync messages for all active connections with autoSyncOrders=true.
   * Runs outside of CLS context, so tenantId is read from each connection record.
   */
  private async syncAllActiveMessages() {
    // M4: Use distributed lock to prevent concurrent message sync across instances
    const result = await this.distributedLock.withLock('ebay:message-sync', 300, async () => {
      const connections = await bypassTenantGuard(() =>
        this.prisma.marketplaceConnection.findMany({
          where: {
            platform: 'EBAY',
            isActive: true,
            isConnected: true,
            autoSyncOrders: true,
          },
        }),
      );

      this.logger.log(
        `Scheduled message sync: found ${connections.length} active connection(s)`
      );

      for (const connection of connections) {
        try {
          await runWithTenant(connection.tenantId, () =>
            this.syncMessages(connection.tenantId, connection.id),
          );
        } catch (error) {
          this.logger.error(
            `Scheduled message sync failed for connection ${connection.id} (tenant ${connection.tenantId})`,
            error
          );
        }
      }
    });

    if (result === null) {
      this.logger.warn('Message sync already in progress on another instance, skipping this tick');
    }
  }

  /**
   * Fetch messages from eBay Trading API GetMyMessages and upsert threads/messages locally.
   * tenantId is passed explicitly so this works both from CLS-based requests and scheduled jobs.
   */
  async syncMessages(tenantId: string, connectionId: string): Promise<SyncResult> {
    const startedAt = new Date();
    let itemsTotal = 0;
    let itemsSuccess = 0;
    let itemsFailed = 0;

    // Create sync log entry
    const syncLog = await this.prisma.marketplaceSyncLog.create({
      data: {
        tenantId,
        connectionId,
        syncType: SyncType.ORDER_SYNC, // Reuse existing type; messages piggyback on order sync type
        direction: SyncDirection.FROM_MARKETPLACE,
        status: SyncLogStatus.SUCCESS,
        startedAt,
        details: 'Message sync initiated',
      },
    });

    try {
      const ebayMessages = await this.fetchMessagesFromEbay(connectionId, tenantId);
      itemsTotal = ebayMessages.length;

      for (const msg of ebayMessages) {
        try {
          await this.upsertMessageThread(tenantId, connectionId, msg);
          itemsSuccess++;
        } catch (msgError) {
          itemsFailed++;
          this.logger.error(
            `Failed to sync eBay message ${msg.MessageID || 'unknown'}`,
            msgError
          );
        }
      }

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
          details: `Synced ${itemsSuccess}/${itemsTotal} messages from eBay`,
        },
      });

      this.logger.log(
        `Message sync complete for connection ${connectionId}: ${itemsSuccess}/${itemsTotal} succeeded`
      );

      return {
        syncLogId: syncLog.id,
        itemsTotal,
        itemsSuccess,
        itemsFailed,
      };
    } catch (error) {
      this.logger.error(
        `Message sync failed for connection ${connectionId}`,
        error
      );

      await this.prisma.marketplaceSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: SyncLogStatus.FAILED,
          itemsTotal,
          itemsSuccess,
          itemsFailed,
          completedAt: new Date(),
          errorMessage: error?.message || String(error) || 'Message sync failed',
          details: 'Message sync failed with an unexpected error',
        },
      });

      throw error;
    }
  }

  /**
   * Fetch messages from eBay Trading API GetMyMessages.
   * In mock mode, returns synthetic message data.
   */
  private async fetchMessagesFromEbay(
    connectionId: string,
    tenantId: string
  ): Promise<any[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched mock messages for connection ${connectionId}`);
      return this.getMockMessages();
    }

    const client = await this.ebayStore.getClient(connectionId, tenantId);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const response = await (client as any).trading.GetMyMessages({
        Folder: 'Inbox',
        StartTime: thirtyDaysAgo.toISOString(),
        DetailLevel: 'ReturnMessages',
      });

      const messages = response?.Messages?.Message;
      if (!messages) {
        return [];
      }

      // Normalize to array (eBay may return a single object or an array)
      return Array.isArray(messages) ? messages : [messages];
    } catch (error) {
      this.logger.error(
        `Failed to fetch messages from eBay Trading API for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Upsert a MarketplaceMessageThread and its corresponding MarketplaceMessage
   * from an eBay Trading API message object.
   */
  private async upsertMessageThread(
    tenantId: string,
    connectionId: string,
    ebayMessage: any
  ) {
    const externalMessageId = ebayMessage.MessageID || ebayMessage.ExternalMessageID;
    if (!externalMessageId) {
      throw new Error('eBay message missing MessageID');
    }

    // Determine thread identity: use ExternalMessageID as thread grouping key,
    // fall back to MessageID if ExternalMessageID is absent.
    const externalThreadId =
      ebayMessage.ExternalMessageID || ebayMessage.MessageID;

    const sender = ebayMessage.Sender || 'unknown';
    const subject = ebayMessage.Subject || '(No Subject)';
    const body = ebayMessage.Text || ebayMessage.Body || '';
    const itemId = ebayMessage.ItemID || null;
    const itemTitle = ebayMessage.ItemTitle || null;
    const sentDate = ebayMessage.ReceiveDate
      ? new Date(ebayMessage.ReceiveDate)
      : new Date();

    // Determine if this message is from the buyer or seller
    const senderType = ebayMessage.MessageType === 'AskSellerQuestion'
      ? MessageSender.BUYER
      : ebayMessage.Sender === 'eBay'
        ? MessageSender.BUYER
        : MessageSender.SELLER;

    // Upsert the thread
    const thread = await this.prisma.marketplaceMessageThread.upsert({
      where: { externalThreadId },
      create: {
        tenantId,
        connectionId,
        externalThreadId,
        externalItemId: itemId,
        itemTitle,
        buyerUsername: sender,
        subject,
        isRead: false,
        status: MessageThreadStatus.OPEN,
        messageCount: 1,
        lastMessageDate: sentDate,
        syncStatus: SyncStatus.SYNCED,
      },
      update: {
        lastMessageDate: sentDate,
        syncStatus: SyncStatus.SYNCED,
        errorMessage: null,
        // Increment message count and update status only if the thread already exists
        messageCount: { increment: 0 }, // Will be corrected below after message upsert
      },
    });

    // Upsert the individual message (scoped by tenantId)
    const existingMessage = await this.prisma.marketplaceMessage.findUnique({
      where: {
        tenantId_externalMessageId: { tenantId, externalMessageId },
      },
    });

    if (!existingMessage) {
      await this.prisma.marketplaceMessage.create({
        data: {
          tenantId,
          threadId: thread.id,
          externalMessageId,
          sender: senderType,
          body,
          sentDate,
        },
      });

      // Recalculate message count from actual records
      const messageCount = await this.prisma.marketplaceMessage.count({
        where: { threadId: thread.id },
      });

      await this.prisma.marketplaceMessageThread.update({
        where: { id: thread.id },
        data: {
          messageCount,
          // Mark unread if a new buyer message arrived
          ...(senderType === MessageSender.BUYER ? { isRead: false, status: MessageThreadStatus.OPEN } : {}),
        },
      });
    }
  }

  /**
   * Return mock eBay messages for development/testing.
   */
  private getMockMessages(): any[] {
    const now = new Date();
    return [
      {
        MessageID: 'mock_msg_001',
        ExternalMessageID: 'mock_thread_001',
        Sender: 'mock_buyer_jane',
        Subject: 'Question about item condition',
        Text: 'Hi, is this item in new condition? Any scratches?',
        ItemID: '110123456789',
        ItemTitle: 'Vintage Watch - Excellent Condition',
        ReceiveDate: new Date(now.getTime() - 3600000).toISOString(),
        MessageType: 'AskSellerQuestion',
      },
      {
        MessageID: 'mock_msg_002',
        ExternalMessageID: 'mock_thread_002',
        Sender: 'mock_buyer_john',
        Subject: 'Shipping question',
        Text: 'Do you ship internationally? Specifically to Canada.',
        ItemID: '110987654321',
        ItemTitle: 'Collectible Card Set - Complete',
        ReceiveDate: new Date(now.getTime() - 7200000).toISOString(),
        MessageType: 'AskSellerQuestion',
      },
      {
        MessageID: 'mock_msg_003',
        ExternalMessageID: 'mock_thread_003',
        Sender: 'mock_buyer_alice',
        Subject: 'Bundle discount?',
        Text: 'Would you offer a discount if I buy 3 items from your store?',
        ItemID: '110111222333',
        ItemTitle: 'Handmade Ceramic Mug',
        ReceiveDate: now.toISOString(),
        MessageType: 'AskSellerQuestion',
      },
    ];
  }

  /**
   * Query message threads from the local database with filters and pagination.
   */
  async getThreads(
    tenantId: string,
    filters?: {
      connectionId?: string;
      status?: string;
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ threads: any[]; total: number }> {
    const where: Prisma.MarketplaceMessageThreadWhereInput = { tenantId };

    if (filters?.connectionId) where.connectionId = filters.connectionId;
    if (filters?.status) where.status = filters.status;
    if (filters?.unreadOnly) where.isRead = false;

    const [threads, total] = await Promise.all([
      this.prisma.marketplaceMessageThread.findMany({
        where,
        include: {
          connection: {
            select: { id: true, name: true, platform: true, marketplaceId: true },
          },
          messages: {
            orderBy: { sentDate: 'desc' },
            take: 1, // Include latest message preview
          },
        },
        orderBy: { lastMessageDate: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      this.prisma.marketplaceMessageThread.count({ where }),
    ]);

    return { threads, total };
  }

  /**
   * Get a single message thread with all messages.
   */
  async getThread(tenantId: string, threadId: string): Promise<any> {
    const thread = await this.prisma.marketplaceMessageThread.findFirst({
      where: { id: threadId, tenantId },
      include: {
        connection: {
          select: { id: true, name: true, platform: true, marketplaceId: true },
        },
        messages: {
          orderBy: { sentDate: 'asc' },
        },
      },
    });

    if (!thread) {
      throw new NotFoundException(`Message thread ${threadId} not found`);
    }

    return thread;
  }

  /**
   * Send a reply to a message thread via eBay Trading API AddMemberMessageAAQToPartner.
   * Creates a local MarketplaceMessage record and updates thread status.
   */
  async replyToMessage(
    tenantId: string,
    threadId: string,
    body: string
  ): Promise<void> {
    const thread = await this.getThread(tenantId, threadId);

    // Send via eBay Trading API
    await this.sendReplyToEbay(thread.connectionId, thread, body, tenantId);

    // Create local message record
    const externalMessageId = `reply_${thread.id}_${Date.now()}`;
    await this.prisma.marketplaceMessage.create({
      data: {
        tenantId,
        threadId: thread.id,
        externalMessageId,
        sender: MessageSender.SELLER,
        body,
        sentDate: new Date(),
      },
    });

    // Update thread status and count
    const messageCount = await this.prisma.marketplaceMessage.count({
      where: { threadId: thread.id },
    });

    await this.prisma.marketplaceMessageThread.update({
      where: { id: thread.id },
      data: {
        status: MessageThreadStatus.RESPONDED,
        messageCount,
        lastMessageDate: new Date(),
        isRead: true,
      },
    });

    // Audit log
    try {
      await this.audit.logMessageSent(threadId, thread.buyerUsername);
    } catch {
      // Audit logging is best-effort; don't fail the reply
    }

    this.logger.log(
      `Replied to message thread ${threadId} (buyer: ${thread.buyerUsername})`
    );
  }

  /**
   * Send reply via eBay Trading API.
   * In mock mode, logs the operation without making an API call.
   */
  private async sendReplyToEbay(
    connectionId: string,
    thread: any,
    body: string,
    tenantId: string
  ): Promise<void> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Sent reply to buyer ${thread.buyerUsername} for thread ${thread.id}`
      );
      return;
    }

    const client = await this.ebayStore.getClient(connectionId, tenantId);

    try {
      await (client as any).trading.AddMemberMessageAAQToPartner({
        ItemID: thread.externalItemId,
        MemberMessage: {
          Body: body,
          RecipientID: thread.buyerUsername,
          Subject: thread.subject,
          QuestionType: 'General',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send reply via eBay Trading API for thread ${thread.id}`,
        error
      );
      throw error;
    }
  }

  /**
   * Mark a message thread as read locally.
   */
  async markAsRead(tenantId: string, threadId: string): Promise<void> {
    const thread = await this.prisma.marketplaceMessageThread.findFirst({
      where: { id: threadId, tenantId },
    });

    if (!thread) {
      throw new NotFoundException(`Message thread ${threadId} not found`);
    }

    await this.prisma.marketplaceMessageThread.update({
      where: { id: threadId },
      data: { isRead: true },
    });

    this.logger.log(`Marked thread ${threadId} as read`);
  }

  /**
   * Get count of unread message threads, optionally filtered by connection.
   */
  async getUnreadCount(
    tenantId: string,
    connectionId?: string
  ): Promise<number> {
    const where: Prisma.MarketplaceMessageThreadWhereInput = {
      tenantId,
      isRead: false,
    };

    if (connectionId) where.connectionId = connectionId;

    return this.prisma.marketplaceMessageThread.count({ where });
  }
}
