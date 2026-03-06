import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../../operations/audit-log.service';
import { ClsService } from 'nestjs-cls';

/**
 * Marketplace Audit Service
 * Provides audit logging for marketplace-specific operations
 */
@Injectable()
export class MarketplaceAuditService {
  private readonly logger = new Logger(MarketplaceAuditService.name);

  constructor(
    private auditLog: AuditLogService,
    private cls: ClsService
  ) {}

  /**
   * Get current context from CLS.
   * Returns undefined values when called outside of a CLS context
   * (e.g. scheduled jobs). Callers should wrap audit calls in try/catch.
   */
  private getContext() {
    try {
      const tenantId = this.cls.get('tenantId');
      const userId = this.cls.get('userId');
      return { tenantId, userId };
    } catch {
      return { tenantId: undefined, userId: undefined };
    }
  }

  /**
   * Log connection created
   */
  async logConnectionCreated(connectionId: string, connectionName: string, platform: string) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'CREATE',
      docType: 'MarketplaceConnection',
      docName: connectionName,
      meta: {
        connectionId,
        platform,
      },
    });
  }

  /**
   * Log connection disconnected
   */
  async logConnectionDisconnected(connectionId: string, connectionName: string) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'DISCONNECT',
      docType: 'MarketplaceConnection',
      docName: connectionName,
      meta: {
        connectionId,
      },
    });
  }

  /**
   * Log connection deleted
   */
  async logConnectionDeleted(connectionId: string, connectionName: string) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'DELETE',
      docType: 'MarketplaceConnection',
      docName: connectionName,
      meta: {
        connectionId,
      },
    });
  }

  /**
   * Log OAuth connected
   */
  async logOAuthConnected(connectionId: string, connectionName: string, platform: string) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'OAUTH_CONNECTED',
      docType: 'MarketplaceConnection',
      docName: connectionName,
      meta: {
        connectionId,
        platform,
      },
    });
  }

  /**
   * Log listing created
   */
  async logListingCreated(listingId: string, listingTitle: string, connectionName: string) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'CREATE',
      docType: 'MarketplaceListing',
      docName: listingTitle,
      meta: {
        listingId,
        connectionName,
      },
    });
  }

  /**
   * Log listing published
   */
  async logListingPublished(
    listingId: string,
    listingTitle: string,
    externalListingId: string,
    platform: string
  ) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'PUBLISH',
      docType: 'MarketplaceListing',
      docName: listingTitle,
      meta: {
        listingId,
        externalListingId,
        platform,
      },
    });
  }

  /**
   * Log listing ended
   */
  async logListingEnded(listingId: string, listingTitle: string, platform: string) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'END_LISTING',
      docType: 'MarketplaceListing',
      docName: listingTitle,
      meta: {
        listingId,
        platform,
      },
    });
  }

  /**
   * Log listing deleted
   */
  async logListingDeleted(listingId: string, listingTitle: string) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'DELETE',
      docType: 'MarketplaceListing',
      docName: listingTitle,
      meta: {
        listingId,
      },
    });
  }

  /**
   * Log listing approved
   */
  async logListingApproved(listingId: string, listingTitle: string, approvedById: string) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'APPROVE',
      docType: 'MarketplaceListing',
      docName: listingTitle,
      meta: {
        listingId,
        approvedById,
      },
    });
  }

  /**
   * Log listing rejected
   */
  async logListingRejected(
    listingId: string,
    listingTitle: string,
    rejectedById: string,
    reason: string
  ) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'REJECT',
      docType: 'MarketplaceListing',
      docName: listingTitle,
      meta: {
        listingId,
        rejectedById,
        reason,
      },
    });
  }

  /**
   * Log inventory synced
   */
  async logInventorySynced(listingId: string, listingTitle: string, newQuantity: number) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'SYNC_INVENTORY',
      docType: 'MarketplaceListing',
      docName: listingTitle,
      meta: {
        listingId,
        newQuantity,
      },
    });
  }

  async logReturnProcessed(returnId: string, action: string, details?: Record<string, any>) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action,
      docType: 'MarketplaceReturn',
      docName: returnId,
      meta: { returnId, ...details },
    });
  }

  async logMessageSent(threadId: string, recipient: string) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'REPLY',
      docType: 'MarketplaceMessage',
      docName: threadId,
      meta: { threadId, recipient },
    });
  }

  async logCampaignAction(campaignId: string, campaignName: string, action: string) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action,
      docType: 'MarketplaceCampaign',
      docName: campaignName,
      meta: { campaignId },
    });
  }

  async logWebhookProcessed(type: string, details: Record<string, any>) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action: 'WEBHOOK_PROCESSED',
      docType: 'EbayWebhook',
      docName: type,
      meta: details,
    });
  }

  async logFeedbackAction(feedbackId: string, action: string, details?: Record<string, any>) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action,
      docType: 'MarketplaceFeedback',
      docName: feedbackId,
      meta: { feedbackId, ...details },
    });
  }

  async logShipmentAction(shipmentId: string, action: string, details?: Record<string, any>) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action,
      docType: 'MarketplaceShipment',
      docName: shipmentId,
      meta: { shipmentId, ...details },
    });
  }

  async logBulkOperation(taskId: string, action: string, details?: Record<string, any>) {
    const ctx = this.getContext();
    await this.auditLog.log(ctx, {
      action,
      docType: 'MarketplaceBulkTask',
      docName: taskId,
      meta: { taskId, ...details },
    });
  }
}
