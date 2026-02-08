'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../lib/api';

interface RevenueData {
  today: number;
  yesterday: number;
  thisWeek: number;
  thisMonth: number;
  lastMonth: number;
  outstandingInvoices: number;
}

interface ActionItems {
  ordersToShip: number;
  overdueInvoices: number;
  lowStockItems: number;
  pendingReturns: number;
}

interface DailyRevenue {
  date: string;
  amount: number;
}

interface TopProduct {
  name: string;
  unitsSold: number;
  revenue: number;
}

interface RecentOrder {
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
}

interface ExpenseSummary {
  thisMonth: number;
  lastMonth: number;
}

interface CashFlow {
  invoiced: number;
  paid: number;
  outstanding: number;
}

interface BusinessHealth {
  revenue: RevenueData;
  actionItems: ActionItems;
  dailyRevenue: DailyRevenue[];
  topProducts: TopProduct[];
  recentOrders: RecentOrder[];
  expenses: ExpenseSummary;
  cashFlow: CashFlow;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    SHIPPED: 'bg-purple-100 text-purple-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function PercentChange({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return <span className="text-xs text-slate-400">--</span>;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct >= 0;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${isUp ? 'text-green-600' : 'text-red-600'}`}>
      <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}>
        {isUp ? (
          <path d="M6 9V3m0 0L3 6m3-3l3 3" />
        ) : (
          <path d="M6 3v6m0 0l3-3m-3 3L3 6" />
        )}
      </svg>
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function RevenueBarChart({ data }: { data: DailyRevenue[] }) {
  if (!data.length) return <div className="text-sm text-slate-400 text-center py-8">No revenue data available</div>;
  const maxAmount = Math.max(...data.map(d => d.amount), 1);

  return (
    <div className="flex items-end gap-2 h-40 px-2">
      {data.map((day, i) => {
        const height = Math.max((day.amount / maxAmount) * 100, 2);
        const label = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-slate-500 font-medium">{formatCurrency(day.amount)}</span>
            <div className="w-full relative" style={{ height: '120px' }}>
              <div
                className="absolute bottom-0 w-full rounded-t bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all duration-500 hover:from-indigo-700 hover:to-indigo-500"
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function CashFlowBar({ label, amount, max, color }: { label: string; amount: number; max: number; color: string }) {
  const pct = max > 0 ? (amount / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{formatCurrency(amount)}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BusinessHealthPage() {
  const [data, setData] = useState<BusinessHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadData = useCallback(async () => {
    try {
      setError('');
      const res = await api.get('/v1/store/admin/business-health');
      setData(res.data);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load business health data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-slate-200 rounded-lg" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-slate-200 rounded-lg" />)}
          </div>
          <div className="h-52 bg-slate-200 rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-slate-200 rounded-lg" />
            <div className="h-64 bg-slate-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-medium">{error}</p>
          <button onClick={loadData} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { revenue, actionItems, dailyRevenue, topProducts, recentOrders, expenses, cashFlow } = data;
  const cashFlowMax = Math.max(cashFlow.invoiced, cashFlow.paid, cashFlow.outstanding, 1);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Business Health</h1>
          <p className="text-sm text-slate-500 mt-1">
            Last updated {lastRefresh.toLocaleTimeString()} -- auto-refreshes every 60s
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          {error} -- showing last known data
        </div>
      )}

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Today's Revenue</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(revenue.today)}</p>
          <div className="mt-2">
            <PercentChange current={revenue.today} previous={revenue.yesterday} />
            <span className="text-xs text-slate-400 ml-1">vs yesterday</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">This Week</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(revenue.thisWeek)}</p>
          <p className="text-xs text-slate-400 mt-2">Current week total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">This Month</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(revenue.thisMonth)}</p>
          <div className="mt-2">
            <PercentChange current={revenue.thisMonth} previous={revenue.lastMonth} />
            <span className="text-xs text-slate-400 ml-1">vs last month</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Outstanding Invoices</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(revenue.outstandingInvoices)}</p>
          <p className="text-xs text-slate-400 mt-2">Awaiting payment</p>
        </div>
      </div>

      {/* Action Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <a href="/app/orders?status=CONFIRMED" className="block bg-orange-50 border border-orange-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-800">Orders to Ship</p>
              <p className="text-xl font-bold text-orange-900 mt-1">{actionItems.ordersToShip}</p>
            </div>
            <div className="p-2 bg-orange-100 rounded-lg">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </a>
        <a href="/app/invoices?status=overdue" className="block bg-red-50 border border-red-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800">Overdue Invoices</p>
              <p className="text-xl font-bold text-red-900 mt-1">{actionItems.overdueInvoices}</p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </a>
        <a href="/app/reorder-alerts" className="block bg-yellow-50 border border-yellow-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800">Low Stock Items</p>
              <p className="text-xl font-bold text-yellow-900 mt-1">{actionItems.lowStockItems}</p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
          </div>
        </a>
        {actionItems.pendingReturns > 0 && (
          <a href="/app/returns?status=pending" className="block bg-purple-50 border border-purple-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-800">Pending Returns</p>
                <p className="text-xl font-bold text-purple-900 mt-1">{actionItems.pendingReturns}</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </div>
            </div>
          </a>
        )}
        {actionItems.pendingReturns === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Pending Returns</p>
                <p className="text-xl font-bold text-green-900 mt-1">0</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Daily Revenue (Last 7 Days)</h2>
        <RevenueBarChart data={dailyRevenue} />
      </div>

      {/* Top Products + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Top Products This Month</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No sales data this month</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-slate-500 font-medium">Product</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Units</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2.5 text-slate-900 font-medium">{p.name}</td>
                      <td className="py-2.5 text-right text-slate-600">{p.unitsSold}</td>
                      <td className="py-2.5 text-right text-slate-900 font-medium">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Orders</h2>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No recent orders</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-slate-500 font-medium">Order</th>
                    <th className="text-left py-2 text-slate-500 font-medium">Customer</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Total</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2.5">
                        <a href={`/app/orders/${o.orderNumber}`} className="text-indigo-600 hover:underline font-medium">
                          #{o.orderNumber}
                        </a>
                      </td>
                      <td className="py-2.5 text-slate-600">{o.customerName}</td>
                      <td className="py-2.5 text-right text-slate-900 font-medium">{formatCurrency(o.total)}</td>
                      <td className="py-2.5 text-right"><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Expense Summary + Cash Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Expense Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-500">This Month</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(expenses.thisMonth)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-500">Last Month</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(expenses.lastMonth)}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <PercentChange current={expenses.thisMonth} previous={expenses.lastMonth} />
            <span className="text-sm text-slate-500">
              {expenses.thisMonth > expenses.lastMonth ? 'increase' : 'decrease'} in expenses
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Cash Flow</h2>
          <div className="space-y-4">
            <CashFlowBar label="Invoiced" amount={cashFlow.invoiced} max={cashFlowMax} color="bg-indigo-500" />
            <CashFlowBar label="Paid" amount={cashFlow.paid} max={cashFlowMax} color="bg-green-500" />
            <CashFlowBar label="Outstanding" amount={cashFlow.outstanding} max={cashFlowMax} color="bg-amber-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
