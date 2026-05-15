'use client';

/**
 * H9: eBay webhook DLQ admin.
 *
 * eBay does NOT retry inbound notifications — a single handler crash =
 * permanent data loss without this DLQ. This page lets an operator:
 *   1. See which events failed processing (and why).
 *   2. Read the verified-genuine rawBody we persisted to inspect the
 *      eBay payload that caused the crash.
 *   3. Click "Replay" to re-run the handler with the persisted body
 *      after a code fix is deployed.
 *
 * Restricted to admin / System Manager via the @Roles decorator on
 * the backend controller. Plain links from the marketplace nav for
 * platform admins; non-admins get a 403 when they hit the endpoints.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from '@platform/ui';
import { RefreshCw, RotateCcw, ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

interface DlqRow {
  id: string;
  tenantId: string | null;
  topic: string;
  externalEventId: string | null;
  status: 'received' | 'processing' | 'done' | 'failed';
  receivedAt: string;
  processedAt: string | null;
  attempts: number;
  lastAttemptAt: string | null;
  errorMessage: string | null;
}

interface DlqDetail extends DlqRow {
  rawBody: string;
  headers: any;
}

const STATUSES: Array<DlqRow['status'] | 'all'> = ['all', 'failed', 'received', 'processing', 'done'];

export default function WebhookDlqPage() {
  const [rows, setRows] = useState<DlqRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<typeof STATUSES[number]>('failed');
  const [topicFilter, setTopicFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Map<string, DlqDetail>>(new Map());
  const [replaying, setReplaying] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (topicFilter.trim()) params.set('topic', topicFilter.trim());
      params.set('limit', '100');
      const res = await api.get<{ rows: DlqRow[] }>(
        `/v1/marketplace/ebay/admin/notifications/dlq?${params}`,
      );
      setRows(res.data.rows);
    } catch (err: any) {
      toast({
        title: 'Failed to load DLQ',
        description: err?.response?.data?.error ?? 'unknown',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // re-load when filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const toggleExpand = async (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
      setExpanded(next);
      return;
    }
    next.add(id);
    setExpanded(next);
    if (!details.has(id)) {
      try {
        const res = await api.get<DlqDetail>(
          `/v1/marketplace/ebay/admin/notifications/dlq/${id}`,
        );
        const m = new Map(details);
        m.set(id, res.data);
        setDetails(m);
      } catch (err: any) {
        toast({
          title: 'Failed to load detail',
          description: err?.response?.data?.error ?? 'unknown',
          variant: 'destructive',
        });
      }
    }
  };

  const replay = async (id: string) => {
    const next = new Set(replaying);
    next.add(id);
    setReplaying(next);
    try {
      await api.post(`/v1/marketplace/ebay/admin/notifications/dlq/${id}/replay`);
      toast({ title: 'Replayed', description: `Event ${id.slice(0, 8)}… reprocessed successfully` });
      // Update the row in place to "done"
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: 'done', processedAt: new Date().toISOString() } : r)));
    } catch (err: any) {
      toast({
        title: 'Replay failed',
        description: err?.response?.data?.detail ?? err?.response?.data?.error ?? 'unknown',
        variant: 'destructive',
      });
      // Refresh so we get the latest errorMessage
      load();
    } finally {
      const after = new Set(replaying);
      after.delete(id);
      setReplaying(after);
    }
  };

  const stats = useMemo(() => {
    const total = rows.length;
    const failed = rows.filter((r) => r.status === 'failed').length;
    const done = rows.filter((r) => r.status === 'done').length;
    return { total, failed, done };
  }, [rows]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Webhook DLQ</h1>
          <p className="text-gray-600 mt-1">
            Failed and recent eBay webhook events — review payloads and replay after fixes.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Topic (exact match)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              placeholder="ITEM_SOLD, RETURN_CREATED, …"
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-mono"
            />
            <button
              type="button"
              onClick={load}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Filter
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-4 text-sm text-gray-600">
        <span>{stats.total} total</span>
        <span className="text-red-600">{stats.failed} failed</span>
        <span className="text-green-700">{stats.done} done</span>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-2 py-2"></th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Received</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Topic</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Tenant</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Attempts</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Error</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500 text-sm">
                  No events found for the current filter.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isOpen = expanded.has(r.id);
              const detail = details.get(r.id);
              return (
                <>
                  <tr key={r.id} className={r.status === 'failed' ? 'bg-red-50/40' : ''}>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => toggleExpand(r.id)}
                        className="text-gray-500 hover:text-gray-900"
                      >
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
                      {new Date(r.receivedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-900">{r.topic}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">
                      {r.tenantId ? r.tenantId.slice(0, 8) + '…' : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                    <td className="px-3 py-2 text-xs text-gray-700">{r.attempts}</td>
                    <td className="px-3 py-2 text-xs text-red-700 max-w-md truncate" title={r.errorMessage ?? ''}>
                      {r.errorMessage ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(r.status === 'failed' || r.status === 'done') && (
                        <button
                          onClick={() => replay(r.id)}
                          disabled={replaying.has(r.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          <RotateCcw className={`w-3 h-3 ${replaying.has(r.id) ? 'animate-spin' : ''}`} />
                          Replay
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={r.id + ':detail'} className="bg-gray-50">
                      <td colSpan={8} className="px-6 py-3">
                        {!detail ? (
                          <div className="text-xs text-gray-500 inline-flex items-center gap-2">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Loading payload…
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-4 text-xs text-gray-600">
                              <span>id: <code className="font-mono">{detail.id}</code></span>
                              {detail.externalEventId && (
                                <span>eBay event: <code className="font-mono">{detail.externalEventId}</code></span>
                              )}
                              {detail.processedAt && (
                                <span>processed: {new Date(detail.processedAt).toLocaleString()}</span>
                              )}
                            </div>
                            <details>
                              <summary className="text-xs font-medium text-gray-700 cursor-pointer">
                                Raw payload
                              </summary>
                              <pre className="mt-2 max-h-96 overflow-auto bg-white border border-gray-200 rounded p-2 text-xs whitespace-pre-wrap break-all">
                                {(() => {
                                  try {
                                    return JSON.stringify(JSON.parse(detail.rawBody), null, 2);
                                  } catch {
                                    return detail.rawBody;
                                  }
                                })()}
                              </pre>
                            </details>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: DlqRow['status'] }) {
  const cfg: Record<DlqRow['status'], { label: string; classes: string; Icon: any }> = {
    received: { label: 'Received', classes: 'bg-blue-100 text-blue-800', Icon: AlertCircle },
    processing: { label: 'Processing', classes: 'bg-amber-100 text-amber-800', Icon: RefreshCw },
    done: { label: 'Done', classes: 'bg-green-100 text-green-800', Icon: CheckCircle2 },
    failed: { label: 'Failed', classes: 'bg-red-100 text-red-800', Icon: AlertCircle },
  };
  const { label, classes, Icon } = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
}
