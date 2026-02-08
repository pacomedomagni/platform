'use client';

import { useEffect, useState } from 'react';

interface FunnelStage {
  stage: string;
  sessions: number;
  conversionRate: number;
  dropoff: number;
}

interface SourceData {
  source: string;
  count: number;
}

const STAGE_LABELS: Record<string, string> = {
  page_view: 'Page View',
  product_view: 'Product View',
  add_to_cart: 'Add to Cart',
  begin_checkout: 'Begin Checkout',
  purchase: 'Purchase',
};

export default function FunnelAnalyticsPage() {
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(tenantId && { 'x-tenant-id': tenantId }),
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('from', dateRange.from);
      if (dateRange.to) params.set('to', dateRange.to);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const [funnelRes, sourcesRes] = await Promise.all([
        fetch(`/api/analytics/funnel${qs}`, { headers }),
        fetch(`/api/analytics/sources${qs}`, { headers }),
      ]);

      if (funnelRes.ok) {
        const data = await funnelRes.json();
        setFunnel(data.funnel || []);
      }
      if (sourcesRes.ok) {
        setSources(await sourcesRes.json());
      }
    } finally {
      setLoading(false);
    }
  }

  const maxSessions = funnel.length > 0 ? Math.max(...funnel.map((f) => f.sessions), 1) : 1;

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Funnel Analytics</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>From</label>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            style={{ padding: 8 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>To</label>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            style={{ padding: 8 }}
          />
        </div>
        <button
          onClick={fetchData}
          style={{ padding: '8px 16px', background: '#000', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Apply
        </button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Conversion Funnel</h2>
            {funnel.length === 0 ? (
              <p style={{ color: '#888' }}>No funnel data available.</p>
            ) : (
              <div>
                {funnel.map((stage, idx) => (
                  <div key={stage.stage} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{STAGE_LABELS[stage.stage] || stage.stage}</span>
                      <span>{stage.sessions} sessions ({stage.conversionRate}%)</span>
                    </div>
                    <div style={{ background: '#eee', borderRadius: 4, height: 24, overflow: 'hidden' }}>
                      <div
                        style={{
                          background: `hsl(${210 - idx * 30}, 70%, 50%)`,
                          height: '100%',
                          width: `${(stage.sessions / maxSessions) * 100}%`,
                          borderRadius: 4,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    {idx > 0 && (
                      <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 2 }}>
                        Dropoff: {stage.dropoff}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Top Traffic Sources</h2>
            {sources.length === 0 ? (
              <p style={{ color: '#888' }}>No source data available.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>Source</th>
                    <th style={{ padding: 8, textAlign: 'right' }}>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.source} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 8 }}>{source.source}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{source.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
