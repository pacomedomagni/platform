/**
 * Customer Addresses Page
 * Manage shipping addresses
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, Badge, ConfirmDialog } from '@platform/ui';
import { ArrowLeft, Plus, Trash2, Edit2, MapPin, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../../../lib/auth-store';
import { authApi, CustomerAddress } from '../../../../lib/store-api';

export default function AddressesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; addressId: string | null }>({ open: false, addressId: null });

  // Form state
  const [form, setForm] = useState({
    label: '',
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
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/storefront/account/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAddresses();
    }
  }, [isAuthenticated]);

  const loadAddresses = async () => {
    try {
      const data = await authApi.getAddresses();
      setAddresses(data);
    } catch {
      setError('Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      label: '',
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
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (addr: CustomerAddress) => {
    setForm({
      label: addr.label,
      firstName: addr.firstName,
      lastName: addr.lastName,
      company: addr.company || '',
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || '',
      city: addr.city,
      state: addr.state || '',
      postalCode: addr.postalCode,
      country: addr.country,
      phone: addr.phone || '',
      isDefault: addr.isDefault,
    });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editingId) {
        await authApi.updateAddress(editingId, form);
      } else {
        await authApi.addAddress(form as Omit<CustomerAddress, 'id'>);
      }
      await loadAddresses();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ open: true, addressId: id });
  };

  const confirmDeleteAddress = async () => {
    if (!deleteConfirm.addressId) return;

    setDeleteConfirm({ open: false, addressId: null });
    try {
      await authApi.deleteAddress(deleteConfirm.addressId);
      setAddresses((prev) => prev.filter((a) => a.id !== deleteConfirm.addressId));
    } catch {
      setError('Failed to delete address');
    }
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
          <Link
            href="/storefront/account"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="gap-2" size="sm">
              <Plus className="h-4 w-4" /> Add Address
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            {editingId ? 'Edit Address' : 'New Address'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Label</label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g., Home, Work, Office"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">First Name</label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Last Name</label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Company (optional)</label>
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 1</label>
              <Input
                value={form.addressLine1}
                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 2 (optional)</label>
              <Input
                value={form.addressLine2}
                onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">City</label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">State</label>
                <Input
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Postal Code</label>
                <Input
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone (optional)</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                type="tel"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="rounded border-slate-300"
              />
              <label htmlFor="isDefault" className="text-sm text-slate-600">
                Set as default address
              </label>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingId ? 'Update Address' : 'Save Address'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Address List */}
      {addresses.length === 0 && !showForm ? (
        <Card className="border-slate-200/70 bg-white p-12 text-center shadow-sm">
          <MapPin className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No addresses saved</h2>
          <p className="mt-2 text-sm text-slate-500">
            Add a shipping address to speed up your checkout.
          </p>
          <Button onClick={() => setShowForm(true)} className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> Add Address
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {addresses.map((addr) => (
            <Card key={addr.id} className="border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{addr.label}</h3>
                    {addr.isDefault && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Default
                      </Badge>
                    )}
                  </div>
                  <address className="mt-2 text-sm not-italic text-slate-600">
                    {addr.firstName} {addr.lastName}<br />
                    {addr.company && <>{addr.company}<br /></>}
                    {addr.addressLine1}<br />
                    {addr.addressLine2 && <>{addr.addressLine2}<br /></>}
                    {addr.city}, {addr.state} {addr.postalCode}<br />
                    {addr.country}
                    {addr.phone && <><br />{addr.phone}</>}
                  </address>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(addr)}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Edit address"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete address"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, addressId: open ? deleteConfirm.addressId : null })}
        title="Delete Address"
        description="Are you sure you want to delete this address? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteAddress}
      />
    </div>
  );
}
