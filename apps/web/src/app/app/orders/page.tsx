'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Card, Button, DataTable, StatusBadge, toast, type DataTableColumn } from '@platform/ui';
import { Download, RefreshCw, Package, Clock, Truck, CheckCircle, X, Search } from 'lucide-react';
import api from '../../../lib/api';

interface OrderStats {
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customer?: { name: string; email: string };
  status: string;
  paymentStatus: string;
  grandTotal: number;
  currency?: string;
  itemCount: number;
  createdAt: string;
}

const STATUS_OPTIONS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
const PAYMENT_OPTIONS = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;

function OrdersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? '';
  const paymentStatus = searchParams.get('payment') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const sortId = searchParams.get('sort') ?? 'createdAt';
  const sortDir = (searchParams.get('dir') as 'asc' | 'desc' | null) ?? 'desc';
  const autoRefresh = (searchParams.get('auto') ?? '1') !== '0';

  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({ pending: 0, processing: 0, shipped: 0, delivered: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchDraft, setSearchDraft] = useState(search);

  const setParam = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '') sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Debounce typing into URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== search) setParam({ q: searchDraft || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const loadOrders = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      try {
        const params: any = {};
        if (search) params.search = search;
        if (status) params.status = status;
        if (paymentStatus) params.paymentStatus = paymentStatus;
        if (from) params.from = from;
        if (to) params.to = to;
        if (sortId) params.sort = sortId;
        if (sortDir) params.dir = sortDir;

        // O2: stats failure must not kill the orders table. Run them with
        // allSettled and surface the orders table independently of the
        // KPI cards.
        const [resOutcome, statsOutcome] = await Promise.allSettled([
          api.get('/v1/store/orders/admin/all', { params }),
          api.get('/v1/store/orders/admin/stats'),
        ]);
        if (resOutcome.status === 'fulfilled') {
          setOrders(resOutcome.value.data.data || []);
        } else if (mode === 'initial') {
          toast({
            title: 'Failed to load orders',
            description: (resOutcome.reason as Error)?.message || 'Please try again.',
            variant: 'destructive',
          });
        }
        if (statsOutcome.status === 'fulfilled') {
          const s = statsOutcome.value.data;
          setStats({
            pending: s.pending || 0,
            processing: (s.processing || 0) + (s.confirmed || 0),
            shipped: s.shipped || 0,
            delivered: s.delivered || 0,
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, status, paymentStatus, from, to, sortId, sortDir]
  );

  useEffect(() => {
    loadOrders('initial');
  }, [loadOrders]);

  // O3: only poll when the tab is visible. Background tabs accumulate noisy
  // fetches that hammer the API for nothing the user can see; refresh once
  // when they come back to the tab so the data is fresh.
  useEffect(() => {
    if (!autoRefresh) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(() => loadOrders('refresh'), 30_000);
    };
    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadOrders('refresh');
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [autoRefresh, loadOrders]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (paymentStatus) params.set('paymentStatus', paymentStatus);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (selectedIds.length > 0) params.set('ids', selectedIds.join(','));

      const response = await api.get('/v1/operations/export/orders/csv?' + params.toString(), { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      const count = selectedIds.length || orders.length;
      toast({ title: 'Export ready', description: `Exported ${count} order${count === 1 ? '' : 's'}.`, variant: 'success' });
    } catch {
      toast({ title: 'Export failed', description: 'Could not export orders. Try again.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = !!(search || status || paymentStatus || from || to);

  const handleClearFilters = () =>
    setParam({ q: null, status: null, payment: null, from: null, to: null });

  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const formatDate = (date: string) =>
    new Date(date).toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);

  const columns: DataTableColumn<Order>[] = useMemo(
    () => [
      {
        id: 'orderNumber',
        header: 'Order',
        sortable: true,
        cell: (o) => <span className="font-medium text-primary">{o.orderNumber}</span>,
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: (o) =>
          o.customer ? (
            <div>
              <p className="font-medium">{o.customer.name}</p>
              <p className="text-xs text-muted-foreground">{o.customer.email}</p>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        cell: (o) => <StatusBadge kind="order" status={o.status} />,
      },
      {
        id: 'paymentStatus',
        header: 'Payment',
        sortable: true,
        cell: (o) => <StatusBadge kind="payment" status={o.paymentStatus} />,
      },
      { id: 'itemCount', header: 'Items', align: 'right', sortable: true, cell: (o) => o.itemCount },
      {
        id: 'grandTotal',
        header: 'Total',
        align: 'right',
        sortable: true,
        cell: (o) => <span className="font-medium">{formatCurrency(o.grandTotal, o.currency || 'USD')}</span>,
      },
      {
        id: 'createdAt',
        header: 'Date',
        sortable: true,
        cell: (o) => <span className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</span>,
      },
    ],
    [locale]
  );

  const statCards = [
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Processing', value: stats.processing, icon: Package, color: 'text-blue-600 bg-blue-50' },
    { label: 'Shipped', value: stats.shipped, icon: Truck, color: 'text-purple-600 bg-purple-50' },
    { label: 'Delivered', value: stats.delivered, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Order Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and track customer orders</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setParam({ auto: autoRefresh ? '0' : null })}
            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            aria-pressed={autoRefresh}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={exporting}>
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Exporting…' : selectedIds.length > 0 ? `Export ${selectedIds.length}` : 'Export CSV'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Filter bar — URL-stateful, shareable, back-button safe */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search by order # or email…"
              aria-label="Search orders"
              className="w-full rounded-lg border border-input/80 bg-background/80 pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setParam({ status: e.target.value || null })}
            aria-label="Filter by status"
            className="md:col-span-2 rounded-lg border border-input/80 bg-background/80 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
          <select
            value={paymentStatus}
            onChange={(e) => setParam({ payment: e.target.value || null })}
            aria-label="Filter by payment"
            className="md:col-span-2 rounded-lg border border-input/80 bg-background/80 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="">All Payments</option>
            {PAYMENT_OPTIONS.map((p) => (
              <option key={p} value={p}>{p === 'PAID' ? 'Paid' : p.charAt(0) + p.slice(1).toLowerCase()}</option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setParam({ from: e.target.value || null })}
            aria-label="From date"
            className="md:col-span-2 rounded-lg border border-input/80 bg-background/80 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setParam({ to: e.target.value || null })}
            aria-label="To date"
            className="md:col-span-2 rounded-lg border border-input/80 bg-background/80 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{orders.length} result{orders.length === 1 ? '' : 's'} for current filters</span>
            <button onClick={handleClearFilters} className="inline-flex items-center gap-1 hover:text-foreground">
              <X className="h-3 w-3" /> Clear filters
            </button>
          </div>
        )}
      </Card>

      <DataTable
        columns={columns}
        rows={orders}
        rowKey={(o) => o.id}
        loading={loading}
        refreshing={refreshing}
        empty={
          <div className="py-6">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">No orders match these filters</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Adjust the filters above or {hasFilters ? <button onClick={handleClearFilters} className="underline">clear them</button> : 'wait for your first order.'}
            </p>
          </div>
        }
        sort={{ id: sortId, dir: sortDir }}
        onSortChange={(next) => setParam({ sort: next.dir ? next.id : null, dir: next.dir })}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={(ids) => (
          <Button size="sm" variant="outline" onClick={handleExportCSV} disabled={exporting}>
            <Download className="mr-2 h-3.5 w-3.5" /> Export {ids.length}
          </Button>
        )}
        onRowClick={(o) => router.push(`/app/orders/${o.id}`)}
      />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        </div>
      }
    >
      <OrdersInner />
    </Suspense>
  );
}
