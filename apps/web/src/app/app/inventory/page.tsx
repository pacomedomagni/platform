'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, EmptyState, StatusBadge } from '@platform/ui';
import {
  ArrowUpDown,
  Package,
  Hash,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Boxes,
} from 'lucide-react';
import api from '../../../lib/api';

// Shape returned by GET /v1/store/admin/dashboard/inventory-alerts. We only consume
// counts + light alert lists so the merchant has an at-a-glance view; deep navigation
// (movements, batches, etc.) lives in the secondary nav cards below.
type InventoryAlert = { productId: string; name: string; available: number };
interface InventoryAlertsResponse {
  outOfStockCount: number;
  lowStockCount: number;
  outOfStock: InventoryAlert[];
  lowStock: InventoryAlert[];
}

// Shape used to derive total SKUs / inventory value via /v1/inventory/stock-balance.
// Same shape as the report page consumes; we just aggregate it client-side.
type BalanceRow = {
  itemCode: string;
  warehouseCode: string;
  actualQty: string | number;
  // Some endpoints include a unit value; absent → we just count SKUs.
  unitValue?: string | number;
};

type Reorder = {
  itemCode: string;
  warehouseCode: string;
  availableQty: string;
  reorderLevel: string | null;
  suggestedQty: string;
  shouldReorder: boolean;
};

const inventoryLinks = [
  {
    href: '/app/inventory/movements',
    icon: ArrowUpDown,
    title: 'Stock Movements',
    description: 'Track receipts, issues, transfers, and adjustments',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    href: '/app/inventory/batches',
    icon: Package,
    title: 'Batch Tracking',
    description: 'Manage product batches with expiry dates',
    color: 'text-green-600 bg-green-50',
  },
  {
    href: '/app/inventory/serials',
    icon: Hash,
    title: 'Serial Numbers',
    description: 'Track individual items with unique serials',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    href: '/app/reports/stock-balance',
    icon: BarChart3,
    title: 'Stock Balance',
    description: 'View current stock levels across warehouses',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    href: '/app/reports/stock-valuation',
    icon: TrendingUp,
    title: 'Stock Valuation',
    description: 'Analyze inventory value and COGS',
    color: 'text-indigo-600 bg-indigo-50',
  },
  {
    href: '/app/reports/reorder-suggestions',
    icon: AlertTriangle,
    title: 'Reorder Suggestions',
    description: 'Items needing replenishment',
    color: 'text-red-600 bg-red-50',
  },
];

export default function InventoryPage() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<InventoryAlertsResponse | null>(null);
  const [balanceRows, setBalanceRows] = useState<BalanceRow[]>([]);
  const [reorderRows, setReorderRows] = useState<Reorder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 6.1: route everything through the axios singleton so auth +
        // tenant headers are consistent and the response envelope unwrap
        // happens in one place. Promise.allSettled keeps each subrequest
        // independently useful — a 404 on stock-balance shouldn't blank
        // the whole overview.
        const [alertsRes, balanceRes, reorderRes] = await Promise.allSettled([
          api.get<InventoryAlertsResponse>('/v1/store/admin/dashboard/inventory-alerts'),
          api.get<BalanceRow[]>('/v1/inventory/stock-balance', { params: {} }),
          api.get<Reorder[]>('/v1/inventory/reorder-suggestions', { params: {} }),
        ]);

        if (cancelled) return;

        if (alertsRes.status === 'fulfilled') {
          setAlerts(alertsRes.value.data);
        }
        if (balanceRes.status === 'fulfilled') {
          setBalanceRows(balanceRes.value.data || []);
        }
        if (reorderRes.status === 'fulfilled') {
          setReorderRows(reorderRes.value.data || []);
        }

        // If literally nothing came back we surface an error so EmptyState can render.
        if (
          alertsRes.status === 'rejected' &&
          balanceRes.status === 'rejected' &&
          reorderRes.status === 'rejected'
        ) {
          setError('Inventory services are unavailable.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Aggregate KPIs client-side. Total SKUs = unique itemCodes; value = sum(actualQty * unitValue) when present.
  const uniqueSkus = new Set(balanceRows.map((r) => r.itemCode)).size;
  const totalValue = balanceRows.reduce((sum, r) => {
    const qty = Number(r.actualQty) || 0;
    const unit = r.unitValue != null ? Number(r.unitValue) : 0;
    return sum + qty * unit;
  }, 0);
  const lowStockCount = alerts?.lowStockCount ?? reorderRows.filter((r) => r.shouldReorder).length;
  const outOfStockCount = alerts?.outOfStockCount ?? 0;
  // Dead stock = aged-out inventory; we have no dedicated endpoint, so we approximate with
  // SKUs that have stock but no movement-driven reservations. Marked clearly as approximate.
  const deadStockApprox = balanceRows.filter((r) => Number(r.actualQty) > 0 && !reorderRows.find((x) => x.itemCode === r.itemCode))
    .length;

  const lowStockPreview = (alerts?.lowStock ?? []).slice(0, 10);

  const stats = [
    { label: 'Total SKUs', value: uniqueSkus, icon: Boxes, color: 'text-slate-600 bg-slate-50' },
    {
      label: 'Stock Value',
      value: totalValue ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(totalValue) : '—',
      icon: TrendingUp,
      color: 'text-indigo-600 bg-indigo-50',
    },
    { label: 'Low Stock', value: lowStockCount, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Out of Stock', value: outOfStockCount, icon: Package, color: 'text-red-600 bg-red-50' },
    { label: 'Dead Stock (est.)', value: deadStockApprox, icon: Boxes, color: 'text-purple-600 bg-purple-50' },
  ];

  const noData =
    !loading &&
    !alerts &&
    balanceRows.length === 0 &&
    reorderRows.length === 0;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Inventory Management
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Track stock movements, batches, serial numbers, and inventory analytics
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {noData ? (
        <EmptyState
          icon={<Boxes className="h-5 w-5" />}
          title="No inventory data yet"
          description="Once stock is received or balances are tracked, KPIs and low-stock alerts will appear here."
          primaryAction={
            <Link
              href="/app/inventory/movements"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Record a stock movement
            </Link>
          }
        />
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-xl font-semibold mt-1">{loading ? '—' : stat.value}</p>
                    </div>
                    <div className={`p-2.5 rounded-lg ${stat.color}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Low stock preview */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Low stock items</h3>
                <p className="text-xs text-slate-500 mt-0.5">Top items below their reorder point</p>
              </div>
              <Link
                href="/app/reports/reorder-suggestions"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View all reorder suggestions →
              </Link>
            </div>
            {lowStockPreview.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No low-stock items right now.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2 pr-4">Product</th>
                      <th className="text-right py-2 pr-4">Available</th>
                      <th className="text-left py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockPreview.map((row) => (
                      <tr key={row.productId} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium text-slate-900">{row.name}</td>
                        <td className="py-2 pr-4 text-right">{row.available}</td>
                        <td className="py-2">
                          <StatusBadge
                            kind="product"
                            status={row.available <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Secondary nav — kept so deep tools remain reachable from a single hub. */}
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Tools</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventoryLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href}>
                    <Card className="p-5 h-full hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${link.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            {link.title}
                          </h3>
                          <p className="text-sm text-slate-500 mt-1">{link.description}</p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
