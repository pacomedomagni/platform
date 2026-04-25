'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  ConfirmDialog,
  DataTable,
  StatusBadge,
  toast,
  type DataTableColumn,
} from '@platform/ui';
import { Plus, Package, Search, X } from 'lucide-react';
import api from '../../../lib/api';

interface Product {
  id: string;
  slug: string;
  displayName: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  isFeatured: boolean;
  isPublished: boolean;
  stockStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

const STOCK_STATUS_FROM_STRING: Record<string, string> = {
  in_stock: 'IN_STOCK',
  low_stock: 'LOW_STOCK',
  out_of_stock: 'OUT_OF_STOCK',
};

function stockStatusKey(p: Product): string {
  if (p.stockStatus && STOCK_STATUS_FROM_STRING[p.stockStatus]) {
    return STOCK_STATUS_FROM_STRING[p.stockStatus];
  }
  return 'IN_STOCK';
}

function ProductsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const publishedFilter = searchParams.get('published') ?? '';
  const featuredFilter = searchParams.get('featured') ?? '';
  const stockFilter = searchParams.get('stock') ?? '';
  const sortId = searchParams.get('sort') ?? 'createdAt';
  const sortDir = (searchParams.get('dir') as 'asc' | 'desc' | null) ?? 'desc';
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);

  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [searchDraft, setSearchDraft] = useState(search);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [confirmState, setConfirmState] = useState<
    | { kind: 'publish' | 'unpublish' | 'delete'; ids: string[] }
    | null
  >(null);

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

  // Debounced search → URL
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

  const loadProducts = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(page * PAGE_SIZE));
        if (sortId) {
          const sortParam =
            sortId === 'displayName' ? 'name' : sortId === 'price' ? 'price' : 'createdAt';
          params.set('sortBy', sortParam);
          params.set('sortOrder', sortDir ?? 'desc');
        }
        // Pass through optional filters in case the backend honors them.
        if (publishedFilter) params.set('isPublished', publishedFilter);
        if (featuredFilter) params.set('isFeatured', featuredFilter);
        if (stockFilter) params.set('stockStatus', stockFilter);

        const res = await api.get(`/v1/store/admin/products?${params.toString()}`);
        const payload = res.data && typeof res.data === 'object' ? res.data : {};
        setProducts(payload.data || []);
        if (payload.pagination) setPagination(payload.pagination);
      } catch (error: any) {
        if (mode === 'initial') {
          toast({
            title: 'Failed to load products',
            description: error?.message || 'Please try again.',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setHasLoadedOnce(true);
      }
    },
    [search, sortId, sortDir, page, publishedFilter, featuredFilter, stockFilter],
  );

  useEffect(() => {
    loadProducts(hasLoadedOnce ? 'refresh' : 'initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProducts]);

  const formatCurrency = (amount: number) => {
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    const currency =
      (typeof window !== 'undefined' && localStorage.getItem('tenantCurrency')) || 'USD';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  };

  const formatDate = (date?: string) => {
    if (!date) return '—';
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    return new Date(date).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Client-side filter pass — defensive in case the backend does not honor these params.
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (publishedFilter === 'true' && !p.isPublished) return false;
      if (publishedFilter === 'false' && p.isPublished) return false;
      if (featuredFilter === 'true' && !p.isFeatured) return false;
      if (featuredFilter === 'false' && p.isFeatured) return false;
      if (stockFilter) {
        const key = stockStatusKey(p);
        if (stockFilter === 'in' && key !== 'IN_STOCK') return false;
        if (stockFilter === 'low' && key !== 'LOW_STOCK') return false;
        if (stockFilter === 'out' && key !== 'OUT_OF_STOCK') return false;
      }
      return true;
    });
  }, [products, publishedFilter, featuredFilter, stockFilter]);

  const columns: DataTableColumn<Product>[] = useMemo(
    () => [
      {
        id: 'displayName',
        header: 'Product',
        sortable: true,
        cell: (p) => (
          <div className="flex items-center gap-3">
            {p.images && p.images.length > 0 ? (
              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-border/60">
                <img
                  src={p.images[0]}
                  alt={p.displayName}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                {p.displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'price',
        header: 'Price',
        sortable: true,
        align: 'right',
        cell: (p) => (
          <div className="flex flex-col items-end">
            <span className="font-medium">{formatCurrency(p.price)}</span>
            {p.compareAtPrice && p.compareAtPrice > p.price && (
              <span className="text-xs text-muted-foreground line-through">
                {formatCurrency(p.compareAtPrice)}
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (p) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge kind="product" status={p.isPublished ? 'PUBLISHED' : 'DRAFT'} />
            {p.isFeatured && <StatusBadge kind="product" status="FEATURED" />}
          </div>
        ),
      },
      {
        id: 'stock',
        header: 'Stock',
        sortable: true,
        cell: (p) => <StatusBadge kind="product" status={stockStatusKey(p)} />,
      },
      {
        id: 'updatedAt',
        header: 'Updated',
        sortable: true,
        cell: (p) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(p.updatedAt || p.createdAt)}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const hasFilters = !!(search || publishedFilter || featuredFilter || stockFilter);

  const handleClearFilters = () =>
    setParam({
      q: null,
      published: null,
      featured: null,
      stock: null,
      page: null,
    });

  const filterChips: Array<{ key: string; label: string; active: boolean; apply: () => void }> = [
    {
      key: 'all',
      label: 'All',
      active: !publishedFilter && !featuredFilter && !stockFilter,
      apply: () =>
        setParam({ published: null, featured: null, stock: null, page: null }),
    },
    {
      key: 'published',
      label: 'Published',
      active: publishedFilter === 'true',
      apply: () =>
        setParam({ published: 'true', featured: null, stock: null, page: null }),
    },
    {
      key: 'drafts',
      label: 'Drafts',
      active: publishedFilter === 'false',
      apply: () =>
        setParam({ published: 'false', featured: null, stock: null, page: null }),
    },
    {
      key: 'featured',
      label: 'Featured',
      active: featuredFilter === 'true',
      apply: () =>
        setParam({ featured: 'true', published: null, stock: null, page: null }),
    },
    {
      key: 'oos',
      label: 'Out of stock',
      active: stockFilter === 'out',
      apply: () =>
        setParam({ stock: 'out', published: null, featured: null, page: null }),
    },
  ];

  // Bulk actions
  const runBulkPublish = async (publish: boolean) => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    const verb = publish ? 'Published' : 'Unpublished';
    const results = await Promise.allSettled(
      selectedIds.map((id) =>
        api.put(`/v1/store/admin/products/${id}`, { isPublished: publish }),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok > 0) {
      toast({
        title: `${verb} ${ok} product${ok === 1 ? '' : 's'}`,
        description: failed > 0 ? `${failed} failed.` : undefined,
        variant: failed > 0 ? 'destructive' : 'success',
      });
    } else {
      toast({
        title: `Failed to ${publish ? 'publish' : 'unpublish'}`,
        description: 'No products were updated.',
        variant: 'destructive',
      });
    }
    setSelectedIds([]);
    setBulkBusy(false);
    setConfirmState(null);
    loadProducts('refresh');
  };

  const runBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      selectedIds.map((id) => api.delete(`/v1/store/admin/products/${id}`)),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok > 0) {
      toast({
        title: `Deleted ${ok} product${ok === 1 ? '' : 's'}`,
        description: failed > 0 ? `${failed} failed.` : undefined,
        variant: failed > 0 ? 'destructive' : 'success',
      });
    } else {
      toast({
        title: 'Failed to delete',
        description: 'No products were deleted.',
        variant: 'destructive',
      });
    }
    setSelectedIds([]);
    setBulkBusy(false);
    setConfirmState(null);
    loadProducts('refresh');
  };

  const confirmAction = async () => {
    if (!confirmState) return;
    if (confirmState.kind === 'publish') return runBulkPublish(true);
    if (confirmState.kind === 'unpublish') return runBulkPublish(false);
    if (confirmState.kind === 'delete') return runBulkDelete();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Products
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage your product catalog</p>
        </div>
        <Link
          href="/app/products/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
      </div>

      {/* Search + filter chips */}
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search products…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            aria-label="Search products"
            className="w-full rounded-lg border border-input/80 bg-background/80 pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
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
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(p) => p.id}
        loading={loading}
        refreshing={refreshing && !loading}
        empty={
          <div className="py-6">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">
              {hasFilters ? 'No products match these filters' : 'No products yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters ? (
                <>
                  Adjust the filters above or{' '}
                  <button onClick={handleClearFilters} className="underline">
                    clear them
                  </button>
                  .
                </>
              ) : (
                'Get started by adding your first product to the catalog.'
              )}
            </p>
            {!hasFilters && (
              <Link
                href="/app/products/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </Link>
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
              onClick={() => setConfirmState({ kind: 'publish', ids })}
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={() => setConfirmState({ kind: 'unpublish', ids })}
            >
              Unpublish
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={bulkBusy}
              onClick={() => setConfirmState({ kind: 'delete', ids })}
            >
              Delete
            </Button>
          </div>
        )}
        onRowClick={(p) => router.push(`/app/products/${p.id}/edit`)}
      />

      {/* Pagination */}
      {pagination && pagination.total > PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
          <span>
            Showing {page * PAGE_SIZE + 1}-
            {Math.min((page + 1) * PAGE_SIZE, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParam({ page: page > 1 ? String(page - 1) : null })}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParam({ page: String(page + 1) })}
              disabled={!pagination.hasMore}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmState?.kind === 'publish'}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title="Publish products"
        description={`Publish ${selectedIds.length} product${selectedIds.length === 1 ? '' : 's'}? They will appear in your storefront.`}
        confirmLabel="Publish"
        loading={bulkBusy}
        onConfirm={confirmAction}
      />
      <ConfirmDialog
        open={confirmState?.kind === 'unpublish'}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title="Unpublish products"
        description={`Unpublish ${selectedIds.length} product${selectedIds.length === 1 ? '' : 's'}? They will be hidden from your storefront.`}
        confirmLabel="Unpublish"
        loading={bulkBusy}
        onConfirm={confirmAction}
      />
      <ConfirmDialog
        open={confirmState?.kind === 'delete'}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title="Delete products"
        description={`This will soft-delete ${selectedIds.length} product${selectedIds.length === 1 ? '' : 's'}. This can be reversed by support.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={bulkBusy}
        onConfirm={confirmAction}
      />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        </div>
      }
    >
      <ProductsInner />
    </Suspense>
  );
}
