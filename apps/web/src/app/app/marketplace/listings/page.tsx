'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PlusIcon,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Trash2,
  Power,
  Upload,
} from 'lucide-react';

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface Listing {
  id: string;
  connectionId: string;
  sku: string;
  title: string;
  description: string;
  price: string;
  quantity: number;
  condition: string;
  categoryId: string;
  status: string;
  syncStatus: string;
  externalOfferId?: string;
  externalListingId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  connection?: {
    name: string;
    marketplaceId: string;
  };
}

export default function MarketplaceListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedConnection, selectedStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load connections
      const connectionsRes = await fetch('/api/v1/marketplace/connections', {
        credentials: 'include',
      });
      if (connectionsRes.ok) {
        const connectionsData = await connectionsRes.json();
        setConnections(connectionsData);
      }

      // Load listings with filters
      const params = new URLSearchParams();
      if (selectedConnection !== 'all') {
        params.append('connectionId', selectedConnection);
      }
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }

      const listingsRes = await fetch(`/api/v1/marketplace/listings?${params}`, {
        credentials: 'include',
      });
      if (listingsRes.ok) {
        const listingsData = await listingsRes.json();
        setListings(listingsData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (listingId: string) => {
    if (!confirm('Publish this listing to eBay?')) return;

    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        alert('Listing published successfully!');
        loadData();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to publish listing');
      }
    } catch (error) {
      console.error('Failed to publish:', error);
      alert('Failed to publish listing');
    }
  };

  const handleEnd = async (listingId: string) => {
    if (!confirm('End this eBay listing? This will remove it from eBay.')) return;

    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}/end`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        alert('Listing ended successfully');
        loadData();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to end listing');
      }
    } catch (error) {
      console.error('Failed to end listing:', error);
      alert('Failed to end listing');
    }
  };

  const handleSyncInventory = async (listingId: string) => {
    setSyncing(listingId);
    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}/sync-inventory`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        alert('Inventory synced successfully');
        loadData();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to sync inventory');
      }
    } catch (error) {
      console.error('Failed to sync inventory:', error);
      alert('Failed to sync inventory');
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (listingId: string) => {
    if (!confirm('Delete this listing? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setListings(listings.filter((l) => l.id !== listingId));
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete listing');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete listing');
    }
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">eBay Listings</h1>
          <p className="text-gray-600 mt-2">Manage your product listings across eBay stores</p>
        </div>
        <Link
          href="/app/marketplace/listings/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-5 h-5" />
          Create Listing
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Stores</option>
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.marketplaceId})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="publishing">Publishing</option>
              <option value="published">Published</option>
              <option value="ended">Ended</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Listings Table */}
      {listings.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No listings found</h3>
          <p className="text-gray-600 mb-4">
            {selectedConnection !== 'all' || selectedStatus !== 'all'
              ? 'Try adjusting your filters or create a new listing'
              : 'Create your first eBay listing to get started'}
          </p>
          <Link
            href="/app/marketplace/listings/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-5 h-5" />
            Create Listing
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Listing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Store
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {listings.map((listing) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    onPublish={handlePublish}
                    onEnd={handleEnd}
                    onSyncInventory={handleSyncInventory}
                    onDelete={handleDelete}
                    syncing={syncing === listing.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ListingRow({
  listing,
  onPublish,
  onEnd,
  onSyncInventory,
  onDelete,
  syncing,
}: {
  listing: Listing;
  onPublish: (id: string) => void;
  onEnd: (id: string) => void;
  onSyncInventory: (id: string) => void;
  onDelete: (id: string) => void;
  syncing: boolean;
}) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <div className="flex items-start gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900">{listing.title}</p>
              {listing.externalListingId && (
                <a
                  href={`https://www.ebay.com/itm/${listing.externalListingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                  title="View on eBay"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">SKU: {listing.sku}</p>
            {listing.errorMessage && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {listing.errorMessage}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">{listing.connection?.name}</div>
        <div className="text-xs text-gray-500">{listing.connection?.marketplaceId}</div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">${listing.price}</div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">{listing.quantity}</div>
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={listing.status} syncStatus={listing.syncStatus} />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {listing.status === 'approved' && !listing.externalListingId && (
            <button
              onClick={() => onPublish(listing.id)}
              className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
              title="Publish to eBay"
            >
              <Upload className="w-4 h-4" />
            </button>
          )}

          {listing.status === 'published' && (
            <>
              <button
                onClick={() => onSyncInventory(listing.id)}
                disabled={syncing}
                className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded disabled:opacity-50"
                title="Sync Inventory"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => onEnd(listing.id)}
                className="p-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded"
                title="End Listing"
              >
                <Power className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={() => onDelete(listing.id)}
            className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status, syncStatus }: { status: string; syncStatus: string }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'draft':
        return { icon: Clock, color: 'gray', label: 'Draft' };
      case 'approved':
        return { icon: CheckCircle2, color: 'green', label: 'Approved' };
      case 'publishing':
        return { icon: RefreshCw, color: 'blue', label: 'Publishing', animate: true };
      case 'published':
        return { icon: CheckCircle2, color: 'green', label: 'Published' };
      case 'ended':
        return { icon: XCircle, color: 'gray', label: 'Ended' };
      case 'error':
        return { icon: AlertCircle, color: 'red', label: 'Error' };
      default:
        return { icon: Clock, color: 'gray', label: status };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
          ${config.color === 'green' ? 'bg-green-100 text-green-800' : ''}
          ${config.color === 'blue' ? 'bg-blue-100 text-blue-800' : ''}
          ${config.color === 'red' ? 'bg-red-100 text-red-800' : ''}
          ${config.color === 'orange' ? 'bg-orange-100 text-orange-800' : ''}
          ${config.color === 'gray' ? 'bg-gray-100 text-gray-800' : ''}
        `}
      >
        <Icon className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} />
        {config.label}
      </span>
      {syncStatus !== 'synced' && status === 'published' && (
        <span className="text-xs text-gray-500">Sync: {syncStatus}</span>
      )}
    </div>
  );
}
