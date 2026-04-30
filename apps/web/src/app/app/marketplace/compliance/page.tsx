'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from '@platform/ui';
import {
  ShieldAlert,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Package,
  Tag,
} from 'lucide-react';
import api from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface ViolationSummaryItem {
  complianceType: string;
  marketplaceId: string;
  listingCount: number;
}

interface ViolationDetail {
  reasonCode: string;
  message: string;
  violationData?: Record<string, unknown>;
}

interface ListingViolation {
  violationId: string;
  complianceType: string;
  listingId?: string;
  reasonCode?: string;
  message?: string;
  severity?: string;
  deadline?: string;
  violations?: ViolationDetail[];
}

// Local (DB-synced) violation shape
interface LocalViolation {
  id: string;
  connectionId: string;
  externalViolationId: string;
  complianceType: string;
  listingId?: string;
  reasonCode: string;
  message: string;
  severity: string;
  status: string;
  violationData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  connection?: {
    name: string;
    marketplaceId: string;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPLIANCE_TYPES = [
  'PRODUCT_ADOPTION',
  'LISTING_VIOLATION',
  'PRODUCT_ADOPTION_AT_RISK',
  'LISTING_VIOLATION_AT_RISK',
] as const;

type ComplianceType = (typeof COMPLIANCE_TYPES)[number];

const COMPLIANCE_TYPE_LABELS: Record<ComplianceType, string> = {
  PRODUCT_ADOPTION: 'Product Adoption',
  LISTING_VIOLATION: 'Listing Violation',
  PRODUCT_ADOPTION_AT_RISK: 'Product Adoption At Risk',
  LISTING_VIOLATION_AT_RISK: 'Listing Violation At Risk',
};

const STATUS_OPTIONS = ['OPEN', 'SUPPRESSED', 'RESOLVED'] as const;

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    ERROR: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle },
    WARNING: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertTriangle },
    INFO: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Info },
  };
  const c = config[severity?.toUpperCase()] ?? { bg: 'bg-gray-100', text: 'text-gray-700', icon: Info };
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon className="w-3 h-3" />
      {severity ?? 'UNKNOWN'}
    </span>
  );
}

function ComplianceTypeBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    PRODUCT_ADOPTION: { bg: 'bg-purple-100', text: 'text-purple-800' },
    LISTING_VIOLATION: { bg: 'bg-red-100', text: 'text-red-800' },
    PRODUCT_ADOPTION_AT_RISK: { bg: 'bg-orange-100', text: 'text-orange-800' },
    LISTING_VIOLATION_AT_RISK: { bg: 'bg-amber-100', text: 'text-amber-800' },
  };
  const c = config[type] ?? { bg: 'bg-gray-100', text: 'text-gray-700' };
  const label = COMPLIANCE_TYPE_LABELS[type as ComplianceType] ?? type;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    OPEN: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle },
    SUPPRESSED: { bg: 'bg-gray-100', text: 'text-gray-700', icon: CheckCircle2 },
    RESOLVED: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2 },
  };
  const c = config[status] ?? { bg: 'bg-gray-100', text: 'text-gray-700', icon: Info };
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

