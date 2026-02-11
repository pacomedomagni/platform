'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Card, Badge, ConfirmDialog } from '@platform/ui';
import api from '../../../../lib/api';
import { ReportAlert, ReportCard, ReportEmpty, ReportPage, ReportTable } from '../../reports/_components/report-shell';
import {
  Webhook,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Send,
  History,
  Eye,
  EyeOff,
} from 'lucide-react';

type WebhookRecord = {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  headers: Record<string, string>;
  status: 'active' | 'paused' | 'disabled';
  createdAt: string;
  updatedAt: string;
};

type WebhookDelivery = {
  id: string;
  webhookId: string;
  event: string;
  payload: string;
  statusCode: number;
  response: string | null;
  error: string | null;
  duration: number;
  success: boolean;
  createdAt: string;
};

const AVAILABLE_EVENTS = [
  { value: 'order.created', label: 'Order Created' },
  { value: 'order.updated', label: 'Order Updated' },
  { value: 'order.completed', label: 'Order Completed' },
  { value: 'order.cancelled', label: 'Order Cancelled' },
  { value: 'customer.created', label: 'Customer Created' },
  { value: 'customer.updated', label: 'Customer Updated' },
  { value: 'product.created', label: 'Product Created' },
  { value: 'product.updated', label: 'Product Updated' },
  { value: 'product.deleted', label: 'Product Deleted' },
  { value: 'inventory.low_stock', label: 'Low Stock Alert' },
  { value: 'inventory.out_of_stock', label: 'Out of Stock Alert' },
  { value: 'payment.received', label: 'Payment Received' },
  { value: 'payment.failed', label: 'Payment Failed' },
  { value: 'shipment.created', label: 'Shipment Created' },
  { value: 'shipment.delivered', label: 'Shipment Delivered' },
];

