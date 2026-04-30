/**
 * Shared formatting + CSV-export helpers for inventory / accounting reports.
 *
 * R-COMMON-5: render numeric values with thousands separators and the
 * tenant's base currency for $-denominated columns. Inventory reports were
 * showing raw "123.4500" strings; financial reports already had their own
 * formatCurrency, this aligns the rest.
 *
 * R-COMMON-6: CSV export for non-financial reports (stock balance/aging/
 * movement/ledger/valuation/locations/serials/reorder-suggestions/aging).
 */

const tenantCurrency = (): string => {
  if (typeof window === 'undefined') return 'USD';
  return localStorage.getItem('tenantCurrency') || 'USD';
};

/** Format a Number-like value with thousands separators. Empty for null/undefined. */
export function formatQty(value: string | number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Format a Number-like value as currency in the tenant's base currency. */
export function formatMoney(value: string | number | null | undefined, currency?: string): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: currency || tenantCurrency(),
  });
}

/**
 * Build a CSV blob and trigger a browser download. Header is the first row;
 * rows are arrays of cell values that get escaped per RFC 4180.
 */
export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>): void {
  const escape = (cell: string | number | null | undefined): string => {
    if (cell === null || cell === undefined) return '';
    const s = typeof cell === 'string' ? cell : String(cell);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ];
  // Prepend BOM so Excel reads UTF-8 correctly. Excel's default in
  // Windows-locale region is to interpret bare CSV as Windows-1252 and
  // mangle accented characters; the BOM forces UTF-8 detection.
  const blob = new Blob(['﻿', lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const datePart = new Date().toISOString().split('T')[0];
  link.download = filename.endsWith('.csv') ? filename : `${filename}-${datePart}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke after a tick so Safari has a chance to consume the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
