'use client';

import { useState, useEffect, useRef } from 'react';
import api from '../../../lib/api';

interface ActivityEvent {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  title: string;
  description?: string;
  actorName?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

const entityTypes = ['all', 'order', 'customer', 'invoice', 'purchase_order', 'return', 'product'];

const entityIcons: Record<string, string> = {
  order: '\u{1F6D2}',
  payment: '\u{1F4B5}',
  customer: '\u{1F464}',
  invoice: '\u{1F4C4}',
  purchase_order: '\u{1F4E6}',
  return: '\u{1F504}',
  product: '\u{1F3F7}\uFE0F',
  inventory: '\u{1F4E6}',
  shipping: '\u{1F69A}',
  discount: '\u{1F3AB}',
};

const entityColors: Record<string, { bg: string; border: string }> = {
  order: { bg: 'bg-blue-100', border: 'border-blue-300' },
  payment: { bg: 'bg-green-100', border: 'border-green-300' },
  customer: { bg: 'bg-purple-100', border: 'border-purple-300' },
  invoice: { bg: 'bg-orange-100', border: 'border-orange-300' },
  purchase_order: { bg: 'bg-cyan-100', border: 'border-cyan-300' },
  return: { bg: 'bg-red-100', border: 'border-red-300' },
  product: { bg: 'bg-yellow-100', border: 'border-yellow-300' },
};

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadEvents = async () => {
    try {
      const params: any = {};
      if (entityFilter !== 'all') params.entityType = entityFilter;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const res = await api.get('/v1/store/admin/activity/recent', { params });
      setEvents(res.data.data || res.data || []);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [entityFilter, dateFrom, dateTo]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadEvents();
      }, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, entityFilter, dateFrom, dateTo]);

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getEntityLink = (event: ActivityEvent) => {
    const routes: Record<string, string> = {
      order: '/app/orders',
      customer: '/app/customers',
      invoice: '/app/invoices',
      purchase_order: '/app/purchase-orders',
      return: '/app/returns',
      product: '/app/products',
    };
    const base = routes[event.entityType];
    return base ? `${base}/${event.entityId}` : null;
  };

  // Group events by date
  const groupedEvents: { label: string; events: ActivityEvent[] }[] = [];
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  events.forEach((event) => {
    const eventDate = new Date(event.createdAt).toDateString();
    let label = '';
    if (eventDate === today) label = 'Today';
    else if (eventDate === yesterday) label = 'Yesterday';
    else label = new Date(event.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const existing = groupedEvents.find((g) => g.label === label);
    if (existing) {
      existing.events.push(event);
    } else {
      groupedEvents.push({ label, events: [event] });
    }
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Activity Feed</h1>
          <p className="text-sm text-slate-500 mt-1">Recent activity across your store</p>
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${autoRefresh ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
        >
          {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
          {entityTypes.map((type) => (
            <option key={type} value={type}>{type === 'all' ? 'All Types' : type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">From:</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">To:</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
        </div>
        {(entityFilter !== 'all' || dateFrom || dateTo) && (
          <button onClick={() => { setEntityFilter('all'); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-slate-500 hover:text-slate-700 font-medium">
            Clear filters
          </button>
        )}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 shadow-sm text-center">
          <p className="text-sm text-slate-400">Loading activity...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 shadow-sm text-center">
          <p className="text-sm text-slate-400">No activity found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedEvents.map((group) => (
            <div key={group.label}>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">{group.label}</h2>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />

                <div className="space-y-4">
                  {group.events.map((event) => {
                    const icon = entityIcons[event.entityType] || '\u{1F4CC}';
                    const colors = entityColors[event.entityType] || { bg: 'bg-slate-100', border: 'border-slate-300' };
                    const link = getEntityLink(event);

                    return (
                      <div key={event.id} className="relative flex items-start gap-4 pl-0">
                        {/* Icon */}
                        <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center text-base`}>
                          {icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                              {event.description && (
                                <p className="text-sm text-slate-600 mt-1">{event.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                {event.actorName && (
                                  <span className="font-medium text-slate-500">{event.actorName}</span>
                                )}
                                <span>{timeAgo(event.createdAt)}</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} capitalize`}>
                                  {event.entityType.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                            {link && (
                              <a href={link} className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                                View &rarr;
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
