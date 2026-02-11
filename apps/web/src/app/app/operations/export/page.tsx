'use client';

import { useState } from 'react';
import { Card, Button, NativeSelect, Label, Input, toast } from '@platform/ui';
import { Download, FileJson, FileSpreadsheet, Calendar } from 'lucide-react';
import api from '../../../../lib/api';

interface ExportHistory {
  id: string;
  entityType: string;
  format: string;
  recordCount: number;
  createdAt: string;
}

export default function ExportPage() {
  const [entityType, setEntityType] = useState<'products' | 'customers' | 'inventory' | 'orders'>('orders');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);

    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange.endDate) params.set('endDate', dateRange.endDate);

      const endpoint = `/v1/operations/export/${entityType}?${params.toString()}`;

      const response = await api.get(endpoint, {
        responseType: 'blob',
        params: { format },
      });

      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${entityType}-export-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Export failed:', error);
      toast({ title: 'Error', description: 'Export failed: ' + (error.response?.data?.message || error.message), variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const entityOptions = [
    { value: 'products', label: 'Products', description: 'Export product catalog with pricing' },
    { value: 'customers', label: 'Customers', description: 'Export customer list with contact info' },
    { value: 'inventory', label: 'Inventory', description: 'Export stock levels by warehouse' },
    { value: 'orders', label: 'Orders', description: 'Export order history with details' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Bulk Export
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Export data to CSV or JSON format
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Export Configuration */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-6">Export Configuration</h2>

          <div className="space-y-6">
            {/* Entity Type */}
            <div className="space-y-2">
              <Label>Select Data to Export</Label>
              <div className="grid gap-3">
                {entityOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      entityType === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="entityType"
                      value={option.value}
                      checked={entityType === option.value}
                      onChange={(e) => setEntityType(e.target.value as any)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Format Selection */}
            <div className="space-y-2">
              <Label>Export Format</Label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    format === 'csv'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value="csv"
                    checked={format === 'csv'}
                    onChange={(e) => setFormat(e.target.value as 'csv')}
                  />
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium">CSV</p>
                    <p className="text-xs text-muted-foreground">Excel compatible</p>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    format === 'json'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value="json"
                    checked={format === 'json'}
                    onChange={(e) => setFormat(e.target.value as 'json')}
                  />
                  <FileJson className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium">JSON</p>
                    <p className="text-xs text-muted-foreground">API friendly</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Date Range (for orders) */}
            {entityType === 'orders' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date Range (Optional)
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Start Date</Label>
                    <Input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) =>
                        setDateRange({ ...dateRange, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">End Date</Label>
                    <Input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) =>
                        setDateRange({ ...dateRange, endDate: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Export Button */}
            <Button className="w-full" onClick={handleExport} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : `Export ${entityType}`}
            </Button>
          </div>
        </Card>

        {/* Export Info & Field Preview */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-6">Export Fields</h2>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The following fields will be included in your export:
            </p>

            {entityType === 'products' && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Product Code</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Product Name</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Price</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Cost Price</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Reorder Level</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Created Date</span>
                </div>
              </div>
            )}

            {entityType === 'customers' && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Email</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">First Name</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Last Name</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Phone</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Created Date</span>
                </div>
              </div>
            )}

            {entityType === 'inventory' && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Product Code</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Product Name</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Quantity on Hand</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Cost Price</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Stock Value</span>
                </div>
              </div>
            )}

            {entityType === 'orders' && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Order Number</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Customer Email</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Status</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Payment Status</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Subtotal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Tax</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Shipping</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Total</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Item Count</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">Created Date</span>
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">Export Tips</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• CSV files can be opened in Excel or Google Sheets</li>
                <li>• JSON files are ideal for API integrations</li>
                <li>• Large exports may take a few moments to generate</li>
                <li>• Dates are exported in ISO 8601 format</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
