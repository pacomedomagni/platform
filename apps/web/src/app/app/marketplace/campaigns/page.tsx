'use client';

import { useState, useEffect } from 'react';
import { toast } from '@platform/ui';
import Link from 'next/link';
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Square,
  Eye,
  MousePointerClick,
  DollarSign,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import api from '@/lib/api';

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface Campaign {
  id: string;
  connectionId: string;
  name: string;
  status: string;
  campaignType: string;
  bidPercentage: number;
  budget?: number;
  dailyBudget?: number;
  impressions: number;
  clicks: number;
  sales: number;
  spend: number;
  createdAt: string;
  updatedAt: string;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'RUNNING':
      return { label: 'Running', color: 'green' };
    case 'PAUSED':
      return { label: 'Paused', color: 'yellow' };
    case 'ENDED':
      return { label: 'Ended', color: 'gray' };
    case 'PENDING':
      return { label: 'Pending', color: 'blue' };
    default:
      return { label: status, color: 'gray' };
  }
}

export default function MarketplaceCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      loadCampaigns();
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

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/marketplace/campaigns', {
        params: { connectionId: selectedConnection },
      });
      setCampaigns(res.data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (campaignId: string) => {
    setActionLoading(campaignId);
    try {
      await api.post(`/v1/marketplace/campaigns/${campaignId}/pause`);
      toast({ title: 'Success', description: 'Campaign paused successfully' });
      loadCampaigns();
    } catch (error: any) {
      console.error('Failed to pause campaign:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.error || error?.response?.data?.message || 'Failed to pause campaign',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (campaignId: string) => {
    setActionLoading(campaignId);
    try {
      await api.post(`/v1/marketplace/campaigns/${campaignId}/resume`);
      toast({ title: 'Success', description: 'Campaign resumed successfully' });
      loadCampaigns();
    } catch (error: any) {
      console.error('Failed to resume campaign:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.error || error?.response?.data?.message || 'Failed to resume campaign',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnd = async (campaignId: string) => {
    setActionLoading(campaignId);
    try {
      await api.post(`/v1/marketplace/campaigns/${campaignId}/end`);
      toast({ title: 'Success', description: 'Campaign ended successfully' });
      loadCampaigns();
    } catch (error: any) {
      console.error('Failed to end campaign:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.error || error?.response?.data?.message || 'Failed to end campaign',
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
            <Megaphone className="w-8 h-8 text-blue-600" />
            Promoted Listings
          </h1>
          <p className="text-gray-600 mt-2">Manage your marketplace advertising campaigns</p>
        </div>
        <Link
          href="/app/marketplace/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          New Campaign
        </Link>
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
              onClick={loadCampaigns}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Campaigns Table */}
      {campaigns.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 mb-4">
            <Megaphone className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns found</h3>
          <p className="text-gray-600 mb-4">
            Create your first promoted listing campaign to increase visibility
          </p>
          <Link
            href="/app/marketplace/campaigns/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            New Campaign
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Campaign
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bid %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      Impr.
                    </span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <MousePointerClick className="w-3 h-3" />
                      Clicks
                    </span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Sales
                    </span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Spend
                    </span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {campaigns.map((campaign) => {
                  const statusConfig = getStatusBadge(campaign.status);
                  const colorClasses: Record<string, string> = {
                    green: 'bg-green-100 text-green-800',
                    yellow: 'bg-yellow-100 text-yellow-800',
                    gray: 'bg-gray-100 text-gray-800',
                    blue: 'bg-blue-100 text-blue-800',
                  };
                  const isActioning = actionLoading === campaign.id;

                  return (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <Link
                          href={`/app/marketplace/campaigns/${campaign.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {campaign.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses[statusConfig.color] || colorClasses.gray}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">{campaign.campaignType}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">{campaign.bidPercentage}%</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {campaign.budget != null || campaign.dailyBudget != null
                            ? `$${(campaign.budget ?? campaign.dailyBudget ?? 0).toFixed(2)}`
                            : '--'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {campaign.impressions.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {campaign.clicks.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {campaign.sales.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          ${campaign.spend.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {campaign.status === 'RUNNING' && (
                            <button
                              onClick={() => handlePause(campaign.id)}
                              disabled={isActioning}
                              className="p-1 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded disabled:opacity-50"
                              title="Pause Campaign"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {campaign.status === 'PAUSED' && (
                            <button
                              onClick={() => handleResume(campaign.id)}
                              disabled={isActioning}
                              className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded disabled:opacity-50"
                              title="Resume Campaign"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {(campaign.status === 'RUNNING' || campaign.status === 'PAUSED') && (
                            <button
                              onClick={() => handleEnd(campaign.id)}
                              disabled={isActioning}
                              className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                              title="End Campaign"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          )}
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
