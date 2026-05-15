import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import eBayApi from 'ebay-api';
import Redis from 'ioredis';
import type {
  EbayOrder,
  EbayInventoryItem,
  EbayCreateOfferResponse,
  EbayPublishOfferResponse,
  EbayGetOffersResponse,
  EbayFulfillment,
  EbayFulfillmentPolicy,
  EbayPaymentPolicy,
  EbayReturnPolicy,
  EbayInventoryLocation,
  EbayInventoryItemGroup,
  EbayPublishGroupResponse,
  EbayGetMyMessagesResponse,
  EbayGetBestOffersResponse,
  EbayGetFeedbackResponse,
  EbayTradingResponse,
} from './ebay.types';

/**
 * Structured eBay API error with category classification per eBay's error spec.
 * Categories: REQUEST (client error), BUSINESS (rule violation), APPLICATION (server error).
 */
export class EbayApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly category: 'REQUEST' | 'BUSINESS' | 'APPLICATION' | 'UNKNOWN',
    public readonly errorId?: number,
    public readonly errors?: Array<{ errorId: number; domain: string; category: string; message: string; longMessage?: string }>,
    public readonly isTokenRevoked?: boolean,
  ) {
    super(message);
    this.name = 'EbayApiError';
  }
}

/**
 * eBay API Client Wrapper
 * Provides methods for interacting with eBay Sell API.
 * Includes automatic retry with exponential backoff for rate limits (429)
 * and transient server errors (500, 502, 503).
 * Classifies errors per eBay's error spec (REQUEST/BUSINESS/APPLICATION).
 */
@Injectable()
export class EbayClientService implements OnModuleDestroy {
  private readonly logger = new Logger(EbayClientService.name);
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 1000;
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  // Redis-backed distributed rate limiting for multi-instance deployments
  private redis: Redis | null = null;
  private redisAvailable = true;

  // In-memory fallback Maps (used only when Redis is unavailable)
  private readonly dailyCallCountsFallback = new Map<string, { count: number; resetAt: number }>();
  private readonly revisionCountsFallback = new Map<string, { count: number; resetAt: number }>();

  private readonly API_DAILY_LIMITS: Record<string, number> = {
    'sell.inventory': 2_000_000,
    'sell.account': 25_000,
    'sell.fulfillment': 2_000_000,
    'sell.marketing': 200_000,
    'sell.finances': 200_000,
    'sell.analytics': 200_000,
    'commerce.taxonomy': 5_000,
    'commerce.media': 1_000_000,
    'oauth2.token': 50_000,
  };

  // Revision tracking per listing per day (H4)
  private readonly MAX_REVISIONS_PER_DAY = 250;

  // M-T1: per-tenant share of the per-app daily quota. Defaults to 1/10
  // — i.e. we assume up to 10 concurrently active tenants share the
  // app's daily call budget. Tunable per-env if a deployment has more
  // tenants. The floor (PER_TENANT_FLOOR) keeps small tenants
  // operational even if the share math would otherwise starve them.
  private readonly PER_TENANT_FRACTION = parseFloat(
    process.env['EBAY_PER_TENANT_FRACTION'] ?? '0.1',
  );
  private readonly PER_TENANT_FLOOR = parseInt(
    process.env['EBAY_PER_TENANT_FLOOR'] ?? '1000',
    10,
  );

  constructor(@Optional() private readonly cls?: ClsService) {}

