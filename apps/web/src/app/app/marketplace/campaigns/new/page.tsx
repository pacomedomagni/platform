'use client';

import { useState, useEffect } from 'react';
import { toast } from '@platform/ui';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, RefreshCw, Search, X } from 'lucide-react';
import Link from 'next/link';
import { unwrapJson } from '@/lib/admin-fetch';

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface Listing {
  id: string;
  externalListingId: string;
  title: string;
  price: string;
  currency: string;
  status: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [campaignName, setCampaignName] = useState('');
  const [bidPercentage, setBidPercentage] = useState<number>(2);
  const [dailyBudget, setDailyBudget] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      loadListings();
    }
  }, [selectedConnection]);

  const loadConnections = async () => {
    try {
      const res = await fetch('/api/v1/marketplace/connections', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = unwrapJson<Connection[]>(await res.json());
        setConnections(data);
        if (data.length > 0) {
          setSelectedConnection(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadListings = async () => {
    setListingsLoading(true);
    try {
      const res = await fetch(
        `/api/v1/marketplace/listings?connectionId=${selectedConnection}&status=ACTIVE`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = unwrapJson<Listing[]>(await res.json());
        setListings(data);
      }
    } catch (error) {
      console.error('Failed to load listings:', error);
    } finally {
      setListingsLoading(false);
    }
  };

  const toggleListing = (listingId: string) => {
    setSelectedListings((prev) =>
      prev.includes(listingId)
        ? prev.filter((id) => id !== listingId)
        : [...prev, listingId]
    );
  };

  const selectAll = () => {
    setSelectedListings(filteredListings.map((l) => l.externalListingId));
  };

  const clearSelection = () => {
    setSelectedListings([]);
  };

  const filteredListings = listings.filter((l) =>
    searchQuery
      ? l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.externalListingId.includes(searchQuery)
      : true
  );

  const handleCreate = async () => {
    if (!selectedConnection) {
      toast({ title: 'Error', description: 'Please select a store', variant: 'destructive' });
      return;
    }
    if (!campaignName.trim()) {
      toast({ title: 'Error', description: 'Campaign name is required', variant: 'destructive' });
      return;
    }
    if (selectedListings.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one listing', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        connectionId: selectedConnection,
        campaignName: campaignName.trim(),
        bidPercentage,
        listingIds: selectedListings,
      };
      if (dailyBudget) {
        body.dailyBudget = parseFloat(dailyBudget);
      }

      const res = await fetch('/api/v1/marketplace/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Campaign created successfully!' });
        router.push('/app/marketplace/campaigns');
      } else {
        const error = unwrapJson(await res.json());
        toast({
          title: 'Error',
          description: error.error || 'Failed to create campaign',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
      toast({ title: 'Error', description: 'Failed to create campaign', variant: 'destructive' });
    } finally {
      setCreating(false);
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
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/app/marketplace/campaigns"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">New Promoted Listing Campaign</h1>
          <p className="text-gray-600 mt-1">Boost your listing visibility with Promoted Listings Standard</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Store Selection */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Store</h2>
          <select
            value={selectedConnection}
            onChange={(e) => setSelectedConnection(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {connections.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name} ({conn.marketplaceId})
              </option>
            ))}
          </select>
        </div>

        {/* Campaign Details */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campaign Name *
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Spring Sale Promotion"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ad Rate (Bid %) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={bidPercentage}
                    onChange={(e) => setBidPercentage(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  eBay recommends 2-10% for Promoted Listings Standard
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daily Budget (optional)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(e.target.value)}
                    placeholder="No limit"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Listing Selection */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Select Listings ({selectedListings.length} selected)
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search listings..."
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {listingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredListings.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              {listings.length === 0
                ? 'No active listings found for this store'
                : 'No listings match your search'}
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {filteredListings.map((listing) => (
                <label
                  key={listing.id}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedListings.includes(listing.externalListingId)}
                    onChange={() => toggleListing(listing.externalListingId)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{listing.title}</p>
                    <p className="text-xs text-gray-500">
                      {listing.externalListingId} &middot; {listing.price} {listing.currency}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link
            href="/app/marketplace/campaigns"
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Cancel
          </Link>
          <button
            onClick={handleCreate}
            disabled={creating || !campaignName.trim() || selectedListings.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Campaign
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
