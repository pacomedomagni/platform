'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface ShippingTaxSettings {
  defaultTaxRate: number;
  defaultShippingRate: number;
  freeShippingThreshold: number;
}

export default function ShippingTaxPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Display values (tax rate shown as percentage, monetary values as dollars)
  const [taxRateDisplay, setTaxRateDisplay] = useState('');
  const [shippingRate, setShippingRate] = useState('');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const tenantId = localStorage.getItem('tenantId');
      const res = await fetch('/api/v1/store/admin/settings', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId || '',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();

      // Convert decimal tax rate to percentage for display (e.g. 0.0825 -> 8.25)
      setTaxRateDisplay(
        data.defaultTaxRate != null ? String(+(data.defaultTaxRate * 100).toFixed(4)) : ''
      );
      setShippingRate(data.defaultShippingRate != null ? String(data.defaultShippingRate) : '');
      setFreeShippingThreshold(
        data.freeShippingThreshold != null ? String(data.freeShippingThreshold) : ''
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = localStorage.getItem('access_token');
      const tenantId = localStorage.getItem('tenantId');

      // Convert display percentage back to decimal (e.g. 8.25 -> 0.0825)
      const taxDecimal = taxRateDisplay ? parseFloat(taxRateDisplay) / 100 : 0;

      const res = await fetch('/api/v1/store/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId || '',
        },
        body: JSON.stringify({
          defaultTaxRate: taxDecimal,
          defaultShippingRate: shippingRate ? parseFloat(shippingRate) : 0,
          freeShippingThreshold: freeShippingThreshold
            ? parseFloat(freeShippingThreshold)
            : 0,
        }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setSuccessMessage('Shipping & tax settings saved successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <Link
            href="/app/settings"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Settings
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Shipping &amp; Tax</h1>
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Settings
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Shipping &amp; Tax
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure shipping rates and tax settings for your store
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-green-700">{successMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="max-w-2xl">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="space-y-6">
            {/* Tax Rate */}
            <div>
              <label
                htmlFor="taxRate"
                className="block text-sm font-medium text-slate-700"
              >
                Tax Rate
              </label>
              <div className="relative mt-1.5">
                <input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxRateDisplay}
                  onChange={(e) => setTaxRateDisplay(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="0.00"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                  <span className="text-sm text-slate-400">%</span>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Applied to all orders. Enter as percentage (e.g. 8.25 for 8.25%)
              </p>
            </div>

            {/* Shipping Rate */}
            <div>
              <label
                htmlFor="shippingRate"
                className="block text-sm font-medium text-slate-700"
              >
                Shipping Rate
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <span className="text-sm text-slate-400">$</span>
                </div>
                <input
                  id="shippingRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingRate}
                  onChange={(e) => setShippingRate(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 py-2.5 pl-8 pr-3.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Flat rate charged per order
              </p>
            </div>

            {/* Free Shipping Threshold */}
            <div>
              <label
                htmlFor="freeShippingThreshold"
                className="block text-sm font-medium text-slate-700"
              >
                Free Shipping Threshold
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <span className="text-sm text-slate-400">$</span>
                </div>
                <input
                  id="freeShippingThreshold"
                  type="number"
                  step="0.01"
                  min="0"
                  value={freeShippingThreshold}
                  onChange={(e) => setFreeShippingThreshold(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 py-2.5 pl-8 pr-3.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Orders above this amount get free shipping. Set to 0 to disable
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3 border-t border-slate-100 pt-6">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href="/app/settings"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
