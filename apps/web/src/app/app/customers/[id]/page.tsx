'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, Label, Textarea, Badge, toast } from '@platform/ui';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  ShoppingBag,
  DollarSign,
  Calendar,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import api from '../../../../lib/api';
import { OrderStatusBadge, PaymentStatusBadge } from '../../orders/_components/order-status-badge';

interface CustomerDetail {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  emailVerified: boolean;
  createdAt: string;
  addresses?: Array<{
    id: string;
    label: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    isDefault: boolean;
  }>;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  itemCount: number;
  createdAt: string;
}

interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: string | null;
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    totalOrders: 0,
    totalSpent: 0,
    averageOrderValue: 0,
    lastOrderDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });

  const loadCustomer = async () => {
    try {
      const [customerRes, ordersRes] = await Promise.all([
        api.get(`/v1/store/admin/customers/${params.id}`),
        api.get(`/v1/store/admin/customers/${params.id}/orders`),
      ]);

      setCustomer(customerRes.data);
      setOrders(ordersRes.data.data || []);

      setEditForm({
        firstName: customerRes.data.firstName || '',
        lastName: customerRes.data.lastName || '',
        phone: customerRes.data.phone || '',
      });

      // Calculate stats
      const ordersList = ordersRes.data.data || [];
      const totalSpent = ordersList.reduce((sum: number, order: CustomerOrder) => sum + order.grandTotal, 0);
      const lastOrder = ordersList.length > 0 ? ordersList[0].createdAt : null;

      setStats({
        totalOrders: ordersList.length,
        totalSpent,
        averageOrderValue: ordersList.length > 0 ? totalSpent / ordersList.length : 0,
        lastOrderDate: lastOrder,
      });
    } catch (error: any) {
      console.error('Failed to load customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!customer) return;

    try {
      await api.put(`/v1/store/admin/customers/${customer.id}`, editForm);
      await loadCustomer();
      setEditing(false);
    } catch (error: any) {
      console.error('Failed to update customer:', error);
      toast({ title: 'Error', description: 'Failed to update customer', variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadCustomer();
  }, [params.id]);

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

  const formatFullDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 lg:p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Customer not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/app/customers')}>
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Unnamed Customer';

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/app/customers')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Customer since {formatDate(customer.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                  <p className="text-xl font-bold">{stats.totalOrders}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Spent</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalSpent)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Avg Order</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.averageOrderValue)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Last Order</p>
                  <p className="text-sm font-bold">
                    {stats.lastOrderDate ? formatDate(stats.lastOrderDate) : 'Never'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Order History */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-4">Order History</h2>
            {orders.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No orders yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="text-left p-3 font-medium">Order</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Payment</th>
                      <th className="text-right p-3 font-medium">Items</th>
                      <th className="text-right p-3 font-medium">Total</th>
                      <th className="text-left p-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => router.push(`/app/orders/${order.id}`)}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      >
                        <td className="p-3">
                          <span className="font-medium text-primary">{order.orderNumber}</span>
                        </td>
                        <td className="p-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="p-3">
                          <PaymentStatusBadge status={order.paymentStatus} />
                        </td>
                        <td className="p-3 text-right">{order.itemCount}</td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(order.grandTotal)}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Admin Notes */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-4">Admin Notes</h2>
            <Textarea
              placeholder="Add internal notes about this customer..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={4}
            />
            <Button size="sm" className="mt-3">Save Notes</Button>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile Info */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Profile Information</h2>
              {!editing ? (
                <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={handleSave}>
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium">{customer.email}</p>
                      {customer.emailVerified && (
                        <Badge variant="success" className="mt-1 text-xs">Verified</Badge>
                      )}
                    </div>
                  </div>

                  {customer.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-medium">{customer.phone}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Member Since</p>
                      <p className="font-medium">{formatFullDate(customer.createdAt)}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Addresses */}
          {customer.addresses && customer.addresses.length > 0 && (
            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Saved Addresses
              </h2>
              <div className="space-y-4">
                {customer.addresses.map((address) => (
                  <div key={address.id} className="pb-4 border-b last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{address.label}</p>
                      {address.isDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {address.addressLine1}
                      {address.addressLine2 && <>, {address.addressLine2}</>}
                      <br />
                      {address.city}, {address.state} {address.postalCode}
                      <br />
                      {address.country}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
