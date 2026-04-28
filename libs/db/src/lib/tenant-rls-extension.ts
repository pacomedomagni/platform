import { AsyncLocalStorage } from 'async_hooks';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  getTenantOverride,
  isTenantGuardBypassed,
} from './tenant-guard';

const logger = new Logger('TenantRls');

/**
 * Models whose underlying tables have ROW LEVEL SECURITY enabled in
 * Postgres. The RLS extension only intervenes for queries against these
 * models — every other tenant-scoped model still relies on application-
 * layer filtering until its RLS migration ships.
 *
 * Keep in lock-step with prisma/migrations/<ts>_marketplace_rls_enable
 * (and any future enablement migrations).
 */
export const RLS_ENFORCED_MODELS: ReadonlySet<string> = new Set([
  'MarketplaceConnection',
  'MarketplaceListing',
  'MarketplaceOrder',
  'MarketplaceReturn',
  'MarketplaceMessageThread',
  // Note: a "MarketplaceMessage" model exists in @prisma/client only if the
  // schema declares one. Today the schema groups messages under threads,
  // but we list it here for forward-compat with the migration's table set.
  'MarketplaceMessage',
  'MarketplaceCampaign',
  'MarketplaceViolation',
  'MarketplaceSyncLog',
]);

/**
 * Marker that lets the extension's recursive call (the one we make inside
 * the wrapping `$transaction`) skip the wrap-and-set logic. Without this
 * flag, every `query()` invocation inside our wrap would re-enter the
 * extension and recurse forever.
 */
const insideRlsWrap = new AsyncLocalStorage<boolean>();

/**
 * Set explicitly when we're already inside a caller-managed `$transaction`
 * that has set `app.tenant` itself (the legacy hand-rolled pattern in
 * inventory/accounting / app.service). Lets those services keep working
 * unchanged: they call `set_config` themselves, then run queries on `tx`,
 * and our extension stays out of the way.
 */
const inUserTransaction = new AsyncLocalStorage<boolean>();

/**
 * Caller-managed escape hatch. Used by our `$transaction` shim below.
 */
export function markUserTransactionScope<T>(fn: () => Promise<T>): Promise<T> {
  return inUserTransaction.run(true, fn);
}

interface RlsExtensionOptions {
  /**
   * Reads back the active tenant id at query time. We can't import ClsService
   * here (libs/db must stay framework-agnostic) so the consumer (PrismaService)
   * provides this getter.
   */
  getTenantId: () => string | undefined;
}

/**
 * Prisma extension that enforces tenant isolation at the database layer
 * by setting `app.tenant` on the connection used for each query.
 *
 * Postgres `set_config('app.tenant', X, true)` is transaction-local, so the
 * SET is wiped at COMMIT/ROLLBACK and cannot leak across pooled connections.
 * That's the only safe scoping for a shared pool, but it requires every
 * tenant-scoped query to run inside a transaction. This extension does
 * exactly that automatically:
 *
 *   prisma.marketplaceListing.findMany({ where: { … } })
 *     → wraps in $transaction
 *     → SELECT set_config('app.tenant', '<tenantId>', true)
 *     → run the original query against the same `tx`
 *
 * Skipped automatically when:
 *   - the model is not tenant-scoped (no point setting app.tenant)
 *   - bypassTenantGuard() is active (provisioning, cron sweeps, etc.)
 *   - we're already inside a user-managed transaction that set its own
 *     app.tenant (legacy inventory/accounting code)
 *   - the operation is itself a transaction op like `$transaction` (rare;
 *     guarded by model presence)
 *   - we're inside our own wrap (insideRlsWrap flag) — avoids recursion
 *
 * Throws if a tenant-scoped query happens with no tenant id available and
 * no bypass active. That's the strict-mode behaviour the audit asked for:
 * forgetting to scope is now a hard error rather than a silent leak.
 */
export function buildTenantRlsExtension(options: RlsExtensionOptions) {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      name: 'tenant-rls',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // Only wrap queries against models whose tables have RLS turned
            // on in Postgres. Non-tenant models (Tenant itself, public eBay
            // key cache, etc.) and tenant-scoped-but-not-yet-RLS-enforced
            // models (Order, Item, Customer, …) bypass this interceptor —
            // they continue to rely on application-layer tenantId filters.
            if (!model || !RLS_ENFORCED_MODELS.has(model)) {
              return query(args);
            }

            // Caller-marked bypass.
            if (isTenantGuardBypassed()) {
              return query(args);
            }

            // Already inside a wrap or a user-managed tx that set
            // app.tenant itself — let the inner query run as-is.
            if (insideRlsWrap.getStore() || inUserTransaction.getStore()) {
              return query(args);
            }

            // runWithTenant() override wins over CLS — used by scheduled
            // jobs that don't run through HTTP middleware.
            const tenantId = getTenantOverride() || options.getTenantId();
            if (!tenantId) {
              throw new Error(
                `TenantRls: ${operation} on ${model} attempted without a tenant id in context. ` +
                  'Wrap the call in bypassTenantGuard() if it legitimately spans tenants, ' +
                  'or ensure CLS has tenantId set before reaching this query.',
              );
            }

            // Wrap the operation in a $transaction so set_config(..., true)
            // applies to the same connection that runs the query.
            //
            // (client as any).$transaction is the unextended client method;
            // we don't recurse through extensions for the SET because it's
            // a $executeRaw on a non-model path.
            return (client as any).$transaction(async (tx: any) => {
              return insideRlsWrap.run(true, async () => {
                await tx.$executeRaw(
                  Prisma.sql`SELECT set_config('app.tenant', ${tenantId}, true)`,
                );
                // Re-issue the model operation on `tx` so the SET applies.
                // Prisma's `tx[model][operation](args)` is the standard
                // pattern for re-running an op on a transaction client.
                const modelKey = lowerFirst(model);
                return tx[modelKey][operation](args);
              });
            });
          },
        },
      },
    });
  });
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Diagnostic — log a one-time message at module load so deployment can
 * confirm the extension is wired without grepping logs at request time.
 */
logger.log('Tenant RLS extension module loaded');
