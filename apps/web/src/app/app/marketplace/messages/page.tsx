'use client';

import { useState, useEffect } from 'react';
import { toast } from '@platform/ui';
import Link from 'next/link';
import {
  RefreshCw,
  MessageSquare,
  Mail,
  MailOpen,
  Filter,
  Download,
} from 'lucide-react';
import api from '@/lib/api';

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface MessageThread {
  id: string;
  connectionId: string;
  subject: string;
  buyerUsername: string;
  itemTitle?: string;
  itemId?: string;
  status: 'OPEN' | 'RESPONDED' | 'CLOSED';
  lastMessageDate: string;
  isRead: boolean;
  messageCount: number;
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  OPEN: { label: 'Open', bg: 'bg-blue-100', text: 'text-blue-800' },
  RESPONDED: { label: 'Responded', bg: 'bg-green-100', text: 'text-green-800' },
  CLOSED: { label: 'Closed', bg: 'bg-gray-100', text: 'text-gray-800' },
};

export default function MarketplaceMessagesPage() {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadConnections();
    loadUnreadCount();
  }, []);

  useEffect(() => {
    loadThreads();
  }, [selectedConnection, selectedStatus, unreadOnly]);

  const loadConnections = async () => {
    try {
      const res = await api.get<Connection[]>('/v1/marketplace/connections');
      setConnections(res.data);
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await api.get<{ count: number }>('/v1/marketplace/messages/unread-count');
      setUnreadCount(res.data.count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const loadThreads = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedConnection !== 'all') params.connectionId = selectedConnection;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (unreadOnly) params.unreadOnly = 'true';
      const res = await api.get<MessageThread[]>('/v1/marketplace/messages', { params });
      setThreads(res.data);
    } catch (error) {
      console.error('Failed to load threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/v1/marketplace/messages/sync');
      toast({ title: 'Success', description: 'Messages synced successfully' });
      loadThreads();
      loadUnreadCount();
    } catch (error: any) {
      console.error('Failed to sync messages:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.error || error?.response?.data?.message || 'Failed to sync messages',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = () => {
    loadThreads();
    loadUnreadCount();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (loading && threads.length === 0) {
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
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  {unreadCount}
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-2">Buyer-seller messages from your eBay stores</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Download className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Messages'}
          </button>
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
              <option value="OPEN">Open</option>
              <option value="RESPONDED">Responded</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Unread only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Threads List */}
      {threads.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 mb-4">
            <MessageSquare className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No messages found</h3>
          <p className="text-gray-600 mb-4">
            {selectedConnection !== 'all' || selectedStatus !== 'all' || unreadOnly
              ? 'Try adjusting your filters to see more messages'
              : 'Buyer messages from your eBay stores will appear here'}
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Sync Messages
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="divide-y divide-gray-200">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/app/marketplace/messages/${thread.id}`}
                className={`block px-6 py-4 hover:bg-gray-50 transition-colors ${
                  !thread.isRead ? 'bg-blue-50/40' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Unread indicator */}
                    <div className="pt-1.5 flex-shrink-0">
                      {!thread.isRead ? (
                        <Mail className="w-5 h-5 text-blue-600" />
                      ) : (
                        <MailOpen className="w-5 h-5 text-gray-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-sm truncate ${
                            !thread.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                          }`}
                        >
                          {thread.subject}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className={!thread.isRead ? 'font-semibold text-gray-700' : ''}>
                          {thread.buyerUsername}
                        </span>
                        {thread.itemTitle && (
                          <>
                            <span>·</span>
                            <span className="truncate">{thread.itemTitle}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Status badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_BADGES[thread.status]?.bg || 'bg-gray-100'
                      } ${STATUS_BADGES[thread.status]?.text || 'text-gray-800'}`}
                    >
                      {STATUS_BADGES[thread.status]?.label || thread.status}
                    </span>

                    {/* Date */}
                    <span
                      className={`text-xs whitespace-nowrap ${
                        !thread.isRead ? 'font-semibold text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {formatDate(thread.lastMessageDate)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
