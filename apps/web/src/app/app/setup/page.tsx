'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Skeleton, StatusBadge } from '@platform/ui';
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import api from '../../../lib/api';

interface Step {
  label: string;
  href: string;
  description: string;
  /** DocType to count records of. If count > 0 we mark this step complete. */
  docType?: string;
  required?: boolean;
}

const STEPS: Step[] = [
  { label: 'Define UOMs', href: '/app/UOM', description: 'Standardize units of measure for inventory and sales.', docType: 'UOM', required: true },
  { label: 'Create Warehouses', href: '/app/Warehouse', description: 'Set up storage locations and site codes.', docType: 'Warehouse', required: true },
  { label: 'Create Locations', href: '/app/Location', description: 'Build bin hierarchy for picking and putaway.', docType: 'Location' },
  { label: 'Create Items', href: '/app/Item', description: 'Add your products and services.', docType: 'Item', required: true },
  { label: 'Set Reorder Levels', href: '/app/Item', description: 'Configure replenishment thresholds per item.' },
  { label: 'Chart of Accounts', href: '/app/Account', description: 'Define the accounting structure for postings.', docType: 'Account', required: true },
  { label: 'Customers', href: '/app/Customer', description: 'Create customer records for sales transactions.', docType: 'Customer' },
  { label: 'Suppliers', href: '/app/Supplier', description: 'Create supplier records for purchases.', docType: 'Supplier' },
];

export default function SetupPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Track which doctype counts came from a successful response vs. a
  // failed/timed-out call. Without this, a 5xx looked identical to "0
  // records exist," pushing the user to "create one" when they may have
  // had ten that the API just failed to return. See SE1/SE2.
  const [failedTypes, setFailedTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const docTypes = Array.from(new Set(STEPS.map((s) => s.docType).filter(Boolean) as string[]));

      // SE1: timeout each call so a hung API doesn't leave the user
      // staring at a Skeleton forever.
      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Timed out')), ms)
          ),
        ]);

      const results = await Promise.allSettled(
        docTypes.map((dt) => withTimeout(api.get(`/v1/doc/${encodeURIComponent(dt)}`), 8000))
      );
      if (!alive) return;
      const next: Record<string, number> = {};
      const failed = new Set<string>();
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const arr = Array.isArray(r.value.data) ? r.value.data : [];
          next[docTypes[i]] = arr.length;
        } else {
          failed.add(docTypes[i]);
        }
      });
      setCounts(next);
      setFailedTypes(failed);
      setLoading(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const isComplete = (step: Step): boolean => !!step.docType && (counts[step.docType] ?? 0) > 0;
  const completedCount = STEPS.filter(isComplete).length;
  const completionPct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Setup Checklist</h1>
          <p className="text-sm text-slate-500">Complete these steps to start transacting.</p>
        </div>
      </div>

      {/* Progress overview */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progress</p>
            <p className="mt-1 text-2xl font-semibold">
              {loading ? <Skeleton className="h-7 w-28" /> : `${completedCount} of ${STEPS.length} complete`}
            </p>
          </div>
          <span className="text-3xl font-bold text-emerald-600">{loading ? '—' : `${completionPct}%`}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </Card>

      <Card className="p-6 space-y-4 bg-white/90 dark:bg-slate-950/80 backdrop-blur">
        {STEPS.map((step, idx) => {
          const complete = isComplete(step);
          const count = step.docType ? counts[step.docType] ?? 0 : null;
          return (
            <div key={step.label} className="flex items-start gap-4 border-b last:border-0 pb-4 last:pb-0">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${
                  complete
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gradient-to-br from-indigo-600 via-blue-500 to-amber-400 text-white'
                }`}
              >
                {complete ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600"
                    href={step.href}
                  >
                    {step.label}
                  </Link>
                  {step.required && !complete && !failedTypes.has(step.docType ?? '') && (
                    <StatusBadge kind="customer" status="UNVERIFIED" label="Required" />
                  )}
                  {complete && <StatusBadge kind="customer" status="VERIFIED" label={`${count} record${count === 1 ? '' : 's'}`} />}
                  {step.docType && failedTypes.has(step.docType) && (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Couldn&apos;t load
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">{step.description}</p>
              </div>
              <Link
                href={step.href}
                className="inline-flex items-center gap-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                {complete ? 'Manage' : 'Open'}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