  private getRedis(): Redis {
    if (!this.redis) {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      this.redis.on('error', (err) => {
        if (this.redisAvailable) {
          this.logger.warn(`Redis rate-limit connection error: ${err.message}. Falling back to in-memory.`);
          this.redisAvailable = false;
        }
      });
      this.redis.on('connect', () => {
        this.redisAvailable = true;
      });
    }
    return this.redis;
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => {});
      this.redis = null;
    }
  }

  /**
   * Calculate seconds remaining until end of current UTC day.
   */
  private getEndOfDayTtl(): number {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);
    return Math.max(Math.ceil((endOfDay.getTime() - now.getTime()) / 1000), 1);
  }

  /**
   * Atomically increment a Redis counter with end-of-day TTL.
   * Returns the new count, or null if Redis is unavailable.
   */
  private async redisIncr(key: string): Promise<number | null> {
    try {
      const redis = this.getRedis();
      const count = await redis.incr(key);
      if (count === 1) {
        // First increment — set TTL to end of day
        await redis.expire(key, this.getEndOfDayTtl());
      }
      return count;
    } catch (error) {
      this.logger.warn(`Redis INCR failed for ${key}: ${error?.message}. Falling back to in-memory.`);
      this.redisAvailable = false;
      return null;
    }
  }

  /**
   * Get current value of a Redis counter.
   * Returns null if Redis is unavailable.
   */
  private async redisGet(key: string): Promise<number | null> {
    try {
      const redis = this.getRedis();
      const val = await redis.get(key);
      return val !== null ? parseInt(val, 10) : 0;
    } catch (error) {
      this.logger.warn(`Redis GET failed for ${key}: ${error?.message}. Falling back to in-memory.`);
      this.redisAvailable = false;
      return null;
    }
  }

  /**
   * Increment daily API call count in Redis.
   */
  private async incrementDailyCount(apiCategory: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `ebay:rate:daily:${apiCategory}:${today}`;
    const count = await this.redisIncr(key);
    if (count !== null) return count;

    // Fallback to in-memory
    const now = Date.now();
    const entry = this.dailyCallCountsFallback.get(apiCategory);
    if (!entry || now >= entry.resetAt) {
      this.dailyCallCountsFallback.set(apiCategory, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
      return 1;
    }
    entry.count++;
    return entry.count;
  }

  /**
   * Get current daily API call count.
   */
  private async getDailyCount(apiCategory: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `ebay:rate:daily:${apiCategory}:${today}`;
    const count = await this.redisGet(key);
    if (count !== null) return count;

    // Fallback to in-memory
    const entry = this.dailyCallCountsFallback.get(apiCategory);
    if (!entry || Date.now() >= entry.resetAt) return 0;
    return entry.count;
  }

  /**
   * Increment revision count for a listing in Redis.
   */
  private async incrementRevisionCount(listingId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `ebay:rate:revision:${listingId}:${today}`;
    const count = await this.redisIncr(key);
    if (count !== null) return count;

    // Fallback to in-memory
    const now = Date.now();
    const entry = this.revisionCountsFallback.get(listingId);
    if (!entry || now >= entry.resetAt) {
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      this.revisionCountsFallback.set(listingId, { count: 1, resetAt: tomorrow.getTime() });
      return 1;
    }
    entry.count++;
    return entry.count;
  }

  /**
   * Classify an eBay API error based on status code and error body.
   */
  private classifyError(error: any): EbayApiError {
    const status = error?.statusCode ?? error?.status ?? error?.response?.status ?? 0;
    const errors = error?.response?.data?.errors ?? error?.errors ?? [];
    const firstError = errors[0];
    const category = firstError?.category || (
      status >= 500 ? 'APPLICATION' :
      status === 401 || status === 403 ? 'REQUEST' :
      status >= 400 ? 'BUSINESS' : 'UNKNOWN'
    );

    // Detect revoked/invalid tokens
    const isTokenRevoked = status === 401 && (
      error?.message?.includes('token') ||
      error?.message?.includes('auth') ||
      firstError?.errorId === 1001 ||
      firstError?.message?.toLowerCase()?.includes('invalid access token')
    );

    return new EbayApiError(
      firstError?.longMessage || firstError?.message || error?.message || `eBay API error (${status})`,
      status,
      category as any,
      firstError?.errorId,
      errors,
      isTokenRevoked,
    );
  }

  /**
   * Track API call count for proactive rate limiting.
   * Uses Redis for distributed counting across instances, with in-memory fallback.
   * Returns true if the call should proceed, false if limit would be exceeded.
   */
  async trackApiCall(apiGroup: string): Promise<boolean> {
    const limit = this.API_DAILY_LIMITS[apiGroup] || 100_000;

    // M-T1: per-tenant pre-check. eBay rate limits are per APP, so one
    // tenant can starve every other tenant by saturating the daily
    // quota. We enforce a per-tenant share BEFORE the global cap so the
    // global cap remains an absolute ceiling, and a runaway tenant gets
    // back-pressured without blocking the rest.
    const tenantId = this.cls?.get?.('tenantId') ?? null;
    if (tenantId) {
      const perTenantCap = Math.max(
        this.PER_TENANT_FLOOR,
        Math.floor(limit * this.PER_TENANT_FRACTION),
      );
      const tenantCount = await this.getTenantDailyCount(apiGroup, tenantId);
      if (tenantCount >= perTenantCap) {
        this.logger.warn(
          `eBay per-tenant daily limit reached for ${apiGroup} tenant=${tenantId}: ${tenantCount}/${perTenantCap}`,
        );
        return false;
      }
    }

    // Check current count before incrementing
    const currentCount = await this.getDailyCount(apiGroup);
    if (currentCount >= limit) {
      this.logger.error(`eBay API daily limit EXCEEDED for ${apiGroup}: ${currentCount}/${limit}`);
      return false;
    }

    const newCount = await this.incrementDailyCount(apiGroup);
    if (tenantId) {
      await this.incrementTenantDailyCount(apiGroup, tenantId);
    }

    // M1: proactive headroom alerts — warn loudly at 70%, error at 90%,
    // before we hit the absolute cap. This gives ops time to either
    // shed load, request a quota increase from eBay, or pause non-
    // critical sync jobs. The previous single warning at 95% gave
    // essentially no warning before saturation.
    if (newCount === Math.floor(limit * 0.7)) {
      this.logger.warn(
        `eBay API headroom: ${apiGroup} crossed 70% (${newCount}/${limit})`,
      );
    }
    if (newCount === Math.floor(limit * 0.9)) {
      this.logger.error(
        `eBay API headroom CRITICAL: ${apiGroup} crossed 90% (${newCount}/${limit})`,
      );
    }
    if (newCount > limit) {
      this.logger.error(`eBay API daily limit EXCEEDED for ${apiGroup}: ${newCount}/${limit}`);
      return false;
    }

    return true;
  }

  /**
   * M-T1: per-tenant daily call counter — separate from the app-wide
   * counter so we can enforce fair share without losing the absolute
   * cap visibility.
   */
  private async getTenantDailyCount(apiGroup: string, tenantId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `ebay:rate:daily:tenant:${tenantId}:${apiGroup}:${today}`;
    const count = await this.redisGet(key);
    return count ?? 0;
  }

  private async incrementTenantDailyCount(apiGroup: string, tenantId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `ebay:rate:daily:tenant:${tenantId}:${apiGroup}:${today}`;
    const count = await this.redisIncr(key);
    return count ?? 0;
  }

  /**
   * Track listing revisions. Uses Redis for distributed counting, with in-memory fallback.
   * Returns true if revision is allowed.
   */
  async checkRevisionLimit(listingId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const key = `ebay:rate:revision:${listingId}:${today}`;

    // Check current count before incrementing
    const currentCount = await this.redisGet(key);
    if (currentCount !== null && currentCount >= this.MAX_REVISIONS_PER_DAY) {
      this.logger.warn(
        `Listing ${listingId} has reached ${this.MAX_REVISIONS_PER_DAY} revisions today. Blocked.`
      );
      return false;
    }

    // Fallback check for in-memory
    if (currentCount === null) {
      const entry = this.revisionCountsFallback.get(listingId);
      if (entry && Date.now() < entry.resetAt && entry.count >= this.MAX_REVISIONS_PER_DAY) {
        this.logger.warn(
          `Listing ${listingId} has reached ${this.MAX_REVISIONS_PER_DAY} revisions today. Blocked.`
        );
        return false;
      }
    }

    const newCount = await this.incrementRevisionCount(listingId);
    if (newCount > this.MAX_REVISIONS_PER_DAY) {
      this.logger.warn(
        `Listing ${listingId} has reached ${this.MAX_REVISIONS_PER_DAY} revisions today. Blocked.`
      );
      return false;
    }

    return true;
  }

  /**
   * L17: simple circuit breaker per API group. After
   * CIRCUIT_FAILURE_THRESHOLD consecutive 5xx responses, the circuit
   * opens for CIRCUIT_OPEN_MS and all calls fast-fail without hitting
   * eBay. After the cooldown a single probe call goes through to
   * test recovery (half-open). This prevents retry storms from
   * compounding an eBay outage and burning rate-limit quota for
   * nothing.
   *
   * Keyed per apiGroup so a Marketing-API outage doesn't break
   * inventory sync.
   */
  private readonly CIRCUIT_FAILURE_THRESHOLD = 5;
  private readonly CIRCUIT_OPEN_MS = 30_000;
  private readonly circuit = new Map<string, { failures: number; openUntil: number }>();

  private circuitAllow(apiGroup: string): boolean {
    const state = this.circuit.get(apiGroup);
    if (!state) return true;
    if (state.openUntil > Date.now()) return false;
    // Cooldown elapsed — allow one probe through. failures stays at
    // threshold; a successful probe will reset it via circuitOnSuccess.
    return true;
  }

  private circuitOnFailure(apiGroup: string): void {
    const state = this.circuit.get(apiGroup) ?? { failures: 0, openUntil: 0 };
    state.failures += 1;
    if (state.failures >= this.CIRCUIT_FAILURE_THRESHOLD) {
      state.openUntil = Date.now() + this.CIRCUIT_OPEN_MS;
      this.logger.error(
        `Circuit breaker OPEN for ${apiGroup} (${state.failures} consecutive failures); fast-fail until ${new Date(state.openUntil).toISOString()}`,
      );
    }
    this.circuit.set(apiGroup, state);
  }

  private circuitOnSuccess(apiGroup: string): void {
    const state = this.circuit.get(apiGroup);
    if (state && (state.failures > 0 || state.openUntil > 0)) {
      this.circuit.set(apiGroup, { failures: 0, openUntil: 0 });
    }
  }

  /**
   * L18: env-toggled per-call request/response body logging.
   *
   * Off by default — eBay payloads contain PII (buyer addresses, emails)
   * and can be huge. When set, logs the function name, response shape,
   * and error body. Toggled via EBAY_DEBUG_LOG_BODIES=true. Useful for
   * incident response when you need to see what eBay actually returned.
   */
  private get debugBodies(): boolean {
    return process.env['EBAY_DEBUG_LOG_BODIES'] === 'true';
  }

  private logDebugBody(label: string, body: unknown): void {
    if (!this.debugBodies) return;
    try {
      // Cap at 4 KB to avoid OOM on huge payloads.
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      this.logger.debug(`[ebay:${label}] ${text.slice(0, 4096)}${text.length > 4096 ? '…(truncated)' : ''}`);
    } catch {
      // Don't let logging itself blow up the request path.
    }
  }

  /**
   * Execute an eBay API call with automatic retry handling.
   * Retries on: HTTP 429 (rate limit), 500, 502, 503 (transient server errors).
   * Uses exponential backoff and respects the Retry-After header when present.
   * Classifies errors per eBay's spec and detects revoked tokens.
   */
  private async withRetry<T>(operation: () => Promise<T>, apiGroup?: string): Promise<T> {
    if (apiGroup && !this.circuitAllow(apiGroup)) {
      throw new EbayApiError(
        `eBay API circuit open for ${apiGroup} (recent failures). Will retry after cooldown.`,
        503,
        'APPLICATION',
      );
    }
    if (apiGroup && !(await this.trackApiCall(apiGroup))) {
      throw new EbayApiError(
        `eBay API daily limit exceeded for ${apiGroup}. Try again tomorrow.`,
        429, 'APPLICATION'
      );
    }

    let lastError: any;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const result = await operation();
        if (apiGroup) this.circuitOnSuccess(apiGroup);
        if (apiGroup) this.logDebugBody(`${apiGroup}:response`, result);
        return result;
      } catch (error: any) {
        lastError = error;

        const status = error?.statusCode ?? error?.status ?? error?.response?.status;
        const isRetryable = (status === 429 || status === 500 || status === 502 || status === 503);
        if (apiGroup) {
          this.logDebugBody(
            `${apiGroup}:error[${status}]`,
            error?.response?.data ?? error?.errors ?? error?.message,
          );
        }

        if (isRetryable && attempt < this.MAX_RETRIES) {
          const retryAfterHeader =
            error?.response?.headers?.['retry-after'] ??
            error?.meta?.headers?.['retry-after'];
          const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

          const delayMs =
            retryAfterSeconds && !isNaN(retryAfterSeconds)
              ? retryAfterSeconds * 1000
              : this.BASE_DELAY_MS * Math.pow(2, attempt);

          this.logger.warn(
            `eBay API error (${status}). Retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`
          );

          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        // L17: trip the breaker on terminal 5xx; 4xx is a client problem
        // (don't fast-fail every caller because one of them sent bad data).
        if (apiGroup && status >= 500) {
          this.circuitOnFailure(apiGroup);
        }
        // Classify and throw structured error
        throw this.classifyError(error);
      }
    }
    throw this.classifyError(lastError);
  }

  /**
   * Extract an OAuth2 access token from an eBay API client instance.
   */
  getAccessToken(client: eBayApi): string {
    // TODO: remove when ebay-api types are fixed
    return (client as any).authToken
      || (client as any).auth?.oAuth2?.accessToken
      || '';
  }

  /**
   * Call the eBay Post-Order API with rate-limit retry.
   * The Post-Order API is not covered by the ebay-api SDK, so we use raw fetch.
   */
  async callPostOrderApi(
    client: eBayApi,
    method: 'GET' | 'POST',
    path: string,
    marketplaceId: string,
    body?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Post-Order API ${method} ${path}`);
      return {};
    }

    return this.withRetry(async () => {
      const accessToken = this.getAccessToken(client);
      const url = `https://api.ebay.com/post-order/v2${path}`;
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId || 'EBAY_US',
      };

      const response = await fetch(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (!response.ok) {
        const err: any = new Error(`eBay Post-Order API returned ${response.status}: ${response.statusText}`);
        err.status = response.status;
        throw err;
      }

      return response.json().catch(() => ({}));
    });
  }

  /**
   * Create or replace inventory item
   */
  async createOrReplaceInventoryItem(
    client: eBayApi,
    sku: string,
    data: {
      product: {
        title: string;
        description: string;
        imageUrls: string[];
        aspects?: Record<string, string[]>;
        brand?: string;
        mpn?: string;
        upc?: string[];
        ean?: string[];
        isbn?: string[];
        epid?: string;
        subtitle?: string;
      };
      condition: string;
      conditionDescription?: string;
      availability: {
        shipToLocationAvailability: {
          quantity: number;
        };
      };
      packageWeightAndSize?: {
        packageType?: string;
        dimensions?: {
          height?: number;
          length?: number;
          width?: number;
          unit?: string;
        };
        weight?: {
          value?: number;
          unit?: string;
        };
      };
    }
  ): Promise<unknown> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Created/updated inventory item: ${sku}`);
      return { sku, statusCode: 204 };
    }
    return this.withRetry(async () => {
      try {
        const response = await client.sell.inventory.createOrReplaceInventoryItem(sku, data as any);
        this.logger.log(`Created/updated inventory item: ${sku}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to create/update inventory item ${sku}`, error);
        throw error;
      }
    });
  }

  /**
   * Delete an inventory item (for rollback on publish failure)
   */
  async deleteInventoryItem(client: eBayApi, sku: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Deleted inventory item: ${sku}`);
      return;
    }
    return this.withRetry(async () => {
      try {
        await client.sell.inventory.deleteInventoryItem(sku);
        this.logger.log(`Deleted inventory item: ${sku}`);
      } catch (error) {
        this.logger.error(`Failed to delete inventory item ${sku}`, error);
        throw error;
      }
    });
  }

  /**
   * Create offer for an inventory item
   */
  async createOffer(
    client: eBayApi,
    data: {
      sku: string;
      marketplaceId: string;
      format: string;
      availableQuantity: number;
      categoryId: string;
      secondaryCategoryId?: string;
      listingDescription?: string;
      listingDuration?: string; // DAYS_1, DAYS_3, DAYS_5, DAYS_7, DAYS_10, DAYS_21, DAYS_30, GTC
      listingPolicies: {
        fulfillmentPolicyId: string;
        paymentPolicyId: string;
        returnPolicyId: string;
        bestOfferTerms?: {
          bestOfferEnabled: boolean;
          autoAcceptPrice?: { value: string; currency: string };
          autoDeclinePrice?: { value: string; currency: string };
        };
      };
      pricingSummary: {
        price: {
          value: string;
          currency: string;
        };
        auctionStartPrice?: { value: string; currency: string };
        auctionReservePrice?: { value: string; currency: string };
      };
      merchantLocationKey?: string;
      includeCatalogProductDetails?: boolean;
      hideBuyerDetails?: boolean;
      lotSize?: number;
      listingStartDate?: string; // ISO 8601 for scheduled listings
    }
  ): Promise<EbayCreateOfferResponse> {
    if (this.mockMode) {
      const offerId = `mock_offer_${Date.now()}`;
      this.logger.log(`[MOCK] Created offer ${offerId} for SKU: ${data.sku}`);
      return { offerId };
    }
    return this.withRetry(async () => {
      try {
        const response = await client.sell.inventory.createOffer(data);
        this.logger.log(`Created offer for SKU: ${data.sku}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to create offer for SKU ${data.sku}`, error);
        throw error;
      }
    });
  }

  /**
   * Publish offer to eBay
   */
  async publishOffer(client: eBayApi, offerId: string): Promise<EbayPublishOfferResponse> {
    if (this.mockMode) {
      const listingId = `mock_listing_${Date.now()}`;
      this.logger.log(`[MOCK] Published offer: ${offerId} → listing ${listingId}`);
      return { listingId };
    }
    return this.withRetry(async () => {
      try {
        const response = await client.sell.inventory.publishOffer(offerId);
        this.logger.log(`Published offer: ${offerId}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to publish offer ${offerId}`, error);
        throw error;
      }
    });
  }

  /**
   * Get a single inventory item by SKU
   */
  async getInventoryItem(client: eBayApi, sku: string): Promise<EbayInventoryItem> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched inventory item: ${sku}`);
      return {
        sku,
        product: { title: 'Mock Product', description: 'Mock description', imageUrls: [] },
        condition: 'NEW',
        availability: { shipToLocationAvailability: { quantity: 100 } },
      };
    }
    return this.withRetry(async () => {
      try {
        const response = await client.sell.inventory.getInventoryItem(sku);
        this.logger.log(`Fetched inventory item: ${sku}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to fetch inventory item ${sku}`, error);
        throw error;
      }
    });
  }

  /**
   * Update inventory quantity
   *
   * Fetches the existing inventory item first, then merges the quantity update
   * into the full item payload before writing it back. This preserves the
   * listing's title, description, images, and all other fields.
   *
   * Previously this called createOrReplaceInventoryItem with only the
   * availability field, which is a full-replace operation that destroyed
   * all other item data (product title, description, images, etc.).
   */
  async updateInventoryQuantity(client: eBayApi, sku: string, quantity: number): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Updated quantity for SKU ${sku}: ${quantity}`);
      return;
    }
    return this.withRetry(async () => {
      try {
        // Fetch the existing inventory item to preserve all current data
        const existingItem = await this.getInventoryItem(client, sku);

        // Merge the quantity update into the existing item
        const updatedItem = {
          ...existingItem,
          availability: {
            ...existingItem.availability,
            shipToLocationAvailability: {
              ...existingItem.availability?.shipToLocationAvailability,
              quantity
            }
          }
        };

        // Write back the full item with only the quantity changed
        await client.sell.inventory.createOrReplaceInventoryItem(sku, updatedItem as any);
        this.logger.log(`Updated quantity for SKU ${sku}: ${quantity}`);
      } catch (error) {
        this.logger.error(`Failed to update quantity for SKU ${sku}`, error);
        throw error;
      }
    });
  }

  /**
   * H5: batched price + quantity update across up to 25 SKUs in a single
   * call. Returns the per-SKU response payload so callers can apply
   * status to the local rows.
   *
   * Use this for the periodic inventory sync — running
   * updateInventoryQuantity in a loop burns one HTTP call per SKU AND
   * counts against the per-listing 250-revisions-per-day cap quickly,
   * because the loop's `getInventoryItem + createOrReplaceInventoryItem`
   * pattern is two calls per SKU. bulkUpdatePriceQuantity is one call
   * per 25 SKUs and registers as one revision per listing.
   *
   * For >25 SKUs callers must batch themselves; this method enforces
   * the limit so an oversized batch fails locally rather than at eBay's
   * edge with a confusing 400.
   */
  async bulkUpdatePriceQuantity(
    client: eBayApi,
    items: Array<{
      sku: string;
      offerId?: string;
      price?: { value: string; currency: string };
      availability?: { shipToLocationAvailability: { quantity: number } };
    }>,
  ): Promise<any> {
    if (items.length === 0) return { responses: [] };
    if (items.length > 25) {
      throw new Error(
        `bulkUpdatePriceQuantity supports up to 25 items per call; received ${items.length}`,
      );
    }
    if (this.mockMode) {
      this.logger.log(`[MOCK] bulkUpdatePriceQuantity for ${items.length} SKU(s)`);
      return {
        responses: items.map((i) => ({ sku: i.sku, statusCode: 200 })),
      };
    }
    return this.withRetry(async () => {
      try {
        const body = {
          requests: items.map((item) => ({
            sku: item.sku,
            offerId: item.offerId,
            availability: item.availability,
            // Only set shipping price keys eBay expects (price under offer).
            ...(item.price
              ? {
                  shipToLocationAvailability: undefined,
                  offers: [
                    {
                      offerId: item.offerId,
                      price: item.price,
                    },
                  ],
                }
              : {}),
          })),
        };
        const result = await (client.sell.inventory as any).bulkUpdatePriceQuantity(
          body,
        );
        this.logger.log(
          `bulkUpdatePriceQuantity: ${items.length} SKU(s) updated`,
        );
        return result;
      } catch (error) {
        this.logger.error(
          `bulkUpdatePriceQuantity failed for ${items.length} SKU(s)`,
          error,
        );
        throw error;
      }
    });
  }

  /**
   * Get orders from eBay
   */
  async getOrders(
    client: eBayApi,
    params: {
      filter?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<EbayOrder[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched 0 orders from eBay`);
      return [];
    }
    return this.withRetry(async () => {
      try {
        const response = await client.sell.fulfillment.getOrders(params);
        this.logger.log(`Fetched ${response.orders?.length || 0} orders from eBay`);
        return response.orders || [];
      } catch (error) {
        this.logger.error('Failed to fetch orders from eBay', error);
        throw error;
      }
    });
  }

  /**
   * M7: validate carrier code against eBay's recognized enum. Falling
   * back to "Other" silently voids eBay's tracking-based defect
   * protection (the seller gets a late-shipment defect even with
   * valid tracking, because eBay can't read it without knowing the
   * carrier). We fail closed so callers get a clear error to remap.
   *
   * List captured from eBay's ShippingCarrierEnum (Fulfillment API);
   * we keep it conservative — better to reject a real carrier and
   * make ops add it than to silently degrade to "Other".
   */
  private static readonly KNOWN_CARRIERS: ReadonlySet<string> = new Set([
    // Domestic US
    'USPS', 'UPS', 'FedEx', 'DHL', 'DHLeCommerce', 'OnTrac', 'LaserShip',
    'GLS', 'Spee_Dee', 'Pilot', 'OldDominion',
    // International (still appear in US-marketplace order shipments)
    'DHLGlobalMail', 'DHLExpress', 'TNT', 'AramexUS', 'Aramex',
    'CanadaPost', 'CanadaPostUS', 'EBAY', 'Other',
    'Borderlinx', 'PostalConnections',
    // Common rate-shop carriers / 3PL aggregators that eBay accepts
    'Pitney_Bowes', 'PB', 'eBayShipping', 'GenericCarrier',
  ]);

  private validateCarrierCode(carrier: string): void {
    if (!carrier || !carrier.trim()) {
      throw new EbayApiError('shippingCarrierCode is required', 400, 'REQUEST');
    }
    // Case-insensitive match — eBay accepts USPS / Usps / usps.
    const normalized = carrier.trim();
    const allowed = Array.from(EbayClientService.KNOWN_CARRIERS);
    const hit = allowed.find((c) => c.toLowerCase() === normalized.toLowerCase());
    if (!hit) {
      throw new EbayApiError(
        `Unknown shippingCarrierCode "${carrier}". Defect protection requires a recognized carrier. ` +
          `Map to one of: ${allowed.slice(0, 15).join(', ')}, ...`,
        400,
        'REQUEST',
      );
    }
  }

  /**
   * Create shipping fulfillment (mark order as shipped)
   */
  async createShippingFulfillment(
    client: eBayApi,
    orderId: string,
    data: {
      lineItems: Array<{
        lineItemId: string;
        quantity: number;
      }>;
      shippingCarrierCode: string;
      trackingNumber: string;
    }
  ): Promise<EbayFulfillment> {
    // M7: validate carrier BEFORE the API call — clearer error and we
    // avoid burning a request against the rate limit for known-bad input.
    this.validateCarrierCode(data.shippingCarrierCode);

    if (this.mockMode) {
      this.logger.log(`[MOCK] Created shipping fulfillment for order: ${orderId}`);
      return { fulfillmentId: `mock_fulfill_${Date.now()}` };
    }
    return this.withRetry(async () => {
      try {
        const response = await client.sell.fulfillment.createShippingFulfillment(orderId, data);
        this.logger.log(`Created shipping fulfillment for order: ${orderId}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to create shipping fulfillment for order ${orderId}`, error);
        throw error;
      }
    });
  }

  /**
   * Get active listings
   */
  async getActiveListings(
    client: eBayApi,
    params?: {
      limit?: number;
      offset?: number;
      sku?: string;
    }
  ): Promise<EbayInventoryItem[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched 0 active listings`);
      return [];
    }
    return this.withRetry(async () => {
      try {
        const response = await client.sell.inventory.getInventoryItems(params);
        this.logger.log(`Fetched ${response.inventoryItems?.length || 0} active listings`);
        return response.inventoryItems || [];
      } catch (error) {
        this.logger.error('Failed to fetch active listings', error);
        throw error;
      }
    });
  }

  /**
   * End listing
   */
  async withdrawOffer(client: eBayApi, offerId: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Withdrew offer: ${offerId}`);
      return;
    }
    return this.withRetry(async () => {
      try {
        await client.sell.inventory.withdrawOffer(offerId);
        this.logger.log(`Withdrew offer: ${offerId}`);
      } catch (error) {
        this.logger.error(`Failed to withdraw offer ${offerId}`, error);
        throw error;
      }
    });
  }

  /**
   * Get fulfillment policies
   */
  async getFulfillmentPolicies(client: eBayApi, marketplaceId: string): Promise<EbayFulfillmentPolicy[]> {
    if (this.mockMode) {
      return [{ fulfillmentPolicyId: 'mock_fp_1', name: 'Mock Fulfillment Policy' }];
    }
    return this.withRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response = await client.sell.account.getFulfillmentPolicies(marketplaceId as any);
        return response.fulfillmentPolicies || [];
      } catch (error) {
        this.logger.error('Failed to fetch fulfillment policies', error);
        throw error;
      }
    });
  }

  /**
   * Get a single fulfillment policy by ID
   */
  async getFulfillmentPolicy(client: eBayApi, policyId: string): Promise<EbayFulfillmentPolicy> {
    if (this.mockMode) {
      return { fulfillmentPolicyId: policyId, name: 'Mock Fulfillment Policy' };
    }
    return this.withRetry(async () => {
      try {
        const response = await (client.sell.account as any).getFulfillmentPolicy(policyId);
        return response;
      } catch (error) {
        this.logger.error(`Failed to fetch fulfillment policy ${policyId}`, error);
        throw error;
      }
    });
  }

  /**
   * Create a fulfillment policy. Used by the lazy-clone path that
   * applies per-listing handling-time / shipping-service overrides
   * without touching the seller's saved policies.
   */
  async createFulfillmentPolicy(
    client: eBayApi,
    body: Record<string, unknown>
  ): Promise<EbayFulfillmentPolicy> {
    if (this.mockMode) {
      return { fulfillmentPolicyId: `mock_fp_${Date.now()}`, name: (body as any).name };
    }
    return this.withRetry(async () => {
      try {
        const response = await (client.sell.account as any).createFulfillmentPolicy(body);
        return response;
      } catch (error) {
        this.logger.error('Failed to create fulfillment policy', error);
        throw error;
      }
    });
  }

  /**
   * Get payment policies
   */
  async getPaymentPolicies(client: eBayApi, marketplaceId: string): Promise<EbayPaymentPolicy[]> {
    if (this.mockMode) {
      return [{ paymentPolicyId: 'mock_pp_1', name: 'Mock Payment Policy' }];
    }
    return this.withRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response = await client.sell.account.getPaymentPolicies(marketplaceId as any);
        return response.paymentPolicies || [];
      } catch (error) {
        this.logger.error('Failed to fetch payment policies', error);
        throw error;
      }
    });
  }

  /**
   * Get return policies
   */
  async getReturnPolicies(client: eBayApi, marketplaceId: string): Promise<EbayReturnPolicy[]> {
    if (this.mockMode) {
      return [{ returnPolicyId: 'mock_rp_1', name: 'Mock Return Policy' }];
    }
    return this.withRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response = await client.sell.account.getReturnPolicies(marketplaceId as any);
        return response.returnPolicies || [];
      } catch (error) {
        this.logger.error('Failed to fetch return policies', error);
        throw error;
      }
    });
  }

  /**
   * Get inventory locations
   */
  async getInventoryLocations(client: eBayApi): Promise<EbayInventoryLocation[]> {
    if (this.mockMode) {
      return [{ merchantLocationKey: 'mock_loc_1', name: 'Mock Location' }];
    }
    return this.withRetry(async () => {
      try {
        const response = await client.sell.inventory.getInventoryLocations();
        return response.locations || [];
      } catch (error) {
        this.logger.error('Failed to fetch inventory locations', error);
        throw error;
      }
    });
  }

  /**
   * Update an existing offer (price, quantity, etc. on a published listing)
   */
  async updateOffer(
    client: eBayApi,
    offerId: string,
    data: {
      availableQuantity?: number;
      categoryId?: string;
      listingDescription?: string;
      pricingSummary?: {
        price: { value: string; currency: string };
      };
      listingPolicies?: {
        fulfillmentPolicyId: string;
        paymentPolicyId: string;
        returnPolicyId: string;
      };
    }
  ): Promise<unknown> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Updated offer: ${offerId}`);
      return { offerId };
    }
    return this.withRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response = await (client.sell.inventory as any).updateOffer(offerId, data);
        this.logger.log(`Updated offer: ${offerId}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to update offer ${offerId}`, error);
        throw error;
      }
    });
  }

  /**
   * Get offers for a SKU
   */
  async getOffers(client: eBayApi, params: { sku?: string; format?: string; limit?: number; offset?: number }): Promise<EbayGetOffersResponse> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched offers`);
      return { offers: [], total: 0 };
    }
    return this.withRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response = await (client.sell.inventory as any).getOffers(params);
        this.logger.log(`Fetched ${response.offers?.length || 0} offers`);
        return response;
      } catch (error) {
        this.logger.error('Failed to fetch offers', error);
        throw error;
      }
    });
  }

  // ============================================
  // Multi-Variation Listing Methods
  // ============================================

  /**
   * Create or replace inventory item group (for multi-variation listings)
   */
  async createOrReplaceInventoryItemGroup(
    client: eBayApi,
    inventoryItemGroupKey: string,
    data: {
      title: string;
      description: string;
      imageUrls: string[];
      aspects: Record<string, string[]>;
      variantSKUs: string[];
      variesBy: {
        aspectsImageVariesBy: string[];
        specifications: Array<{ name: string; values: string[] }>;
      };
    }
  ): Promise<unknown> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Created/updated inventory item group: ${inventoryItemGroupKey}`);
      return { inventoryItemGroupKey, statusCode: 204 };
    }
    return this.withRetry(async () => {
      try {
        const response = await client.sell.inventory.createOrReplaceInventoryItemGroup(
          inventoryItemGroupKey,
          data as any
        );
        this.logger.log(`Created/updated inventory item group: ${inventoryItemGroupKey}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to create/update inventory item group ${inventoryItemGroupKey}`, error);
        throw error;
      }
    });
  }

  /**
   * Get inventory item group
   */
  async getInventoryItemGroup(client: eBayApi, inventoryItemGroupKey: string): Promise<EbayInventoryItemGroup> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched inventory item group: ${inventoryItemGroupKey}`);
      return { inventoryItemGroupKey, title: 'Mock Group', variantSKUs: [] };
    }
    return this.withRetry(async () => {
      try {
        const response = await client.sell.inventory.getInventoryItemGroup(inventoryItemGroupKey);
        this.logger.log(`Fetched inventory item group: ${inventoryItemGroupKey}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to fetch inventory item group ${inventoryItemGroupKey}`, error);
        throw error;
      }
    });
  }

  /**
   * Delete inventory item group
   */
  async deleteInventoryItemGroup(client: eBayApi, inventoryItemGroupKey: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Deleted inventory item group: ${inventoryItemGroupKey}`);
      return;
    }
    return this.withRetry(async () => {
      try {
        await client.sell.inventory.deleteInventoryItemGroup(inventoryItemGroupKey);
        this.logger.log(`Deleted inventory item group: ${inventoryItemGroupKey}`);
      } catch (error) {
        this.logger.error(`Failed to delete inventory item group ${inventoryItemGroupKey}`, error);
        throw error;
      }
    });
  }

  /**
   * Publish offer by inventory item group (for multi-variation listings)
   */
  async publishOfferByInventoryItemGroup(
    client: eBayApi,
    data: {
      inventoryItemGroupKey: string;
      marketplaceId: string;
      offers: Array<{
        sku: string;
        marketplaceId: string;
        format: string;
        availableQuantity: number;
        categoryId: string;
        listingPolicies: {
          fulfillmentPolicyId: string;
          paymentPolicyId: string;
          returnPolicyId: string;
        };
        pricingSummary: {
          price: { value: string; currency: string };
        };
        merchantLocationKey?: string;
      }>;
    }
  ): Promise<EbayPublishGroupResponse> {
    if (this.mockMode) {
      const listingId = `mock_group_listing_${Date.now()}`;
      this.logger.log(`[MOCK] Published offers by group: ${data.inventoryItemGroupKey} → ${listingId}`);
      return { listingId, offers: data.offers.map((o, i) => ({ offerId: `mock_offer_${i}`, sku: o.sku })) };
    }
    return this.withRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response = await (client.sell.inventory as any).publishOfferByInventoryItemGroup(data);
        this.logger.log(`Published offers by group: ${data.inventoryItemGroupKey}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to publish offers by group ${data.inventoryItemGroupKey}`, error);
        throw error;
      }
    });
  }

  // ============================================
  // Trading API Methods
  // ============================================

  /**
   * Get messages from eBay (Trading API)
   */
  async getMyMessages(
    client: eBayApi,
    params: { folder?: string; startTime?: string; endTime?: string; detailLevel?: string }
  ): Promise<EbayGetMyMessagesResponse> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched 0 messages from eBay`);
      return { Messages: { Message: [] } };
    }
    return this.withRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response: EbayGetMyMessagesResponse = await (client as any).trading.GetMyMessages({
          Folder: params.folder || 'Inbox',
          StartTime: params.startTime,
          EndTime: params.endTime,
          DetailLevel: params.detailLevel || 'ReturnMessages',
        });
        this.logger.log(`Fetched messages from eBay`);
        return response;
      } catch (error) {
        this.logger.error('Failed to fetch messages from eBay', error);
        throw error;
      }
    });
  }

  /**
   * Send message to buyer (Trading API)
   */
  async addMemberMessageAAQToPartner(
    client: eBayApi,
    data: { itemId: string; recipientId: string; subject: string; body: string }
  ): Promise<EbayTradingResponse> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Sent message to ${data.recipientId}`);
      return { Ack: 'Success' };
    }
    return this.withRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response: EbayTradingResponse = await (client as any).trading.AddMemberMessageAAQToPartner({
          ItemID: data.itemId,
          MemberMessage: {
            Body: data.body,
            RecipientID: [data.recipientId],
            Subject: data.subject,
            QuestionType: 'General',
          },
        });
        this.logger.log(`Sent message to ${data.recipientId}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to send message to ${data.recipientId}`, error);
        throw error;
      }
    });
  }

  /**
   * Get best offers for a listing (Trading API)
   */
  async getBestOffers(client: eBayApi, itemId: string, status?: string): Promise<EbayGetBestOffersResponse> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched best offers for item ${itemId}`);
      return { BestOfferArray: { BestOffer: [] } };
    }
    return this.withRetry(async () => {
      try {
        const params: Record<string, unknown> = { ItemID: itemId };
        if (status) params.BestOfferStatus = status;
        // TODO: remove when ebay-api types are fixed
        const response: EbayGetBestOffersResponse = await (client as any).trading.GetBestOffers(params);
        this.logger.log(`Fetched best offers for item ${itemId}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to fetch best offers for item ${itemId}`, error);
        throw error;
      }
    });
  }

  /**
   * Respond to best offer (Trading API)
   */
  async respondToBestOffer(
    client: eBayApi,
    itemId: string,
    bestOfferId: string,
    action: 'Accept' | 'Decline' | 'Counter',
    counterAmount?: number,
    sellerMessage?: string
  ): Promise<EbayTradingResponse> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Responded to best offer ${bestOfferId} with ${action}`);
      return { Ack: 'Success' };
    }
    return this.withRetry(async () => {
      try {
        const params: Record<string, unknown> = {
          ItemID: itemId,
          BestOfferID: bestOfferId,
          Action: action,
        };
        if (action === 'Counter' && counterAmount !== undefined) {
          params.CounterOfferPrice = { _value: counterAmount, _attrs: { currencyID: 'USD' } };
        }
        if (sellerMessage) params.SellerResponse = sellerMessage;
        // TODO: remove when ebay-api types are fixed
        const response: EbayTradingResponse = await (client as any).trading.RespondToBestOffer(params);
        this.logger.log(`Responded to best offer ${bestOfferId} with ${action}`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to respond to best offer ${bestOfferId}`, error);
        throw error;
      }
    });
  }

  /**
   * Get feedback (Trading API)
   */
  async getFeedback(client: eBayApi, params?: { userId?: string; entriesPerPage?: number; pageNumber?: number }): Promise<EbayGetFeedbackResponse> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched feedback`);
      return { FeedbackDetailArray: { FeedbackDetail: [] }, FeedbackScore: 0 };
    }
    return this.withRetry(async () => {
      try {
        // TODO: remove when ebay-api types are fixed
        const response: EbayGetFeedbackResponse = await (client as any).trading.GetFeedback({
          DetailLevel: 'ReturnAll',
          Pagination: {
            EntriesPerPage: params?.entriesPerPage || 25,
            PageNumber: params?.pageNumber || 1,
          },
          ...(params?.userId ? { UserID: params.userId } : {}),
        });
        this.logger.log(`Fetched feedback`);
        return response;
      } catch (error) {
        this.logger.error('Failed to fetch feedback', error);
        throw error;
      }
    });
  }

  // ============================================
  // EPS Image Upload (C1)
  // ============================================

  /**
   * Upload images to eBay Picture Services (EPS) via Media API.
   * Downloads each image from MinIO storage, then uploads the binary buffer to eBay EPS.
   * Returns array of EPS-hosted URLs (i.ebayimg.com) ready for inventory items.
   * Rate limit: 50 uploads per 5 seconds.
   */
  async uploadImagesToEps(
    connectionId: string,
    imageUrls: string[],
    mediaService: { uploadImageFromStorage: (connId: string, urlOrKey: string) => Promise<{ imageId: string; imageUrl: string }> }
  ): Promise<string[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Uploaded ${imageUrls.length} images to EPS`);
      return imageUrls.map((_, i) => `https://i.ebayimg.com/images/mock/eps_${Date.now()}_${i}/s-l1600.jpg`);
    }

    const epsUrls: string[] = [];
    const BATCH_SIZE = 10; // Process in batches to respect 50/5s rate limit

    for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
      const batch = imageUrls.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (url) => {
          try {
            const result = await mediaService.uploadImageFromStorage(connectionId, url);
            return result.imageUrl;
          } catch (error) {
            this.logger.warn(`Failed to upload image to EPS: ${url}. Using original URL.`);
            return url; // Fallback to original URL if EPS upload fails
          }
        })
      );
      epsUrls.push(...results);

      // Rate limit: wait between batches if more to process
      if (i + BATCH_SIZE < imageUrls.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.log(`Uploaded ${epsUrls.filter(u => u.includes('ebayimg.com')).length}/${imageUrls.length} images to EPS`);
    return epsUrls;
  }

  // ============================================
  // Bulk Operations (L2, L3)
  // ============================================

  /**
   * Bulk create or replace inventory items (up to 25 per call).
   */
  async bulkCreateOrReplaceInventoryItems(
    client: eBayApi,
    items: Array<{ sku: string; data: any }>
  ): Promise<{ responses: Array<{ sku: string; statusCode: number; errors?: any[] }> }> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Bulk created ${items.length} inventory items`);
      return {
        responses: items.map((item) => ({ sku: item.sku, statusCode: 200 })),
      };
    }
    return this.withRetry(async () => {
      try {
        const payload = {
          requests: items.map((item) => ({
            sku: item.sku,
            ...item.data,
          })),
        };
        const response = await (client.sell.inventory as any).bulkCreateOrReplaceInventoryItem(payload);
        this.logger.log(`Bulk created/updated ${items.length} inventory items`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to bulk create inventory items`, error);
        throw error;
      }
    }, 'sell.inventory');
  }

  /**
   * Bulk create offers (up to 25 per call).
   */
  async bulkCreateOffers(
    client: eBayApi,
    offers: Array<any>
  ): Promise<{ responses: Array<{ offerId?: string; statusCode: number; errors?: any[] }> }> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Bulk created ${offers.length} offers`);
      return {
        responses: offers.map((_, i) => ({ offerId: `mock_offer_bulk_${i}`, statusCode: 200 })),
      };
    }
    return this.withRetry(async () => {
      try {
        const response = await (client.sell.inventory as any).bulkCreateOffer({ requests: offers });
        this.logger.log(`Bulk created ${offers.length} offers`);
        return response;
      } catch (error) {
        this.logger.error(`Failed to bulk create offers`, error);
        throw error;
      }
    }, 'sell.inventory');
  }

  // ============================================
  // Bid Recommendations (M1)
  // ============================================

  /**
   * Get promoted listings bid recommendations for listings.
   * Uses the eBay Recommendation API.
   */
  async getAdRateRecommendations(
    client: eBayApi,
    listingIds: string[]
  ): Promise<Array<{ listingId: string; suggestedBidPercentage: string; trendingBidPercentage?: string }>> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Got bid recommendations for ${listingIds.length} listings`);
      return listingIds.map((id) => ({
        listingId: id,
        suggestedBidPercentage: '8.5',
        trendingBidPercentage: '7.2',
      }));
    }
    return this.withRetry(async () => {
      try {
        const response = await (client.sell as any).recommendation.findListingRecommendations({
          listingIds: listingIds.map((id) => ({ listingId: id })),
          filter: { types: ['AD'] },
        });

        const recommendations = response?.listingRecommendations || [];
        return recommendations.map((rec: any) => ({
          listingId: rec.listingId,
          suggestedBidPercentage: rec.marketing?.ad?.bidPercentages?.find((b: any) => b.basis === 'ITEM')?.value || '5.0',
          trendingBidPercentage: rec.marketing?.ad?.bidPercentages?.find((b: any) => b.basis === 'TRENDING')?.value,
        }));
      } catch (error) {
        this.logger.error('Failed to get bid recommendations', error);
        throw error;
      }
    }, 'sell.marketing');
  }

  // ============================================
  // Digital Signatures for EU/UK (C2)
  // ============================================

  /**
   * Generate digital signature headers for EU/UK seller API calls.
   * Required for: all Finances API, issueRefund (Fulfillment), Post-Order refund/cancellation methods.
   * Uses eBay's RFC9421 / RFC9530 spec.
   */
  async getDigitalSignatureHeaders(
    client: eBayApi,
    method: string,
    url: string,
    body?: string,
  ): Promise<Record<string, string>> {
    // Check if we have signing keys configured
    const privateKey = process.env['EBAY_SIGNING_PRIVATE_KEY'];
    const publicKeyJwe = process.env['EBAY_SIGNING_PUBLIC_KEY_JWE'];

    if (!privateKey || !publicKeyJwe) {
      // Not configured — only needed for EU/UK sellers
      return {};
    }

    try {
      const crypto = await import('crypto');
      const headers: Record<string, string> = {};

      // x-ebay-signature-key header (Public Key as JWE)
      headers['x-ebay-signature-key'] = publicKeyJwe;

      // Content-Digest (SHA-256 of body, only if payload exists)
      if (body) {
        const digest = crypto.createHash('sha256').update(body).digest('base64');
        headers['Content-Digest'] = `sha-256=:${digest}:`;
      }

      // Build signature base per RFC9421
      const timestamp = Math.floor(Date.now() / 1000);
      const coveredComponents = ['"@method"', '"@path"', '"@authority"'];
      if (body) coveredComponents.push('"content-digest"');

      const signatureInput = `sig1=(${coveredComponents.join(' ')});created=${timestamp}`;
      headers['Signature-Input'] = signatureInput;

      // Generate signature
      const signatureBase = coveredComponents
        .map((c) => {
          const name = c.replace(/"/g, '');
          if (name === '@method') return `"@method": ${method.toUpperCase()}`;
          if (name === '@path') return `"@path": ${new URL(url).pathname}`;
          if (name === '@authority') return `"@authority": ${new URL(url).host}`;
          if (name === 'content-digest') return `"content-digest": ${headers['Content-Digest']}`;
          return '';
        })
        .join('\n') + `\n"@signature-params": ${signatureInput}`;

      const sign = crypto.createSign('SHA256');
      sign.update(signatureBase);
      const signature = sign.sign(privateKey, 'base64');
      headers['Signature'] = `sig1=:${signature}:`;

      return headers;
    } catch (error) {
      this.logger.warn('Failed to generate digital signature headers', error);
      return {};
    }
  }
}
