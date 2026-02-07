import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Webhook } from '@prisma/client';
import * as crypto from 'crypto';
import * as url from 'url';
import * as net from 'net';

interface TenantContext {
  tenantId: string;
}

interface WebhookEvent {
  event: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // URL Validation (SSRF Protection)
  // ==========================================

  /**
   * Validate webhook URL to prevent SSRF attacks.
   * Rejects non-HTTPS, localhost, private, and link-local addresses.
   */
  private validateWebhookUrl(webhookUrl: string): void {
    let parsed: URL;
    try {
      parsed = new URL(webhookUrl);
    } catch {
      throw new BadRequestException('Invalid webhook URL');
    }

    // Require HTTPS
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Webhook URL must use HTTPS');
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost
    if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
      throw new BadRequestException('Webhook URL must not point to localhost');
    }

    // Block IP-based addresses that are private/reserved
    if (net.isIP(hostname)) {
      const blockedPatterns = [
        /^127\./, // loopback
        /^0\.0\.0\.0$/, // unspecified
        /^::1$/, // IPv6 loopback
        /^10\./, // 10.0.0.0/8 private
        /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12 private
        /^192\.168\./, // 192.168.0.0/16 private
        /^169\.254\./, // 169.254.0.0/16 link-local
        /^fc00:/i, // IPv6 unique local
        /^fd/i, // IPv6 unique local
        /^fe80:/i, // IPv6 link-local
      ];

      for (const pattern of blockedPatterns) {
        if (pattern.test(hostname)) {
          throw new BadRequestException(
            'Webhook URL must not point to a private or reserved IP address',
          );
        }
      }
    }
  }

  // ==========================================
  // Response Sanitization (WH-3)
  // ==========================================

  /**
   * Strip the secret field from webhook objects.
   * Replaces it with a masked placeholder.
   */
  private sanitize<T extends { secret?: string }>(webhook: T): Omit<T, 'secret'> & { secretMasked: string } {
    const { secret, ...rest } = webhook;
    return { ...rest, secretMasked: '****' };
  }

  // ==========================================
  // CRUD Operations
  // ==========================================

  /**
   * List all webhooks for tenant
   */
  async findMany(ctx: TenantContext) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return webhooks.map(w => this.sanitize(w));
  }

  /**
   * Get webhook by ID
   */
  async findOne(ctx: TenantContext, id: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id },
    });
    if (!webhook || webhook.tenantId !== ctx.tenantId) {
      throw new NotFoundException(`Webhook '${id}' not found`);
    }
    return this.sanitize(webhook);
  }

  /**
   * Internal: get webhook by ID with full secret (not sanitized)
   */
  private async findOneInternal(ctx: TenantContext, id: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id },
    });
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
  ) {
    this.validateWebhookUrl(data.url);

    const secret = data.secret || crypto.randomBytes(32).toString('hex');

    const webhook = await this.prisma.webhook.create({
      data: {
        tenantId: ctx.tenantId,
        name: data.name,
        url: data.url,
        events: data.events,
        secret,
        headers: data.headers || {},
        status: 'active',
      },
    });

    this.logger.debug(`Created webhook ${webhook.id} for tenant ${ctx.tenantId}`);

    // Return full secret only on create
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
  ) {
    await this.findOneInternal(ctx, id); // Ensure it exists and belongs to tenant

    if (data.url) {
      this.validateWebhookUrl(data.url);
    }

    const updated = await this.prisma.webhook.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.url !== undefined && { url: data.url }),
        ...(data.events !== undefined && { events: data.events }),
        ...(data.secret !== undefined && { secret: data.secret }),
        ...(data.headers !== undefined && { headers: data.headers }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });

    this.logger.debug(`Updated webhook ${id}`);

    return this.sanitize(updated);
  }

  /**
   * Delete a webhook
   */
  async delete(ctx: TenantContext, id: string): Promise<{ deleted: boolean }> {
    await this.findOneInternal(ctx, id); // Ensure it exists and belongs to tenant

    // Delete associated deliveries first
    await this.prisma.webhookDelivery.deleteMany({
      where: { webhookId: id },
    });

    await this.prisma.webhook.delete({
      where: { id },
    });

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
  ) {
    await this.findOneInternal(ctx, webhookId); // Ensure webhook exists and belongs to tenant

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.webhookDelivery.count({
        where: { webhookId },
      }),
    ]);

    return { data, total };
  }

  /**
   * Retry a failed delivery
   */
  async retryDelivery(ctx: TenantContext, deliveryId: string): Promise<{ retried: boolean }> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });
    if (!delivery) {
      throw new NotFoundException(`Delivery '${deliveryId}' not found`);
    }

    const webhook = await this.findOneInternal(ctx, delivery.webhookId);

    const event: WebhookEvent = {
      event: delivery.event,
      payload: (typeof delivery.payload === 'string' ? JSON.parse(delivery.payload) : delivery.payload as any).data || {},
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
    // Get unsanitized webhooks for delivery (need secret for signing)
    const webhooks = await this.prisma.webhook.findMany({
      where: { tenantId: ctx.tenantId, status: 'active' },
    });

    const activeWebhooks = webhooks.filter(
      w => (w.events as string[]).includes(event.event)
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
  private async deliverWebhook(webhook: Webhook, event: WebhookEvent): Promise<void> {
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

    const webhookHeaders = (webhook.headers || {}) as Record<string, string>;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-Event': event.event,
      'X-Webhook-Timestamp': event.timestamp.toISOString(),
      ...webhookHeaders,
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

    // Record delivery in database
    await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: event.event,
        payload,
        statusCode: response?.status || 0,
        response: responseText,
        error,
        duration,
        success: response?.ok || false,
      },
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
    const webhook = await this.findOneInternal(ctx, id);

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
    events: unknown;
    totalDeliveries: number;
    last24Hours: {
      total: number;
      successful: number;
      failed: number;
    };
  }>> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { tenantId: ctx.tenantId },
    });
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stats = await Promise.all(
      webhooks.map(async (webhook) => {
        const [totalDeliveries, last24Total, last24Successful, last24Failed] = await Promise.all([
          this.prisma.webhookDelivery.count({
            where: { webhookId: webhook.id },
          }),
          this.prisma.webhookDelivery.count({
            where: { webhookId: webhook.id, createdAt: { gte: oneDayAgo } },
          }),
          this.prisma.webhookDelivery.count({
            where: { webhookId: webhook.id, createdAt: { gte: oneDayAgo }, success: true },
          }),
          this.prisma.webhookDelivery.count({
            where: { webhookId: webhook.id, createdAt: { gte: oneDayAgo }, success: false },
          }),
        ]);

        return {
          id: webhook.id,
          name: webhook.name,
          url: webhook.url,
          status: webhook.status,
          events: webhook.events,
          totalDeliveries,
          last24Hours: {
            total: last24Total,
            successful: last24Successful,
            failed: last24Failed,
          },
        };
      })
    );

    return stats;
  }
}
