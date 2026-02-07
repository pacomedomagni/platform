'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download, AlertTriangle } from 'lucide-react';
import { Card } from '@platform/ui';

interface ImportJob {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  errors: { row: number; error: string }[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

function getHeaders() {
  const token = localStorage.getItem('access_token');
  const tenantId = localStorage.getItem('tenantId');
  return {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenantId || '',
  };
}

export default function ProductImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/v1/store/admin/products/import/${jobId}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data: ImportJob = await res.json();
        setActiveJob(data);
        if (data.status === 'completed' || data.status === 'failed') {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      }
    } catch {
      // Ignore polling errors
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setActiveJob(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const headers = getHeaders();
      const res = await fetch('/api/v1/store/admin/products/import', {
        method: 'POST',
        headers: {
          Authorization: headers.Authorization,
          'x-tenant-id': headers['x-tenant-id'],
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Upload failed');
      }

      const data = await res.json();
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Start polling
      pollRef.current = setInterval(() => pollJobStatus(data.jobId), 2000);
      await pollJobStatus(data.jobId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Please drop a CSV file');
    }
  }, []);

  const downloadTemplate = () => {
    const csvContent = 'name,price,description,compareAtPrice,category,isFeatured,isPublished\n"Example Product",29.99,"A great product",39.99,"",false,true\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const progress = activeJob
    ? activeJob.totalRows > 0
      ? Math.round((activeJob.processedRows / activeJob.totalRows) * 100)
      : 0
    : 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href="/app/products"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Products
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Import Products
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a CSV file to bulk import products into your store
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* Upload Area */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Upload CSV</h2>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <Download className="h-4 w-4" />
              Download Template
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setError(null);
                }
              }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  Drop your CSV file here, or click to browse
                </p>
                <p className="mt-1 text-xs text-slate-400">Max 5MB, CSV format only</p>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Start Import'}
            </button>
            <p className="text-xs text-slate-400">
              Columns: name, price, description, compareAtPrice, category, isFeatured, isPublished
            </p>
          </div>
        </Card>

        {/* Import Progress */}
        {activeJob && (
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Import Progress</h2>
              {activeJob.status === 'processing' && (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              )}
              {activeJob.status === 'completed' && (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              )}
              {activeJob.status === 'failed' && (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>

            {/* Progress Bar */}
            <div className="mb-3 h-2.5 w-full rounded-full bg-slate-100">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  activeJob.status === 'failed' ? 'bg-red-500' : 'bg-blue-600'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                {activeJob.processedRows} of {activeJob.totalRows} rows processed
              </span>
              <span className="font-medium text-slate-700">{progress}%</span>
            </div>

            {/* Summary */}
            {(activeJob.status === 'completed' || activeJob.status === 'failed') && (
              <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="text-xs text-slate-500">Imported</p>
                  <p className="text-lg font-semibold text-emerald-600">
                    {activeJob.successCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Errors</p>
                  <p className="text-lg font-semibold text-red-600">
                    {activeJob.errorCount}
                  </p>
                </div>
              </div>
            )}

            {/* Error Table */}
            {activeJob.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Row Errors
                </h3>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Row</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeJob.errors.map((err, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                            {err.row}
                          </td>
                          <td className="px-3 py-2 text-red-600">{err.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Success Link */}
            {activeJob.status === 'completed' && activeJob.successCount > 0 && (
              <div className="mt-4">
                <Link
                  href="/app/products"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  View Products
                </Link>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
