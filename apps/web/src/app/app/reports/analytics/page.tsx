'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Card } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportFilters, ReportPage } from '../../reports/_components/report-shell';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Download,
  BarChart3,
  PieChart,
  Calendar,
  RefreshCw,
} from 'lucide-react';

type DashboardData = {
  totalRevenue: number;
  revenueGrowth: number;
  orderCount: number;
  orderGrowth: number;
  averageOrderValue: number;
  aovGrowth: number;
  customerCount: number;
  customerGrowth: number;
  topProducts: Array<{ name: string; revenue: number; quantity: number }>;
  revenueByCategory: Array<{ category: string; revenue: number; percentage: number }>;
  revenueByPaymentMethod: Array<{ method: string; revenue: number; count: number }>;
  salesTrends: Array<{ date: string; revenue: number; orders: number }>;
};

type InventoryData = {
  totalValue: number;
  lowStockItems: number;
  deadStockItems: number;
  turnoverRate: number;
};

export default function AnalyticsDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardRes, trendsRes, topProductsRes, categoryRes, paymentRes, inventoryRes, lowStockRes, deadStockRes] = await Promise.all([
        api.get('/v1/analytics/dashboard', { params: { startDate, endDate } }),
        api.get('/v1/analytics/sales/trends', { params: { startDate, endDate, groupBy } }),
        api.get('/v1/analytics/sales/top-products', { params: { startDate, endDate, limit: 5 } }),
        api.get('/v1/analytics/sales/categories', { params: { startDate, endDate } }),
        api.get('/v1/analytics/sales/payment-methods', { params: { startDate, endDate } }),
        api.get('/v1/analytics/inventory/value'),
        api.get('/v1/analytics/inventory/low-stock'),
        api.get('/v1/analytics/inventory/dead-stock'),
      ]);

      setDashboard({
        totalRevenue: dashboardRes.data?.summary?.totalRevenue || dashboardRes.data?.totalRevenue || 0,
        revenueGrowth: dashboardRes.data?.summary?.revenueGrowth || dashboardRes.data?.revenueGrowth || 0,
        orderCount: dashboardRes.data?.summary?.totalOrders || dashboardRes.data?.orderCount || 0,
        orderGrowth: dashboardRes.data?.summary?.orderGrowth || dashboardRes.data?.orderGrowth || 0,
        averageOrderValue: dashboardRes.data?.summary?.averageOrderValue || dashboardRes.data?.averageOrderValue || 0,
        aovGrowth: dashboardRes.data?.summary?.aovGrowth || dashboardRes.data?.aovGrowth || 0,
        customerCount: dashboardRes.data?.summary?.totalCustomers || dashboardRes.data?.customerCount || 0,
        customerGrowth: dashboardRes.data?.summary?.customerGrowth || dashboardRes.data?.customerGrowth || 0,
        topProducts: topProductsRes.data || [],
        revenueByCategory: categoryRes.data || [],
        revenueByPaymentMethod: paymentRes.data || [],
        salesTrends: trendsRes.data || [],
      });

      setInventory({
        totalValue: inventoryRes.data?.totalValue || 0,
        lowStockItems: lowStockRes.data?.length || 0,
        deadStockItems: deadStockRes.data?.length || 0,
        turnoverRate: inventoryRes.data?.turnoverRate || 0,
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (type: string) => {
    try {
      const response = await api.get(`/v1/analytics/export/${type}`, {
        params: { startDate, endDate, format: 'csv' },
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-report-${startDate}-${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to export report');
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercentage = (num: number) => {
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(1)}%`;
  };

  return (
    <ReportPage
      title="Analytics Dashboard"
      description="Real-time business intelligence and performance metrics"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportReport('sales')}>
            <Download className="h-4 w-4 mr-2" />
            Export Sales
          </Button>
          <Button variant="outline" onClick={() => exportReport('inventory')}>
            <Download className="h-4 w-4 mr-2" />
            Export Inventory
          </Button>
        </div>
      }
    >
      {/* Date Filters */}
      <ReportFilters className="md:grid-cols-4">
        <div>
          <label className="text-xs text-muted-foreground">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Group By</label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={loadDashboard} disabled={loading} className="w-full">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </ReportFilters>

      {error && <ReportAlert>{error}</ReportAlert>}

      {dashboard && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Revenue</span>
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold">{formatCurrency(dashboard.totalRevenue)}</div>
              <div className={`text-sm flex items-center gap-1 ${dashboard.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboard.revenueGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {formatPercentage(dashboard.revenueGrowth)} vs previous period
              </div>
            </Card>

            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Orders</span>
                <ShoppingCart className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold">{formatNumber(dashboard.orderCount)}</div>
              <div className={`text-sm flex items-center gap-1 ${dashboard.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboard.orderGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {formatPercentage(dashboard.orderGrowth)} vs previous period
              </div>
            </Card>

            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Order Value</span>
                <BarChart3 className="h-4 w-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold">{formatCurrency(dashboard.averageOrderValue)}</div>
              <div className={`text-sm flex items-center gap-1 ${dashboard.aovGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboard.aovGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {formatPercentage(dashboard.aovGrowth)} vs previous period
              </div>
            </Card>

            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Customers</span>
                <Users className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold">{formatNumber(dashboard.customerCount)}</div>
              <div className={`text-sm flex items-center gap-1 ${dashboard.customerGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboard.customerGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {formatPercentage(dashboard.customerGrowth)} vs previous period
              </div>
            </Card>
          </div>

          {/* Inventory KPIs */}
          {inventory && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 space-y-2 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Inventory Value</span>
                  <Package className="h-4 w-4 text-slate-500" />
                </div>
                <div className="text-2xl font-bold">{formatCurrency(inventory.totalValue)}</div>
              </Card>

              <Card className="p-5 space-y-2 bg-amber-50/50 border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-700">Low Stock Items</span>
                  <Package className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-amber-700">{inventory.lowStockItems}</div>
              </Card>

              <Card className="p-5 space-y-2 bg-red-50/50 border-red-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-700">Dead Stock Items</span>
                  <Package className="h-4 w-4 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-red-700">{inventory.deadStockItems}</div>
              </Card>

              <Card className="p-5 space-y-2 bg-blue-50/50 border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Turnover Rate</span>
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-blue-700">{inventory.turnoverRate.toFixed(2)}x</div>
              </Card>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Sales Trends Chart */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Sales Trends
                </h3>
              </div>
              <div className="h-64 flex items-end gap-1">
                {dashboard.salesTrends.length === 0 ? (
                  <p className="text-muted-foreground text-sm w-full text-center">No data available</p>
                ) : (
                  dashboard.salesTrends.slice(-14).map((item, idx) => {
                    const maxRevenue = Math.max(...dashboard.salesTrends.map(s => s.revenue));
                    const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                          style={{ height: `${height}%`, minHeight: '4px' }}
                          title={`${item.date}: ${formatCurrency(item.revenue)}`}
                        />
                        <span className="text-[10px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Revenue by Category */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Revenue by Category
                </h3>
              </div>
              <div className="space-y-3">
                {dashboard.revenueByCategory.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No data available</p>
                ) : (
                  dashboard.revenueByCategory.slice(0, 6).map((cat, idx) => {
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-slate-500'];
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{cat.category || 'Uncategorized'}</span>
                          <span className="font-medium">{formatCurrency(cat.revenue)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colors[idx % colors.length]} transition-all`}
                            style={{ width: `${cat.percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* Bottom Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Top Selling Products</h3>
              <div className="space-y-3">
                {dashboard.topProducts.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No data available</p>
                ) : (
                  dashboard.topProducts.map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded-full text-sm font-medium">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.quantity} sold</p>
                        </div>
                      </div>
                      <span className="font-semibold">{formatCurrency(product.revenue)}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Payment Methods */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Revenue by Payment Method</h3>
              <div className="space-y-3">
                {dashboard.revenueByPaymentMethod.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No data available</p>
                ) : (
                  dashboard.revenueByPaymentMethod.map((method, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-medium text-sm capitalize">{method.method || 'Other'}</p>
                        <p className="text-xs text-muted-foreground">{method.count} transactions</p>
                      </div>
                      <span className="font-semibold">{formatCurrency(method.revenue)}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </ReportPage>
  );
}
