'use client';

import { useState, useEffect } from 'react';
import { Card, Button } from '@platform/ui';
import { Download, RefreshCw, Package, Clock, Truck, CheckCircle } from 'lucide-react';
import api from '../../../lib/api';
import { OrderFilters } from './_components/order-filters';
import { OrderTable } from './_components/order-table';
import { Pagination } from '../_components/pagination';

interface OrderStats {
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customer?: {
    name: string;
    email: string;
  };
  status: string;
  paymentStatus: string;
  grandTotal: number;
  itemCount: number;
  createdAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const loadOrders = async () => {
    try {
      const params: any = { offset: (page - 1) * 20, limit: 20 };
      if (search) params.search = search;
      if (status) params.status = status;
      if (paymentStatus) params.paymentStatus = paymentStatus;

      const res = await api.get('/v1/store/admin/orders/all', { params });
      setOrders(res.data.data || []);
      const total = res.data.pagination?.total ?? res.data.total ?? 0;
      setTotalItems(total);
      setTotalPages(Math.max(1, Math.ceil(total / 20)));

      // Calculate stats
      const allOrders = res.data.data || [];
      setStats({
        pending: allOrders.filter((o: Order) => o.status === 'PENDING').length,
        processing: allOrders.filter((o: Order) => o.status === 'PROCESSING' || o.status === 'CONFIRMED').length,
        shipped: allOrders.filter((o: Order) => o.status === 'SHIPPED').length,
        delivered: allOrders.filter((o: Order) => o.status === 'DELIVERED').length,
      });
    } catch (error: any) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (paymentStatus) params.set('paymentStatus', paymentStatus);

      const response = await api.get('/v1/operations/export/orders?' + params.toString(), {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export orders:', error);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatus('');
    setPaymentStatus('');
    setPage(1);
  };

  useEffect(() => {
    loadOrders();
  }, [search, status, paymentStatus, page]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadOrders();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, search, status, paymentStatus, page]);

  const statCards = [
    {
      label: 'Pending',
      value: stats.pending,
      icon: Clock,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Processing',
      value: stats.processing,
      icon: Package,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Shipped',
      value: stats.shipped,
      icon: Truck,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Delivered',
      value: stats.delivered,
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50',
    },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Order Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage and track customer orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="p-5">
        <OrderFilters
          search={search}
          status={status}
          paymentStatus={paymentStatus}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          onStatusChange={(v) => { setStatus(v); setPage(1); }}
          onPaymentStatusChange={(v) => { setPaymentStatus(v); setPage(1); }}
          onClear={handleClearFilters}
        />
      </Card>

      {/* Orders Table */}
      <Card className="p-5">
        <OrderTable orders={orders} loading={loading} />
        <Pagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={20} onPageChange={(p) => setPage(p)} />
      </Card>
    </div>
  );
}
