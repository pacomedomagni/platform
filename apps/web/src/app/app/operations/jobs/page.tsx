'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button, Card, Badge, ConfirmDialog } from '@platform/ui';
import api from '../../../../lib/api';
import {
  ReportAlert,
  ReportCard,
  ReportEmpty,
  ReportPage,
  ReportTable,
} from '../../reports/_components/report-shell';
import {
  ArrowLeft,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Ban,
  RefreshCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

type Job = {
  id: string;
  type: string;
  status: JobStatus;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

type JobStats = {
  pending: number;
  running: number;
  completed: number;
  failed: number;
};

const STATUS_OPTIONS: { value: '' | JobStatus; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusConfig: Record<
  JobStatus,
  { icon: typeof Clock; colorClass: string; badgeDot: string; label: string }
> = {
  pending: {
    icon: Clock,
    colorClass: 'bg-amber-50 text-amber-700 border-amber-200',
    badgeDot: 'bg-amber-500',
    label: 'Pending',
  },
  running: {
    icon: Play,
    colorClass: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeDot: 'bg-blue-500 animate-pulse',
    label: 'Running',
  },
  completed: {
    icon: CheckCircle,
    colorClass: 'bg-green-50 text-green-700 border-green-200',
    badgeDot: 'bg-green-500',
    label: 'Completed',
  },
  failed: {
    icon: XCircle,
    colorClass: 'bg-red-50 text-red-700 border-red-200',
    badgeDot: 'bg-red-500',
    label: 'Failed',
  },
  cancelled: {
    icon: Ban,
    colorClass: 'bg-slate-50 text-slate-700 border-slate-200',
    badgeDot: 'bg-slate-500',
    label: 'Cancelled',
  },
};

const REFRESH_INTERVAL = 10_000;
const PAGE_LIMIT = 20;

export default function BackgroundJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [totalJobs, setTotalJobs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'' | JobStatus>('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  // Confirm dialogs
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [retryConfirm, setRetryConfirm] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/v1/operations/jobs/stats');
      setStats(res.data);
    } catch (e: any) {
      // Stats failure is non-critical, don't block the page
      console.error('Failed to load job stats:', e);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const params: Record<string, string | number> = {
        page,
        limit: PAGE_LIMIT,
      };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;

      const res = await api.get('/v1/operations/jobs', { params });
      setJobs(res.data.data || res.data.jobs || []);
      setTotalJobs(res.data.total ?? res.data.data?.length ?? 0);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load jobs');
    }
  }, [page, statusFilter, typeFilter]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([loadStats(), loadJobs()]);
    setLoading(false);
  }, [loadStats, loadJobs]);

  // Initial load and auto-refresh
  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      loadStats();
      loadJobs();
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadAll, loadStats, loadJobs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  // Auto-clear success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const cancelJob = async () => {
    const id = cancelConfirm;
    if (!id) return;
    setCancelConfirm(null);
    setError(null);
    try {
      await api.post(`/v1/operations/jobs/${id}/cancel`);
      setSuccess('Job cancelled successfully');
      loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to cancel job');
    }
  };

  const retryJob = async () => {
    const id = retryConfirm;
    if (!id) return;
    setRetryConfirm(null);
    setError(null);
    try {
      await api.post(`/v1/operations/jobs/${id}/retry`);
      setSuccess('Job retried successfully');
      loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to retry job');
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '--';
    return new Date(date).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const truncate = (str: string, len: number) => {
    if (str.length <= len) return str;
    return str.slice(0, len) + '...';
  };

  const totalPages = Math.max(1, Math.ceil(totalJobs / PAGE_LIMIT));

  const statsCards: { key: keyof JobStats; label: string; icon: typeof Clock; color: string }[] = [
    { key: 'pending', label: 'Pending', icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { key: 'running', label: 'Running', icon: Play, color: 'text-blue-600 bg-blue-50' },
    { key: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { key: 'failed', label: 'Failed', icon: XCircle, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <ReportPage
      title="Background Jobs"
      description="Monitor and manage scheduled and running background tasks"
      actions={
        <Button variant="outline" size="sm" onClick={() => loadAll()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      }
    >
      {/* Back link */}
      <Link
        href="/app/operations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Operations
      </Link>

      {error && <ReportAlert>{error}</ReportAlert>}
      {success && (
        <div className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          {success}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">{card.label}</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {stats ? (stats[card.key] ?? 0).toLocaleString() : '--'}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="p-4 bg-white/90 dark:bg-slate-950/70 backdrop-blur border-border/70">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | JobStatus)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <input
              type="text"
              placeholder="Filter by job type..."
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('');
                setTypeFilter('');
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Jobs Table */}
      <ReportCard>
        <ReportTable>
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="text-left p-3 font-medium">Job ID</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Created</th>
              <th className="text-left p-3 font-medium">Started</th>
              <th className="text-left p-3 font-medium">Completed</th>
              <th className="text-left p-3 font-medium">Error</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading jobs...
                  </div>
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <ReportEmpty colSpan={8} message="No jobs found" />
            ) : (
              jobs.map((job) => {
                const config = statusConfig[job.status];
                const StatusIcon = config.icon;

                return (
                  <tr key={job.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <code className="text-xs bg-muted px-2 py-1 rounded" title={job.id}>
                        {truncate(job.id, 12)}
                      </code>
                    </td>
                    <td className="p-3">
                      <span className="text-sm font-medium">{job.type}</span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${config.colorClass}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${config.badgeDot}`} />
                        {config.label}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(job.startedAt)}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(job.completedAt)}
                    </td>
                    <td className="p-3">
                      {job.error ? (
                        <span
                          className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded cursor-help"
                          title={job.error}
                        >
                          {truncate(job.error, 30)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(job.status === 'pending' || job.status === 'running') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCancelConfirm(job.id)}
                            title="Cancel Job"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        {job.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRetryConfirm(job.id)}
                            title="Retry Job"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </ReportTable>
      </ReportCard>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_LIMIT + 1}--{Math.min(page * PAGE_LIMIT, totalJobs)} of{' '}
            {totalJobs.toLocaleString()} jobs
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <p className="text-xs text-muted-foreground text-center">
        Auto-refreshes every 10 seconds
      </p>

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={cancelConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setCancelConfirm(null);
        }}
        title="Cancel Job"
        description="Are you sure you want to cancel this job? This action cannot be undone."
        confirmLabel="Cancel Job"
        variant="destructive"
        onConfirm={cancelJob}
      />

      {/* Retry Confirmation */}
      <ConfirmDialog
        open={retryConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setRetryConfirm(null);
        }}
        title="Retry Job"
        description="Are you sure you want to retry this failed job?"
        confirmLabel="Retry"
        onConfirm={retryJob}
      />
    </ReportPage>
  );
}
