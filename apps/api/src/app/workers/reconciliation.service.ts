import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@platform/db';
import { DistributedLockService } from '@platform/queue';

/**
 * Phase 3 W3.8: inventory reconciliation.
 *
 * For every (tenantId, itemId, warehouseId) we compare the sum of the
 * BinBalance rows against the WarehouseItemBalance row that's supposed to
 * be the rolled-up total. Any divergence is surfaced via a structured log
 * entry and persisted in the audit log so it shows up in admin UI / ops
 * dashboards.
 *
 * The audit's prior finding was that no such reconciliation existed. With
 * tens of thousands of inventory writes per day, even a tiny percentage
 * of write-paths drifting will eventually snowball; the daily cross-check
 * gives us a chance to catch drift before it becomes a customer-facing
 * stockout.
 */
@Injectable()
export class InventoryReconciliationService {
  private readonly logger = new Logger(InventoryReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lockService: DistributedLockService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async reconcileInventory(): Promise<{ totalChecked: number; totalDrifted: number } | null> {
    return this.lockService.withLock(
      'cron:reconciliation:inventory',
      30 * 60_000,
      () => this.runReconciliation(),
    );
  }

  private async runReconciliation(): Promise<{ totalChecked: number; totalDrifted: number }> {
    this.logger.log('Starting inventory reconciliation...');

    type Drift = {
      tenantId: string;
      itemId: string;
      warehouseId: string;
      warehouseTotal: string;
      binSum: string;
      delta: string;
    };

    // One SQL pass: GROUP BY (tenantId, itemId, warehouseId), compare
    // SUM(bin_balances.actualQty) to warehouse_item_balances.actualQty.
    // Result rows are only the (tenantId, itemId, warehouseId) tuples
    // where the two diverge by more than 0.000001 (sub-µ rounding noise).
    const drifts = await this.prisma.$queryRaw<Drift[]>`
      WITH bin_sums AS (
        SELECT
          "tenantId",
          "itemId",
          "warehouseId",
          SUM("actualQty") AS "binSum"
        FROM bin_balances
        GROUP BY "tenantId", "itemId", "warehouseId"
      )
      SELECT
        wib."tenantId",
        wib."itemId",
        wib."warehouseId",
        wib."actualQty"::text          AS "warehouseTotal",
        COALESCE(bs."binSum", 0)::text AS "binSum",
        (wib."actualQty" - COALESCE(bs."binSum", 0))::text AS "delta"
      FROM warehouse_item_balances wib
      LEFT JOIN bin_sums bs USING ("tenantId", "itemId", "warehouseId")
      WHERE ABS(wib."actualQty" - COALESCE(bs."binSum", 0)) > 0.000001
    `;

    if (drifts.length === 0) {
      this.logger.log('Reconciliation complete — no drift detected');
      return { totalChecked: 1, totalDrifted: 0 };
    }

    this.logger.warn(`Reconciliation found ${drifts.length} drifted inventory rows`);

    // Persist a single audit-log entry summarizing the drift so admins
    // can see it. Per-tenant entries (one per unique tenantId in the drift
    // list) so each tenant only sees their own.
    const byTenant = new Map<string, Drift[]>();
    for (const d of drifts) {
      const arr = byTenant.get(d.tenantId) ?? [];
      arr.push(d);
      byTenant.set(d.tenantId, arr);
    }

    for (const [tenantId, rows] of byTenant) {
      try {
        await this.prisma.auditLog.create({
          data: {
            tenantId,
            userId: null,
            action: 'INVENTORY_RECONCILIATION_DRIFT',
            docType: 'WarehouseItemBalance',
            docName: `${rows.length} drifted rows`,
            meta: {
              count: rows.length,
              // Cap the embedded sample so a tenant with 10k drift rows
              // doesn't produce a 10MB JSON blob in the audit table.
              sample: rows.slice(0, 25),
            },
          },
        });
      } catch (err) {
        this.logger.error(
          `Failed to record reconciliation drift for tenant ${tenantId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return { totalChecked: 1, totalDrifted: drifts.length };
  }
}
