'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

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

  useEffect(() => {
    loadConnections();

    // Check for OAuth callback success/error
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      alert('eBay store connected successfully!');
      window.history.replaceState({}, '', '/app/marketplace/connections');
      loadConnections();
    } else if (params.get('error')) {
      alert(`Connection failed: ${params.get('error')}`);
      window.history.replaceState({}, '', '/app/marketplace/connections');
    }
  }, []);

  const loadConnections = async () => {
    try {
      const res = await fetch('/api/v1/marketplace/connections', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConnection = async () => {
    if (!newConnection.name.trim()) {
      alert('Store name is required');
      return;
    }

    try {
      const res = await fetch('/api/v1/marketplace/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platform: 'EBAY',
          ...newConnection,
        }),
      });

      if (res.ok) {
        const connection = await res.json();
        setConnections([...connections, connection]);
        setShowAddModal(false);
        setNewConnection({ name: '', description: '', marketplaceId: 'EBAY_US', isDefault: false });

        // Redirect to OAuth flow
        window.location.href = `/api/v1/marketplace/ebay/auth/connect?connectionId=${connection.id}`;
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create connection');
      }
    } catch (error) {
      console.error('Failed to create connection:', error);
      alert('Failed to create connection');
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this store?')) return;

    try {
      const res = await fetch(`/api/v1/marketplace/connections/${connectionId}/disconnect`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        loadConnections();
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this store? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/v1/marketplace/connections/${connectionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setConnections(connections.filter((c) => c.id !== connectionId));
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete connection');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
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

  useEffect(() => {
    loadStatus();
  }, [connection.id]);

  const loadStatus = async () => {
    try {
      const res = await fetch(`/api/v1/marketplace/connections/${connection.id}/status`, {
        credentials: 'include',
      });
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch (error) {
      console.error('Failed to load status:', error);
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
