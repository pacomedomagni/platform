'use client';

import { useState, useEffect } from 'react';
import { toast } from '@platform/ui';
import Link from 'next/link';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  DollarSign,
  Truck,
  ArrowDownCircle,
  RotateCcw,
} from 'lucide-react';
import { unwrapJson } from '@/lib/admin-fetch';

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface Return {
  id: string;
  connectionId: string;
  externalReturnId?: string;
  orderId: string;
  externalOrderId?: string;
  buyerUsername: string;
  reason: string;
  status: string;
  refundAmount?: string;
  currency?: string;
  itemsData?: string;
  createdAt: string;
  updatedAt: string;
  connection?: {
    name: string;
    marketplaceId: string;
  };
}

const STATUS_OPTIONS = [
  'RETURN_REQUESTED',
  'RETURN_ACCEPTED',
  'RETURN_DECLINED',
  'ITEM_SHIPPED',
  'ITEM_RECEIVED',
  'REFUND_ISSUED',
  'CLOSED',
] as const;

function getStatusBadge(status: string) {
  switch (status) {
    case 'RETURN_REQUESTED':
      return { label: 'Requested', color: 'yellow', icon: Clock };
    case 'RETURN_ACCEPTED':
      return { label: 'Accepted', color: 'green', icon: CheckCircle2 };
    case 'RETURN_DECLINED':
      return { label: 'Declined', color: 'red', icon: XCircle };
    case 'ITEM_SHIPPED':
      return { label: 'Item Shipped', color: 'blue', icon: Truck };
    case 'ITEM_RECEIVED':
      return { label: 'Item Received', color: 'blue', icon: ArrowDownCircle };
    case 'REFUND_ISSUED':
      return { label: 'Refunded', color: 'purple', icon: DollarSign };
    case 'CLOSED':
      return { label: 'Closed', color: 'gray', icon: Package };
    default:
      return { label: status, color: 'gray', icon: Clock };
  }
}

