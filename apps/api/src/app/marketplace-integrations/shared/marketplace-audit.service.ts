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
   * Get current context from CLS
   */
  private getContext() {
    const tenantId = this.cls.get('tenantId');
    const userId = this.cls.get('userId');
    return { tenantId, userId };
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
}
