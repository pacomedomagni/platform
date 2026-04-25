'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Skeleton, StatusBadge, EmptyState } from '@platform/ui';
import {
  Webhook,
  FileText,
  Clock,
  Bell,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import api from '../../../lib/api';

interface OperationsSummary {
  webhooks: { total: number; active: number; failing: number };
  jobs: { running: number; queued: number; failedRecent: number };
  audit: { lastEntryAt: string | null; entriesToday: number };
}

const operationsLinks = [
  {
    href: '/app/operations/webhooks',
    icon: Webhook,
    title: 'Webhooks',
    description: 'Configure webhook integrations for real-time events',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    href: '/app/operations/audit-logs',
    icon: FileText,
    title: 'Audit Logs',
    description: 'View system activity and change history',
    color: 'text-green-600 bg-green-50',
  },
  {
    href: '/app/operations/jobs',
    icon: Clock,
    title: 'Background Jobs',
    description: 'Monitor scheduled and running tasks',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    href: '/app/operations/notifications',
    icon: Bell,
    title: 'Notifications',
    description: 'Manage notification templates and alerts',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    href: '/app/operations/import',
    icon: Upload,
    title: 'Import Data',
    description: 'Bulk import products, customers, and more',
    color: 'text-indigo-600 bg-indigo-50',
  },
  {
    href: '/app/operations/export',
    icon: Download,
    title: 'Export Data',
    description: 'Export data in CSV, JSON, or Excel format',
    color: 'text-red-600 bg-red-50',
  },
];

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function OperationsPage() {
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [webhooksRes, jobsStatsRes, auditRes] = await Promise.allSettled([
          api.get('/v1/operations/webhooks'),
          api.get('/v1/operations/jobs/stats'),
          api.get('/v1/operations/audit-logs', { params: { limit: 1 } }),
        ]);

        if (!alive) return;

        const webhooks = webhooksRes.status === 'fulfilled'
          ? (webhooksRes.value.data?.data || webhooksRes.value.data || [])
          : [];
        const jobsStats = jobsStatsRes.status === 'fulfilled' ? jobsStatsRes.value.data : {};
        const auditData = auditRes.status === 'fulfilled' ? auditRes.value.data : {};
        const auditEntries = auditData?.data || auditData?.entries || [];

        setSummary({
          webhooks: {
            total: Array.isArray(webhooks) ? webhooks.length : 0,
            active: Array.isArray(webhooks) ? webhooks.filter((w: any) => w.isActive !== false && w.status !== 'DISABLED').length : 0,
            failing: Array.isArray(webhooks) ? webhooks.filter((w: any) => w.lastDeliveryStatus === 'FAILED' || w.status === 'FAILING').length : 0,
          },
          jobs: {
            running: jobsStats?.running || 0,
            queued: jobsStats?.queued || jobsStats?.pending || 0,
            failedRecent: jobsStats?.failed || jobsStats?.failedRecent || 0,
          },
          audit: {
            lastEntryAt: auditEntries[0]?.createdAt || auditData?.lastEntryAt || null,
            entriesToday: auditData?.entriesToday || auditData?.summary?.today || 0,
          },
        });
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Operations
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          System integrations, automations, and data management
        </p>
      </div>

      {/* Status overview */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
              <Skeleton className="mt-2 h-3 w-32" />
            </Card>
          ))}
        </div>
      ) : error || !summary ? (
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Couldn't load operations summary"
          description="Status endpoints didn't respond. Use the cards below to navigate to each tool directly."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Webhooks</span>
              <Webhook className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{summary.webhooks.active}</span>
              <span className="text-xs text-muted-foreground">of {summary.webhooks.total} active</span>
            </div>
            {summary.webhooks.failing > 0 ? (
              <div className="mt-2 flex items-center gap-1.5">
                <StatusBadge kind="webhook" status="FAILING" />
                <span className="text-xs text-muted-foreground">{summary.webhooks.failing} failing</span>
              </div>
            ) : (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> All healthy
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Background jobs</span>
              <Clock className="h-4 w-4 text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{summary.jobs.running + summary.jobs.queued}</span>
              <span className="text-xs text-muted-foreground">in flight ({summary.jobs.running} running, {summary.jobs.queued} queued)</span>
            </div>
            {summary.jobs.failedRecent > 0 ? (
              <div className="mt-2 flex items-center gap-1.5">
                <StatusBadge kind="job" status="FAILED" />
                <span className="text-xs text-muted-foreground">{summary.jobs.failedRecent} recent failures</span>
              </div>
            ) : (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> No recent failures
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Audit activity</span>
              <Activity className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{summary.audit.entriesToday}</span>
              <span className="text-xs text-muted-foreground">events today</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Last entry {relativeTime(summary.audit.lastEntryAt)}</p>
          </Card>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Tools</h2>
        <div className="mt-3 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {operationsLinks.map((link) => {
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
                      <p className="text-sm text-slate-500 mt-1">
                        {link.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
