'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConfirmDialog, toast } from '@platform/ui';
import {
  PlusIcon,
  RefreshCw,
  Trash2,
  Pencil,
  ChevronRight,
  Warehouse,
  Store,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  FolderTree,
  MapPin,
  X,
} from 'lucide-react';
import { adminFetch, unwrapJson } from '@/lib/admin-fetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Connection {
  id: string;
  name: string;
  platform: string;
  isConnected: boolean;
  isDefault: boolean;
}

interface StoreCategory {
  categoryId?: number;
  name: string;
  order?: number;
  parentId?: number;
}

interface InventoryLocation {
  merchantLocationKey: string;
  name: string;
  address?: {
    addressLine1?: string;
    city?: string;
    stateOrProvince?: string;
    postalCode?: string;
    country?: string;
  };
  locationType: 'WAREHOUSE' | 'STORE';
  merchantLocationStatus?: string;
}

interface RoleTemplate {
  name: string;
  description: string;
  permissions: string[];
}

type ActiveTab = 'categories' | 'locations' | 'permissions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the current admin user's roles from localStorage. Returns lowercased
 * role names so callers can do case-insensitive comparisons matching the API
 * RolesGuard. The login flow stores the user payload under "user".
 */
function useCurrentUserRoles(): string[] {
  const [roles, setRoles] = useState<string[]>([]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const list: string[] = Array.isArray(parsed?.roles) ? parsed.roles : [];
      setRoles(list.map((r) => String(r).trim().toLowerCase()));
    } catch {
      // Bad JSON → leave empty so the UI defaults to "no privileged role".
    }
  }, []);
  return roles;
}

function canManageMarketplaceSettings(roles: string[]): boolean {
  return roles.includes('admin') || roles.includes('system manager');
}

