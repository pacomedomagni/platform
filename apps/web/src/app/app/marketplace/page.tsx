'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Skeleton, StatusBadge, EmptyState, Button } from '@platform/ui';
import { Link2, Tag, ShoppingCart, RotateCcw, AlertTriangle, ExternalLink } from 'lucide-react';
import { unwrapJson } from '@/lib/admin-fetch';

interface Connection {
  id: string;
  platform: string;
  marketplaceId?: string;
  isConnected: boolean;
  isReady?: boolean;
  name?: string;
}

interface Listing {
  id: string;
  status: string;
  errorMessage?: string | null;
  title?: string;
  marketplace?: string;
}

interface ListingCounts {
  draft: number;
  approved: number;
  publishing: number;
  published: number;
  ended: number;
  error: number;
}

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token') || '';
  const tenantId = localStorage.getItem('tenantId') || '';
  return {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenantId,
  };
}

export default function MarketplaceLanding() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [counts, setCounts] = useState<ListingCounts>({
    draft: 0,
    approved: 0,
    publishing: 0,
    published: 0,
    ended: 0,
    error: 0,
  });
  const [recentErrors, setRecentErrors] = useState<Listing[]>([]);
  const [recentOrders, setRecentOrders] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [connRes, listRes, ordersRes] = await Promise.allSettled([
          fetch('/api/v1/marketplace/connections', { headers: authHeaders() }),
          fetch('/api/v1/marketplace/listings?limit=200', { headers: authHeaders() }),
          fetch('/api/v1/marketplace/orders?limit=1', { headers: authHeaders() }),
        ]);

        if (!alive) return;

        if (connRes.status === 'fulfilled' && connRes.value.ok) {
          const data = unwrapJson(await connRes.value.json());
          setConnections(Array.isArray(data) ? data : data?.data || []);
        }

        if (listRes.status === 'fulfilled' && listRes.value.ok) {
          const data = unwrapJson(await listRes.value.json());
          const listings: Listing[] = Array.isArray(data) ? data : data?.data || [];
          const next: ListingCounts = { draft: 0, approved: 0, publishing: 0, published: 0, ended: 0, error: 0 };
          for (const l of listings) {
            const s = (l.status || '').toUpperCase();
            if (s === 'DRAFT') next.draft++;
            else if (s === 'APPROVED') next.approved++;
            else if (s === 'PUBLISHING') next.publishing++;
            else if (s === 'PUBLISHED') next.published++;
            else if (s === 'ENDED') next.ended++;
            else if (s === 'ERROR') next.error++;
          }
          setCounts(next);
          setRecentErrors(listings.filter((l) => (l.status || '').toUpperCase() === 'ERROR').slice(0, 5));
        }

        if (ordersRes.status === 'fulfilled' && ordersRes.value.ok) {
          const data = unwrapJson(await ordersRes.value.json());
          setRecentOrders(data?.total ?? data?.count ?? (Array.isArray(data?.data) ? data.data.length : 0));
        }
      } catch {
        if (alive) setErrored(true);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const totalListings = counts.draft + counts.approved + counts.publishing + counts.published + counts.ended + counts.error;
  const noConnections = !loading && connections.length === 0;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Marketplace</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage listings, orders, and integrations across third-party marketplaces.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
            </Card>
          ))}
        </div>
      ) : noConnections ? (
        <EmptyState
          icon={<Link2 className="h-5 w-5" />}
          title="No marketplaces connected yet"
          description="Connect to eBay or another marketplace to start syncing listings, orders, and inventory."
          primaryAction={
            <Link
              href="/app/marketplace/connections"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Link2 className="h-4 w-4" /> Connect a marketplace
            </Link>
          }
        />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Connections</span>
                <Link2 className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{connections.length}</span>
                <span className="text-xs text-muted-foreground">linked</span>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Listings</span>
                <Tag className="h-4 w-4 text-purple-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{totalListings}</span>
                <span className="text-xs text-muted-foreground">total ({counts.published} live)</span>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Recent orders</span>
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{recentOrders}</span>
                <span className="text-xs text-muted-foreground">marketplace orders</span>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Issues</span>
                <AlertTriangle className={`h-4 w-4 ${counts.error > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{counts.error}</span>
                <span className="text-xs text-muted-foreground">listings in error</span>
              </div>
            </Card>
          </div>

          {/* Listing status breakdown */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Listing pipeline</h2>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-3">
              {([
                ['draft', 'DRAFT'],
                ['approved', 'APPROVED'],
                ['publishing', 'PUBLISHING'],
                ['published', 'PUBLISHED'],
                ['ended', 'ENDED'],
                ['error', 'ERROR'],
              ] as const).map(([key, status]) => (
                <Link
                  key={key}
                  href={`/app/marketplace/listings?status=${status}`}
                  className="rounded-lg border border-border/70 bg-background p-3 text-center transition hover:border-primary/40 hover:shadow-sm"
                >
                  <div className="flex justify-center">
                    <StatusBadge kind="listing" status={status} />
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{counts[key]}</div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Recent errors */}
          {recentErrors.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent listing errors</h2>
                <Link href="/app/marketplace/listings?status=ERROR" className="text-xs text-primary hover:underline">
                  View all
                </Link>
              </div>
              <ul className="mt-3 divide-y divide-border/60">
                {recentErrors.map((l) => (
                  <li key={l.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{l.title || l.id}</p>
                        <p className="truncate text-xs text-muted-foreground">{l.errorMessage || 'Unknown error'}</p>
                      </div>
                      <Link
                        href={`/app/marketplace/listings/${l.id}`}
                        className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {errored && !loading && (
        <p className="text-xs text-muted-foreground">
          Note: marketplace summary data is partial — some endpoints didn&apos;t respond. Use the tab nav above to navigate directly.
        </p>
      )}
    </div>
  );
}
