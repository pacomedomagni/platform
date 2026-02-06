'use client';

import { useState, useRef } from 'react';
import { Card, Button, NativeSelect, Label, Badge } from '@platform/ui';
import { Upload, Download, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import api from '../../../../lib/api';

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

interface PreviewRow {
  [key: string]: string;
}

export default function ImportPage() {
  const [entityType, setEntityType] = useState<'products' | 'customers' | 'inventory'>('products');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [options, setOptions] = useState({
    skipDuplicates: false,
    updateExisting: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setPreview([]);

    // Parse CSV and show preview
    const text = await selectedFile.text();
    const rows = parseCSV(text);
    setPreview(rows.slice(0, 10));
  };

  const parseCSV = (text: string): PreviewRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows: PreviewRow[] = [];

    for (let i = 1; i < Math.min(lines.length, 11); i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: PreviewRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    return rows;
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);
      formData.append('skipDuplicates', String(options.skipDuplicates));
      formData.append('updateExisting', String(options.updateExisting));

      const res = await api.post('/v1/operations/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult(res.data);
    } catch (error: any) {
      console.error('Import failed:', error);
      alert('Import failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = (type: string) => {
    const templates = {
      products: 'code,name,price,cost,reorderLevel\nPROD001,Sample Product,99.99,50.00,10',
      customers: 'email,firstName,lastName,phone\ncustomer@example.com,John,Doe,+1234567890',
      inventory: 'code,warehouse,quantity\nPROD001,MAIN,100',
    };

    const content = templates[type as keyof typeof templates];
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}-template.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownloadErrors = () => {
    if (!result || result.errors.length === 0) return;

    const csvContent = [
      'Row,Error',
      ...result.errors.map(e => `${e.row},"${e.error}"`),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'import-errors.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      setFile(droppedFile);

      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const rows = parseCSV(text);
        setPreview(rows.slice(0, 10));
      };
      reader.readAsText(droppedFile);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Bulk Import
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Import products, customers, or inventory from CSV files
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Configuration */}
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-4">Import Settings</h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <NativeSelect
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value as any)}
                >
                  <option value="products">Products</option>
                  <option value="customers">Customers</option>
                  <option value="inventory">Inventory</option>
                </NativeSelect>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.skipDuplicates}
                    onChange={(e) =>
                      setOptions({ ...options, skipDuplicates: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Skip duplicates</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.updateExisting}
                    onChange={(e) =>
                      setOptions({ ...options, updateExisting: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Update existing records</span>
                </label>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-4">Download Templates</h2>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleDownloadTemplate('products')}
              >
                <Download className="w-4 h-4 mr-2" />
                Products Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleDownloadTemplate('customers')}
              >
                <Download className="w-4 h-4 mr-2" />
                Customers Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleDownloadTemplate('inventory')}
              >
                <Download className="w-4 h-4 mr-2" />
                Inventory Template
              </Button>
            </div>
          </Card>
        </div>

        {/* Upload & Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* File Upload */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-4">Upload File</h2>

            <div
              className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">
                {file ? file.name : 'Drop your CSV file here or click to browse'}
              </p>
              <p className="text-xs text-muted-foreground">
                Supports CSV files up to 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {file && (
              <div className="mt-4 flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreview([]);
                    setResult(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {file && !result && (
              <Button className="w-full mt-4" onClick={handleImport} disabled={importing}>
                {importing ? 'Importing...' : 'Start Import'}
              </Button>
            )}
          </Card>

          {/* Preview */}
          {preview.length > 0 && !result && (
            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4">
                Preview (First 10 rows)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      {Object.keys(preview[0]).map((header) => (
                        <th key={header} className="text-left p-2 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        {Object.values(row).map((value, cellIdx) => (
                          <td key={cellIdx} className="p-2">
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Results */}
          {result && (
            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                {result.errors.length === 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                )}
                Import Results
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{result.total}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{result.created}</p>
                  <p className="text-xs text-muted-foreground">Created</p>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                  <p className="text-xs text-muted-foreground">Updated</p>
                </div>
                <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-destructive">
                      {result.errors.length} Errors Found
                    </h3>
                    <Button size="sm" variant="outline" onClick={handleDownloadErrors}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Error Report
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {result.errors.map((error, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm"
                      >
                        <span className="font-medium">Row {error.row}:</span> {error.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                className="w-full mt-4"
                onClick={() => {
                  setFile(null);
                  setPreview([]);
                  setResult(null);
                }}
              >
                Import Another File
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
