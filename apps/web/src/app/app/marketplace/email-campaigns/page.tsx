'use client';

import { useState, useEffect } from 'react';
import { toast } from '@platform/ui';
import {
  Mail,
  Plus,
  Trash2,
  BarChart3,
  RefreshCw,
  X,
} from 'lucide-react';
import { unwrapJson } from '@/lib/admin-fetch';

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface EmailCampaign {
  emailCampaignId: string;
  subject: string;
  body: string;
  audienceType: string;
  status: string;
  scheduledDate: string | null;
  sentDate?: string | null;
  createdDate: string;
}

interface Audience {
  audienceId: string;
  audienceType: string;
  name: string;
  subscriberCount: number;
  description: string;
}

interface CampaignReport {
  emailCampaignId: string;
  sent: number;
  opened: number;
  clicked: number;
  bounced?: number;
  unsubscribed?: number;
  openRate?: number;
  clickRate?: number;
  bounceRate?: number;
  unsubscribeRate?: number;
  lastUpdated?: string;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'SENT':
      return { label: 'Sent', bg: 'bg-green-100', text: 'text-green-800' };
    case 'SCHEDULED':
      return { label: 'Scheduled', bg: 'bg-blue-100', text: 'text-blue-800' };
    case 'DRAFT':
      return { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-800' };
    case 'SENDING':
      return { label: 'Sending', bg: 'bg-yellow-100', text: 'text-yellow-800' };
    case 'FAILED':
      return { label: 'Failed', bg: 'bg-red-100', text: 'text-red-800' };
    default:
      return { label: status, bg: 'bg-gray-100', text: 'text-gray-800' };
  }
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MarketplaceEmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    subject: '',
    body: '',
    audienceType: '',
    scheduledDate: '',
  });
  const [creating, setCreating] = useState(false);

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<CampaignReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      loadCampaigns();
      loadAudiences();
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
        } else {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/marketplace/email-campaigns?connectionId=${selectedConnection}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = unwrapJson<{ campaigns: EmailCampaign[]; total: number }>(
          await res.json()
        );
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error('Failed to load email campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAudiences = async () => {
    try {
      const res = await fetch(
        `/api/v1/marketplace/email-campaigns/audiences?connectionId=${selectedConnection}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = unwrapJson<Audience[]>(await res.json());
        setAudiences(data);
      }
    } catch (error) {
      console.error('Failed to load audiences:', error);
    }
  };

  const handleCreate = async () => {
    if (!createForm.subject.trim() || !createForm.body.trim() || !createForm.audienceType) {
      toast({
        title: 'Validation Error',
        description: 'Subject, body, and audience type are required',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/v1/marketplace/email-campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnection,
          subject: createForm.subject,
          body: createForm.body,
          audienceType: createForm.audienceType,
          scheduledDate: createForm.scheduledDate || undefined,
        }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Email campaign created successfully' });
        setShowCreateModal(false);
        setCreateForm({ subject: '', body: '', audienceType: '', scheduledDate: '' });
        loadCampaigns();
      } else {
        const error = unwrapJson(await res.json());
        toast({
          title: 'Error',
          description: error.error || 'Failed to create email campaign',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to create email campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to create email campaign',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this email campaign?')) return;

    setActionLoading(campaignId);
    try {
      const res = await fetch(
        `/api/v1/marketplace/email-campaigns/${campaignId}?connectionId=${selectedConnection}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (res.ok) {
        toast({ title: 'Success', description: 'Email campaign deleted successfully' });
        loadCampaigns();
      } else {
        const error = unwrapJson(await res.json());
        toast({
          title: 'Error',
          description: error.error || 'Failed to delete email campaign',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to delete email campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete email campaign',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewReport = async (campaignId: string) => {
    setReportLoading(true);
    setShowReportModal(true);
    setReportData(null);

    try {
      const res = await fetch(
        `/api/v1/marketplace/email-campaigns/${campaignId}/report?connectionId=${selectedConnection}`,
        { credentials: 'include' }
      );

      if (res.ok) {
        const data = unwrapJson<CampaignReport>(await res.json());
        setReportData(data);
      } else {
        const error = unwrapJson(await res.json());
        toast({
          title: 'Error',
          description: error.error || 'Failed to load campaign report',
          variant: 'destructive',
        });
        setShowReportModal(false);
      }
    } catch (error) {
      console.error('Failed to load campaign report:', error);
      toast({
        title: 'Error',
        description: 'Failed to load campaign report',
        variant: 'destructive',
      });
      setShowReportModal(false);
    } finally {
      setReportLoading(false);
    }
  };

  if (loading && campaigns.length === 0 && connections.length === 0) {
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
            <Mail className="w-8 h-8 text-blue-600" />
            Email Campaigns
          </h1>
          <p className="text-gray-600 mt-2">
            Manage email marketing campaigns for your eBay store subscribers
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedConnection}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          Create Campaign
        </button>
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
              disabled={!selectedConnection}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : campaigns.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 mb-4">
            <Mail className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No email campaigns found</h3>
          <p className="text-gray-600 mb-4">
            Create your first email campaign to engage your store subscribers
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedConnection}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            Create Campaign
          </button>
        </div>
      ) : (
        /* Campaigns Table */
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Audience
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {campaigns.map((campaign) => {
                  const statusConfig = getStatusBadge(campaign.status);
                  const isActioning = actionLoading === campaign.emailCampaignId;

                  return (
                    <tr key={campaign.emailCampaignId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">
                          {campaign.subject}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">
                          {campaign.audienceType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">
                          {formatDate(campaign.scheduledDate)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewReport(campaign.emailCampaignId)}
                            className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                            title="View Report"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(campaign.emailCampaignId)}
                            disabled={isActioning}
                            className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                            title="Delete Campaign"
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

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Create Email Campaign</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={createForm.subject}
                  onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                  placeholder="Enter email subject line"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body
                </label>
                <textarea
                  value={createForm.body}
                  onChange={(e) => setCreateForm({ ...createForm, body: e.target.value })}
                  placeholder="Enter email body content (HTML supported)"
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Audience
                </label>
                <select
                  value={createForm.audienceType}
                  onChange={(e) => setCreateForm({ ...createForm, audienceType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select audience</option>
                  {audiences.map((aud) => (
                    <option key={aud.audienceId} value={aud.audienceType}>
                      {aud.name} ({aud.subscriberCount.toLocaleString()} subscribers)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scheduled Date (optional)
                </label>
                <input
                  type="datetime-local"
                  value={createForm.scheduledDate}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, scheduledDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
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
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Campaign Report</h2>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportData(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              {reportLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : reportData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-700">
                        {reportData.sent.toLocaleString()}
                      </div>
                      <div className="text-xs text-blue-600 mt-1">Sent</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-700">
                        {reportData.opened.toLocaleString()}
                      </div>
                      <div className="text-xs text-green-600 mt-1">Opened</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-700">
                        {reportData.clicked.toLocaleString()}
                      </div>
                      <div className="text-xs text-purple-600 mt-1">Clicked</div>
                    </div>
                  </div>

                  {(reportData.openRate != null || reportData.clickRate != null) && (
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Rates</h4>
                      <div className="space-y-2">
                        {reportData.openRate != null && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Open Rate</span>
                            <span className="font-medium text-gray-900">
                              {reportData.openRate.toFixed(2)}%
                            </span>
                          </div>
                        )}
                        {reportData.clickRate != null && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Click Rate</span>
                            <span className="font-medium text-gray-900">
                              {reportData.clickRate.toFixed(2)}%
                            </span>
                          </div>
                        )}
                        {reportData.bounceRate != null && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Bounce Rate</span>
                            <span className="font-medium text-gray-900">
                              {reportData.bounceRate.toFixed(2)}%
                            </span>
                          </div>
                        )}
                        {reportData.unsubscribeRate != null && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Unsubscribe Rate</span>
                            <span className="font-medium text-gray-900">
                              {reportData.unsubscribeRate.toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {reportData.lastUpdated && (
                    <div className="text-xs text-gray-400 text-right pt-2">
                      Last updated: {formatDate(reportData.lastUpdated)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No report data available
                </div>
              )}
            </div>
            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportData(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