function StatusBadge({ status }: { status: string }) {
  const config = getStatusBadge(status);
  const Icon = config.icon;

  const colorClasses: Record<string, string> = {
    yellow: 'bg-yellow-100 text-yellow-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    gray: 'bg-gray-100 text-gray-800',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorClasses[config.color] || colorClasses.gray}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export default function MarketplaceReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [declineModal, setDeclineModal] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [refundModal, setRefundModal] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');

  useEffect(() => {
    loadData();
  }, [selectedConnection, selectedStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const connectionsRes = await fetch('/api/v1/marketplace/connections', {
        credentials: 'include',
      });
      if (connectionsRes.ok) {
        const connectionsData = unwrapJson(await connectionsRes.json());
        setConnections(connectionsData);
      }

      const params = new URLSearchParams();
      if (selectedConnection !== 'all') {
        params.append('connectionId', selectedConnection);
      }
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }

      const returnsRes = await fetch(`/api/v1/marketplace/returns?${params}`, {
        credentials: 'include',
      });
      if (returnsRes.ok) {
        const returnsData = unwrapJson(await returnsRes.json());
        setReturns(returnsData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (selectedConnection === 'all') {
      toast({ title: 'Error', description: 'Please select a store to sync returns', variant: 'destructive' });
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch('/api/v1/marketplace/returns/sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: selectedConnection }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Returns synced successfully' });
        loadData();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to sync returns', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to sync returns:', error);
      toast({ title: 'Error', description: 'Failed to sync returns', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleApprove = async (returnId: string) => {
    setActionLoading(returnId);
    try {
      const res = await fetch(`/api/v1/marketplace/returns/${returnId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Return approved' });
        loadData();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to approve return', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to approve return:', error);
      toast({ title: 'Error', description: 'Failed to approve return', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async () => {
    const returnId = declineModal;
    if (!returnId) return;
    if (!declineReason.trim()) {
      toast({ title: 'Validation Error', description: 'Please provide a reason for declining', variant: 'destructive' });
      return;
    }
    setDeclineModal(null);
    setActionLoading(returnId);
    try {
      const res = await fetch(`/api/v1/marketplace/returns/${returnId}/decline`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Return declined' });
        setDeclineReason('');
        loadData();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to decline return', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to decline return:', error);
      toast({ title: 'Error', description: 'Failed to decline return', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefund = async () => {
    const returnId = refundModal;
    if (!returnId) return;
    if (!refundAmount.trim() || isNaN(Number(refundAmount))) {
      toast({ title: 'Validation Error', description: 'Please enter a valid refund amount', variant: 'destructive' });
      return;
    }
    setRefundModal(null);
    setActionLoading(returnId);
    try {
      const res = await fetch(`/api/v1/marketplace/returns/${returnId}/refund`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: refundAmount }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Refund issued successfully' });
        setRefundAmount('');
        loadData();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to issue refund', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to issue refund:', error);
      toast({ title: 'Error', description: 'Failed to issue refund', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkReceived = async (returnId: string) => {
    setActionLoading(returnId);
    try {
      const res = await fetch(`/api/v1/marketplace/returns/${returnId}/received`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Return marked as received' });
        loadData();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to mark as received', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to mark as received:', error);
      toast({ title: 'Error', description: 'Failed to mark as received', variant: 'destructive' });
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
          <h1 className="text-3xl font-bold text-gray-900">Marketplace Returns</h1>
          <p className="text-gray-600 mt-2">Manage return requests from your marketplace buyers</p>
        </div>
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
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {getStatusBadge(status).label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || selectedConnection === 'all'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <RotateCcw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync Returns
            </button>
          </div>
        </div>
      </div>

      {/* Returns Table */}
      {returns.length === 0 ? (
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">No returns found</h3>
          <p className="text-gray-600">
            {selectedConnection !== 'all' || selectedStatus !== 'all'
              ? 'Try adjusting your filters or sync returns from your store'
              : 'No return requests have been received yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Return ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Buyer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Refund Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Request Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/app/marketplace/returns/${ret.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        title={ret.id}
                      >
                        {ret.externalReturnId || ret.id.substring(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {ret.externalOrderId || ret.orderId.substring(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{ret.buyerUsername}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-[200px] truncate" title={ret.reason}>
                        {ret.reason}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={ret.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {ret.refundAmount
                          ? `${ret.currency || 'USD'} ${Number(ret.refundAmount).toFixed(2)}`
                          : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">
                        {new Date(ret.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {ret.status === 'RETURN_REQUESTED' && (
                          <>
                            <button
                              onClick={() => handleApprove(ret.id)}
                              disabled={actionLoading === ret.id}
                              className="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                              title="Approve return"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setDeclineReason('');
                                setDeclineModal(ret.id);
                              }}
                              disabled={actionLoading === ret.id}
                              className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                              title="Decline return"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {ret.status === 'ITEM_SHIPPED' && (
                          <button
                            onClick={() => handleMarkReceived(ret.id)}
                            disabled={actionLoading === ret.id}
                            className="px-2 py-1 text-xs font-medium text-white bg-orange-600 rounded hover:bg-orange-700 disabled:opacity-50"
                            title="Mark as received"
                          >
                            Mark Received
                          </button>
                        )}
                        {(ret.status === 'RETURN_ACCEPTED' || ret.status === 'ITEM_RECEIVED') && (
                          <button
                            onClick={() => {
                              setRefundAmount(ret.refundAmount || '');
                              setRefundModal(ret.id);
                            }}
                            disabled={actionLoading === ret.id}
                            className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                            title="Issue refund"
                          >
                            Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {declineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Decline Return</h2>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for declining this return request.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason *
              </label>
              <input
                type="text"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Enter reason for declining..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setDeclineModal(null);
                  setDeclineReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Decline Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Issue Refund</h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter the refund amount to issue to the buyer.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Refund Amount *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setRefundModal(null);
                  setRefundAmount('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRefund}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Issue Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