const PERMISSION_LABELS: Record<string, string> = {
  'marketplace.view': 'View Marketplace',
  'marketplace.connections.manage': 'Manage Connections',
  'marketplace.listings.create': 'Create Listings',
  'marketplace.listings.approve': 'Approve Listings',
  'marketplace.listings.publish': 'Publish Listings',
  'marketplace.returns.manage': 'Manage Returns',
  'marketplace.messages.manage': 'Manage Messages',
  'marketplace.campaigns.manage': 'Manage Campaigns',
  'marketplace.finances.view': 'View Finances',
  'marketplace.settings.manage': 'Manage Settings',
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MarketplaceSettingsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('categories');
  const [loadingConnections, setLoadingConnections] = useState(true);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    setLoadingConnections(true);
    try {
      const res = await adminFetch('/api/v1/marketplace/connections');
      if (res.ok) {
        const data = unwrapJson<Connection[]>(await res.json());
        setConnections(data);
        const def = data.find((c) => c.isDefault) ?? data[0];
        if (def) setSelectedConnectionId(def.id);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setLoadingConnections(false);
    }
  };

  const userRoles = useCurrentUserRoles();
  const canEditPermissions = canManageMarketplaceSettings(userRoles);

  // Hide the Permissions tab from non-admin users entirely. The API also
  // rejects them, but hiding it client-side avoids a confusing dead tab.
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'categories', label: 'Store Categories', icon: <FolderTree className="w-4 h-4" /> },
    { id: 'locations', label: 'Inventory Locations', icon: <MapPin className="w-4 h-4" /> },
    ...(canEditPermissions
      ? [{ id: 'permissions' as const, label: 'Permissions', icon: <ShieldCheck className="w-4 h-4" /> }]
      : []),
  ];

  // If the user landed on the Permissions tab via deeplink without rights,
  // bounce them to the first allowed tab.
  useEffect(() => {
    if (activeTab === 'permissions' && !canEditPermissions) {
      setActiveTab('categories');
    }
  }, [activeTab, canEditPermissions]);

  if (loadingConnections) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Marketplace Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure store categories, inventory locations, and role permissions
        </p>
      </div>

      {/* Connection selector */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
          eBay Store:
        </label>
        {connections.length === 0 ? (
          <p className="text-sm text-gray-500">
            No connections found.{' '}
            <a href="/app/marketplace/connections" className="text-blue-600 hover:underline">
              Add one first.
            </a>
          </p>
        ) : (
          <select
            value={selectedConnectionId}
            onChange={(e) => setSelectedConnectionId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {!selectedConnectionId ? (
        <EmptyState
          icon={<FolderTree className="w-10 h-10 text-gray-300" />}
          title="No connection selected"
          description="Select an eBay store above to manage its settings."
        />
      ) : (
        <>
          {activeTab === 'categories' && (
            <StoreCategoriesSection connectionId={selectedConnectionId} />
          )}
          {activeTab === 'locations' && (
            <InventoryLocationsSection connectionId={selectedConnectionId} />
          )}
          {activeTab === 'permissions' && canEditPermissions && <PermissionsSection />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Store Categories
// ---------------------------------------------------------------------------

function StoreCategoriesSection({ connectionId }: { connectionId: string }) {
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; order: string; parentId: string }>({
    name: '',
    order: '',
    parentId: '',
  });

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(
        `/api/v1/marketplace/ebay/store-categories?connectionId=${connectionId}`
      );
      if (res.ok) {
        const data = unwrapJson<{ categories?: StoreCategory[] } | StoreCategory[]>(
          await res.json()
        );
        const cats = Array.isArray(data)
          ? data
          : (data as any)?.categories ?? [];
        setCategories(cats);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openAdd = () => {
    setEditingCategory(null);
    setForm({ name: '', order: '', parentId: '' });
    setShowForm(true);
  };

  const openEdit = (cat: StoreCategory) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      order: cat.order != null ? String(cat.order) : '',
      parentId: cat.parentId != null ? String(cat.parentId) : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation Error', description: 'Category name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const updated: StoreCategory[] = editingCategory
        ? categories.map((c) =>
            c.categoryId === editingCategory.categoryId
              ? {
                  ...c,
                  name: form.name.trim(),
                  order: form.order ? Number(form.order) : undefined,
                  parentId: form.parentId ? Number(form.parentId) : undefined,
                }
              : c
          )
        : [
            ...categories,
            {
              name: form.name.trim(),
              order: form.order ? Number(form.order) : undefined,
              parentId: form.parentId ? Number(form.parentId) : undefined,
            },
          ];

      const res = await adminFetch(
        `/api/v1/marketplace/ebay/store-categories?connectionId=${connectionId}`,
        {
          method: 'POST',
          body: JSON.stringify({ categories: updated }),
        }
      );

      if (res.ok) {
        toast({ title: 'Success', description: editingCategory ? 'Category updated' : 'Category added' });
        setShowForm(false);
        await loadCategories();
      } else {
        const err = unwrapJson(await res.json().catch(() => null));
        toast({ title: 'Error', description: (err as any)?.error || 'Failed to save', variant: 'destructive' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save category', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget == null) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await adminFetch(
        `/api/v1/marketplace/ebay/store-categories/${id}?connectionId=${connectionId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        toast({ title: 'Success', description: 'Category deleted' });
        setCategories((prev) => prev.filter((c) => c.categoryId !== id));
      } else {
        const err = unwrapJson(await res.json().catch(() => null));
        toast({ title: 'Error', description: (err as any)?.error || 'Failed to delete', variant: 'destructive' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to delete category', variant: 'destructive' });
    }
  };

  // Group into parent / child hierarchy for display
  const parents = categories.filter((c) => !c.parentId);
  const childrenOf = (parentId?: number) =>
    categories.filter((c) => c.parentId === parentId);

  if (loading) {
    return <SectionSkeleton />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Store Categories</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Organise your eBay store with custom categories
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="w-10 h-10 text-gray-300" />}
          title="No categories yet"
          description="Add store categories to organise your eBay listings."
        />
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
          {parents.map((parent) => (
            <div key={parent.categoryId ?? parent.name}>
              <CategoryRow cat={parent} onEdit={openEdit} onDelete={setDeleteTarget} />
              {childrenOf(parent.categoryId).map((child) => (
                <div key={child.categoryId ?? child.name} className="bg-gray-50">
                  <CategoryRow
                    cat={child}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                    isChild
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <Modal
          title={editingCategory ? 'Edit Category' : 'Add Category'}
          onClose={() => setShowForm(false)}
        >
          <div className="space-y-4">
            <Field label="Name *">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Electronics"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </Field>
            <Field label="Display Order">
              <input
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: e.target.value })}
                placeholder="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </Field>
            <Field label="Parent Category (ID)">
              <select
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">None (top-level)</option>
                {parents
                  .filter((p) => p.categoryId !== editingCategory?.categoryId)
                  .map((p) => (
                    <option key={p.categoryId} value={String(p.categoryId)}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <ModalActions
            onCancel={() => setShowForm(false)}
            onConfirm={handleSave}
            confirmLabel={editingCategory ? 'Save Changes' : 'Add Category'}
            loading={saving}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Category"
        description="Are you sure you want to delete this store category?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function CategoryRow({
  cat,
  onEdit,
  onDelete,
  isChild,
}: {
  cat: StoreCategory;
  onEdit: (c: StoreCategory) => void;
  onDelete: (id: number) => void;
  isChild?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${isChild ? 'pl-10' : ''}`}>
      <div className="flex items-center gap-2 text-sm text-gray-800">
        {isChild && <ChevronRight className="w-4 h-4 text-gray-400" />}
        <span className="font-medium">{cat.name}</span>
        {cat.order != null && (
          <span className="text-xs text-gray-400">order: {cat.order}</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(cat)}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
        >
          <Pencil className="w-4 h-4" />
        </button>
        {cat.categoryId != null && (
          <button
            onClick={() => onDelete(cat.categoryId!)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inventory Locations
// ---------------------------------------------------------------------------

function InventoryLocationsSection({ connectionId }: { connectionId: string }) {
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<InventoryLocation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const emptyForm = {
    merchantLocationKey: '',
    name: '',
    addressLine1: '',
    city: '',
    stateOrProvince: '',
    postalCode: '',
    country: 'US',
    locationType: 'WAREHOUSE' as 'WAREHOUSE' | 'STORE',
    phone: '',
  };
  const [form, setForm] = useState(emptyForm);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(
        `/api/v1/marketplace/inventory-locations?connectionId=${connectionId}`
      );
      if (res.ok) {
        const data = unwrapJson<{ locations?: InventoryLocation[] } | InventoryLocation[]>(
          await res.json()
        );
        const locs = Array.isArray(data)
          ? data
          : (data as any)?.locations ?? [];
        setLocations(locs);
      }
    } catch (err) {
      console.error('Failed to load locations:', err);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const openAdd = () => {
    setEditingLocation(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (loc: InventoryLocation) => {
    setEditingLocation(loc);
    setForm({
      merchantLocationKey: loc.merchantLocationKey,
      name: loc.name,
      addressLine1: loc.address?.addressLine1 ?? '',
      city: loc.address?.city ?? '',
      stateOrProvince: loc.address?.stateOrProvince ?? '',
      postalCode: loc.address?.postalCode ?? '',
      country: loc.address?.country ?? 'US',
      locationType: loc.locationType,
      phone: '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.merchantLocationKey.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Location key and name are required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      let res: Response;
      if (editingLocation) {
        res = await adminFetch(
          `/api/v1/marketplace/inventory-locations/${editingLocation.merchantLocationKey}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              connectionId,
              name: form.name.trim(),
              phone: form.phone.trim() || undefined,
            }),
          }
        );
      } else {
        res = await adminFetch('/api/v1/marketplace/inventory-locations', {
          method: 'POST',
          body: JSON.stringify({
            connectionId,
            merchantLocationKey: form.merchantLocationKey.trim(),
            name: form.name.trim(),
            address: {
              addressLine1: form.addressLine1,
              city: form.city,
              stateOrProvince: form.stateOrProvince,
              postalCode: form.postalCode,
              country: form.country,
            },
            locationType: form.locationType,
            phone: form.phone.trim() || undefined,
          }),
        });
      }

      if (res.ok) {
        toast({
          title: 'Success',
          description: editingLocation ? 'Location updated' : 'Location created',
        });
        setShowForm(false);
        await loadLocations();
      } else {
        const err = unwrapJson(await res.json().catch(() => null));
        toast({
          title: 'Error',
          description: (err as any)?.error || 'Failed to save location',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save location', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const key = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await adminFetch(
        `/api/v1/marketplace/inventory-locations/${key}?connectionId=${connectionId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        toast({ title: 'Success', description: 'Location deleted' });
        setLocations((prev) => prev.filter((l) => l.merchantLocationKey !== key));
      } else {
        const err = unwrapJson(await res.json().catch(() => null));
        toast({ title: 'Error', description: (err as any)?.error || 'Failed to delete', variant: 'destructive' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to delete location', variant: 'destructive' });
    }
  };

  const toggleEnable = async (loc: InventoryLocation) => {
    const key = loc.merchantLocationKey;
    const isEnabled = loc.merchantLocationStatus === 'ENABLED';
    const action = isEnabled ? 'disable' : 'enable';
    setActionLoading(key);
    try {
      const res = await adminFetch(
        `/api/v1/marketplace/inventory-locations/${key}/${action}`,
        {
          method: 'POST',
          body: JSON.stringify({ connectionId }),
        }
      );
      if (res.ok) {
        toast({ title: 'Success', description: `Location ${action}d` });
        await loadLocations();
      } else {
        const err = unwrapJson(await res.json().catch(() => null));
        toast({ title: 'Error', description: (err as any)?.error || `Failed to ${action}`, variant: 'destructive' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: `Failed to ${action} location`, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <SectionSkeleton />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Inventory Locations</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Warehouses and stores that hold your eBay inventory
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {locations.length === 0 ? (
        <EmptyState
          icon={<MapPin className="w-10 h-10 text-gray-300" />}
          title="No inventory locations"
          description="Add a warehouse or store location to manage eBay inventory."
        />
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
          {locations.map((loc) => {
            const enabled = loc.merchantLocationStatus === 'ENABLED';
            return (
              <div
                key={loc.merchantLocationKey}
                className="flex items-center justify-between px-4 py-4 hover:bg-gray-50"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-gray-400">
                    {loc.locationType === 'WAREHOUSE' ? (
                      <Warehouse className="w-5 h-5" />
                    ) : (
                      <Store className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">{loc.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{loc.merchantLocationKey}</span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          loc.locationType === 'WAREHOUSE'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {loc.locationType}
                      </span>
                      {loc.merchantLocationStatus && (
                        <span
                          className={`flex items-center gap-1 text-xs ${
                            enabled ? 'text-green-600' : 'text-gray-400'
                          }`}
                        >
                          {enabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          {enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      )}
                    </div>
                    {loc.address && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[
                          loc.address.addressLine1,
                          loc.address.city,
                          loc.address.stateOrProvince,
                          loc.address.postalCode,
                          loc.address.country,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {loc.merchantLocationStatus && (
                    <button
                      onClick={() => toggleEnable(loc)}
                      disabled={actionLoading === loc.merchantLocationKey}
                      className={`px-3 py-1.5 text-xs rounded font-medium transition-colors disabled:opacity-50 ${
                        enabled
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {actionLoading === loc.merchantLocationKey ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : enabled ? (
                        'Disable'
                      ) : (
                        'Enable'
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(loc)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(loc.merchantLocationKey)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <Modal
          title={editingLocation ? 'Edit Location' : 'Add Inventory Location'}
          onClose={() => setShowForm(false)}
        >
          <div className="space-y-4">
            {!editingLocation && (
              <Field label="Location Key *">
                <input
                  type="text"
                  value={form.merchantLocationKey}
                  onChange={(e) =>
                    setForm({ ...form, merchantLocationKey: e.target.value.toUpperCase().replace(/\s+/g, '_') })
                  }
                  placeholder="e.g., WAREHOUSE_NYC"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Unique key for this location (letters, numbers, underscores)
                </p>
              </Field>
            )}
            <Field label="Name *">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., New York Warehouse"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </Field>
            <Field label="Type">
              <select
                value={form.locationType}
                onChange={(e) =>
                  setForm({ ...form, locationType: e.target.value as 'WAREHOUSE' | 'STORE' })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="WAREHOUSE">Warehouse</option>
                <option value="STORE">Store</option>
              </select>
            </Field>
            {!editingLocation && (
              <>
                <Field label="Address">
                  <input
                    type="text"
                    value={form.addressLine1}
                    onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                    placeholder="Street address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City">
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="New York"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </Field>
                  <Field label="State">
                    <input
                      type="text"
                      value={form.stateOrProvince}
                      onChange={(e) => setForm({ ...form, stateOrProvince: e.target.value })}
                      placeholder="NY"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </Field>
                  <Field label="Postal Code">
                    <input
                      type="text"
                      value={form.postalCode}
                      onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                      placeholder="10001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </Field>
                  <Field label="Country">
                    <input
                      type="text"
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
                      placeholder="US"
                      maxLength={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </Field>
                </div>
              </>
            )}
            <Field label="Phone (optional)">
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 212 555 0100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </Field>
          </div>
          <ModalActions
            onCancel={() => setShowForm(false)}
            onConfirm={handleSave}
            confirmLabel={editingLocation ? 'Save Changes' : 'Create Location'}
            loading={saving}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Location"
        description="Are you sure you want to delete this inventory location? Listings using it may be affected."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permissions / RBAC
// ---------------------------------------------------------------------------

function PermissionsSection() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [permRes, tplRes] = await Promise.all([
          adminFetch('/api/v1/marketplace/rbac/permissions'),
          adminFetch('/api/v1/marketplace/rbac/templates'),
        ]);

        if (permRes.ok) {
          const data = unwrapJson<{ permissions: string[] }>(await permRes.json());
          setPermissions(data.permissions ?? []);
          // Default all enabled
          setEnabled(new Set(data.permissions ?? []));
        }
        if (tplRes.ok) {
          const data = unwrapJson<{ templates: RoleTemplate[] }>(await tplRes.json());
          setTemplates(data.templates ?? []);
        }
      } catch (err) {
        console.error('Failed to load permissions:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const applyTemplate = (templateName: string) => {
    const tpl = templates.find((t) => t.name === templateName);
    if (!tpl) return;
    setEnabled(new Set(tpl.permissions));
    setSelectedTemplate(templateName);
  };

  if (loading) {
    return <SectionSkeleton />;
  }

  // Group permissions by namespace prefix
  const grouped = permissions.reduce<Record<string, string[]>>((acc, perm) => {
    const parts = perm.split('.');
    const group = parts.length >= 2 ? parts[1] : 'other';
    const label = group.charAt(0).toUpperCase() + group.slice(1);
    (acc[label] = acc[label] ?? []).push(perm);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Marketplace Permissions</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Read-only view of available permissions and role templates. Editing
          per-role permission overrides is not yet wired to a backend endpoint;
          the toggles below are illustrative — applying a template previews
          which permissions the role would grant. Manage actual role
          assignments via the user-management page for now.
        </p>
      </div>

      {/* Role template picker */}
      {templates.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Quick Apply Role Template</h3>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.name}
                onClick={() => applyTemplate(tpl.name)}
                title={tpl.description}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  selectedTemplate === tpl.name
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100'
                }`}
              >
                {tpl.name}
              </button>
            ))}
          </div>
          {selectedTemplate && (
            <p className="text-xs text-blue-700 mt-2">
              {templates.find((t) => t.name === selectedTemplate)?.description}
            </p>
          )}
        </div>
      )}

      {/* Permission toggles grouped by category */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([group, perms]) => (
          <div key={group} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {group}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {perms.map((perm) => {
                const isEnabled = enabled.has(perm);
                return (
                  <div
                    key={perm}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {PERMISSION_LABELS[perm] ?? perm}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">{perm}</p>
                    </div>
                    {/*
                      Read-only state pill. Was a clickable toggle, but with no
                      Save button and no backend persistence the toggle was
                      lying — closing the tab discarded "edits" silently.
                      Until an endpoint exists, this just visualizes what each
                      role template would grant when the picker above is used.
                      See M123 in docs/ui-audit.md.
                    */}
                    <span
                      role="status"
                      aria-label={isEnabled ? 'Granted' : 'Not granted'}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isEnabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-50 text-gray-500 border border-gray-200'
                      }`}
                    >
                      {isEnabled ? 'Granted' : 'Not granted'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Role templates reference table */}
      {templates.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Role Templates Reference</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide w-36">
                    Role
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Description
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Permissions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {templates.map((tpl) => (
                  <tr key={tpl.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {tpl.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{tpl.description}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tpl.permissions.map((p) => (
                          <span
                            key={p}
                            className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-mono"
                          >
                            {p.replace('marketplace.', '')}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
      <div className="flex justify-center mb-3">{icon}</div>
      <h3 className="text-base font-medium text-gray-700 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 rounded-lg" />
      ))}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  loading,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  loading?: boolean;
}) {
  return (
    <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
      <button
        onClick={onCancel}
        className="flex-1 px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
