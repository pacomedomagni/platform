import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Webhook, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as net from 'net';
import * as dns from 'dns';

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
   * Check if an IP address is in a private or reserved range.
   */
  private isPrivateOrReservedIP(ip: string): boolean {
    const blockedPatterns = [
      /^127\./, // 127.0.0.0/8 loopback
      /^0\.0\.0\.0$/, // unspecified
      /^::1$/, // IPv6 loopback
      /^10\./, // 10.0.0.0/8 private
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12 private
      /^192\.168\./, // 192.168.0.0/16 private
      /^169\.254\./, // 169.254.0.0/16 link-local
      /^fc00:/i, // IPv6 unique local (fc00::/7)
      /^fd/i, // IPv6 unique local
      /^fe80:/i, // IPv6 link-local
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(ip)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Validate webhook URL to prevent SSRF attacks.
   * Rejects non-HTTPS, localhost, private, and link-local addresses.
   * Also resolves DNS to ensure the hostname doesn't point to private IPs.
   */
  private async validateWebhookUrl(webhookUrl: string): Promise<void> {
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
      if (this.isPrivateOrReservedIP(hostname)) {
        throw new BadRequestException(
          'Webhook URL must not point to a private or reserved IP address',
        );
      }
    }

    // DNS resolution pre-check: resolve hostname and validate resolved IPs
    // This prevents SSRF via DNS rebinding or hostnames pointing to internal IPs
    if (!net.isIP(hostname)) {
      const resolvedIPs: string[] = [];

      try {
        const ipv4Addresses = await dns.promises.resolve4(hostname);
        resolvedIPs.push(...ipv4Addresses);
      } catch {
        // No IPv4 records is acceptable if IPv6 exists
      }

      try {
        const ipv6Addresses = await dns.promises.resolve6(hostname);
        resolvedIPs.push(...ipv6Addresses);
      } catch {
        // No IPv6 records is acceptable if IPv4 exists
      }

      if (resolvedIPs.length === 0) {
        throw new BadRequestException('Webhook URL hostname could not be resolved');
      }

      for (const ip of resolvedIPs) {
        if (this.isPrivateOrReservedIP(ip)) {
          throw new BadRequestException(
            'Webhook URL must not resolve to a private or reserved IP address',
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
    const masked = secret && secret.length >= 4
      ? '****' + secret.slice(-4)
      : '****';
    return { ...rest, secretMasked: masked };
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
    await this.validateWebhookUrl(data.url);

    // M-WH-6: Enforce max 25 webhooks per tenant
    const existingCount = await this.prisma.webhook.count({
      where: { tenantId: ctx.tenantId },
    });
    if (existingCount >= 25) {
      throw new BadRequestException('Maximum of 25 webhooks per tenant reached');
    }

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

    // Return only specific fields on create — include secret so the user can store it,
    // but exclude tenantId and other internal fields from the response.
    return {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      status: webhook.status,
      createdAt: webhook.createdAt,
    };
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
      await this.validateWebhookUrl(data.url);
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
    // L-1: Cap limit to 500 to prevent unbounded queries
    const limit = Math.min(options.limit || 20, 500);
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
   * Deliver a webhook with automatic retry and circuit breaker support.
   * On failure, schedules up to 3 retries with exponential backoff (1min, 5min, 30min)
   * via BackgroundJob records. If a webhook accumulates >10 consecutive failures,
   * it is automatically disabled (circuit breaker).
   */
  private async deliverWebhook(webhook: Webhook, event: WebhookEvent, attempt = 0): Promise<void> {
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

    // Apply custom headers first, then system headers so they cannot be overridden
    const webhookHeaders = (webhook.headers || {}) as Record<string, string>;
    const headers: Record<string, string> = {
      ...webhookHeaders,
      'Content-Type': 'application/json',
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-Event': event.event,
      'X-Webhook-Timestamp': event.timestamp.toISOString(),
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
    const success = response?.ok || false;

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
        success,
      },
    });

    if (!success) {
      // M-WH-5: Circuit breaker - track consecutive failures
      const recentDeliveries = await this.prisma.webhookDelivery.findMany({
        where: { webhookId: webhook.id },
        orderBy: { createdAt: 'desc' },
        take: 11,
        select: { success: true },
      });
      const consecutiveFailures = recentDeliveries.findIndex(d => d.success);
      const failureCount = consecutiveFailures === -1 ? recentDeliveries.length : consecutiveFailures;

      if (failureCount > 10) {
        this.logger.warn(
          `Webhook ${webhook.id} has >10 consecutive failures. Auto-disabling.`,
        );
        await this.prisma.webhook.update({
          where: { id: webhook.id },
          data: { status: 'disabled' },
        });
      }

      // H-WH-2: Automatic retry with exponential backoff (1min, 5min, 30min)
      const maxRetries = 3;
      if (attempt < maxRetries) {
        const retryDelays = [60_000, 300_000, 1_800_000]; // 1min, 5min, 30min
        const delayMs = retryDelays[attempt] || 1_800_000;
        const scheduledFor = new Date(Date.now() + delayMs);

        await this.prisma.backgroundJob.create({
          data: {
            tenantId: webhook.tenantId,
            type: 'webhook.retry',
            payload: {
              webhookId: webhook.id,
              event: event.event,
              eventPayload: event.payload,
              attempt: attempt + 1,
            } as object,
            scheduledAt: scheduledFor,
            priority: 3,
            status: 'pending',
            attempts: 0,
            maxAttempts: 1,
          },
        });
        this.logger.debug(
          `Scheduled webhook retry ${attempt + 1}/${maxRetries} for webhook ${webhook.id} at ${scheduledFor.toISOString()}`,
        );
      }

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
   * Get webhook statistics using a single aggregated query with conditional counts
   * instead of N*4 queries (one per webhook per metric).
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

    if (webhooks.length === 0) return [];

    const webhookIds = webhooks.map(w => w.id);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Single query with conditional aggregation for all webhooks
    const deliveryStats = await this.prisma.$queryRaw<Array<{
      webhookId: string;
      total_deliveries: bigint;
      last24_total: bigint;
      last24_successful: bigint;
      last24_failed: bigint;
    }>>`
      SELECT
        "webhookId",
        COUNT(*)::bigint AS total_deliveries,
        COUNT(*) FILTER (WHERE "createdAt" >= ${oneDayAgo})::bigint AS last24_total,
        COUNT(*) FILTER (WHERE "createdAt" >= ${oneDayAgo} AND success = true)::bigint AS last24_successful,
        COUNT(*) FILTER (WHERE "createdAt" >= ${oneDayAgo} AND success = false)::bigint AS last24_failed
      FROM webhook_deliveries
      WHERE "webhookId" IN (${Prisma.join(webhookIds)})
      GROUP BY "webhookId"
    `;

    const statsMap = new Map(
      deliveryStats.map(s => [s.webhookId, {
        totalDeliveries: Number(s.total_deliveries),
        last24Total: Number(s.last24_total),
        last24Successful: Number(s.last24_successful),
        last24Failed: Number(s.last24_failed),
      }]),
    );

    return webhooks.map(webhook => {
      const s = statsMap.get(webhook.id);
      return {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        status: webhook.status,
        events: webhook.events,
        totalDeliveries: s?.totalDeliveries ?? 0,
        last24Hours: {
          total: s?.last24Total ?? 0,
          successful: s?.last24Successful ?? 0,
          failed: s?.last24Failed ?? 0,
        },
      };
    });
  }

  // ==========================================
  // Cleanup
  // ==========================================

  /**
   * M-WH-7: Clean up old WebhookDelivery records older than 30 days.
   * Called by a cron job or cleanup scheduler.
   */
  async cleanupOldDeliveries(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.prisma.webhookDelivery.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    this.logger.log(`Deleted ${result.count} old webhook delivery records`);
    return result.count;
  }
}
