import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

interface TenantContext {
  tenantId: string;
}

interface WebhookEvent {
  event: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

// In-memory webhook record
interface WebhookRecord {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  headers: Record<string, string>;
  status: 'active' | 'paused' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
}

// In-memory delivery record
interface WebhookDeliveryRecord {
  id: string;
  webhookId: string;
  event: string;
  payload: string;
  statusCode: number;
  response: string | null;
  error: string | null;
  duration: number;
  success: boolean;
  createdAt: Date;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  
  // In-memory stores
  private webhooks: Map<string, WebhookRecord> = new Map();
  private deliveries: Map<string, WebhookDeliveryRecord> = new Map();

  private generateId(): string {
    return `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateDeliveryId(): string {
    return `del_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // ==========================================
  // CRUD Operations
  // ==========================================

  /**
   * List all webhooks for tenant
   */
  async findMany(ctx: TenantContext): Promise<WebhookRecord[]> {
    const webhooks: WebhookRecord[] = [];
    this.webhooks.forEach(webhook => {
      if (webhook.tenantId === ctx.tenantId) {
        webhooks.push(webhook);
      }
    });
    return webhooks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get webhook by ID
   */
  async findOne(ctx: TenantContext, id: string): Promise<WebhookRecord> {
    const webhook = this.webhooks.get(id);
    if (!webhook || webhook.tenantId !== ctx.tenantId) {
      throw new NotFoundException(`Webhook '${id}' not found`);
    }
    return webhook;
  }

  /**
   * Create a new webhook
   */
  async create(
    ctx: TenantContext,
    data: {
      name: string;
      url: string;
      events: string[];
      secret?: string;
      headers?: Record<string, string>;
    }
  ): Promise<WebhookRecord> {
    const id = this.generateId();
    const secret = data.secret || crypto.randomBytes(32).toString('hex');
    
    const webhook: WebhookRecord = {
      id,
      tenantId: ctx.tenantId,
      name: data.name,
      url: data.url,
      events: data.events,
      secret,
      headers: data.headers || {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.set(id, webhook);
    this.logger.debug(`Created webhook ${id} for tenant ${ctx.tenantId}`);
    
    return webhook;
  }

  /**
   * Update a webhook
   */
  async update(
    ctx: TenantContext,
    id: string,
    data: {
      name?: string;
      url?: string;
      events?: string[];
      secret?: string;
      headers?: Record<string, string>;
      status?: 'active' | 'paused' | 'disabled';
    }
  ): Promise<WebhookRecord> {
    const webhook = await this.findOne(ctx, id);

    const updated: WebhookRecord = {
      ...webhook,
      name: data.name ?? webhook.name,
      url: data.url ?? webhook.url,
      events: data.events ?? webhook.events,
      secret: data.secret ?? webhook.secret,
      headers: data.headers ?? webhook.headers,
      status: data.status ?? webhook.status,
      updatedAt: new Date(),
    };

    this.webhooks.set(id, updated);
    this.logger.debug(`Updated webhook ${id}`);
    
    return updated;
  }

  /**
   * Delete a webhook
   */
  async delete(ctx: TenantContext, id: string): Promise<{ deleted: boolean }> {
    await this.findOne(ctx, id); // Ensure it exists
    
    // Delete associated deliveries
    this.deliveries.forEach((delivery, deliveryId) => {
      if (delivery.webhookId === id) {
        this.deliveries.delete(deliveryId);
      }
    });
    
    this.webhooks.delete(id);
    this.logger.debug(`Deleted webhook ${id}`);
    
    return { deleted: true };
  }

  // ==========================================
  // Delivery Management
  // ==========================================

  /**
   * Get deliveries for a webhook
   */
  async getDeliveries(
    ctx: TenantContext,
    webhookId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ data: WebhookDeliveryRecord[]; total: number }> {
    await this.findOne(ctx, webhookId); // Ensure webhook exists
    
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const allDeliveries: WebhookDeliveryRecord[] = [];
    this.deliveries.forEach(delivery => {
      if (delivery.webhookId === webhookId) {
        allDeliveries.push(delivery);
      }
    });

    // Sort by createdAt descending
    allDeliveries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      data: allDeliveries.slice(offset, offset + limit),
      total: allDeliveries.length,
    };
  }

  /**
   * Retry a failed delivery
   */
  async retryDelivery(ctx: TenantContext, deliveryId: string): Promise<{ retried: boolean }> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      throw new NotFoundException(`Delivery '${deliveryId}' not found`);
    }

    const webhook = this.webhooks.get(delivery.webhookId);
    if (!webhook || webhook.tenantId !== ctx.tenantId) {
      throw new NotFoundException(`Webhook not found`);
    }

    const event: WebhookEvent = {
      event: delivery.event,
      payload: JSON.parse(delivery.payload).data || {},
      timestamp: new Date(),
    };

    await this.deliverWebhook(webhook, event);
    return { retried: true };
  }

  // ==========================================
  // Event Triggering
  // ==========================================

  /**
   * Trigger webhooks for an event
   */
  async triggerEvent(ctx: TenantContext, event: WebhookEvent): Promise<{
    triggered: number;
    successful: number;
    failed: number;
  }> {
    const webhooks = await this.findMany(ctx);
    const activeWebhooks = webhooks.filter(
      w => w.status === 'active' && w.events.includes(event.event)
    );

    const results = await Promise.allSettled(
      activeWebhooks.map(webhook => this.deliverWebhook(webhook, event))
    );

    return {
      triggered: activeWebhooks.length,
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
    };
  }

  /**
   * Deliver a webhook
   */
  private async deliverWebhook(webhook: WebhookRecord, event: WebhookEvent): Promise<void> {
    const payload = JSON.stringify({
      event: event.event,
      timestamp: event.timestamp.toISOString(),
      data: event.payload,
    });

    // Generate signature
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(payload)
      .digest('hex');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-Event': event.event,
      'X-Webhook-Timestamp': event.timestamp.toISOString(),
      ...webhook.headers,
    };

    const startTime = Date.now();
    let response: Response | null = null;
    let error: string | null = null;
    let responseText: string | null = null;

    try {
      response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
      responseText = await response.text().catch(() => '');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Webhook delivery failed: ${error}`);
    }

    const duration = Date.now() - startTime;

    // Record delivery
    const deliveryId = this.generateDeliveryId();
    this.deliveries.set(deliveryId, {
      id: deliveryId,
      webhookId: webhook.id,
      event: event.event,
      payload,
      statusCode: response?.status || 0,
      response: responseText,
      error,
      duration,
      success: response?.ok || false,
      createdAt: new Date(),
    });

    if (!response?.ok) {
      throw new Error(error || `HTTP ${response?.status}`);
    }
  }

  // ==========================================
  // Testing
  // ==========================================

  /**
   * Test a webhook (send a test event)
   */
  async testWebhook(ctx: TenantContext, id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const webhook = await this.findOne(ctx, id);

    const testEvent: WebhookEvent = {
      event: 'test.ping',
      payload: {
        message: 'This is a test webhook delivery',
        webhookId: webhook.id,
        webhookName: webhook.name,
      },
      timestamp: new Date(),
    };

    try {
      await this.deliverWebhook(webhook, testEvent);
      return { success: true, message: 'Test webhook delivered successfully' };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Delivery failed',
      };
    }
  }

  // ==========================================
  // Statistics
  // ==========================================

  /**
   * Get webhook statistics
   */
  async getStats(ctx: TenantContext): Promise<Array<{
    id: string;
    name: string;
    url: string;
    status: string;
    events: string[];
    totalDeliveries: number;
    last24Hours: {
      total: number;
      successful: number;
      failed: number;
    };
  }>> {
    const webhooks = await this.findMany(ctx);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return webhooks.map(webhook => {
      const allDeliveries: WebhookDeliveryRecord[] = [];
      const last24HoursDeliveries: WebhookDeliveryRecord[] = [];

      this.deliveries.forEach(delivery => {
        if (delivery.webhookId === webhook.id) {
          allDeliveries.push(delivery);
          if (delivery.createdAt >= oneDayAgo) {
            last24HoursDeliveries.push(delivery);
          }
        }
      });

      return {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        status: webhook.status,
        events: webhook.events,
        totalDeliveries: allDeliveries.length,
        last24Hours: {
          total: last24HoursDeliveries.length,
          successful: last24HoursDeliveries.filter(d => d.success).length,
          failed: last24HoursDeliveries.filter(d => !d.success).length,
        },
      };
    });
  }
}
