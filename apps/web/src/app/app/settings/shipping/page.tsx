'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge, ConfirmDialog, toast, toastUndo } from '@platform/ui';
import { Info, X as XIcon } from 'lucide-react';
import Link from 'next/link';
import { unwrapJson } from '@/lib/admin-fetch';

// Curated short list — covers the high-traffic countries; merchants can free-type for the long tail.
const COMMON_COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'JP', name: 'Japan' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
];

// Shipping rate type → human label, used on the small badge inside the per-rate row.
const RATE_TYPE_LABEL: Record<string, string> = {
  flat: 'Flat',
  weight: 'Weight',
  price: 'Price',
};

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
  // Switched from a single comma-separated string to a structured chip set so we
  // can render removable chips and prevent dupes / malformed input on the way in.
  const [newZoneCountryCodes, setNewZoneCountryCodes] = useState<string[]>([]);
  const [countryInput, setCountryInput] = useState('');
  const [savingZone, setSavingZone] = useState(false);

  // Add rate modal
  const [addRateZoneId, setAddRateZoneId] = useState<string | null>(null);
  const [newRateName, setNewRateName] = useState('');
  const [newRatePrice, setNewRatePrice] = useState('');
  const [newRateType, setNewRateType] = useState('flat');
  const [savingRate, setSavingRate] = useState(false);
  const [deleteZoneConfirm, setDeleteZoneConfirm] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await fetch('/api/v1/store/admin/settings', { headers });
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = unwrapJson(await res.json());

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
        const data = unwrapJson(await res.json());
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
      toast({ title: 'Defaults saved', variant: 'success' });
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addCountryCode = (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    setNewZoneCountryCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
    setCountryInput('');
  };

  const removeCountryCode = (code: string) => {
    setNewZoneCountryCodes((prev) => prev.filter((c) => c !== code));
  };

  const handleAddZone = async () => {
    if (!newZoneName.trim()) return;
    setSavingZone(true);
    try {
      // Country codes are already normalised through addCountryCode so we just send them as-is.
      const res = await fetch('/api/v1/store/admin/shipping/zones', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name: newZoneName, countries: newZoneCountryCodes }),
      });
      if (!res.ok) throw new Error('Failed to create zone');
      setNewZoneName('');
      setNewZoneCountryCodes([]);
      setCountryInput('');
      setShowAddZone(false);
      await fetchZones();
      toast({
        title: 'Zone created',
        description: `Saved ${newZoneCountryCodes.length} countr${newZoneCountryCodes.length === 1 ? 'y' : 'ies'}.`,
        variant: 'success',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingZone(false);
    }
  };

  const handleDeleteZone = (zoneId: string) => {
    setDeleteZoneConfirm(zoneId);
  };

  const confirmDeleteZone = async () => {
    const zoneId = deleteZoneConfirm;
    if (!zoneId) return;
    setDeleteZoneConfirm(null);

    // Optimistic remove with 5s undo. Server DELETE is deferred so undo is a true no-op.
    const snapshot = zones.find((z) => z.id === zoneId);
    if (snapshot) setZones((prev) => prev.filter((z) => z.id !== zoneId));

    let cancelled = false;
    toastUndo({
      title: 'Zone deleted',
      description: snapshot ? `${snapshot.name} — undo within 5 seconds.` : 'Undo within 5 seconds.',
      windowMs: 5000,
      onUndo: () => {
        cancelled = true;
        if (snapshot) setZones((prev) => [snapshot, ...prev]);
      },
    });

    setTimeout(async () => {
      if (cancelled) return;
      try {
        await fetch(`/api/v1/store/admin/shipping/zones/${zoneId}`, {
          method: 'DELETE',
          headers: getHeaders(),
        });
        await fetchZones();
      } catch (err: any) {
        toast({ title: 'Delete failed', description: err?.message ?? 'Restoring.', variant: 'destructive' });
        await fetchZones();
      }
    }, 5000);
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
      toast({ title: 'Rate added', variant: 'success' });
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

          {/*
            Inline note (not a tooltip) — merchants reliably misread the zone-vs-default precedence.
            Calling it out above the form reduces support tickets noticeably.
          */}
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p>
              Zone rates <strong>replace</strong> your default rates for matching countries. If a country isn&apos;t in
              any zone, the default rate applies.
            </p>
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
                  <label className="block text-xs font-medium text-slate-700">Countries</label>
                  {/*
                    Selected codes render as removable chips. The free-text input accepts any ISO
                    code (covering the long tail) and the quick-pick row covers the high-traffic
                    countries. Typing a code and pressing Enter or comma adds it.
                  */}
                  <div className="mt-1 flex flex-wrap gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-2">
                    {newZoneCountryCodes.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                      >
                        {code}
                        <button
                          type="button"
                          onClick={() => removeCountryCode(code)}
                          className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                          aria-label={`Remove ${code}`}
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={countryInput}
                      onChange={(e) => setCountryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addCountryCode(countryInput);
                        } else if (e.key === 'Backspace' && !countryInput && newZoneCountryCodes.length > 0) {
                          // Backspace on an empty field deletes the most recently added chip — standard chip-input UX.
                          removeCountryCode(newZoneCountryCodes[newZoneCountryCodes.length - 1]);
                        }
                      }}
                      onBlur={() => addCountryCode(countryInput)}
                      placeholder={newZoneCountryCodes.length === 0 ? 'Type ISO code and press Enter' : ''}
                      className="flex-1 min-w-[10ch] border-none bg-transparent px-1 py-0.5 text-sm focus:outline-none focus:ring-0"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {COMMON_COUNTRIES.map((c) => {
                      const selected = newZoneCountryCodes.includes(c.code);
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => (selected ? removeCountryCode(c.code) : addCountryCode(c.code))}
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
                            selected
                              ? 'border-blue-300 bg-blue-100 text-blue-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                          title={c.name}
                        >
                          {c.code}
                        </button>
                      );
                    })}
                  </div>
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
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700">
                              {rate.name}
                            </span>
                            {/* Outline badge keeps the type label visually consistent with other badges across the app. */}
                            <Badge variant="outline" className="text-xs">
                              {RATE_TYPE_LABEL[rate.type] ?? rate.type}
                            </Badge>
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

      <ConfirmDialog
        open={deleteZoneConfirm !== null}
        onOpenChange={(open) => { if (!open) setDeleteZoneConfirm(null); }}
        title="Delete Shipping Zone"
        description="Delete this shipping zone and all its rates?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteZone}
      />
    </div>
  );
}
