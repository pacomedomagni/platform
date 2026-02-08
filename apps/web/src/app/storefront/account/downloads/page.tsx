'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button } from '@platform/ui';
import { Download, ArrowLeft, FileDown, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../../../lib/auth-store';

interface DigitalDownload {
  id: string;
  productId: string;
  orderId: string;
  downloadCount: number;
  maxDownloads: number | null;
  expiresAt: string | null;
  createdAt: string;
  product?: { displayName: string; images?: string[] };
  order?: { orderNumber: string };
}

export default function DownloadsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [downloads, setDownloads] = useState<DigitalDownload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/storefront/account/login');
      return;
    }

    if (isAuthenticated) {
      fetchDownloads();
    }
  }, [isAuthenticated, authLoading, router]);

  function getHeaders(): Record<string, string> {
    const token = localStorage.getItem('customer_token');
    const tenantId = localStorage.getItem('tenantId');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(tenantId && { 'x-tenant-id': tenantId }),
    };
  }

  async function fetchDownloads() {
    try {
      const customerId = localStorage.getItem('customer_id');
      if (!customerId) return;
      const res = await fetch(`/api/v1/store/downloads/customer`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDownloads(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(download: DigitalDownload) {
    const res = await fetch(`/api/v1/store/downloads/${download.id}/track`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.fileKey) {
        // In production this would be a presigned URL
        alert(`Download ready: ${data.productName}`);
      }
      await fetchDownloads();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.message || 'Download failed');
    }
  }

  function isExpired(dl: DigitalDownload) {
    if (!dl.expiresAt) return false;
    return new Date(dl.expiresAt) < new Date();
  }

  function isLimitReached(dl: DigitalDownload) {
    if (!dl.maxDownloads) return false;
    return dl.downloadCount >= dl.maxDownloads;
  }

  if (authLoading || loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-20">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">My Downloads</h1>
          <p className="text-sm text-slate-500">Access your digital purchases</p>
        </div>
        <Link
          href="/storefront/account"
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      {downloads.length === 0 ? (
        <Card className="border-slate-200/70 bg-white p-12 text-center shadow-sm">
          <FileDown className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No downloads yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            Digital products you purchase will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {downloads.map((dl) => {
            const expired = isExpired(dl);
            const limitReached = isLimitReached(dl);
            const canDownload = !expired && !limitReached;

            return (
              <Card key={dl.id} className={`border-slate-200/70 bg-white p-5 shadow-sm ${!canDownload ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Download className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="font-semibold text-slate-900">
                        {dl.product?.displayName || dl.productId}
                      </p>
                      <p className="text-sm text-slate-500">
                        {dl.order?.orderNumber ? `Order #${dl.order.orderNumber}` : `Order ${dl.orderId.slice(0, 8)}...`}
                        {' · '}
                        Downloads: {dl.downloadCount}{dl.maxDownloads ? ` / ${dl.maxDownloads}` : ''}
                        {dl.expiresAt && (
                          <> · Expires: {new Date(dl.expiresAt).toLocaleDateString()}</>
                        )}
                      </p>
                      {expired && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                          <AlertCircle className="h-3 w-3" /> Expired
                        </p>
                      )}
                      {limitReached && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                          <AlertCircle className="h-3 w-3" /> Download limit reached
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleDownload(dl)}
                    disabled={!canDownload}
                  >
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
