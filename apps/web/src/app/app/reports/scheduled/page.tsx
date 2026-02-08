'use client';

import { useEffect, useState } from 'react';

interface ScheduledReport {
  id: string;
  reportType: string;
  schedule: string;
  recipients: string[];
  format: string;
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

const REPORT_TYPES = [
  { value: 'sales_summary', label: 'Sales Summary' },
  { value: 'inventory_status', label: 'Inventory Status' },
  { value: 'low_stock_alert', label: 'Low Stock Alert' },
  { value: 'customer_activity', label: 'Customer Activity' },
  { value: 'order_fulfillment', label: 'Order Fulfillment' },
];

const SCHEDULE_OPTIONS = [
  { value: '0 8 * * *', label: 'Daily at 8 AM' },
  { value: '0 8 * * 1', label: 'Weekly (Monday 8 AM)' },
  { value: '0 8 1 * *', label: 'Monthly (1st at 8 AM)' },
];

export default function ScheduledReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    reportType: 'sales_summary',
    schedule: '0 8 * * *',
    recipients: '',
    format: 'csv',
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(tenantId && { 'x-tenant-id': tenantId }),
  };

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    try {
      const res = await fetch('/api/store/admin/reports/scheduled', { headers });
      if (res.ok) {
        setReports(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  async function createReport(e: React.FormEvent) {
    e.preventDefault();
    const recipients = form.recipients.split(',').map((r) => r.trim()).filter(Boolean);
    const res = await fetch('/api/store/admin/reports/scheduled', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...form, recipients }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ reportType: 'sales_summary', schedule: '0 8 * * *', recipients: '', format: 'csv' });
      await fetchReports();
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/store/admin/reports/scheduled/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ isActive: !isActive }),
    });
    await fetchReports();
  }

  async function deleteReport(id: string) {
    if (!confirm('Delete this scheduled report?')) return;
    await fetch(`/api/store/admin/reports/scheduled/${id}`, {
      method: 'DELETE',
      headers,
    });
    await fetchReports();
  }

  if (loading) return <div style={{ padding: 32 }}>Loading...</div>;

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Scheduled Reports</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 16px', background: '#000', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          {showForm ? 'Cancel' : '+ New Report'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createReport} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Report Type</label>
            <select
              value={form.reportType}
              onChange={(e) => setForm({ ...form, reportType: e.target.value })}
              style={{ width: '100%', padding: 8 }}
            >
              {REPORT_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Schedule</label>
            <select
              value={form.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value })}
              style={{ width: '100%', padding: 8 }}
            >
              {SCHEDULE_OPTIONS.map((so) => (
                <option key={so.value} value={so.value}>{so.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Recipients (comma-separated emails)</label>
            <input
              value={form.recipients}
              onChange={(e) => setForm({ ...form, recipients: e.target.value })}
              placeholder="admin@example.com, manager@example.com"
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Format</label>
            <select
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
              style={{ width: '100%', padding: 8 }}
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel</option>
            </select>
          </div>
          <button type="submit" style={{ padding: '8px 20px', background: '#000', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Create Report
          </button>
        </form>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>Type</th>
            <th style={{ padding: 8 }}>Schedule</th>
            <th style={{ padding: 8 }}>Recipients</th>
            <th style={{ padding: 8 }}>Format</th>
            <th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }}>Last Run</th>
            <th style={{ padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No scheduled reports yet.</td>
            </tr>
          )}
          {reports.map((report) => (
            <tr key={report.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>
                {REPORT_TYPES.find((r) => r.value === report.reportType)?.label || report.reportType}
              </td>
              <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 13 }}>{report.schedule}</td>
              <td style={{ padding: 8 }}>{report.recipients.join(', ')}</td>
              <td style={{ padding: 8, textTransform: 'uppercase' }}>{report.format}</td>
              <td style={{ padding: 8 }}>
                <span style={{ color: report.isActive ? 'green' : '#888' }}>
                  {report.isActive ? 'Active' : 'Paused'}
                </span>
              </td>
              <td style={{ padding: 8 }}>{report.lastRunAt ? new Date(report.lastRunAt).toLocaleDateString() : 'Never'}</td>
              <td style={{ padding: 8, display: 'flex', gap: 8 }}>
                <button onClick={() => toggleActive(report.id, report.isActive)} style={{ cursor: 'pointer' }}>
                  {report.isActive ? 'Pause' : 'Activate'}
                </button>
                <button onClick={() => deleteReport(report.id)} style={{ color: 'red', cursor: 'pointer' }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
