'use client';

import { useState, useEffect } from 'react';
import { toast } from '@platform/ui';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Eye,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Plus,
  Trash2,
} from 'lucide-react';
import { unwrapJson } from '@/lib/admin-fetch';

interface Campaign {
  id: string;
  connectionId: string;
  externalCampaignId: string;
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

interface CampaignAd {
  listingId: string;
  title?: string;
  bidPercentage: number;
  status: string;
}

interface CampaignReport {
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  ctr: number;
  acos: number;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [ads, setAds] = useState<CampaignAd[]>([]);
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [addListingId, setAddListingId] = useState('');
  const [addBidPct, setAddBidPct] = useState<number>(2);
  const [addingAd, setAddingAd] = useState(false);

  useEffect(() => {
    loadCampaign();
  }, [campaignId]);

  const loadCampaign = async () => {
    setLoading(true);
    try {
      const [campRes, adsRes, reportRes] = await Promise.all([
        fetch(`/api/v1/marketplace/campaigns/${campaignId}`, { credentials: 'include' }),
        fetch(`/api/v1/marketplace/campaigns/${campaignId}/ads`, { credentials: 'include' }),
        fetch(`/api/v1/marketplace/campaigns/${campaignId}/report`, { credentials: 'include' }),
      ]);

      if (campRes.ok) {
        setCampaign(unwrapJson<Campaign>(await campRes.json()));
      }
      if (adsRes.ok) {
        setAds(unwrapJson<CampaignAd[]>(await adsRes.json()));
      }
      if (reportRes.ok) {
        setReport(unwrapJson<CampaignReport>(await reportRes.json()));
      }
    } catch (error) {
      console.error('Failed to load campaign:', error);
      toast({ title: 'Error', description: 'Failed to load campaign details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'pause' | 'resume' | 'end') => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/campaigns/${campaignId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Success', description: `Campaign ${action}d successfully` });
        loadCampaign();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || `Failed to ${action} campaign`, variant: 'destructive' });
      }
    } catch (error) {
      console.error(`Failed to ${action} campaign:`, error);
      toast({ title: 'Error', description: `Failed to ${action} campaign`, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAd = async () => {
    if (!addListingId.trim()) return;
    setAddingAd(true);
    try {
      const res = await fetch(`/api/v1/marketplace/campaigns/${campaignId}/ads`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: addListingId.trim(), bidPercentage: addBidPct }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Ad added successfully' });
        setAddListingId('');
        loadCampaign();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to add ad', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to add ad:', error);
      toast({ title: 'Error', description: 'Failed to add ad', variant: 'destructive' });
    } finally {
      setAddingAd(false);
    }
  };

  const handleRemoveAd = async (listingId: string) => {
    try {
      const res = await fetch(`/api/v1/marketplace/campaigns/${campaignId}/ads/${listingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Ad removed successfully' });
        loadCampaign();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to remove ad', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to remove ad:', error);
      toast({ title: 'Error', description: 'Failed to remove ad', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Campaign not found</h2>
          <Link href="/app/marketplace/campaigns" className="text-blue-600 hover:underline">
            Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    RUNNING: { bg: 'bg-green-100', text: 'text-green-800', label: 'Running' },
    PAUSED: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Paused' },
    ENDED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Ended' },
    PENDING: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Pending' },
  };

  const sc = statusConfig[campaign.status] || statusConfig.PENDING;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/app/marketplace/campaigns"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{campaign.name}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
              {sc.label}
            </span>
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            {campaign.campaignType} &middot; Created {new Date(campaign.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {campaign.status === 'RUNNING' && (
            <button
              onClick={() => handleAction('pause')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50 disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
          {campaign.status === 'PAUSED' && (
            <button
              onClick={() => handleAction('resume')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}
          {(campaign.status === 'RUNNING' || campaign.status === 'PAUSED') && (
            <button
              onClick={() => handleAction('end')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <Square className="w-4 h-4" />
              End
            </button>
          )}
          <button
            onClick={loadCampaign}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500">Impressions</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {(report?.impressions ?? campaign.impressions).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <MousePointerClick className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-500">Clicks</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {(report?.clicks ?? campaign.clicks).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-gray-500">Sales</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {(report?.sales ?? campaign.sales).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-gray-500">Spend</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${(report?.spend ?? campaign.spend).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Campaign Config */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
          <div>
            <p className="text-gray-500 mb-1">Bid Percentage</p>
            <p className="font-medium text-gray-900">{campaign.bidPercentage}%</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Daily Budget</p>
            <p className="font-medium text-gray-900">
              {campaign.dailyBudget != null ? `$${campaign.dailyBudget.toFixed(2)}` : 'No limit'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Total Budget</p>
            <p className="font-medium text-gray-900">
              {campaign.budget != null ? `$${campaign.budget.toFixed(2)}` : 'No limit'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">CTR</p>
            <p className="font-medium text-gray-900">
              {report?.ctr != null ? `${(report.ctr * 100).toFixed(2)}%` : '--'}
            </p>
          </div>
        </div>
      </div>

      {/* Ads / Listings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Promoted Listings ({ads.length})
          </h2>
        </div>

        {/* Add Ad Form */}
        {(campaign.status === 'RUNNING' || campaign.status === 'PAUSED') && (
          <div className="flex items-end gap-3 mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">eBay Listing ID</label>
              <input
                type="text"
                value={addListingId}
                onChange={(e) => setAddListingId(e.target.value)}
                placeholder="e.g., 123456789012"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bid %</label>
              <input
                type="number"
                min={1}
                max={100}
                value={addBidPct}
                onChange={(e) => setAddBidPct(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAddAd}
              disabled={addingAd || !addListingId.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {addingAd ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </div>
        )}

        {ads.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No ads in this campaign yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Listing ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bid %
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
                {ads.map((ad) => (
                  <tr key={ad.listingId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{ad.listingId}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{ad.title || '--'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{ad.bidPercentage}%</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        ad.status === 'RUNNING' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {ad.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleRemoveAd(ad.listingId)}
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Remove ad"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
