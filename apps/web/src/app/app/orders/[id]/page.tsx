'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Textarea } from '@platform/ui';
import {
  ArrowLeft,
  Printer,
  Package,
  CreditCard,
  MapPin,
  FileText,
  RefreshCw,
} from 'lucide-react';
import api from '../../../../lib/api';
import { OrderStatusBadge, PaymentStatusBadge } from '../_components/order-status-badge';
import { OrderTimeline } from '../_components/order-timeline';
import { RefundModal } from '../_components/refund-modal';

interface OrderDetail {
  id: string;
  orderNumber: string;
  email: string;
  phone: string | null;
  status: string;
  paymentStatus: string;
  shippingAddress: any;
  billingAddress: any;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl: string | null;
  }>;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  shippingMethod: string | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  customerNotes: string | null;
  createdAt: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt?: string | null;
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState('');
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [trackingInfo, setTrackingInfo] = useState({ carrier: '', number: '' });

  const loadOrder = async () => {
    try {
      const res = await api.get(`/v1/store/admin/orders/${params.id}`);
      setOrder(res.data);
      setTrackingInfo({
        carrier: res.data.shippingCarrier || '',
        number: res.data.trackingNumber || '',
      });
    } catch (error: any) {
      console.error('Failed to load order:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!order) return;

    // Confirm destructive/irreversible actions
    const confirmMessage = newStatus === 'SHIPPED'
      ? 'Mark this order as shipped? The customer will be notified.'
      : newStatus === 'DELIVERED'
      ? 'Mark this order as delivered?'
      : newStatus === 'CANCELLED'
      ? 'Cancel this order? This action cannot be easily reversed.'
      : null;
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    try {
      const body: any = { status: newStatus };

      if (newStatus === 'SHIPPED' && trackingInfo.carrier && trackingInfo.number) {
        body.carrier = trackingInfo.carrier;
        body.trackingNumber = trackingInfo.number;
      }

      await api.put(`/v1/store/admin/orders/${order.id}/status`, body);
      await loadOrder();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      alert('Failed to update order status');
    }
  };

  const handleRefund = async (amount: number, reason: string, type: 'full' | 'partial') => {
    if (!order) return;

    try {
      await api.post(`/v1/store/admin/orders/${order.id}/refund`, {
        amount,
        reason,
        type,
      });
      await loadOrder();
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to process refund');
    }
  };

  const handleSaveNotes = async () => {
    if (!order) return;
    try {
      await api.put(`/v1/store/admin/orders/${order.id}/status`, {
        status: order.status,
        adminNotes,
      });
      alert('Notes saved');
    } catch {
      alert('Failed to save notes');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    loadOrder();
  }, [params.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatAddress = (address: any) => {
    if (!address) return 'N/A';
    return `${address.firstName || ''} ${address.lastName || ''}\n${address.addressLine1}\n${
      address.addressLine2 ? address.addressLine2 + '\n' : ''
    }${address.city}, ${address.state || ''} ${address.postalCode}\n${address.country}`;
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

  if (!order) {
    return (
      <div className="p-6 lg:p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Order not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/app/orders')}>
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  const canConfirm = order.status === 'PENDING';
  const canProcess = order.status === 'CONFIRMED';
  const canShip = order.status === 'PROCESSING' || order.status === 'CONFIRMED';
  const canDeliver = order.status === 'SHIPPED';
  const canRefund = order.paymentStatus === 'PAID' && order.status !== 'CANCELLED';

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/app/orders')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Order {order.orderNumber}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Placed on {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadOrder}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print Invoice
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status & Actions */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-4">Order Status</h2>
            <div className="flex items-center gap-3 mb-4">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>

            <div className="flex flex-wrap gap-2">
              {canConfirm && (
                <Button size="sm" onClick={() => updateStatus('CONFIRMED')}>
                  Confirm Order
                </Button>
              )}
              {canProcess && (
                <Button size="sm" onClick={() => updateStatus('PROCESSING')}>
                  Start Processing
                </Button>
              )}
              {canShip && (
                <Button size="sm" onClick={() => updateStatus('SHIPPED')}>
                  <Package className="w-4 h-4 mr-2" />
                  Mark as Shipped
                </Button>
              )}
              {canDeliver && (
                <Button size="sm" onClick={() => updateStatus('DELIVERED')}>
                  Mark as Delivered
                </Button>
              )}
              {canRefund && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowRefundModal(true)}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Process Refund
                </Button>
              )}
            </div>
          </Card>

          {/* Order Items */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order Items
            </h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(item.totalPrice)}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span>{formatCurrency(order.shippingTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(order.taxTotal)}</span>
              </div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(order.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrency(order.grandTotal)}</span>
              </div>
            </div>
          </Card>

          {/* Customer Notes */}
          {order.customerNotes && (
            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Customer Notes
              </h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {order.customerNotes}
              </p>
            </Card>
          )}

          {/* Admin Notes */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-4">Internal Notes</h2>
            <Textarea
              placeholder="Add internal notes (admin-only)..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={4}
            />
            <Button size="sm" className="mt-3" onClick={handleSaveNotes}>Save Notes</Button>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-4">Order Timeline</h2>
            <OrderTimeline
              status={order.status}
              createdAt={order.createdAt}
              confirmedAt={order.confirmedAt}
              shippedAt={order.shippedAt}
              deliveredAt={order.deliveredAt}
              cancelledAt={order.cancelledAt}
            />
          </Card>

          {/* Shipping Address */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Shipping Address
            </h2>
            <p className="text-sm whitespace-pre-wrap">{formatAddress(order.shippingAddress)}</p>
            {order.shippingAddress?.phone && (
              <p className="text-sm text-muted-foreground mt-2">
                Phone: {order.shippingAddress.phone}
              </p>
            )}
          </Card>

          {/* Billing Address */}
          {order.billingAddress && (
            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4">Billing Address</h2>
              <p className="text-sm whitespace-pre-wrap">{formatAddress(order.billingAddress)}</p>
            </Card>
          )}

          {/* Customer Info */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-4">Customer Info</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{order.email}</p>
              </div>
              {order.phone && (
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-medium">{order.phone}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Shipping Info */}
          {(order.shippingCarrier || order.trackingNumber) && (
            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4">Shipping Info</h2>
              <div className="space-y-2 text-sm">
                {order.shippingCarrier && (
                  <div>
                    <span className="text-muted-foreground">Carrier:</span>
                    <p className="font-medium">{order.shippingCarrier}</p>
                  </div>
                )}
                {order.trackingNumber && (
                  <div>
                    <span className="text-muted-foreground">Tracking:</span>
                    <p className="font-medium font-mono">{order.trackingNumber}</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Refund Modal */}
      <RefundModal
        open={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        orderTotal={order.grandTotal}
        onRefund={handleRefund}
      />
    </div>
  );
}
