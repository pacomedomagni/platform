'use client';

/**
 * L19: eBay bulk listing importer.
 *
 * Pipeline:
 *   1. Seller picks a destination connection.
 *   2. Seller pastes CSV or uploads a .csv file.
 *   3. We parse it locally (no upload of raw CSV — we only POST the
 *      structured row objects to the API).
 *   4. We render a preview table with column-mapping inferred from
 *      headers. The seller can fix any wrong rows here.
 *   5. POST to /v1/marketplace/ebay/listings/bulk-import (capped 500
 *      rows per call by the backend; we batch larger files).
 *   6. Render per-row success/failure report; failed rows stay
 *      visible so the seller can fix and re-submit.
 *
 * Output: drafts only. The seller publishes them after review via
 * the normal listings page.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from '@platform/ui';
import { Upload, CheckCircle2, XCircle, ArrowLeft, FileText, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

const REQUIRED_COLUMNS = [
  'sku',
  'title',
  'price',
  'quantity',
  'condition',
  'categoryId',
  'productListingId',
] as const;
const OPTIONAL_COLUMNS = [
  'description',
  'subtitle',
  'warehouseId',
  'conditionDescription',
  'secondaryCategoryId',
  'photos',          // pipe-separated URLs
  'itemSpecifics',   // JSON: {"Brand":["Apple"],"Model":["iPhone 15"]}
  'fulfillmentPolicyId',
  'paymentPolicyId',
  'returnPolicyId',
] as const;

type RowResult =
  | { kind: 'pending'; index: number; data: Record<string, any> }
  | { kind: 'ok'; index: number; data: Record<string, any>; listingId: string }
  | { kind: 'fail'; index: number; data: Record<string, any>; error: string };

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

/** Minimal CSV parser. Handles quoted fields and escaped quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cur);
        cur = '';
      } else if (ch === '\n') {
        row.push(cur);
        cur = '';
        rows.push(row);
        row = [];
      } else if (ch === '\r') {
        // ignore — handled with \n
      } else {
        cur += ch;
      }
    }
  }
  // flush
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Map a parsed-row array to an object using the header row, coercing
 *  the few well-known numeric fields. */
function rowToObject(headers: string[], row: string[]): Record<string, any> {
  const obj: Record<string, any> = {};
  headers.forEach((h, i) => {
    const key = h.trim();
    let value: any = (row[i] ?? '').trim();
    if (value === '') return; // omit empty cells so backend defaults apply
    if (key === 'price') value = Number(value);
    if (key === 'quantity') value = Number(value);
    if (key === 'lotSize' || key === 'weightValue' || key === 'dimensionLength' || key === 'dimensionWidth' || key === 'dimensionHeight') {
      value = Number(value);
    }
    if (key === 'photos') {
      // pipe-separated for CSV friendliness
      value = String(value).split('|').map((s) => s.trim()).filter(Boolean);
    }
    if (key === 'itemSpecifics' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        // keep raw string; backend will reject and surface via per-row error
      }
    }
    obj[key] = value;
  });
  return obj;
}

const SAMPLE_CSV =
  'sku,title,price,quantity,condition,categoryId,productListingId,description,photos,itemSpecifics\n' +
  'EXAMPLE-001,Vintage Leather Wallet,29.99,5,USED_EXCELLENT,2996,prod-uuid-here,"Genuine leather, lightly used","https://cdn.example.com/img1.jpg|https://cdn.example.com/img2.jpg","{""Brand"":[""Coach""],""Color"":[""Brown""]}"\n';

