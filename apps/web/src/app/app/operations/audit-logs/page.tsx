'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Input, NativeSelect, Label } from '@platform/ui';
import { Download, Search, Activity, Users, FileText } from 'lucide-react';
import api from '../../../../lib/api';

interface AuditLog {
  id: string;
  action: string;
  docType: string;
  docName: string;
  userId: string | null;
  createdAt: string;
}

interface ActivitySummary {
  total: number;
  byAction: Array<{ action: string; count: number }>;
  byDocType: Array<{ docType: string; count: number }>;
  byUser: Array<{ userId: string | null; count: number }>;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    action: '',
    docType: '',
    search: '',
  });

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.action) params.action = filters.action;
      if (filters.docType) params.docType = filters.docType;

      const [logsRes, summaryRes] = await Promise.all([
        api.get('/v1/operations/audit-logs', { params }),
        api.get('/v1/operations/audit-logs/summary', { params: { startDate: filters.startDate, endDate: filters.endDate } }),
      ]);

      let filteredLogs = logsRes.data.data || [];

      if (filters.search) {
        filteredLogs = filteredLogs.filter((log: AuditLog) =>
          log.docName.toLowerCase().includes(filters.search.toLowerCase())
        );
      }

      setLogs(filteredLogs);
      setSummary(summaryRes.data);
    } catch (error: any) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.action) params.set('action', filters.action);
      if (filters.docType) params.set('docType', filters.docType);

      const response = await api.get('/v1/operations/audit-logs/export?' + params.toString(), {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filters.startDate, filters.endDate, filters.action, filters.docType]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create: 'text-green-600 bg-green-50',
      update: 'text-blue-600 bg-blue-50',
      delete: 'text-red-600 bg-red-50',
      view: 'text-gray-600 bg-gray-50',
      export: 'text-purple-600 bg-purple-50',
    };
    return colors[action.toLowerCase()] || 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Audit Logs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track all system activities and changes
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export to CSV
        </Button>
      </div>

      {/* Activity Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Total Activities</h3>
            </div>
            <p className="text-3xl font-bold">{summary.total.toLocaleString()}</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold">Top Document Types</h3>
            </div>
            <div className="space-y-2">
              {summary.byDocType.slice(0, 3).map((item) => (
                <div key={item.docType} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.docType}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold">Top Actions</h3>
            </div>
            <div className="space-y-2">
              {summary.byAction.slice(0, 3).map((item) => (
                <div key={item.action} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{item.action}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-5">
        <div className="grid md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Start Date</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">End Date</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Action</Label>
            <NativeSelect
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="view">View</option>
              <option value="export">Export</option>
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Document Type</Label>
            <NativeSelect
              value={filters.docType}
              onChange={(e) => setFilters({ ...filters, docType: e.target.value })}
            >
              <option value="">All Types</option>
              <option value="Order">Order</option>
              <option value="Product">Product</option>
              <option value="Customer">Customer</option>
              <option value="Inventory">Inventory</option>
              <option value="User">User</option>
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Document name..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadLogs();
                }}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-medium">Action</th>
                <th className="text-left p-3 font-medium">Document Type</th>
                <th className="text-left p-3 font-medium">Document Name</th>
                <th className="text-left p-3 font-medium">User</th>
                <th className="text-left p-3 font-medium">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Loading audit logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getActionColor(log.action)}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3">{log.docType}</td>
                    <td className="p-3 font-medium">{log.docName}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {log.userId || 'System'}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
