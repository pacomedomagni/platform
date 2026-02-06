'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, Badge, NativeSelect } from '@platform/ui';
import { Search, Users, TrendingUp, UserCheck, AlertTriangle, Download } from 'lucide-react';
import api from '../../../lib/api';

interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  orderCount?: number;
  totalSpent?: number;
  lastOrderDate?: string | null;
  createdAt: string;
  emailVerified?: boolean;
}

interface CustomerStats {
  total: number;
  new: number;
  highValue: number;
  atRisk: number;
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    total: 0,
    new: 0,
    highValue: 0,
    atRisk: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (segment) params.segment = segment;

      const res = await api.get('/v1/store/admin/customers', { params });
      const customerList = res.data.data || [];
      setCustomers(customerList);

      // Calculate stats
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      setStats({
        total: customerList.length,
        new: customerList.filter((c: Customer) => new Date(c.createdAt) > thirtyDaysAgo).length,
        highValue: customerList.filter((c: Customer) => (c.totalSpent || 0) > 1000).length,
        atRisk: customerList.filter(
          (c: Customer) =>
            c.lastOrderDate && new Date(c.lastOrderDate) < ninetyDaysAgo
        ).length,
      });
    } catch (error: any) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/v1/operations/export/customers', {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export customers:', error);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadCustomers();
    }, 300);

    return () => clearTimeout(debounce);
  }, [search, segment]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCustomerSegment = (customer: Customer) => {
    if ((customer.totalSpent || 0) > 1000) return { label: 'VIP', color: 'text-purple-600 bg-purple-50' };

    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceCreation < 30) return { label: 'New', color: 'text-blue-600 bg-blue-50' };

    if (customer.lastOrderDate) {
      const daysSinceOrder = Math.floor(
        (Date.now() - new Date(customer.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceOrder > 90) return { label: 'At Risk', color: 'text-red-600 bg-red-50' };
    }

    return null;
  };

  const statCards = [
    {
      label: 'Total Customers',
      value: stats.total,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'New (30 days)',
      value: stats.new,
      icon: UserCheck,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'High Value',
      value: stats.highValue,
      icon: TrendingUp,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'At Risk',
      value: stats.atRisk,
      icon: AlertTriangle,
      color: 'text-amber-600 bg-amber-50',
    },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Customer Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage and analyze your customer base
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
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
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <NativeSelect
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="sm:w-48"
          >
            <option value="">All Segments</option>
            <option value="new">New Customers</option>
            <option value="high_value">High Value</option>
            <option value="at_risk">At Risk</option>
            <option value="vip">VIP</option>
          </NativeSelect>
        </div>
      </Card>

      {/* Customers Table */}
      <Card className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Phone</th>
                <th className="text-right p-3 font-medium">Orders</th>
                <th className="text-right p-3 font-medium">Total Spent</th>
                <th className="text-left p-3 font-medium">Last Order</th>
                <th className="text-left p-3 font-medium">Segment</th>
                <th className="text-left p-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const segmentBadge = getCustomerSegment(customer);
                  const fullName = [customer.firstName, customer.lastName]
                    .filter(Boolean)
                    .join(' ') || 'N/A';

                  return (
                    <tr
                      key={customer.id}
                      onClick={() => router.push(`/app/customers/${customer.id}`)}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {fullName[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <span className="font-medium">{fullName}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{customer.email}</span>
                          {customer.emailVerified && (
                            <Badge variant="success" className="text-xs">Verified</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {customer.phone || '-'}
                      </td>
                      <td className="p-3 text-right">{customer.orderCount || 0}</td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(customer.totalSpent || 0)}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {customer.lastOrderDate ? formatDate(customer.lastOrderDate) : 'Never'}
                      </td>
                      <td className="p-3">
                        {segmentBadge && (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${segmentBadge.color}`}
                          >
                            {segmentBadge.label}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {formatDate(customer.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
