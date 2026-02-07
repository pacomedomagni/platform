'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  states: string[];
  zipCodes: string[];
  isDefault: boolean;
  rates: ShippingRate[];
}

interface ShippingRate {
  id: string;
  name: string;
  type: string;
  price: number;
  freeShippingThreshold: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  isEnabled: boolean;
}

function getHeaders() {
  const token = localStorage.getItem('access_token');
  const tenantId = localStorage.getItem('tenantId');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenantId || '',
  };
}

export default function ShippingTaxPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [taxRateDisplay, setTaxRateDisplay] = useState('');
  const [shippingRate, setShippingRate] = useState('');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('');

  // Shipping zones
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneCountries, setNewZoneCountries] = useState('');
  const [savingZone, setSavingZone] = useState(false);

  // Add rate modal
  const [addRateZoneId, setAddRateZoneId] = useState<string | null>(null);
  const [newRateName, setNewRateName] = useState('');
  const [newRatePrice, setNewRatePrice] = useState('');
  const [newRateType, setNewRateType] = useState('flat');
  const [savingRate, setSavingRate] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await fetch('/api/v1/store/admin/settings', { headers });
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();

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

  const fetchZones = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await fetch('/api/v1/store/admin/shipping/zones', { headers });
      if (res.ok) {
        const data = await res.json();
        setZones(data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchZones();
  }, [fetchSettings, fetchZones]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const taxDecimal = taxRateDisplay ? parseFloat(taxRateDisplay) / 100 : 0;
      const res = await fetch('/api/v1/store/admin/settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          defaultTaxRate: taxDecimal,
          defaultShippingRate: shippingRate ? parseFloat(shippingRate) : 0,
          freeShippingThreshold: freeShippingThreshold
            ? parseFloat(freeShippingThreshold)
            : 0,
        }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setSuccessMessage('Settings saved successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddZone = async () => {
    if (!newZoneName.trim()) return;
    setSavingZone(true);
    try {
      const countries = newZoneCountries
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);

      const res = await fetch('/api/v1/store/admin/shipping/zones', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name: newZoneName, countries }),
      });
      if (!res.ok) throw new Error('Failed to create zone');
      setNewZoneName('');
      setNewZoneCountries('');
      setShowAddZone(false);
      await fetchZones();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingZone(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Delete this shipping zone and all its rates?')) return;
    try {
      await fetch(`/api/v1/store/admin/shipping/zones/${zoneId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      await fetchZones();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddRate = async () => {
    if (!addRateZoneId || !newRateName.trim() || !newRatePrice) return;
    setSavingRate(true);
    try {
      const res = await fetch(`/api/v1/store/admin/shipping/zones/${addRateZoneId}/rates`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: newRateName,
          price: parseFloat(newRatePrice),
          type: newRateType,
        }),
      });
      if (!res.ok) throw new Error('Failed to create rate');
      setAddRateZoneId(null);
      setNewRateName('');
      setNewRatePrice('');
      setNewRateType('flat');
      await fetchZones();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingRate(false);
    }
  };

  const handleDeleteRate = async (rateId: string) => {
    try {
      await fetch(`/api/v1/store/admin/shipping/rates/${rateId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      await fetchZones();
    } catch (err: any) {
      setError(err.message);
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
          Configure shipping rates, zones, and tax settings
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

      <div className="max-w-3xl space-y-8">
        {/* Default Rates */}
        <form onSubmit={handleSave}>
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Default Rates</h2>
            <p className="mb-6 text-xs text-slate-400">
              Fallback rates used when no shipping zones match the customer&apos;s address.
            </p>
            <div className="space-y-6">
              <div>
                <label htmlFor="taxRate" className="block text-sm font-medium text-slate-700">
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
              </div>

              <div>
                <label htmlFor="shippingRate" className="block text-sm font-medium text-slate-700">
                  Default Shipping Rate
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
              </div>

              <div>
                <label htmlFor="freeShippingThreshold" className="block text-sm font-medium text-slate-700">
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
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-6">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Defaults'}
              </button>
            </div>
          </div>
        </form>

        {/* Shipping Zones */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Shipping Zones</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Create zones with specific rates for different regions
              </p>
            </div>
            <button
              onClick={() => setShowAddZone(true)}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add Zone
            </button>
          </div>

          {/* Add Zone Form */}
          {showAddZone && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Zone Name</label>
                  <input
                    type="text"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. United States"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Countries (comma-separated ISO codes)
                  </label>
                  <input
                    type="text"
                    value={newZoneCountries}
                    onChange={(e) => setNewZoneCountries(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. US, CA, MX"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddZone}
                    disabled={savingZone}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingZone ? 'Creating...' : 'Create Zone'}
                  </button>
                  <button
                    onClick={() => setShowAddZone(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {zones.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center">
              <p className="text-sm text-slate-500">No shipping zones configured</p>
              <p className="mt-1 text-xs text-slate-400">
                The default flat rate will be used for all orders
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {zones.map((zone) => (
                <div key={zone.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{zone.name}</h3>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {zone.countries.map((c) => (
                          <span
                            key={c}
                            className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                          >
                            {c}
                          </span>
                        ))}
                        {zone.countries.length === 0 && (
                          <span className="text-xs text-slate-400">All countries</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAddRateZoneId(zone.id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Add Rate
                      </button>
                      <button
                        onClick={() => handleDeleteZone(zone.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Zone Rates */}
                  {zone.rates.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {zone.rates.map((rate) => (
                        <div
                          key={rate.id}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                        >
                          <div>
                            <span className="text-sm font-medium text-slate-700">
                              {rate.name}
                            </span>
                            <span className="ml-2 text-xs text-slate-400">({rate.type})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-slate-900">
                              ${Number(rate.price).toFixed(2)}
                            </span>
                            <button
                              onClick={() => handleDeleteRate(rate.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Rate Form (inline) */}
                  {addRateZoneId === zone.id && (
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700">
                            Rate Name
                          </label>
                          <input
                            type="text"
                            value={newRateName}
                            onChange={(e) => setNewRateName(e.target.value)}
                            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                            placeholder="e.g. Standard"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700">
                            Price ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newRatePrice}
                            onChange={(e) => setNewRatePrice(e.target.value)}
                            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                            placeholder="5.99"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700">Type</label>
                          <select
                            value={newRateType}
                            onChange={(e) => setNewRateType(e.target.value)}
                            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                          >
                            <option value="flat">Flat Rate</option>
                            <option value="weight">Weight Based</option>
                            <option value="price">Price Based</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={handleAddRate}
                          disabled={savingRate}
                          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingRate ? 'Adding...' : 'Add Rate'}
                        </button>
                        <button
                          onClick={() => setAddRateZoneId(null)}
                          className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
