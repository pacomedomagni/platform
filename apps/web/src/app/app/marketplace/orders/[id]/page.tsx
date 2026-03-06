'use client';

import { useState, useEffect } from 'react';
import { toast } from '@platform/ui';
import { ConfirmDialog } from '@platform/ui';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  RefreshCw,
  ArrowLeft,
  Package,
  Truck,
  DollarSign,
  User,
  MapPin,
  ExternalLink,
  X,
  Ban,
  CreditCard,
  ShoppingCart,
  FileText,
} from 'lucide-react';
import { unwrapJson } from '@/lib/admin-fetch';

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface LineItem {
  title: string;
  quantity: number;
  price: string;
  lineItemId?: string;
  sku?: string;
  listingId?: string;
}

interface ShippingAddress {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  countryCode?: string;
}

interface Order {
  id: string;
  connectionId: string;
  externalOrderId: string;
  buyerUsername: string;
  totalAmount: string;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  syncStatus: string;
  shippingAddress?: ShippingAddress;
  itemsData?: string;
  subtotal?: string;
  shippingCost?: string;
  tax?: string;
  trackingNumber?: string;
  carrier?: string;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  connection?: {
    name: string;
    marketplaceId: string;
  };
}

const CARRIERS = [
  'USPS',
  'UPS',
  'FedEx',
  'DHL',
  'Royal Mail',
  'Australia Post',
  'Canada Post',
  'Hermes',
  'DPD',
  'TNT',
  'Other',
];

function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    PAID: { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' },
    PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
    FAILED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
    REFUNDED: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Refunded' },
  };

  const c = config[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <CreditCard className="w-3 h-3 mr-1" />
      {c.label}
    </span>
  );
}

function FulfillmentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    NOT_STARTED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Not Started' },
    IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress' },
    FULFILLED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Fulfilled' },
  };

  const c = config[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <Truck className="w-3 h-3 mr-1" />
      {c.label}
    </span>
  );
}