function SummaryCard({
  type,
  count,
  active,
  onClick,
}: {
  type: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const isError = type === 'LISTING_VIOLATION' || type === 'PRODUCT_ADOPTION';
  const isAtRisk = type.includes('AT_RISK');

  const accentClass = isError
    ? 'border-red-200 bg-red-50 hover:border-red-400'
    : isAtRisk
      ? 'border-amber-200 bg-amber-50 hover:border-amber-400'
      : 'border-gray-200 bg-white hover:border-gray-400';

  const countClass = isError
    ? 'text-red-600'
    : isAtRisk
      ? 'text-amber-600'
      : 'text-gray-900';

  const Icon = isError ? AlertCircle : isAtRisk ? AlertTriangle : Tag;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border rounded-lg p-4 transition-all ${accentClass} ${active ? 'ring-2 ring-blue-500' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${isError ? 'text-red-500' : isAtRisk ? 'text-amber-500' : 'text-gray-500'}`} />
        <span className="text-xs font-medium text-gray-600">
          {COMPLIANCE_TYPE_LABELS[type as ComplianceType] ?? type}
        </span>
      </div>
      <p className={`text-3xl font-bold ${countClass}`}>{count}</p>
      <p className="text-xs text-gray-500 mt-1">
        {count === 1 ? 'listing' : 'listings'}
      </p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Expandable row for local violations
// ---------------------------------------------------------------------------

function ViolationRow({
  violation,
  onSuppress,
  suppressLoading,
}: {
  violation: LocalViolation;
  onSuppress: (id: string, listingId: string, connectionId: string, complianceType: string) => void;
  suppressLoading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const deadlineRaw =
    (violation.violationData as any)?.complianceDeadline ||
    (violation.violationData as any)?.deadline;
  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;

  const nestedViolations: ViolationDetail[] =
    (violation.violationData as any)?.violations ?? [];

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3">
          <button className="text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-4 py-3">
          <ComplianceTypeBadge type={violation.complianceType} />
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 font-mono">
          {violation.listingId ?? '-'}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={violation.message}>
          {violation.message}
        </td>
        <td className="px-4 py-3">
          <SeverityBadge severity={violation.severity} />
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={violation.status} />
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {deadline ? deadline.toLocaleDateString() : '-'}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {new Date(violation.createdAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {violation.status === 'OPEN' && violation.listingId && (
            <button
              onClick={() =>
                onSuppress(
                  violation.id,
                  violation.listingId!,
                  violation.connectionId,
                  violation.complianceType
                )
              }
              disabled={suppressLoading === violation.id}
              className="px-2 py-1 text-xs font-medium text-white bg-orange-500 rounded hover:bg-orange-600 disabled:opacity-50"
            >
              {suppressLoading === violation.id ? 'Suppressing...' : 'Suppress'}
            </button>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={9} className="px-6 py-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Reason Code: </span>
                  <code className="text-gray-800 bg-gray-100 px-1 py-0.5 rounded text-xs">
                    {violation.reasonCode}
                  </code>
                </div>
                <div>
                  <span className="font-medium text-gray-600">External ID: </span>
                  <code className="text-gray-800 bg-gray-100 px-1 py-0.5 rounded text-xs break-all">
                    {violation.externalViolationId}
                  </code>
                </div>
              </div>

              {nestedViolations.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Violation Details
                  </p>
                  <ul className="space-y-1.5">
                    {nestedViolations.map((v, i) => (
                      <li key={i} className="text-sm bg-white border border-gray-200 rounded p-2">
                        <span className="font-medium text-gray-700">{v.reasonCode}: </span>
                        <span className="text-gray-600">{v.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {violation.violationData && nestedViolations.length === 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Raw Violation Data
                  </p>
                  <pre className="text-xs text-gray-600 bg-white border border-gray-200 rounded p-2 overflow-x-auto max-h-32">
                    {JSON.stringify(violation.violationData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MarketplaceCompliancePage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('OPEN');

  // Data
  const [summary, setSummary] = useState<ViolationSummaryItem[]>([]);
  const [violations, setViolations] = useState<LocalViolation[]>([]);
  const [total, setTotal] = useState(0);

  // UI state
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [loadingViolations, setLoadingViolations] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [suppressLoading, setSuppressLoading] = useState<string | null>(null);

  // Pagination
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 25;

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const loadConnections = async () => {
    try {
      const res = await api.get<Connection[]>('/v1/marketplace/connections');
      setConnections(res.data);
      if (res.data.length > 0) setSelectedConnection(res.data[0].id);
    } catch {
      toast({ title: 'Error', description: 'Failed to load connections', variant: 'destructive' });
    } finally {
      setLoadingConnections(false);
    }
  };

  const loadSummary = useCallback(async () => {
    if (!selectedConnection) return;
    setLoadingSummary(true);
    try {
      const res = await api.get<{ violationSummaries: ViolationSummaryItem[] }>(
        '/v1/marketplace/compliance/summary',
        { params: { connectionId: selectedConnection } },
      );
      setSummary(res.data.violationSummaries ?? []);
    } catch {
      setSummary([]);
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedConnection]);

  const loadViolations = useCallback(async (currentOffset = 0) => {
    if (!selectedConnection) return;
    setLoadingViolations(true);
    try {
      const params: Record<string, string | number> = {
        connectionId: selectedConnection,
        limit: PAGE_SIZE,
        offset: currentOffset,
      };
      if (selectedType !== 'all') params.complianceType = selectedType;
      if (selectedStatus !== 'all') params.status = selectedStatus;

      const res = await api.get<{ violations: LocalViolation[]; total: number }>(
        '/v1/marketplace/compliance/local',
        { params },
      );
      setViolations(res.data.violations ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast({ title: 'Error', description: 'Failed to load violations', variant: 'destructive' });
      setViolations([]);
    } finally {
      setLoadingViolations(false);
    }
  }, [selectedConnection, selectedType, selectedStatus]);

  // Load connections on mount
  useEffect(() => {
    loadConnections();
  }, []);

  // Reload data when connection / filters change
  useEffect(() => {
    if (!selectedConnection) return;
    setOffset(0);
    loadSummary();
    loadViolations(0);
  }, [selectedConnection, selectedType, selectedStatus]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleSync = async () => {
    if (!selectedConnection) return;
    setSyncing(true);
    try {
      const res = await api.post<{ message: string }>('/v1/marketplace/compliance/sync', {
        connectionId: selectedConnection,
      });
      toast({ title: 'Sync complete', description: res.data.message });
      loadSummary();
      loadViolations(offset);
    } catch (err: any) {
      toast({
        title: 'Sync failed',
        description: err?.response?.data?.error || err?.response?.data?.message || 'Failed to sync violations',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSuppress = async (
    id: string,
    listingId: string,
    connectionId: string,
    complianceType: string
  ) => {
    setSuppressLoading(id);
    try {
      await api.post(`/v1/marketplace/compliance/${listingId}/suppress`, {
        connectionId,
        complianceType,
      });
      toast({ title: 'Suppressed', description: `Violation for listing ${listingId} suppressed` });
      loadViolations(offset);
      loadSummary();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.response?.data?.error || err?.response?.data?.message || 'Failed to suppress violation',
        variant: 'destructive',
      });
    } finally {
      setSuppressLoading(null);
    }
  };

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset);
    loadViolations(newOffset);
  };

  // ---------------------------------------------------------------------------
  // Summary helpers
  // ---------------------------------------------------------------------------

  const totalViolations = summary.reduce((acc, s) => acc + (s.listingCount ?? 0), 0);
  const getSummaryCount = (type: string) =>
    summary.find((s) => s.complianceType === type)?.listingCount ?? 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loadingConnections) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketplace Compliance</h1>
          <p className="text-gray-600 mt-2">
            Monitor listing compliance violations and resolve issues before they affect your account
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={!selectedConnection || syncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Violations'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a store...</option>
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.marketplaceId})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Compliance Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              {COMPLIANCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {COMPLIANCE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => { loadSummary(); loadViolations(offset); }}
            disabled={!selectedConnection}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {!selectedConnection ? (
        /* No store selected */
        <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <ShieldAlert className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a store to view compliance</h3>
          <p className="text-gray-500">
            Choose a connected store from the dropdown above to see violation data
          </p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* Summary Cards */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900">Violation Summary</h2>
              {loadingSummary && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
              {!loadingSummary && totalViolations > 0 && (
                <span className="ml-2 text-sm text-gray-500">
                  {totalViolations} total affected {totalViolations === 1 ? 'listing' : 'listings'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {COMPLIANCE_TYPES.map((type) => (
                <SummaryCard
                  key={type}
                  type={type}
                  count={getSummaryCount(type)}
                  active={selectedType === type}
                  onClick={() =>
                    setSelectedType((prev) => (prev === type ? 'all' : type))
                  }
                />
              ))}
            </div>
          </section>

          {/* Violations Table */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">Violations</h2>
              {loadingViolations && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
              {!loadingViolations && (
                <span className="text-sm text-gray-500">{total} total</span>
              )}
            </div>

            {loadingViolations && violations.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : violations.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <CheckCircle2 className="w-14 h-14 mx-auto text-green-300 mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No violations found</h3>
                <p className="text-gray-500 text-sm">
                  {selectedType !== 'all' || selectedStatus !== 'all'
                    ? 'Try adjusting your filters or sync latest data from eBay'
                    : 'Great — no compliance violations detected for this store'}
                </p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 w-8" />
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Listing ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Message
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Severity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Deadline
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Detected
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {violations.map((v) => (
                        <ViolationRow
                          key={v.id}
                          violation={v}
                          onSuppress={handleSuppress}
                          suppressLoading={suppressLoading}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {total > PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                    <p className="text-sm text-gray-500">
                      Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePageChange(Math.max(0, offset - PAGE_SIZE))}
                        disabled={offset === 0}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handlePageChange(offset + PAGE_SIZE)}
                        disabled={offset + PAGE_SIZE >= total}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
