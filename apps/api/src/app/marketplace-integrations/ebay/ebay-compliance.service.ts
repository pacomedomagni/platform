import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { bypassTenantGuard, runWithTenant } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';
import { Prisma } from '@prisma/client';

interface SyncResult {
  syncLogId: string;
  itemsTotal: number;
  itemsSuccess: number;
  itemsFailed: number;
}

/**
 * eBay Compliance Service
 * Monitors listing compliance violations via the eBay Sell Compliance API.
 * Supports fetching violations, summaries, suppression, and scheduled hourly syncing.
 */
@Injectable()
export class EbayComplianceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EbayComplianceService.name);
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';
  private isSyncing = false;

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private audit: MarketplaceAuditService
  ) {}

  onModuleInit() {
    if (process.env.ENABLE_SCHEDULED_TASKS === 'false') {
      this.logger.log('Scheduled tasks disabled via ENABLE_SCHEDULED_TASKS=false');
      return;
    }
    this.syncInterval = setInterval(
      () => this.syncAllActiveViolations(),
      this.SYNC_INTERVAL_MS
    );
    this.logger.log('eBay compliance violation sync scheduler started (every 60 minutes)');
  }

  onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Scheduled sync: sync violations for all active connections.
   * Runs outside of CLS context, so tenantId is read from each connection record.
   */
  private async syncAllActiveViolations() {
    if (this.isSyncing) {
      this.logger.warn('Compliance sync already in progress, skipping this tick');
      return;
    }
    this.isSyncing = true;
    try {
      const connections = await bypassTenantGuard(() =>
        this.prisma.marketplaceConnection.findMany({
          where: {
            platform: 'EBAY',
            isActive: true,
            isConnected: true,
          },
        }),
      );

      this.logger.log(
        `Scheduled compliance sync: found ${connections.length} active connection(s)`
      );

      for (const connection of connections) {
        try {
          await runWithTenant(connection.tenantId, () =>
            this.syncViolations(connection.tenantId, connection.id),
          );
        } catch (error) {
          this.logger.error(
            `Scheduled compliance sync failed for connection ${connection.id} (tenant ${connection.tenantId})`,
            error
          );
          // Continue to next connection on failure
        }
      }
    } catch (error) {
      this.logger.error('Scheduled compliance sync global error', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Fetch listing violations from eBay Sell Compliance API.
   * Returns raw violation data from eBay, optionally filtered by compliance type.
   */
  async getViolations(
    connectionId: string,
    tenantId: string,
    complianceType?: string
  ): Promise<any> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Returning mock violations for connection ${connectionId}${complianceType ? ` (type: ${complianceType})` : ''}`
      );
      return this.getMockViolations(complianceType);
    }

    const client = await this.ebayStore.getClient(connectionId, tenantId);

    try {
      const params: any = {};
      if (complianceType) {
        params.compliance_type = complianceType;
      }

      const response = await (client.sell as any).compliance.getListingViolations(params);

      this.logger.log(
        `Fetched violations for connection ${connectionId}${complianceType ? ` (type: ${complianceType})` : ''}`
      );

      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch violations for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get violation count summary grouped by compliance type
   * (PRODUCT_ADOPTION, LISTING_VIOLATION, etc.).
   */
  async getViolationSummary(
    connectionId: string,
    tenantId: string
  ): Promise<any> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Returning mock violation summary for connection ${connectionId}`
      );
      return this.getMockViolationSummary();
    }

    const client = await this.ebayStore.getClient(connectionId, tenantId);

    try {
      const response = await (client.sell as any).compliance.getListingViolationsSummary();

      this.logger.log(`Fetched violation summary for connection ${connectionId}`);

      return response;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch violation summary for connection ${connectionId}: ${error?.message || String(error)}`,
        error
      );
      throw error;
    }
  }

  /**
   * Suppress a known violation for a listing on eBay.
   */
  async suppressViolation(
    connectionId: string,
    tenantId: string,
    listingId: string,
    complianceType?: string
  ): Promise<void> {
    await this.ebayStore.getConnection(connectionId, tenantId);

    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Suppressed violation for listing ${listingId} on connection ${connectionId}`
      );
    } else {
      const client = await this.ebayStore.getClient(connectionId, tenantId);

      try {
        await (client.sell as any).compliance.suppressViolation({
          complianceType: complianceType || 'LISTING_VIOLATION',
          listingId,
        });

        this.logger.log(
          `Suppressed violation for listing ${listingId} on connection ${connectionId}`
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to suppress violation for listing ${listingId}: ${error?.message || String(error)}`,
          error
        );
        throw error;
      }
    }

    // Update local violation status if it exists
    await this.prisma.marketplaceViolation.updateMany({
      where: {
        connectionId,
        listingId,
        tenantId,
        status: 'OPEN',
      },
      data: {
        status: 'SUPPRESSED',
      },
    });

    try {
      await this.audit.logReturnProcessed(listingId, 'SUPPRESS_VIOLATION', {
        connectionId,
        listingId,
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Sync violations from eBay and store/upsert them in the MarketplaceViolation table.
   * tenantId is passed explicitly so this works both from CLS-based requests and scheduled jobs.
   */
  async syncViolations(tenantId: string, connectionId: string): Promise<SyncResult> {
    const startedAt = new Date();
    let itemsTotal = 0;
    let itemsSuccess = 0;
    let itemsFailed = 0;

    // Create sync log entry
    const syncLog = await this.prisma.marketplaceSyncLog.create({
      data: {
        tenantId,
        connectionId,
        syncType: 'inventory_sync', // Compliance violations relate to listing/inventory health
        direction: 'from_marketplace',
        status: 'success',
        startedAt,
        details: 'Compliance violation sync started',
      },
    });

    try {
      if (this.mockMode) {
        this.logger.log(`[MOCK] Compliance sync for connection ${connectionId}: 0 violations`);
        await this.prisma.marketplaceSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'success',
            itemsTotal: 0,
            itemsSuccess: 0,
            itemsFailed: 0,
            completedAt: new Date(),
            details: '[MOCK] Compliance sync complete — 0 violations',
          },
        });
        return { syncLogId: syncLog.id, itemsTotal: 0, itemsSuccess: 0, itemsFailed: 0 };
      }

      const client = await this.ebayStore.getClient(connectionId, tenantId);

      // Fetch violations for all compliance types
      const complianceTypes = [
        'PRODUCT_ADOPTION',
        'LISTING_VIOLATION',
        'PRODUCT_ADOPTION_AT_RISK',
        'LISTING_VIOLATION_AT_RISK',
      ];

      let allViolations: any[] = [];

      for (const complianceType of complianceTypes) {
        try {
          const response = await (client.sell as any).compliance.getListingViolations({
            compliance_type: complianceType,
          });

          const violations = response?.listingViolations || [];
          for (const v of violations) {
            allViolations.push({ ...v, complianceType });
          }
        } catch (apiError: any) {
          // Some compliance types may not be available for the seller
          this.logger.warn(
            `Compliance API fetch failed for type ${complianceType} on connection ${connectionId}: ${apiError?.message || String(apiError)}`
          );
        }
      }

      itemsTotal = allViolations.length;

      for (const violation of allViolations) {
        try {
          const externalViolationId =
            violation.violationId ||
            `${violation.complianceType}_${violation.listingId || 'unknown'}_${violation.reasonCode || 'unknown'}`;

          const listingId = violation.listingId || null;
          const reasonCode = violation.reasonCode || violation.violations?.[0]?.reasonCode || 'UNKNOWN';
          const message =
            violation.message ||
            violation.violations?.[0]?.message ||
            'Compliance violation detected';
          const severity = violation.severity || 'WARNING';

          await this.prisma.marketplaceViolation.upsert({
            where: { externalViolationId },
            create: {
              tenantId,
              connectionId,
              externalViolationId,
              complianceType: violation.complianceType,
              listingId,
              reasonCode,
              message,
              severity,
              violationData: violation as any,
              status: 'OPEN',
            },
            update: {
              complianceType: violation.complianceType,
              reasonCode,
              message,
              severity,
              violationData: violation as any,
              // Don't overwrite status if already SUPPRESSED or RESOLVED
            },
          });

          itemsSuccess++;
        } catch (violationError) {
          itemsFailed++;
          this.logger.error(
            `Failed to sync violation ${violation.violationId || 'unknown'}`,
            violationError
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
          ? 'success'
          : itemsSuccess > 0
            ? 'partial'
            : 'failed';

      await this.prisma.marketplaceSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status,
          itemsTotal,
          itemsSuccess,
          itemsFailed,
          completedAt: new Date(),
          details: `Synced ${itemsSuccess}/${itemsTotal} compliance violations from eBay`,
        },
      });

      this.logger.log(
        `Compliance sync complete for connection ${connectionId}: ${itemsSuccess}/${itemsTotal} succeeded`
      );

      return {
        syncLogId: syncLog.id,
        itemsTotal,
        itemsSuccess,
        itemsFailed,
      };
    } catch (error) {
      this.logger.error(`Compliance sync failed for connection ${connectionId}`, error);

      await this.prisma.marketplaceSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          itemsTotal,
          itemsSuccess,
          itemsFailed,
          completedAt: new Date(),
          errorMessage: error?.message || String(error) || 'Compliance sync failed',
          details: 'Compliance sync failed with an unexpected error',
        },
      });

      throw error;
    }
  }

  /**
   * Get locally synced violations from the database.
   */
  async getLocalViolations(
    tenantId: string,
    filters?: {
      connectionId?: string;
      complianceType?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ violations: any[]; total: number }> {
    const where: Prisma.MarketplaceViolationWhereInput = { tenantId };
    if (filters?.connectionId) where.connectionId = filters.connectionId;
    if (filters?.complianceType) where.complianceType = filters.complianceType;
    if (filters?.status) where.status = filters.status;

    const [violations, total] = await Promise.all([
      this.prisma.marketplaceViolation.findMany({
        where,
        include: {
          connection: {
            select: { id: true, name: true, platform: true, marketplaceId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      this.prisma.marketplaceViolation.count({ where }),
    ]);

    return { violations, total };
  }

  /**
   * Return mock violations for development/testing.
   */
  private getMockViolations(complianceType?: string): any {
    const violations = [
      {
        violationId: 'mock_violation_001',
        complianceType: 'PRODUCT_ADOPTION',
        listingId: '110123456789',
        reasonCode: 'MISSING_PRODUCT_IDENTIFIERS',
        message: 'This listing is missing required product identifiers (UPC, EAN, or ISBN).',
        severity: 'WARNING',
      },
      {
        violationId: 'mock_violation_002',
        complianceType: 'LISTING_VIOLATION',
        listingId: '110987654321',
        reasonCode: 'MISSING_ITEM_SPECIFICS',
        message: 'Required item specifics are missing: Brand, MPN.',
        severity: 'ERROR',
      },
      {
        violationId: 'mock_violation_003',
        complianceType: 'LISTING_VIOLATION',
        listingId: '110111222333',
        reasonCode: 'POLICY_VIOLATION',
        message: 'Listing description contains prohibited content.',
        severity: 'ERROR',
      },
    ];

    if (complianceType) {
      return {
        listingViolations: violations.filter(v => v.complianceType === complianceType),
      };
    }

    return { listingViolations: violations };
  }

  /**
   * Return mock violation summary for development/testing.
   */
  private getMockViolationSummary(): any {
    return {
      violationSummaries: [
        {
          complianceType: 'PRODUCT_ADOPTION',
          marketplaceId: 'EBAY_US',
          listingCount: 3,
        },
        {
          complianceType: 'LISTING_VIOLATION',
          marketplaceId: 'EBAY_US',
          listingCount: 5,
        },
        {
          complianceType: 'PRODUCT_ADOPTION_AT_RISK',
          marketplaceId: 'EBAY_US',
          listingCount: 1,
        },
        {
          complianceType: 'LISTING_VIOLATION_AT_RISK',
          marketplaceId: 'EBAY_US',
          listingCount: 0,
        },
      ],
    };
  }
}