export default function BulkImportPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [results, setResults] = useState<RowResult[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Connection[]>('/v1/marketplace/connections')
      .then((res) => {
        const ebay = res.data.filter((c) => c.platform === 'EBAY' && c.isConnected);
        setConnections(ebay);
        if (ebay.length === 1) setConnectionId(ebay[0].id);
      })
      .catch(() => setConnections([]));
  }, []);

  const parsed = useMemo(() => {
    setParseError(null);
    if (!csvText.trim()) return { headers: [], rows: [] as Record<string, any>[] };
    const grid = parseCsv(csvText);
    if (grid.length === 0) return { headers: [], rows: [] };
    const headers = grid[0];
    const missingRequired = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
    if (missingRequired.length > 0) {
      setParseError(`Missing required column(s): ${missingRequired.join(', ')}`);
      return { headers, rows: [] };
    }
    const rows = grid.slice(1).map((r) => rowToObject(headers, r));
    return { headers, rows };
  }, [csvText]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
    setResults([]);
  };

  const handleSubmit = async () => {
    if (!connectionId) {
      toast({ title: 'Pick a destination', description: 'Choose an eBay store first', variant: 'destructive' });
      return;
    }
    if (parsed.rows.length === 0) return;

    setSubmitting(true);
    setResults(parsed.rows.map((data, i) => ({ kind: 'pending', index: i, data })));
    try {
      // Backend caps at 500/req — batch larger imports.
      const BATCH = 500;
      const accumulated: RowResult[] = [];
      for (let offset = 0; offset < parsed.rows.length; offset += BATCH) {
        const batch = parsed.rows.slice(offset, offset + BATCH).map((r) => ({
          ...r,
          connectionId,
        }));
        const res = await api.post<{
          succeeded: Array<{ index: number; listingId: string; sku?: string }>;
          failed: Array<{ index: number; sku?: string; error: string }>;
        }>(`/v1/marketplace/ebay/listings/bulk-import`, { rows: batch });
        const okSet = new Map(res.data.succeeded.map((s) => [s.index, s.listingId]));
        const failMap = new Map(res.data.failed.map((f) => [f.index, f.error]));
        batch.forEach((data, i) => {
          const globalIdx = offset + i;
          if (okSet.has(i)) {
            accumulated.push({ kind: 'ok', index: globalIdx, data, listingId: okSet.get(i)! });
          } else if (failMap.has(i)) {
            accumulated.push({ kind: 'fail', index: globalIdx, data, error: failMap.get(i)! });
          } else {
            accumulated.push({ kind: 'fail', index: globalIdx, data, error: 'No response from server' });
          }
        });
      }
      setResults(accumulated);
      const okCount = accumulated.filter((r) => r.kind === 'ok').length;
      const failCount = accumulated.filter((r) => r.kind === 'fail').length;
      toast({
        title: 'Import complete',
        description: `${okCount} drafts created${failCount ? `, ${failCount} failed` : ''}`,
        variant: failCount > 0 ? 'destructive' : undefined,
      });
    } catch (err: any) {
      toast({
        title: 'Import failed',
        description: err?.response?.data?.error ?? err?.message ?? 'Unknown error',
        variant: 'destructive',
      });
      setResults([]);
    } finally {
      setSubmitting(false);
    }
  };

  const okCount = results.filter((r) => r.kind === 'ok').length;
  const failCount = results.filter((r) => r.kind === 'fail').length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link
        href="/app/marketplace/listings"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to listings
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Bulk import eBay listings</h1>
      <p className="text-gray-600 mb-6">
        Upload a CSV to create draft listings in bulk. Drafts go through
        your normal review &amp; publish flow.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: input */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destination store
            </label>
            <select
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Pick an eBay store —</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.marketplaceId})
                </option>
              ))}
            </select>
            {connections.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No connected eBay stores. <Link href="/app/marketplace/connections" className="underline">Connect one first.</Link>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CSV file
            </label>
            <label
              htmlFor="csv-file"
              className="flex items-center justify-center gap-2 w-full px-3 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <Upload className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-700">Click to choose a .csv</span>
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              …or paste CSV directly below.
            </p>
          </div>

          <div>
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setResults([]);
              }}
              placeholder="Paste CSV content here, including the header row."
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setCsvText(SAMPLE_CSV)}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <FileText className="w-3 h-3" />
            Insert sample row
          </button>
        </div>

        {/* Right: spec + actions */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">CSV format</h3>
            <p className="text-xs text-gray-600 mb-2">
              Header row is required. Required columns:
            </p>
            <div className="flex flex-wrap gap-1 mb-3">
              {REQUIRED_COLUMNS.map((c) => (
                <span
                  key={c}
                  className="px-2 py-0.5 text-xs font-mono bg-red-100 text-red-800 rounded"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-600 mb-2">Optional:</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {OPTIONAL_COLUMNS.map((c) => (
                <span
                  key={c}
                  className="px-2 py-0.5 text-xs font-mono bg-gray-200 text-gray-700 rounded"
                >
                  {c}
                </span>
              ))}
            </div>
            <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
              <li><strong>photos</strong>: pipe-separated URLs, e.g. <code className="bg-white px-1 rounded">https://a|https://b</code></li>
              <li><strong>itemSpecifics</strong>: JSON object, e.g. <code className="bg-white px-1 rounded">{`{"Brand":["Apple"]}`}</code></li>
              <li>Backend caps each batch at <strong>500 rows</strong>. Larger CSVs are auto-batched.</li>
              <li>Drafts only — you publish them from the listings page after review.</li>
            </ul>
          </div>

          {parseError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-900">{parseError}</p>
            </div>
          )}

          {parsed.rows.length > 0 && !parseError && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-900">
                Parsed <strong>{parsed.rows.length}</strong> row{parsed.rows.length === 1 ? '' : 's'} from CSV.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || parsed.rows.length === 0 || !connectionId}
            className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Importing…' : `Import ${parsed.rows.length || ''} draft listing${parsed.rows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>

      {/* Results table — pinned at the bottom so the page doesn't jump
          on submit. Failed rows stay visible for fix-up. */}
      {results.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Results</h2>
          <p className="text-sm text-gray-600 mb-4">
            {okCount} created · {failCount} failed
          </p>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">SKU</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Title</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((r) => (
                  <tr key={r.index} className={r.kind === 'fail' ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2 text-gray-600">{r.index + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.data.sku ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-900">{r.data.title ?? '—'}</td>
                    <td className="px-3 py-2">
                      {r.kind === 'ok' && (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <CheckCircle2 className="w-4 h-4" />
                          Created (<code className="text-xs">{r.listingId.slice(0, 8)}…</code>)
                        </span>
                      )}
                      {r.kind === 'fail' && (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <XCircle className="w-4 h-4 flex-shrink-0" />
                          <span className="text-xs">{r.error}</span>
                        </span>
                      )}
                      {r.kind === 'pending' && (
                        <span className="text-gray-500 text-xs">…</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
