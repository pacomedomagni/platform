'use client';

/**
 * ReportToolbar — shared filter strip for accounting reports.
 *
 * Replaces ad-hoc unlabeled date inputs + "Load" button per page. Presets fire
 * onChange immediately so the merchant doesn't have to click Load. CSV is always
 * available (clicking it calls onExport('csv')); PDF falls back to window.print()
 * when the parent doesn't override it, which is enough for "save as PDF" without
 * a backend rendering pipeline.
 */

import { useMemo } from 'react';
import { Button } from '@platform/ui';
import { Download, FileText, Printer, RefreshCw } from 'lucide-react';

export type ReportPreset =
  | 'today'
  | '7d'
  | '30d'
  | '90d'
  | 'mtd'
  | 'qtd'
  | 'ytd'
  | 'lastMonth';

const PRESET_LABELS: Record<ReportPreset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  mtd: 'Month to date',
  qtd: 'Quarter to date',
  ytd: 'Year to date',
  lastMonth: 'Last month',
};

const ALL_PRESETS: ReportPreset[] = ['today', '7d', '30d', '90d', 'mtd', 'qtd', 'ytd', 'lastMonth'];

const fmt = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Returns [from, to] in YYYY-MM-DD for the given preset. */
export function presetRange(preset: ReportPreset): [string, string] {
  const today = new Date();
  const to = fmt(today);
  switch (preset) {
    case 'today':
      return [to, to];
    case '7d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return [fmt(from), to];
    }
    case '30d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return [fmt(from), to];
    }
    case '90d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 89);
      return [fmt(from), to];
    }
    case 'mtd': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return [fmt(from), to];
    }
    case 'qtd': {
      const q = Math.floor(today.getMonth() / 3);
      const from = new Date(today.getFullYear(), q * 3, 1);
      return [fmt(from), to];
    }
    case 'ytd': {
      const from = new Date(today.getFullYear(), 0, 1);
      return [fmt(from), to];
    }
    case 'lastMonth': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return [fmt(from), fmt(last)];
    }
  }
}

export interface ReportToolbarProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** Refresh (re-fetch with current dates). Optional — most pages will want it. */
  onRefresh?: () => void;
  /** Loading state for the refresh spin. */
  loading?: boolean;
  /**
   * Called when the user requests an export. `'pdf'` defaults to window.print()
   * when the parent doesn't supply onExport — useful for the no-backend case.
   */
  onExport?: (format: 'csv' | 'pdf') => void | Promise<void>;
  /** Subset of presets to show (defaults to all). */
  presets?: ReportPreset[];
  /** Hide the To input when the report is point-in-time (e.g. balance sheet). */
  singleDate?: boolean;
  /** Label used for the From input when singleDate is true. */
  singleDateLabel?: string;
}

export function ReportToolbar({
  from,
  to,
  onChange,
  onRefresh,
  loading = false,
  onExport,
  presets = ALL_PRESETS,
  singleDate = false,
  singleDateLabel = 'As of',
}: ReportToolbarProps) {
  const presetOptions = useMemo(() => presets, [presets]);

  const handlePreset = (value: string) => {
    if (!value) return;
    const [pFrom, pTo] = presetRange(value as ReportPreset);
    onChange(pFrom, pTo);
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    if (onExport) {
      onExport(format);
      return;
    }
    // No-backend fallback for PDF — browsers reliably let users "Save as PDF" from print.
    if (format === 'pdf' && typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3 print:hidden">
      {!singleDate ? (
        <>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => onChange(e.target.value, to)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => onChange(from, e.target.value)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </label>
        </>
      ) : (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          {singleDateLabel}
          <input
            type="date"
            value={from}
            onChange={(e) => onChange(e.target.value, e.target.value)}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Preset
        <select
          // We use value="" so the dropdown stays in a "nothing selected" state after firing.
          value=""
          onChange={(e) => handlePreset(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="">Select…</option>
          {presetOptions.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2 ml-auto">
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
          <Download className="mr-2 h-3.5 w-3.5" />
          CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
          {onExport ? <FileText className="mr-2 h-3.5 w-3.5" /> : <Printer className="mr-2 h-3.5 w-3.5" />}
          PDF
        </Button>
      </div>
    </div>
  );
}

/** Tiny client-side CSV serializer — escape, quote, join. Handles strings, numbers, null, and undefined. */
export function toCSV(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (!rows.length) return '';
  const cols = columns ?? Object.keys(rows[0]);
  const escape = (val: unknown) => {
    if (val == null) return '';
    const s = String(val);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = cols.join(',');
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}

/** Trigger a browser download for arbitrary CSV string. */
export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
