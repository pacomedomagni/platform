'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Card,
  Button,
  ConfirmDialog,
  DataTable,
  StatusBadge,
  toast,
  type DataTableColumn,
} from '@platform/ui';
import {
  Search,
  Users,
  TrendingUp,
  UserCheck,
  AlertTriangle,
  Download,
  X,
} from 'lucide-react';
import api from '../../../lib/api';

interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  orderCount?: number;
  totalSpent?: number;
  lastOrderDate?: string | null;
  createdAt: string;
  emailVerified?: boolean;
  isActive?: boolean;
}

interface CustomerStats {
  total: number;
  new: number;
  highValue: number;
  atRisk: number;
}

const PAGE_SIZE = 50;

type Segment = '' | 'new' | 'high_value' | 'vip' | 'at_risk';

function deriveSegment(c: Customer): Segment {
  if ((c.totalSpent || 0) > 1000 && (c.orderCount || 0) >= 5) return 'vip';
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSinceCreation < 30) return 'new';
  if (c.lastOrderDate) {
    const daysSinceOrder = Math.floor(
      (Date.now() - new Date(c.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceOrder > 90) return 'at_risk';
  }
  if ((c.totalSpent || 0) > 500) return 'high_value';
  return '';
}

function segmentBadgeStatus(seg: Segment): string | null {
  switch (seg) {
    case 'new':
      return 'NEW';
    case 'high_value':
      return 'HIGH_VALUE';
    case 'vip':
      return 'VIP';
    case 'at_risk':
      return 'AT_RISK';
    default:
      return null;
  }
}

function CustomersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const segment = (searchParams.get('segment') ?? '') as Segment;
  const statusFilter = searchParams.get('status') ?? '';
  const sortId = searchParams.get('sort') ?? 'createdAt';
  const sortDir = (searchParams.get('dir') as 'asc' | 'desc' | null) ?? 'desc';
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    total: 0,
    new: 0,
    highValue: 0,
    atRisk: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [searchDraft, setSearchDraft] = useState(search);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

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
    [router, pathname, searchParams],
  );

  // Debounce search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== search) setParam({ q: searchDraft || null, page: null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const loadCustomers = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      try {
        const params: any = {};
        if (search) params.search = search;
        if (segment) params.segment = segment;
        if (statusFilter) params.status = statusFilter;
        if (sortId) params.sort = sortId;
        if (sortDir) params.dir = sortDir;
        params.page = page + 1;
        params.limit = PAGE_SIZE;

        const res = await api.get('/v1/store/admin/customers', { params });
        const customerList: Customer[] = res.data.data || [];
        setCustomers(customerList);

        if (res.data.stats) {
          setStats(res.data.stats);
        } else {
          const now = new Date();
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

          setStats({
            total: customerList.length,
            new: customerList.filter((c) => new Date(c.createdAt) > thirtyDaysAgo).length,
            highValue: customerList.filter((c) => (c.totalSpent || 0) > 500).length,
            atRisk: customerList.filter(
              (c) => c.lastOrderDate && new Date(c.lastOrderDate) < ninetyDaysAgo,
            ).length,
          });
        }
      } catch (err: any) {
        if (mode === 'initial') {
          toast({
            title: 'Failed to load customers',
            description: err?.message || 'Please try again.',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setHasLoadedOnce(true);
      }
    },
    [search, segment, statusFilter, sortId, sortDir, page],
  );

  useEffect(() => {
    loadCustomers(hasLoadedOnce ? 'refresh' : 'initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCustomers]);

  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const formatCurrency = (amount: number) => {
    const currency =
      (typeof window !== 'undefined' && localStorage.getItem('tenantCurrency')) || 'USD';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  };
  const formatDate = (date?: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Client-side fallback filter for status (backend may not support).
  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (statusFilter === 'active' && c.isActive === false) return false;
      if (statusFilter === 'inactive' && c.isActive !== false) return false;
      return true;
    });
  }, [customers, statusFilter]);

  // Client-side sort fallback for fields the backend does not handle.
  const rows = useMemo(() => {
    if (!sortId || !sortDir) return filtered;
    const dirMul = sortDir === 'asc' ? 1 : -1;
    const out = [...filtered];
    out.sort((a, b) => {
      let av: number | string | null = null;
      let bv: number | string | null = null;
      switch (sortId) {
        case 'name':
          av = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
          bv = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
          break;
        case 'orderCount':
          av = a.orderCount || 0;
          bv = b.orderCount || 0;
          break;
        case 'totalSpent':
          av = a.totalSpent || 0;
          bv = b.totalSpent || 0;
          break;
        case 'lastOrderDate':
          av = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0;
          bv = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0;
          break;
        case 'createdAt':
        default:
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dirMul;
      if (av > bv) return 1 * dirMul;
      return 0;
    });
    return out;
  }, [filtered, sortId, sortDir]);

  const columns: DataTableColumn<Customer>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Customer',
        sortable: true,
        cell: (c) => {
          const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || 'N/A';
          return (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <span className="text-sm font-medium text-primary">
                  {fullName[0]?.toUpperCase() || '?'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{fullName}</span>
                {c.emailVerified && <StatusBadge kind="customer" status="VERIFIED" />}
              </div>
            </div>
          );
        },
      },
      {
        id: 'email',
        header: 'Email',
        cell: (c) => <span className="text-sm">{c.email}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: (c) => (
          <StatusBadge kind="customer" status={c.isActive === false ? 'INACTIVE' : 'ACTIVE'} />
        ),
      },
      {
        id: 'orderCount',
        header: 'Orders',
        align: 'right',
        sortable: true,
        cell: (c) => c.orderCount || 0,
      },
      {
        id: 'totalSpent',
        header: 'Total Spent',
        align: 'right',
        sortable: true,
        cell: (c) => (
          <span className="font-medium">{formatCurrency(c.totalSpent || 0)}</span>
        ),
      },
      {
        id: 'lastOrderDate',
        header: 'Last Order',
        sortable: true,
        cell: (c) => (
          <span className="text-sm text-muted-foreground">
            {c.lastOrderDate ? formatDate(c.lastOrderDate) : 'Never'}
          </span>
        ),
      },
      {
        id: 'segment',
        header: 'Segment',
        cell: (c) => {
          const seg = deriveSegment(c);
          const status = segmentBadgeStatus(seg);
          return status ? <StatusBadge kind="customer" status={status} /> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        id: 'createdAt',
        header: 'Joined',
        sortable: true,
        cell: (c) => (
          <span className="text-sm text-muted-foreground">{formatDate(c.createdAt)}</span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  const hasFilters = !!(search || segment || statusFilter);
  const handleClearFilters = () =>
    setParam({ q: null, segment: null, status: null, page: null });

  const filterChips: Array<{ key: string; label: string; active: boolean; apply: () => void }> = [
    {
      key: 'all',
      label: 'All',
      active: !segment,
      apply: () => setParam({ segment: null, page: null }),
    },
    {
      key: 'new',
      label: 'New',
      active: segment === 'new',
      apply: () => setParam({ segment: 'new', page: null }),
    },
    {
      key: 'high_value',
      label: 'High Value',
      active: segment === 'high_value',
      apply: () => setParam({ segment: 'high_value', page: null }),
    },
    {
      key: 'vip',
      label: 'VIP',
      active: segment === 'vip',
      apply: () => setParam({ segment: 'vip', page: null }),
    },
    {
      key: 'at_risk',
      label: 'At Risk',
      active: segment === 'at_risk',
      apply: () => setParam({ segment: 'at_risk', page: null }),
    },
  ];

  const statCards = [
    { label: 'Total Customers', value: stats.total, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'New (30 days)', value: stats.new, icon: UserCheck, color: 'text-green-600 bg-green-50' },
    { label: 'High Value', value: stats.highValue, icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
    { label: 'At Risk', value: stats.atRisk, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
  ];

  const handleExportCSV = async (idsOverride?: string[]) => {
    const ids = idsOverride && idsOverride.length > 0 ? idsOverride : selectedIds;
    try {
      const params = new URLSearchParams();
      if (ids.length > 0) params.set('ids', ids.join(','));
      const url = `/v1/operations/export/customers/csv${params.toString() ? `?${params}` : ''}`;
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      const count = ids.length || rows.length;
      toast({
        title: 'Export ready',
        description: `Exported ${count} customer${count === 1 ? '' : 's'}.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const runBulkDeactivate = async () => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await api.post('/v1/store/admin/customers/bulk/active', {
        ids: selectedIds,
        isActive: false,
      });
      const result = res.data?.data ?? res.data;
      const ok = result?.ok ?? 0;
      const failed = result?.failed ?? 0;
      if (ok > 0) {
        toast({
          title: `Deactivated ${ok} customer${ok === 1 ? '' : 's'}`,
          description: failed > 0 ? `${failed} skipped (not found or wrong tenant).` : undefined,
          variant: failed > 0 ? 'destructive' : 'success',
        });
      } else {
        toast({
          title: 'Failed to deactivate',
          description: 'No customers were updated.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Failed to deactivate',
        description: err?.response?.data?.message || err?.message || 'Bulk request failed.',
        variant: 'destructive',
      });
    } finally {
      setSelectedIds([]);
      setBulkBusy(false);
      setConfirmDeactivate(false);
      loadCustomers('refresh');
    }
  };

  const emptyMessage = (() => {
    if (segment === 'new') return 'No new customers in the last 30 days.';
    if (segment === 'high_value') return 'No high-value customers match.';
    if (segment === 'vip') return 'No VIP customers yet.';
    if (segment === 'at_risk') return 'No at-risk customers right now.';
    if (search) return `No customers match "${search}".`;
    return 'No customers yet';
  })();

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Customer Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage and analyze your customer base</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => handleExportCSV()}>
          <Download className="w-4 h-4 mr-2" />
          {selectedIds.length > 0 ? `Export ${selectedIds.length}` : 'Export CSV'}
        </Button>
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

      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by name or email…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              aria-label="Search customers"
              className="w-full rounded-lg border border-input/80 bg-background/80 pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setParam({ status: e.target.value || null, page: null })}
            aria-label="Filter by status"
            className="sm:w-44 rounded-lg border border-input/80 bg-background/80 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.apply}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                chip.active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {chip.label}
            </button>
          ))}
          {hasFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        loading={loading}
        refreshing={refreshing && !loading}
        empty={
          <div className="py-6">
            <Users className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">
              {emptyMessage}
            </p>
            {hasFilters && (
              <p className="mt-1 text-sm text-muted-foreground">
                <button onClick={handleClearFilters} className="underline">
                  Clear filters
                </button>{' '}
                to see everyone.
              </p>
            )}
          </div>
        }
        sort={{ id: sortId, dir: sortDir }}
        onSortChange={(next) => setParam({ sort: next.dir ? next.id : null, dir: next.dir })}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={(ids) => (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={() => handleExportCSV(ids)}
            >
              <Download className="mr-2 h-3.5 w-3.5" /> Export {ids.length}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={bulkBusy}
              onClick={() => setConfirmDeactivate(true)}
            >
              Deactivate
            </Button>
          </div>
        )}
        onRowClick={(c) => router.push(`/app/customers/${c.id}`)}
      />

      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        title="Deactivate customers"
        description={`Deactivate ${selectedIds.length} customer${selectedIds.length === 1 ? '' : 's'}? They will lose login access and will not receive marketing emails. This can be reversed.`}
        confirmLabel="Deactivate"
        variant="destructive"
        loading={bulkBusy}
        onConfirm={runBulkDeactivate}
      />
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        </div>
      }
    >
      <CustomersInner />
    </Suspense>
  );
}
