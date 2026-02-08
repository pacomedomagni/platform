'use client';

import { useEffect, useState } from 'react';

interface DigitalDownload {
  id: string;
  productId: string;
  orderId: string;
  downloadCount: number;
  maxDownloads: number | null;
  expiresAt: string | null;
  createdAt: string;
  product?: { title: string };
}

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DigitalDownload[]>([]);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(tenantId && { 'x-tenant-id': tenantId }),
  };

  useEffect(() => {
    fetchDownloads();
  }, []);

  async function fetchDownloads() {
    try {
      const res = await fetch('/api/store/downloads/my', { headers });
      if (res.ok) {
        setDownloads(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(download: DigitalDownload) {
    const res = await fetch(`/api/store/downloads/${download.id}/track`, {
      method: 'POST',
      headers,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
      await fetchDownloads();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.message || 'Download failed');
    }
  }

  function isExpired(download: DigitalDownload) {
    if (!download.expiresAt) return false;
    return new Date(download.expiresAt) < new Date();
  }

  function isLimitReached(download: DigitalDownload) {
    if (!download.maxDownloads) return false;
    return download.downloadCount >= download.maxDownloads;
  }

  if (loading) return <div style={{ padding: 32 }}>Loading...</div>;

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>My Downloads</h1>

      {downloads.length === 0 ? (
        <p style={{ color: '#888' }}>You have no digital downloads yet.</p>
      ) : (
        <div>
          {downloads.map((dl) => {
            const expired = isExpired(dl);
            const limitReached = isLimitReached(dl);
            const canDownload = !expired && !limitReached;

            return (
              <div
                key={dl.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: canDownload ? 1 : 0.6,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{dl.product?.title || dl.productId}</div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                    Order: {dl.orderId.slice(0, 8)}...
                    {' | '}
                    Downloads: {dl.downloadCount}{dl.maxDownloads ? ` / ${dl.maxDownloads}` : ''}
                    {dl.expiresAt && (
                      <>
                        {' | '}
                        Expires: {new Date(dl.expiresAt).toLocaleDateString()}
                      </>
                    )}
                  </div>
                  {expired && <div style={{ color: '#e74c3c', fontSize: 13, marginTop: 4 }}>Expired</div>}
                  {limitReached && <div style={{ color: '#e74c3c', fontSize: 13, marginTop: 4 }}>Download limit reached</div>}
                </div>
                <button
                  onClick={() => handleDownload(dl)}
                  disabled={!canDownload}
                  style={{
                    padding: '8px 20px',
                    background: canDownload ? '#000' : '#ccc',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: canDownload ? 'pointer' : 'not-allowed',
                  }}
                >
                  Download
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