export default function MarketplaceOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // Fulfillment form state
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [fulfilling, setFulfilling] = useState(false);

  // Cancel state
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Refund modal state
  const [refundModal, setRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      // First fetch all connections
      const connectionsRes = await fetch('/api/v1/marketplace/connections', {
        credentials: 'include',
      });
      if (!connectionsRes.ok) {
        toast({ title: 'Error', description: 'Failed to load connections', variant: 'destructive' });
        setLoading(false);
        return;
      }
      const connections: Connection[] = unwrapJson(await connectionsRes.json());

      // Iterate through connections to find the order
      let foundOrder: Order | null = null;

      for (const connection of connections) {
        const ordersRes = await fetch(
          `/api/v1/marketplace/orders?connectionId=${connection.id}`,
          { credentials: 'include' }
        );
        if (ordersRes.ok) {
          const orders: Order[] = unwrapJson(await ordersRes.json());
          const match = orders.find(
            (o) => o.id === orderId || o.externalOrderId === orderId
          );
          if (match) {
            foundOrder = match;
            break;
          }
        }
      }

      setOrder(foundOrder);
    } catch (error) {
      console.error('Failed to load order:', error);
      toast({ title: 'Error', description: 'Failed to load order details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const parseLineItems = (itemsData?: string): LineItem[] => {
    if (!itemsData) return [];
    try {
      return JSON.parse(itemsData);
    } catch {
      return [];
    }
  };

  const formatCurrency = (amount: string | undefined, currency: string) => {
    if (!amount) return '-';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(amount));
  };

  const handleFulfill = async () => {
    if (!order) return;
    if (!trackingNumber.trim()) {
      toast({ title: 'Validation Error', description: 'Tracking number is required', variant: 'destructive' });
      return;
    }
    if (!carrier) {
      toast({ title: 'Validation Error', description: 'Please select a carrier', variant: 'destructive' });
      return;
    }

    setFulfilling(true);
    try {
      const res = await fetch(`/api/v1/marketplace/orders/${order.id}/fulfill`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber: trackingNumber.trim(), carrier }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Order marked as shipped!' });
        setTrackingNumber('');
        setCarrier('');
        loadOrder();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to fulfill order', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to fulfill order:', error);
      toast({ title: 'Error', description: 'Failed to fulfill order', variant: 'destructive' });
    } finally {
      setFulfilling(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    if (!cancelReason.trim()) {
      toast({ title: 'Validation Error', description: 'Please provide a cancellation reason', variant: 'destructive' });
      return;
    }

    setCancelling(true);
    setCancelConfirm(false);
    try {
      const res = await fetch('/api/v1/marketplace/cancellations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: order.connectionId,
          orderId: order.id,
          reason: cancelReason.trim(),
        }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Order cancellation submitted' });
        setCancelReason('');
        loadOrder();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to cancel order', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to cancel order:', error);
      toast({ title: 'Error', description: 'Failed to cancel order', variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const handleRefund = async () => {
    if (!order) return;
    if (!refundAmount.trim() || isNaN(Number(refundAmount)) || Number(refundAmount) <= 0) {
      toast({ title: 'Validation Error', description: 'Please enter a valid refund amount', variant: 'destructive' });
      return;
    }

    setRefunding(true);
    setRefundModal(false);
    try {
      const res = await fetch(`/api/v1/marketplace/orders/${order.id}/refund`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: order.connectionId,
          amount: refundAmount.trim(),
          reason: refundReason.trim(),
        }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Refund issued successfully' });
        setRefundAmount('');
        setRefundReason('');
        loadOrder();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to issue refund', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to issue refund:', error);
      toast({ title: 'Error', description: 'Failed to issue refund', variant: 'destructive' });
    } finally {
      setRefunding(false);
    }
  };

  const canFulfill =
    order?.fulfillmentStatus === 'NOT_STARTED' || order?.fulfillmentStatus === 'IN_PROGRESS';
  const isFulfilled = order?.fulfillmentStatus === 'FULFILLED';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Link
          href="/app/marketplace/orders"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </Link>
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Order not found</h3>
          <p className="text-gray-600">The requested order could not be found.</p>
        </div>
      </div>
    );
  }

  const lineItems = parseLineItems(order.itemsData);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back button */}
      <Link
        href="/app/marketplace/orders"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Orders
      </Link>

      {/* Order Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Order {order.externalOrderId}
              </h1>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <PaymentStatusBadge status={order.paymentStatus} />
              <FulfillmentStatusBadge status={order.fulfillmentStatus} />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>
                Order Date: {new Date(order.orderDate).toLocaleDateString()} at{' '}
                {new Date(order.orderDate).toLocaleTimeString()}
              </span>
              {order.connection && (
                <span>
                  Store: {order.connection.name} ({order.connection.marketplaceId})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canFulfill && (
              <button
                onClick={() => {
                  setCancelReason('');
                  setCancelConfirm(true);
                }}
                disabled={cancelling}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center gap-2"
              >
                <Ban className="w-4 h-4" />
                Cancel Order
              </button>
            )}
            <button
              onClick={() => {
                setRefundAmount(order.totalAmount || '');
                setRefundReason('');
                setRefundModal(true);
              }}
              disabled={refunding}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              Issue Refund
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items Table */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Line Items
            </h2>
            {lineItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Line Total
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Listing
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineItems.map((item, idx) => {
                      const unitPrice = Number(item.price);
                      const lineTotal = unitPrice * item.quantity;
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{item.title}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {item.sku || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(item.price, order.currency)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(String(lineTotal), order.currency)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.listingId ? (
                              <a
                                href={`https://www.ebay.com/itm/${item.listingId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                View
                              </a>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No line item data available.</p>
            )}
          </div>

          {/* Fulfillment Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Fulfillment
            </h2>

            {isFulfilled ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">Order Shipped</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {order.carrier && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Carrier</label>
                      <p className="mt-1 text-sm text-gray-900">{order.carrier}</p>
                    </div>
                  )}
                  {order.trackingNumber && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Tracking Number</label>
                      <p className="mt-1 text-sm text-gray-900">{order.trackingNumber}</p>
                    </div>
                  )}
                </div>
                {!order.carrier && !order.trackingNumber && (
                  <p className="text-sm text-green-700">This order has been marked as fulfilled.</p>
                )}
              </div>
            ) : canFulfill ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Enter shipping details to mark this order as shipped.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Carrier *
                    </label>
                    <select
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a carrier...</option>
                      {CARRIERS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tracking Number *
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g., 1Z999AA10123456784"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <button
                    onClick={handleFulfill}
                    disabled={fulfilling || !carrier || !trackingNumber.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {fulfilling && <RefreshCw className="w-4 h-4 animate-spin" />}
                    {fulfilling ? 'Shipping...' : 'Mark as Shipped'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No fulfillment action available for the current order status.
              </p>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Buyer Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Buyer Information
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-500">Username</label>
                <p className="mt-1 text-sm text-gray-900">{order.buyerUsername}</p>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Shipping Address
            </h2>
            {order.shippingAddress ? (
              <div className="text-sm text-gray-600 space-y-1">
                {order.shippingAddress.name && (
                  <p className="font-medium text-gray-900">{order.shippingAddress.name}</p>
                )}
                {order.shippingAddress.addressLine1 && (
                  <p>{order.shippingAddress.addressLine1}</p>
                )}
                {order.shippingAddress.addressLine2 && (
                  <p>{order.shippingAddress.addressLine2}</p>
                )}
                <p>
                  {[
                    order.shippingAddress.city,
                    order.shippingAddress.stateOrProvince,
                    order.shippingAddress.postalCode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {order.shippingAddress.countryCode && (
                  <p>{order.shippingAddress.countryCode}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No shipping address available</p>
            )}
          </div>

          {/* Financial Summary */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Financial Summary
            </h2>
            <div className="text-sm text-gray-600 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-gray-900">
                  {formatCurrency(order.subtotal, order.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="text-gray-900">
                  {formatCurrency(order.shippingCost, order.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span className="text-gray-900">
                  {formatCurrency(order.tax, order.currency)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                <span>Total</span>
                <span>{formatCurrency(order.totalAmount, order.currency)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 pt-1">
                <span>Currency</span>
                <span>{order.currency || 'USD'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Order Modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Cancel Order</h2>
              <button
                onClick={() => {
                  setCancelConfirm(false);
                  setCancelReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to cancel order{' '}
              <span className="font-medium">{order.externalOrderId}</span>? This action may not
              be reversible.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cancellation Reason *
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a reason...</option>
                <option value="OUT_OF_STOCK">Out of stock</option>
                <option value="BUYER_ASKED_CANCEL">Buyer asked to cancel</option>
                <option value="ADDRESS_ISSUE">Issue with shipping address</option>
                <option value="PRICE_ERROR">Pricing error</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setCancelConfirm(false);
                  setCancelReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Go Back
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling || !cancelReason}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling && <RefreshCw className="w-4 h-4 animate-spin" />}
                {cancelling ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Issue Refund</h2>
              <button
                onClick={() => {
                  setRefundModal(false);
                  setRefundAmount('');
                  setRefundReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Issue a partial or full refund for order{' '}
              <span className="font-medium">{order.externalOrderId}</span>.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refund Amount ({order.currency || 'USD'}) *
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
                <p className="text-xs text-gray-500 mt-1">
                  Order total: {formatCurrency(order.totalAmount, order.currency)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Reason for refund..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setRefundModal(false);
                  setRefundAmount('');
                  setRefundReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRefund}
                disabled={refunding || !refundAmount.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {refunding && <RefreshCw className="w-4 h-4 animate-spin" />}
                {refunding ? 'Processing...' : 'Issue Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
