'use client';

import { useState, useEffect } from 'react';
import { toast } from '@platform/ui';
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Package,
  Truck,
  X,
  CloudDownload,
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
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  connection?: {
    name: string;
    marketplaceId: string;
  };
}

export default function MarketplaceOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<string>('all');
  const [selectedFulfillment, setSelectedFulfillment] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<string>('all');
  const [selectedSync, setSelectedSync] = useState<string>('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [fulfillModal, setFulfillModal] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [fulfilling, setFulfilling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncConnectionId, setSyncConnectionId] = useState<string>('');
  const [showSyncDropdown, setShowSyncDropdown] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedConnection, selectedFulfillment, selectedPayment, selectedSync]);

  const loadData = async () => {
    setLoading(true);
    try {
      const connectionsRes = await fetch('/api/v1/marketplace/connections', {
        credentials: 'include',
      });
      if (connectionsRes.ok) {
        const connectionsData = unwrapJson(await connectionsRes.json());
        setConnections(connectionsData);
      }

      const params = new URLSearchParams();
      if (selectedConnection !== 'all') {
        params.append('connectionId', selectedConnection);
      }
      if (selectedFulfillment !== 'all') {
        params.append('fulfillmentStatus', selectedFulfillment);
      }
      if (selectedPayment !== 'all') {
        params.append('paymentStatus', selectedPayment);
      }
      if (selectedSync !== 'all') {
        params.append('syncStatus', selectedSync);
      }

      const ordersRes = await fetch(`/api/v1/marketplace/orders?${params}`, {
        credentials: 'include',
      });
      if (ordersRes.ok) {
        const ordersData = unwrapJson(await ordersRes.json());
        setOrders(ordersData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!syncConnectionId) {
      toast({ title: 'Error', description: 'Please select a store to sync', variant: 'destructive' });
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch('/api/v1/marketplace/orders/sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: syncConnectionId }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Orders synced successfully!' });
        setShowSyncDropdown(false);
        loadData();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to sync orders', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to sync orders:', error);
      toast({ title: 'Error', description: 'Failed to sync orders', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleFulfill = async () => {
    if (!fulfillModal) return;
    if (!trackingNumber.trim()) {
      toast({ title: 'Validation Error', description: 'Tracking number is required', variant: 'destructive' });
      return;
    }
    if (!carrier.trim()) {
      toast({ title: 'Validation Error', description: 'Carrier is required', variant: 'destructive' });
      return;
    }

    setFulfilling(true);
    try {
      const res = await fetch(`/api/v1/marketplace/orders/${fulfillModal.id}/fulfill`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber: trackingNumber.trim(), carrier: carrier.trim() }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Order fulfilled successfully!' });
        closeFulfillModal();
        loadData();
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

  const openFulfillModal = (order: Order) => {
    setFulfillModal(order);
    setTrackingNumber('');
    setCarrier('');
  };

  const closeFulfillModal = () => {
    setFulfillModal(null);
    setTrackingNumber('');
    setCarrier('');
  };

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const parseLineItems = (itemsData?: string): LineItem[] => {
    if (!itemsData) return [];
    try {
      return JSON.parse(itemsData);
    } catch {
      return [];
    }
  };

  if (loading) {
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketplace Orders</h1>
          <p className="text-gray-600 mt-2">Manage and fulfill your eBay orders</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowSyncDropdown(!showSyncDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <CloudDownload className="w-5 h-5" />
            Sync Orders
          </button>
          {showSyncDropdown && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Store</label>
              <select
                value={syncConnectionId}
                onChange={(e) => setSyncConnectionId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-3"
              >
                <option value="">Choose a store...</option>
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name} ({conn.marketplaceId})
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSyncDropdown(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSync}
                  disabled={syncing || !syncConnectionId}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {syncing && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {syncing ? 'Syncing...' : 'Sync'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[180px]">
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

          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fulfillment</label>
            <select
              value={selectedFulfillment}
              onChange={(e) => setSelectedFulfillment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="FULFILLED">Fulfilled</option>
            </select>
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment</label>
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sync Status</label>
            <select
              value={selectedSync}
              onChange={(e) => setSelectedSync(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="synced">Synced</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 mb-4">
            <Package className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-600 mb-4">
            {selectedConnection !== 'all' || selectedFulfillment !== 'all' || selectedPayment !== 'all' || selectedSync !== 'all'
              ? 'Try adjusting your filters or sync orders from your store'
              : 'Sync orders from your eBay store to get started'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    eBay Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Buyer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fulfillment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    expanded={expandedOrder === order.id}
                    onToggle={() => toggleOrderExpand(order.id)}
                    onFulfill={() => openFulfillModal(order)}
                    parseLineItems={parseLineItems}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fulfill Modal */}
      {fulfillModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Fulfill Order</h2>
              <button onClick={closeFulfillModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Order: {fulfillModal.externalOrderId}
            </p>

            <div className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carrier *
                </label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="e.g., UPS, FedEx, USPS"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeFulfillModal}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFulfill}
                disabled={fulfilling}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {fulfilling && <RefreshCw className="w-4 h-4 animate-spin" />}
                {fulfilling ? 'Fulfilling...' : 'Fulfill Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    PAID: { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' },
    PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
    FAILED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
    REFUNDED: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Refunded' },
  };

  const c = config[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
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
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function OrderRow({
  order,
  expanded,
  onToggle,
  onFulfill,
  parseLineItems,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onFulfill: () => void;
  parseLineItems: (itemsData?: string) => LineItem[];
}) {
  const lineItems = parseLineItems(order.itemsData);
  const truncatedOrderId =
    order.externalOrderId.length > 16
      ? order.externalOrderId.slice(0, 16) + '...'
      : order.externalOrderId;

  const formatCurrency = (amount: string | undefined, currency: string) => {
    if (!amount) return '-';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(amount));
  };

  const canFulfill = order.fulfillmentStatus === 'NOT_STARTED' || order.fulfillmentStatus === 'IN_PROGRESS';

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            title={order.externalOrderId}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            )}
            {truncatedOrderId}
          </button>
        </td>
        <td className="px-6 py-4">
          <span className="text-sm text-gray-900">{order.buyerUsername}</span>
        </td>
        <td className="px-6 py-4">
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(order.totalAmount, order.currency)}
          </span>
        </td>
        <td className="px-6 py-4">
          <PaymentStatusBadge status={order.paymentStatus} />
        </td>
        <td className="px-6 py-4">
          <FulfillmentStatusBadge status={order.fulfillmentStatus} />
        </td>
        <td className="px-6 py-4">
          <span className="text-sm text-gray-600">
            {new Date(order.orderDate).toLocaleDateString()}
          </span>
        </td>
        <td className="px-6 py-4">
          {canFulfill && (
            <button
              onClick={onFulfill}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
            >
              <Truck className="w-4 h-4" />
              Fulfill
            </button>
          )}
        </td>
      </tr>

      {/* Expanded Detail Row */}
      {expanded && (
        <tr>
          <td colSpan={7} className="px-6 py-4 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Shipping Address */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Shipping Address</h4>
                {order.shippingAddress ? (
                  <div className="text-sm text-gray-600 space-y-1">
                    {order.shippingAddress.name && <p>{order.shippingAddress.name}</p>}
                    {order.shippingAddress.addressLine1 && <p>{order.shippingAddress.addressLine1}</p>}
                    {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                    <p>
                      {[
                        order.shippingAddress.city,
                        order.shippingAddress.stateOrProvince,
                        order.shippingAddress.postalCode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {order.shippingAddress.countryCode && <p>{order.shippingAddress.countryCode}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No shipping address available</p>
                )}
              </div>

              {/* Financial Summary */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Financial Summary</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(order.subtotal, order.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>{formatCurrency(order.shippingCost, order.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{formatCurrency(order.tax, order.currency)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                    <span>Total</span>
                    <span>{formatCurrency(order.totalAmount, order.currency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items */}
            {lineItems.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Line Items</h4>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Title
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Qty
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Price
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.title}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 text-right">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 text-right">
                            {formatCurrency(item.price, order.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
