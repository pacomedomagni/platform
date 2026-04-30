'use client';

import { useState, useEffect } from 'react';
import { toast } from '@platform/ui';
import { Tag, Plus, Play, Pause, Trash2, RefreshCw, PercentCircle } from 'lucide-react';
import api from '@/lib/api';

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface Promotion {
  promotionId: string;
  name: string;
  promotionType: string;
  status: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: 'green' },
  RUNNING: { label: 'Running', color: 'green' },
  PAUSED: { label: 'Paused', color: 'yellow' },
  ENDED: { label: 'Ended', color: 'gray' },
  PENDING: { label: 'Pending', color: 'blue' },
  DRAFT: { label: 'Draft', color: 'gray' },
};

const COLOR_CLASSES: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  gray: 'bg-gray-100 text-gray-800',
  blue: 'bg-blue-100 text-blue-800',
};

function getStatusBadge(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, color: 'gray' };
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString();
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'MARKDOWN_SALE':
    case 'MARKDOWN':
      return 'Markdown Sale';
    case 'ORDER_DISCOUNT':
      return 'Order Discount';
    case 'VOLUME_DISCOUNT':
      return 'Volume Discount';
    case 'CODED_COUPON':
      return 'Coupon';
    default:
      return type;
  }
}

export default function MarketplacePromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      loadPromotions();
    }
  }, [selectedConnection]);

  const loadConnections = async () => {
    try {
      const res = await api.get<Connection[]>('/v1/marketplace/connections');
      setConnections(res.data);
      if (res.data.length > 0) {
        setSelectedConnection(res.data[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
      setLoading(false);
    }
  };

  const loadPromotions = async () => {
    setLoading(true);
    try {
      const conn = connections.find((c) => c.id === selectedConnection);
      const marketplaceId = conn?.marketplaceId || 'EBAY_US';
      const res = await api.get<any>('/v1/marketplace/promotions', {
        params: { connectionId: selectedConnection, marketplaceId },
      });
      const data = res.data;
      setPromotions(Array.isArray(data) ? data : data?.promotions ?? []);
    } catch (error) {
      console.error('Failed to load promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (promotionId: string) => {
    setActionLoading(promotionId);
    try {
      await api.post(`/v1/marketplace/promotions/${promotionId}/pause`, { connectionId: selectedConnection });
      toast({ title: 'Success', description: 'Promotion paused successfully' });
      loadPromotions();
    } catch (error: any) {
      console.error('Failed to pause promotion:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to pause promotion',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (promotionId: string) => {
    setActionLoading(promotionId);
    try {
      await api.post(`/v1/marketplace/promotions/${promotionId}/resume`, { connectionId: selectedConnection });
      toast({ title: 'Success', description: 'Promotion resumed successfully' });
      loadPromotions();
    } catch (error: any) {
      console.error('Failed to resume promotion:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to resume promotion',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (promotionId: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    setActionLoading(promotionId);
    try {
      await api.delete(`/v1/marketplace/promotions/${promotionId}`, {
        params: { connectionId: selectedConnection },
      });
      toast({ title: 'Success', description: 'Promotion deleted successfully' });
      loadPromotions();
    } catch (error: any) {
      console.error('Failed to delete promotion:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to delete promotion',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
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
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <PercentCircle className="w-8 h-8 text-blue-600" />
            Promotions
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              Read-only · Beta
            </span>
          </h1>
          <p className="text-gray-600 mt-2">
            View and manage existing eBay promotions. Create-flows for Markdown Sales
            and Order Discounts are not yet available — manage those in eBay Seller Hub
            for now.
          </p>
        </div>
        {/*
          Create-flow CTAs hidden until the builder ships. The previous shape
          rendered tempting buttons that toast'd "Coming soon" — see M82 in
          docs/ui-audit.md.
        */}
      </div>

      {/* Connection Selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {connections.length === 0 && (
                <option value="">No connections available</option>
              )}
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.marketplaceId})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadPromotions}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Promotions Table */}
      {promotions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 mb-4">
            <Tag className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No promotions found</h3>
          <p className="text-gray-600 mb-4">
            Promotions you create in eBay Seller Hub will appear here. The
            in-app create-flow is on the roadmap.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    End Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {promotions.map((promotion) => {
                  const statusConfig = getStatusBadge(promotion.status);
                  const isActioning = actionLoading === promotion.promotionId;
                  const isActive = promotion.status === 'ACTIVE' || promotion.status === 'RUNNING';
                  const isPaused = promotion.status === 'PAUSED';

                  return (
                    <tr key={promotion.promotionId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">{promotion.name}</span>
                        {promotion.description && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                            {promotion.description}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {getTypeLabel(promotion.promotionType)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${COLOR_CLASSES[statusConfig.color] ?? COLOR_CLASSES.gray}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">{formatDate(promotion.startDate)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">{formatDate(promotion.endDate)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <button
                              onClick={() => handlePause(promotion.promotionId)}
                              disabled={isActioning}
                              className="p-1 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded disabled:opacity-50"
                              title="Pause Promotion"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {isPaused && (
                            <button
                              onClick={() => handleResume(promotion.promotionId)}
                              disabled={isActioning}
                              className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded disabled:opacity-50"
                              title="Resume Promotion"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(promotion.promotionId)}
                            disabled={isActioning}
                            className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                            title="Delete Promotion"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
