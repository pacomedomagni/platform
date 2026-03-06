'use client';

import { useState, useEffect } from 'react';
import { toast } from '@platform/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  DollarSign,
  Truck,
  ArrowDownCircle,
  Send,
  User,
  ShoppingCart,
  MessageSquare,
} from 'lucide-react';
import { unwrapJson } from '@/lib/admin-fetch';

interface ReturnDetail {
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
  messages?: ReturnMessage[];
  timeline?: TimelineEntry[];
  createdAt: string;
  updatedAt: string;
  connection?: {
    name: string;
    marketplaceId: string;
  };
}

interface ReturnItem {
  title: string;
  quantity: number;
  price: number | string;
  sku?: string;
  imageUrl?: string;
}

interface ReturnMessage {
  id: string;
  sender: string;
  message: string;
  createdAt: string;
}

interface TimelineEntry {
  status: string;
  timestamp: string;
  note?: string;
}

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

function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'lg' }) {
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

  const sizeClasses = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses} ${colorClasses[config.color] || colorClasses.gray}`}
    >
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
      {config.label}
    </span>
  );
}

const TIMELINE_ORDER = [
  'RETURN_REQUESTED',
  'RETURN_ACCEPTED',
  'ITEM_SHIPPED',
  'ITEM_RECEIVED',
  'REFUND_ISSUED',
  'CLOSED',
];

export default function MarketplaceReturnDetailPage() {
  const params = useParams();
  const returnId = params.id as string;

  const [returnData, setReturnData] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [declineModal, setDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [refundModal, setRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundComment, setRefundComment] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    loadReturn();
  }, [returnId]);

  const loadReturn = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/returns/${returnId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = unwrapJson(await res.json());
        setReturnData(data);
      } else {
        toast({ title: 'Error', description: 'Failed to load return details', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to load return:', error);
      toast({ title: 'Error', description: 'Failed to load return details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/returns/${returnId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Return approved' });
        loadReturn();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to approve return', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to approve return:', error);
      toast({ title: 'Error', description: 'Failed to approve return', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      toast({ title: 'Validation Error', description: 'Please provide a reason for declining', variant: 'destructive' });
      return;
    }
    setDeclineModal(false);
    setActionLoading(true);
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
        loadReturn();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to decline return', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to decline return:', error);
      toast({ title: 'Error', description: 'Failed to decline return', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!refundAmount.trim() || isNaN(Number(refundAmount))) {
      toast({ title: 'Validation Error', description: 'Please enter a valid refund amount', variant: 'destructive' });
      return;
    }
    setRefundModal(false);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/returns/${returnId}/refund`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: refundAmount, comment: refundComment.trim() || undefined }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Refund issued successfully' });
        setRefundAmount('');
        setRefundComment('');
        loadReturn();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to issue refund', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to issue refund:', error);
      toast({ title: 'Error', description: 'Failed to issue refund', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkReceived = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/returns/${returnId}/received`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Return marked as received' });
        loadReturn();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to mark as received', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to mark as received:', error);
      toast({ title: 'Error', description: 'Failed to mark as received', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter a message', variant: 'destructive' });
      return;
    }
    setSendingMessage(true);
    try {
      const res = await fetch(`/api/v1/marketplace/returns/${returnId}/message`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Message sent' });
        setMessageText('');
        loadReturn();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to send message', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSendingMessage(false);
    }
  };

  const parseItems = (itemsData?: string): ReturnItem[] => {
    if (!itemsData) return [];
    try {
      return JSON.parse(itemsData);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!returnData) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Link
          href="/app/marketplace/returns"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Returns
        </Link>
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Return not found</h3>
          <p className="text-gray-600">The requested return could not be found.</p>
        </div>
      </div>
    );
  }

  const items = parseItems(returnData.itemsData);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back button */}
      <Link
        href="/app/marketplace/returns"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Returns
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Return {returnData.externalReturnId || returnData.id.substring(0, 12)}
              </h1>
              <StatusBadge status={returnData.status} size="lg" />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>
                Created: {new Date(returnData.createdAt).toLocaleDateString()} at{' '}
                {new Date(returnData.createdAt).toLocaleTimeString()}
              </span>
              <span>
                Updated: {new Date(returnData.updatedAt).toLocaleDateString()} at{' '}
                {new Date(returnData.updatedAt).toLocaleTimeString()}
              </span>
            </div>
            {returnData.connection && (
              <div className="mt-2 text-sm text-gray-500">
                Store: {returnData.connection.name} ({returnData.connection.marketplaceId})
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {returnData.status === 'RETURN_REQUESTED' && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => {
                    setDeclineReason('');
                    setDeclineModal(true);
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Decline
                </button>
              </>
            )}
            {returnData.status === 'ITEM_SHIPPED' && (
              <button
                onClick={handleMarkReceived}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                <ArrowDownCircle className="w-4 h-4" />
                Mark Received
              </button>
            )}
            {(returnData.status === 'RETURN_ACCEPTED' || returnData.status === 'ITEM_RECEIVED') && (
              <button
                onClick={() => {
                  setRefundAmount(returnData.refundAmount || '');
                  setRefundComment('');
                  setRefundModal(true);
                }}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                Issue Refund
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Order Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Order ID</label>
                <p className="mt-1 text-sm text-gray-900">
                  {returnData.externalOrderId || returnData.orderId}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Buyer</label>
                <p className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                  <User className="w-4 h-4 text-gray-400" />
                  {returnData.buyerUsername}
                </p>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-500">Return Reason</label>
                <p className="mt-1 text-sm text-gray-900">{returnData.reason}</p>
              </div>
              {returnData.refundAmount && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Refund Amount</label>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {returnData.currency || 'USD'} {Number(returnData.refundAmount).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Return Items
              </h2>
              <div className="divide-y divide-gray-200">
                {items.map((item, index) => (
                  <div key={index} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-12 h-12 object-cover rounded border border-gray-200"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.title}</p>
                        {item.sku && (
                          <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-900">Qty: {item.quantity}</p>
                      <p className="text-sm font-medium text-gray-900">
                        ${Number(item.price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Messages
            </h2>
            {returnData.messages && returnData.messages.length > 0 ? (
              <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                {returnData.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.sender === 'SELLER'
                        ? 'bg-blue-50 border border-blue-200 ml-8'
                        : 'bg-gray-50 border border-gray-200 mr-8'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">
                        {msg.sender === 'SELLER' ? 'You' : returnData.buyerUsername}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.createdAt).toLocaleDateString()}{' '}
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900">{msg.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">No messages yet.</p>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage || !messageText.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Send className={`w-4 h-4 ${sendingMessage ? 'animate-pulse' : ''}`} />
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Timeline */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Timeline</h2>
            {returnData.timeline && returnData.timeline.length > 0 ? (
              <div className="space-y-0">
                {returnData.timeline.map((entry, index) => {
                  const config = getStatusBadge(entry.status);
                  const Icon = config.icon;
                  const isLast = index === returnData.timeline!.length - 1;

                  return (
                    <div key={index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isLast ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        {index < returnData.timeline!.length - 1 && (
                          <div className="w-px h-8 bg-gray-200" />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className={`text-sm font-medium ${isLast ? 'text-gray-900' : 'text-gray-600'}`}>
                          {config.label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(entry.timestamp).toLocaleDateString()}{' '}
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </p>
                        {entry.note && (
                          <p className="text-xs text-gray-500 mt-1">{entry.note}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Fallback: render a simple timeline based on the current status */
              <div className="space-y-0">
                {TIMELINE_ORDER.map((step, index) => {
                  const config = getStatusBadge(step);
                  const Icon = config.icon;
                  const currentIndex = TIMELINE_ORDER.indexOf(returnData.status);
                  const isPast = index <= currentIndex;
                  const isCurrent = step === returnData.status;

                  // If return was declined, only show requested and declined
                  if (returnData.status === 'RETURN_DECLINED') {
                    if (step !== 'RETURN_REQUESTED' && step !== 'RETURN_DECLINED') {
                      // Show the RETURN_DECLINED step in place of RETURN_ACCEPTED
                      if (step === 'RETURN_ACCEPTED') {
                        const declinedConfig = getStatusBadge('RETURN_DECLINED');
                        const DeclinedIcon = declinedConfig.icon;
                        return (
                          <div key={step} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 text-red-600">
                                <DeclinedIcon className="w-4 h-4" />
                              </div>
                            </div>
                            <div className="pb-6">
                              <p className="text-sm font-medium text-red-700">Declined</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }
                  }

                  return (
                    <div key={step} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isCurrent
                              ? 'bg-blue-100 text-blue-600'
                              : isPast
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-100 text-gray-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        {index < TIMELINE_ORDER.length - 1 && (
                          <div
                            className={`w-px h-8 ${isPast && !isCurrent ? 'bg-green-200' : 'bg-gray-200'}`}
                          />
                        )}
                      </div>
                      <div className="pb-6">
                        <p
                          className={`text-sm font-medium ${
                            isCurrent
                              ? 'text-gray-900'
                              : isPast
                                ? 'text-gray-600'
                                : 'text-gray-400'
                          }`}
                        >
                          {config.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

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
                  setDeclineModal(false);
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
            <div className="space-y-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comment (optional)
                </label>
                <input
                  type="text"
                  value={refundComment}
                  onChange={(e) => setRefundComment(e.target.value)}
                  placeholder="Add an optional comment..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setRefundModal(false);
                  setRefundAmount('');
                  setRefundComment('');
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
