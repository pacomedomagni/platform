/**
 * Notifications Admin Page
 * View and manage system notifications
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Button, Badge, toast } from '@platform/ui';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  RefreshCw,
  ShoppingCart,
  Package,
  AlertTriangle,
  CreditCard,
  UserPlus,
  FileText,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';

interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  link?: string;
  priority: string;
  isRead: boolean;
  readAt?: string;
  expiresAt?: string;
  createdAt: string;
}

async function fetchNotifications(params?: {
  types?: string;
  isRead?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: Notification[]; total: number; unreadCount: number }> {
  const res = await api.get('/v1/operations/notifications', { params });
  return res.data;
}

async function markAsRead(id: string) {
  const res = await api.put(`/v1/operations/notifications/${id}/read`);
  return res.data;
}

async function markAllAsRead() {
  const res = await api.put('/v1/operations/notifications/read-all');
  return res.data;
}

async function deleteNotification(id: string) {
  await api.delete(`/v1/operations/notifications/${id}`);
}

async function deleteRead() {
  const res = await api.delete('/v1/operations/notifications/read');
  return res.data;
}

const ICON_MAP: Record<string, typeof Bell> = {
  'order.received': ShoppingCart,
  'order.shipped': Package,
  'order.delivered': Package,
  'order.cancelled': AlertTriangle,
  'payment.received': CreditCard,
  'payment.failed': AlertTriangle,
  'inventory.low': AlertTriangle,
  'inventory.out': AlertTriangle,
  'customer.registered': UserPlus,
  'report.ready': FileText,
  'import.complete': FileText,
  'export.ready': FileText,
  'system.alert': AlertTriangle,
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  normal: 'bg-slate-50 text-slate-700 border-slate-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params: { types?: string; isRead?: string; page?: number; limit?: number } = { page, limit };
      if (filter === 'unread') params.isRead = 'false';
      if (filter === 'read') params.isRead = 'true';

      const result = await fetchNotifications(params);
      setNotifications(result.data);
      setUnreadCount(result.unreadCount);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load notifications', err);
      toast({
        title: 'Could not load notifications',
        description: err instanceof Error ? err.message : 'Please try refreshing.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    // Optimistic update with rollback on failure (NO4).
    const prev = notifications;
    const prevCount = unreadCount;
    setNotifications(p =>
      p.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
    );
    setUnreadCount(c => Math.max(0, c - 1));
    try {
      await markAsRead(id);
    } catch (err) {
      console.error('Mark-as-read failed', err);
      setNotifications(prev);
      setUnreadCount(prevCount);
      toast({
        title: 'Could not mark as read',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    const prev = notifications;
    const prevCount = unreadCount;
    setNotifications(p => p.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await markAllAsRead();
    } catch (err) {
      console.error('Mark-all-as-read failed', err);
      setNotifications(prev);
      setUnreadCount(prevCount);
      toast({
        title: 'Could not mark all as read',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    const prev = notifications;
    const prevTotal = total;
    setNotifications(p => p.filter(n => n.id !== id));
    setTotal(t => t - 1);
    try {
      await deleteNotification(id);
    } catch (err) {
      console.error('Delete failed', err);
      setNotifications(prev);
      setTotal(prevTotal);
      toast({
        title: 'Could not delete notification',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRead = async () => {
    try {
      await deleteRead();
      // Pagination reset (NO6) — after clearing the read entries, page=N
      // can be past the new total; reset to the first page.
      setPage(1);
      loadNotifications();
    } catch (err) {
      console.error('Delete-read failed', err);
      toast({
        title: 'Could not clear read notifications',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Notifications
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadNotifications} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead} className="gap-2">
              <CheckCheck className="h-4 w-4" /> Mark All Read
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDeleteRead} className="gap-2 text-red-600 hover:text-red-700">
            <Trash2 className="h-4 w-4" /> Clear Read
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['all', 'unread', 'read'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Read'}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-12 text-center shadow-sm">
          <BellOff className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No notifications</h2>
          <p className="mt-2 text-sm text-slate-500">
            {filter === 'unread' ? 'All caught up!' : 'Nothing here yet.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const IconComponent = ICON_MAP[notif.type] || Bell;
            return (
              <Card
                key={notif.id}
                className={`flex items-start gap-4 p-4 shadow-sm transition-colors ${
                  notif.isRead ? 'bg-white' : 'bg-blue-50/50 border-blue-100'
                }`}
              >
                <div className={`mt-0.5 rounded-full p-2 ${
                  notif.isRead ? 'bg-slate-100' : 'bg-blue-100'
                }`}>
                  <IconComponent className={`h-4 w-4 ${
                    notif.isRead ? 'text-slate-500' : 'text-blue-600'
                  }`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${notif.isRead ? 'text-slate-700' : 'text-slate-900'}`}>
                      {notif.title}
                    </p>
                    <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[notif.priority] || ''}`}>
                      {notif.priority}
                    </Badge>
                    {!notif.isRead && (
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{notif.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDate(notif.createdAt)}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-500">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(total / limit)}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