const statusConfig = {
  active: { icon: CheckCircle, color: 'bg-green-50 text-green-700 border-green-200', label: 'Active' },
  paused: { icon: Pause, color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Paused' },
  disabled: { icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200', label: 'Disabled' },
};

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeliveriesModal, setShowDeliveriesModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookRecord | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
    headers: {} as Record<string, string>,
    status: 'active' as 'active' | 'paused' | 'disabled',
  });

  // Header editing
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  const loadWebhooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/v1/operations/webhooks');
      setWebhooks(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveries = async (webhookId: string) => {
    try {
      const res = await api.get(`/v1/operations/webhooks/${webhookId}/deliveries`);
      setDeliveries(res.data?.deliveries || res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load deliveries');
    }
  };

  const createWebhook = async () => {
    setError(null);
    try {
      await api.post('/v1/operations/webhooks', formData);
      setShowCreateModal(false);
      resetForm();
      setSuccess('Webhook created successfully');
      loadWebhooks();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create webhook');
    }
  };

  const updateWebhook = async () => {
    if (!editingWebhook) return;
    setError(null);
    try {
      await api.put(`/v1/operations/webhooks/${editingWebhook.id}`, formData);
      setEditingWebhook(null);
      resetForm();
      setSuccess('Webhook updated successfully');
      loadWebhooks();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update webhook');
    }
  };

  const deleteWebhook = (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDeleteWebhook = async () => {
    const id = deleteConfirm;
    if (!id) return;
    setDeleteConfirm(null);
    setError(null);
    try {
      await api.delete(`/v1/operations/webhooks/${id}`);
      setSuccess('Webhook deleted successfully');
      loadWebhooks();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete webhook');
    }
  };

  const testWebhook = async (id: string) => {
    setError(null);
    try {
      const res = await api.post(`/v1/operations/webhooks/${id}/test`);
      if (res.data.success) {
        setSuccess(`Test successful! Response: ${res.data.statusCode}`);
      } else {
        setError(`Test failed: ${res.data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to test webhook');
    }
  };

  const retryDelivery = async (deliveryId: string) => {
    setError(null);
    try {
      await api.post(`/v1/operations/webhooks/deliveries/${deliveryId}/retry`);
      setSuccess('Delivery retried successfully');
      if (selectedWebhook) {
        loadDeliveries(selectedWebhook.id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to retry delivery');
    }
  };

  const toggleStatus = async (webhook: WebhookRecord) => {
    const newStatus = webhook.status === 'active' ? 'paused' : 'active';
    try {
      await api.put(`/v1/operations/webhooks/${webhook.id}`, { status: newStatus });
      setSuccess(`Webhook ${newStatus === 'active' ? 'activated' : 'paused'}`);
      loadWebhooks();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      events: [],
      secret: '',
      headers: {},
      status: 'active',
    });
    setHeaderKey('');
    setHeaderValue('');
  };

  const openEditModal = (webhook: WebhookRecord) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      headers: webhook.headers || {},
      status: webhook.status,
    });
  };

  const openDeliveriesModal = async (webhook: WebhookRecord) => {
    setSelectedWebhook(webhook);
    await loadDeliveries(webhook.id);
    setShowDeliveriesModal(true);
  };

  const addHeader = () => {
    if (headerKey && headerValue) {
      setFormData({
        ...formData,
        headers: { ...formData.headers, [headerKey]: headerValue },
      });
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...formData.headers };
    delete newHeaders[key];
    setFormData({ ...formData, headers: newHeaders });
  };

  const toggleEvent = (event: string) => {
    const events = formData.events.includes(event)
      ? formData.events.filter((e) => e !== event)
      : [...formData.events, event];
    setFormData({ ...formData, events });
  };

  useEffect(() => {
    loadWebhooks();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <ReportPage
      title="Webhooks"
      description="Configure webhook integrations to receive real-time event notifications"
      actions={
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Webhook
        </Button>
      }
    >
      {error && <ReportAlert>{error}</ReportAlert>}
      {success && (
        <div className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          {success}
        </div>
      )}

      {/* Webhooks Table */}
      <ReportCard>
        <ReportTable>
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">URL</th>
              <th className="text-left p-3">Events</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {webhooks.length === 0 && <ReportEmpty colSpan={5} message="No webhooks configured" />}
            {webhooks.map((webhook) => {
              const config = statusConfig[webhook.status];
              const Icon = config.icon;

              return (
                <tr key={webhook.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{webhook.name}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 max-w-xs">
                      <code className="text-xs bg-muted px-2 py-1 rounded truncate">{webhook.url}</code>
                      <a
                        href={webhook.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {webhook.events.slice(0, 2).map((event) => (
                        <span key={event} className="text-xs bg-muted px-2 py-0.5 rounded">
                          {event}
                        </span>
                      ))}
                      {webhook.events.length > 2 && (
                        <span className="text-xs text-muted-foreground">+{webhook.events.length - 2} more</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleStatus(webhook)}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border cursor-pointer transition-opacity hover:opacity-80 ${config.color}`}
                    >
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testWebhook(webhook.id)}
                        title="Test Webhook"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeliveriesModal(webhook)}
                        title="View Deliveries"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(webhook)}
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteWebhook(webhook.id)}
                        title="Delete"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ReportTable>
      </ReportCard>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingWebhook) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">
              {editingWebhook ? 'Edit Webhook' : 'Create New Webhook'}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <Input
                  className="mt-1"
                  placeholder="My Integration"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <select
                  className="flex h-9 w-full mt-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Endpoint URL</label>
              <Input
                className="mt-1"
                placeholder="https://example.com/webhook"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Secret (for signature verification)</label>
              <div className="flex gap-2 mt-1">
                <Input
                  type={showSecret['form'] ? 'text' : 'password'}
                  placeholder="whsec_..."
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSecret({ ...showSecret, form: !showSecret['form'] })}
                >
                  {showSecret['form'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Used to sign webhook payloads. Leave empty to auto-generate.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Events to Subscribe</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-muted/30 rounded-lg">
                {AVAILABLE_EVENTS.map((event) => (
                  <label
                    key={event.value}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.events.includes(event.value)}
                      onChange={() => toggleEvent(event.value)}
                      className="rounded"
                    />
                    <span className="text-sm">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Custom Headers</label>
              <div className="space-y-2">
                {Object.entries(formData.headers).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                    <code className="text-sm flex-1">{key}: {value}</code>
                    <Button variant="ghost" size="sm" onClick={() => removeHeader(key)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Header name"
                    value={headerKey}
                    onChange={(e) => setHeaderKey(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Header value"
                    value={headerValue}
                    onChange={(e) => setHeaderValue(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={addHeader}>
                    Add
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingWebhook(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={editingWebhook ? updateWebhook : createWebhook}>
                {editingWebhook ? 'Update Webhook' : 'Create Webhook'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title="Delete Webhook"
        description="Are you sure you want to delete this webhook?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteWebhook}
      />

      {/* Deliveries Modal */}
      {showDeliveriesModal && selectedWebhook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-4xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Delivery History</h2>
                <p className="text-sm text-muted-foreground">{selectedWebhook.name}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowDeliveriesModal(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-3">
              {deliveries.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No deliveries yet</p>
              ) : (
                deliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className={`p-4 rounded-lg border ${
                      delivery.success ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {delivery.success ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium">{delivery.event}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-muted">
                            {delivery.statusCode}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {delivery.duration}ms
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(delivery.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!delivery.success && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryDelivery(delivery.id)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                    </div>
                    {delivery.error && (
                      <div className="mt-2 p-2 bg-red-100/50 rounded text-sm text-red-700">
                        {delivery.error}
                      </div>
                    )}
                    {delivery.response && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          View Response
                        </summary>
                        <pre className="mt-2 p-2 bg-muted/50 rounded text-xs overflow-x-auto">
                          {delivery.response}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </ReportPage>
  );
}
