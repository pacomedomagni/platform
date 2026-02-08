'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, Label, NativeSelect } from '@platform/ui';
import { MapPin, ArrowLeft, Plus, Trash2, Loader2, Star } from 'lucide-react';
import { useAuthStore } from '../../../../lib/auth-store';
import { authApi, CustomerAddress } from '../../../../lib/store-api';

const countries = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
];

const emptyAddress = {
  label: 'Home',
  firstName: '',
  lastName: '',
  company: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
  phone: '',
  isDefault: false,
};

export default function AddressesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyAddress);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/storefront/account/login');
      return;
    }

    if (isAuthenticated) {
      loadAddresses();
    }
  }, [isAuthenticated, authLoading, router]);

  const loadAddresses = async () => {
    try {
      const data = await authApi.getAddresses();
      setAddresses(Array.isArray(data) ? data : []);
    } catch {
      console.error('Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: Omit<CustomerAddress, 'id'> = {
        ...form,
        company: form.company || null,
        addressLine2: form.addressLine2 || null,
        state: form.state || null,
        phone: form.phone || null,
      };
      if (editingId) {
        await authApi.updateAddress(editingId, payload);
      } else {
        await authApi.addAddress(payload);
      }
      await loadAddresses();
      setShowForm(false);
      setEditingId(null);
      setForm(emptyAddress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (addr: CustomerAddress) => {
    setForm({
      label: addr.label || 'Home',
      firstName: addr.firstName || '',
      lastName: addr.lastName || '',
      company: addr.company || '',
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || '',
      city: addr.city,
      state: addr.state || '',
      postalCode: addr.postalCode,
      country: addr.country,
      phone: addr.phone || '',
      isDefault: addr.isDefault || false,
    });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this address?')) return;
    try {
      await authApi.deleteAddress(id);
      await loadAddresses();
    } catch {
      alert('Failed to delete address');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyAddress);
    setError(null);
  };

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
          <h1 className="text-3xl font-semibold text-slate-900">Addresses</h1>
          <p className="text-sm text-slate-500">Manage your shipping addresses</p>
        </div>
        <div className="flex items-center gap-3">
          {!showForm && (
            <Button
              size="sm"
              onClick={() => { setForm(emptyAddress); setEditingId(null); setShowForm(true); }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Address
            </Button>
          )}
          <Link
            href="/storefront/account"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </div>

      {showForm && (
        <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editingId ? 'Edit Address' : 'New Address'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <NativeSelect value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}>
                <option value="Home">Home</option>
                <option value="Work">Work</option>
                <option value="Other">Other</option>
              </NativeSelect>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>First name</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company (optional)</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Address line 1</Label>
              <Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Address line 2 (optional)</Label>
              <Input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Postal code</Label>
                <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} required />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Country</Label>
                <NativeSelect value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label>Phone (optional)</Label>
                <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="rounded border-slate-300"
              />
              Set as default address
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : 'Save Address'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {addresses.length === 0 && !showForm ? (
        <Card className="border-slate-200/70 bg-white p-12 text-center shadow-sm">
          <MapPin className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No addresses saved</h2>
          <p className="mt-2 text-sm text-slate-500">Add an address for faster checkout.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {addresses.map((addr) => (
            <Card key={addr.id} className="border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 h-5 w-5 text-slate-400" />
                  <div>
                    <p className="font-semibold text-slate-900">
                      {addr.label && <span className="text-xs font-medium text-slate-400 mr-2">{addr.label}</span>}
                      {addr.firstName} {addr.lastName}
                      {addr.isDefault && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Default
                        </span>
                      )}
                    </p>
                    {addr.company && <p className="text-sm text-slate-500">{addr.company}</p>}
                    <p className="text-sm text-slate-600">{addr.addressLine1}</p>
                    {addr.addressLine2 && <p className="text-sm text-slate-600">{addr.addressLine2}</p>}
                    <p className="text-sm text-slate-600">
                      {addr.city}, {addr.state} {addr.postalCode}
                    </p>
                    <p className="text-sm text-slate-500">{addr.country}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(addr)}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
