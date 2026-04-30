'use client';

import { useState, useEffect } from 'react';
import { ConfirmDialog, toast } from '@platform/ui';
import { PlusIcon, CheckCircle2, XCircle, RefreshCw, Palmtree } from 'lucide-react';
import api from '@/lib/api';

interface Connection {
  id: string;
  name: string;
  description?: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

interface ConnectionStatus {
  hasCredentials: boolean;
  isConnected: boolean;
  hasPolicies: boolean;
  canPublishListings: boolean;
  marketplaceId: string;
}

interface VacationStatus {
  enabled: boolean;
  returnMessage?: string;
}

export default function MarketplaceConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newConnection, setNewConnection] = useState({
    name: '',
    description: '',
    marketplaceId: 'EBAY_US',
    isDefault: false,
  });
  const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    // Check for OAuth callback success/error
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      toast({ title: 'Success', description: 'eBay store connected successfully!' });
      window.history.replaceState({}, '', '/app/marketplace/connections');
    } else if (params.get('error')) {
      toast({ title: 'Error', description: `Connection failed: ${params.get('error')}`, variant: 'destructive' });
      window.history.replaceState({}, '', '/app/marketplace/connections');
    }

    // Single call to loadConnections on mount (covers both normal load and OAuth callback return)
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const res = await api.get('/v1/marketplace/connections');
      setConnections(res.data);
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConnection = async () => {
    if (!newConnection.name.trim()) {
      toast({ title: 'Validation Error', description: 'Store name is required', variant: 'destructive' });
      return;
    }

    try {
      const res = await api.post<any>('/v1/marketplace/connections', {
        platform: 'EBAY',
        ...newConnection,
      });
      const connection = res.data;
      setConnections([...connections, connection]);
      setShowAddModal(false);
      setNewConnection({ name: '', description: '', marketplaceId: 'EBAY_US', isDefault: false });
      // Redirect to OAuth flow
      window.location.href = `/api/v1/marketplace/ebay/auth/connect?connectionId=${connection.id}`;
    } catch (error: any) {
      console.error('Failed to create connection:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.error || error?.response?.data?.message || 'Failed to create connection',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = (connectionId: string) => {
    setDisconnectConfirm(connectionId);
  };

  const confirmDisconnect = async () => {
    const connectionId = disconnectConfirm;
    if (!connectionId) return;
    setDisconnectConfirm(null);

    try {
      await api.post(`/v1/marketplace/connections/${connectionId}/disconnect`);
      loadConnections();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleDelete = (connectionId: string) => {
    setDeleteConfirm(connectionId);
  };

  const confirmDelete = async () => {
    const connectionId = deleteConfirm;
    if (!connectionId) return;
    setDeleteConfirm(null);

    try {
      await api.delete(`/v1/marketplace/connections/${connectionId}`);
      setConnections(connections.filter((c) => c.id !== connectionId));
    } catch (error: any) {
      console.error('Failed to delete:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.error || error?.response?.data?.message || 'Failed to delete connection',
        variant: 'destructive',
      });
    }
  };

  const handleReconnect = (connectionId: string) => {
    window.location.href = `/api/v1/marketplace/ebay/auth/connect?connectionId=${connectionId}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketplace Connections</h1>
          <p className="text-gray-600 mt-2">Manage your eBay stores and marketplace integrations</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-5 h-5" />
          Add eBay Store
        </button>
      </div>

      {/*
        Orientation banner: surfaces the two-channel model to first-time
        tenants on the connections page so they know what eBay is and isn't
        before they hit OAuth. Kept terse — full discussion lives in the
        tenant docs.
      */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-sm text-blue-900">
          eBay is a separate sales channel from your storefront. Buyers come
          via eBay; orders flow into your unified Orders page. Listings draw
          from a warehouse you pick per listing — share one with your
          storefront for a single stock pool, or use a dedicated eBay
          warehouse to isolate channels.
        </p>
      </div>

      {connections.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No eBay stores connected</h3>
          <p className="text-gray-600 mb-4">
            Connect your first eBay store to start listing products
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-5 h-5" />
            Connect eBay Store
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onDisconnect={handleDisconnect}
              onDelete={handleDelete}
              onReconnect={handleReconnect}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={disconnectConfirm !== null}
        onOpenChange={(open) => { if (!open) setDisconnectConfirm(null); }}
        title="Disconnect Store"
        description="Are you sure you want to disconnect this store?"
        confirmLabel="Disconnect"
        variant="destructive"
        onConfirm={confirmDisconnect}
      />

      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title="Delete Store"
        description="Are you sure you want to delete this store? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      {/* Add Connection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add eBay Store</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Store Name *
                </label>
                <input
                  type="text"
                  value={newConnection.name}
                  onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                  placeholder="e.g., Main Store, Clearance Store"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newConnection.description}
                  onChange={(e) =>
                    setNewConnection({ ...newConnection, description: e.target.value })
                  }
                  placeholder="Brief description of this store"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marketplace</label>
                <select
                  value={newConnection.marketplaceId}
                  onChange={(e) =>
                    setNewConnection({ ...newConnection, marketplaceId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="EBAY_US">eBay United States</option>
                  <option value="EBAY_UK">eBay United Kingdom</option>
                  <option value="EBAY_DE">eBay Germany</option>
                  <option value="EBAY_CA">eBay Canada</option>
                  <option value="EBAY_AU">eBay Australia</option>
                  <option value="EBAY_FR">eBay France</option>
                  <option value="EBAY_IT">eBay Italy</option>
                  <option value="EBAY_ES">eBay Spain</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={newConnection.isDefault}
                  onChange={(e) =>
                    setNewConnection({ ...newConnection, isDefault: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700">
                  Set as default store
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateConnection}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Connect with eBay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectionCard({
  connection,
  onDisconnect,
  onDelete,
  onReconnect,
}: {
  connection: Connection;
  onDisconnect: (id: string) => void;
  onDelete: (id: string) => void;
  onReconnect: (id: string) => void;
}) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [vacationStatus, setVacationStatus] = useState<VacationStatus | null>(null);
  const [vacationLoading, setVacationLoading] = useState(true);
  const [vacationToggling, setVacationToggling] = useState(false);
  const [showVacationInput, setShowVacationInput] = useState(false);
  const [vacationReturnMessage, setVacationReturnMessage] = useState('');

  useEffect(() => {
    loadStatus();
    loadVacationStatus();
  }, [connection.id]);

  const loadStatus = async () => {
    try {
      const res = await api.get(`/v1/marketplace/connections/${connection.id}/status`);
      setStatus(res.data);
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  };

  const loadVacationStatus = async () => {
    setVacationLoading(true);
    try {
      const res = await api.get(`/v1/marketplace/connections/${connection.id}/vacation`);
      setVacationStatus(res.data);
    } catch (error) {
      console.error('Failed to load vacation status:', error);
      // Endpoint may not exist yet; treat as disabled
      setVacationStatus({ enabled: false });
    } finally {
      setVacationLoading(false);
    }
  };

  const handleVacationToggle = async () => {
    if (!vacationStatus) return;

    const newEnabled = !vacationStatus.enabled;

    // If enabling, show the return message input first
    if (newEnabled && !showVacationInput) {
      setShowVacationInput(true);
      return;
    }

    setVacationToggling(true);
    setShowVacationInput(false);
    try {
      const res = await api.post(`/v1/marketplace/connections/${connection.id}/vacation`, {
        enabled: newEnabled,
        returnMessage: newEnabled ? vacationReturnMessage.trim() : '',
      });
      setVacationStatus(res.data);
      setVacationReturnMessage('');
      toast({
        title: 'Success',
        description: newEnabled ? 'Vacation mode enabled' : 'Vacation mode disabled',
      });
    } catch (error: any) {
      console.error('Failed to toggle vacation mode:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.error || error?.response?.data?.message || 'Failed to update vacation mode',
        variant: 'destructive',
      });
    } finally {
      setVacationToggling(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{connection.name}</h3>
            {connection.isDefault && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                Default
              </span>
            )}
          </div>
          {connection.description && (
            <p className="text-sm text-gray-600 mt-1">{connection.description}</p>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <StatusItem
          label="eBay Connected"
          status={connection.isConnected}
          loading={!status}
        />
        <StatusItem
          label="Business Policies"
          status={status?.hasPolicies || false}
          loading={!status}
        />
        <StatusItem
          label="Ready to List"
          status={status?.canPublishListings || false}
          loading={!status}
        />
      </div>

      <div className="text-xs text-gray-500 mb-4">
        Marketplace: {connection.marketplaceId}
      </div>

      {/* Vacation Mode */}
      {connection.isConnected && (
        <div className="border-t border-gray-200 pt-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Palmtree className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Vacation Mode</span>
            </div>
            {vacationLoading ? (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <button
                onClick={handleVacationToggle}
                disabled={vacationToggling}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                  vacationStatus?.enabled ? 'bg-orange-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    vacationStatus?.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            )}
          </div>
          {vacationStatus?.enabled && vacationStatus.returnMessage && (
            <p className="text-xs text-orange-600 mt-1">
              Message: {vacationStatus.returnMessage}
            </p>
          )}
          {showVacationInput && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={vacationReturnMessage}
                onChange={(e) => setVacationReturnMessage(e.target.value)}
                placeholder="Return message (e.g., Back on March 15th)"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowVacationInput(false);
                    setVacationReturnMessage('');
                  }}
                  className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVacationToggle}
                  disabled={vacationToggling}
                  className="flex-1 px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {vacationToggling && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Enable
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {!connection.isConnected ? (
          <button
            onClick={() => onReconnect(connection.id)}
            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Connect
          </button>
        ) : (
          <>
            <button
              onClick={() => onDisconnect(connection.id)}
              className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
            >
              Disconnect
            </button>
            <button
              onClick={() => onDelete(connection.id)}
              className="px-3 py-2 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatusItem({
  label,
  status,
  loading,
}: {
  label: string;
  status: boolean;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-600">{label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {status ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : (
        <XCircle className="w-4 h-4 text-gray-400" />
      )}
      <span className={status ? 'text-gray-900' : 'text-gray-500'}>{label}</span>
    </div>
  );
}
