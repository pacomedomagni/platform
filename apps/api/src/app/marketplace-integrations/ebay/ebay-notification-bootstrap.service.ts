import { Injectable, Logger } from '@nestjs/common';

/**
 * H6: programmatic notification destination + subscription bootstrap.
 *
 * Subscribing to platform notifications is a one-time, platform-wide
 * operation — NOT per-tenant. The flow is:
 *
 *   1. Mint an app-only access token (client_credentials grant) scoped to
 *      `commerce.notification`. App tokens are platform-wide and have
 *      no user context.
 *   2. POST /commerce/notification/v1/destination — register our HTTPS
 *      endpoint plus the eBay verification token. eBay validates the
 *      endpoint by issuing a GET ?challenge_code=... handshake; we
 *      respond with sha256(challenge||token||endpoint) hex. The
 *      verification-token field must be 32–80 ASCII chars (letters,
 *      digits, underscore, dash).
 *   3. POST /commerce/notification/v1/subscription per topic — bind the
 *      destination to each topic we care about (ITEM_SOLD, RETURN_*,
 *      PAYOUT_*, CASE_*, etc. — see TOPICS below).
 *   4. POST /commerce/notification/v1/subscription/{id}/enable for each.
 *
 * Idempotency: re-running is safe. If a destination already exists, we
 * reuse it (eBay returns 409 / "destinationName already exists" — that's
 * a no-op). Same for subscriptions.
 *
 * MARKETPLACE_ACCOUNT_DELETION is special: it's configured in the eBay
 * Developer Dashboard, not via this API. We log a reminder.
 */
@Injectable()
export class EbayNotificationBootstrapService {
  private readonly logger = new Logger(EbayNotificationBootstrapService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  /**
   * M-T2: app-only access token cache. App tokens have a 2 h lifetime
   * and no refresh token — re-minting on every call burns the
   * identity / oauth2.token daily quota for nothing. The cache is
   * platform-wide (no tenant context) and is OK to live in-memory:
   * the only consumers are this bootstrap service + signature
   * verification's getPublicKey (which has its own cache); a pod
   * restart re-mints, which is fine.
   */
  private appTokenCache: { token: string; expiresAt: number } | null = null;

  /**
   * Topics we subscribe to. These are the ones that ACTUALLY exist in
   * eBay's Sell Notification API as of 2026. Order detection is NOT here
   * — there is no ORDER_CREATED / ORDER_UPDATED topic; the
   * EbayOrderSyncService 15-min poll covers that.
   */
  private static readonly TOPICS: readonly string[] = [
    // Item lifecycle
    'ITEM_SOLD',
    'ITEM_OUT_OF_STOCK',
    'ITEM_CLOSED',
    // Returns
    'RETURN_CREATED',
    'RETURN_UPDATED',
    'RETURN_CLOSED',
    // Cancellations
    'BUYER_CANCEL_REQUESTED',
    'BUYER_CANCEL_CLOSED',
    // Money-Back-Guarantee cases
    'CASE_CREATED',
    'CASE_UPDATED',
    // Payment disputes
    'PAYMENT_DISPUTE_CREATED',
    'PAYMENT_DISPUTE_UPDATED',
    // Payouts
    'PAYOUT_INITIATED',
    'PAYOUT_FAILED',
    // Feedback
    'FEEDBACK_RECEIVED',
  ];

  private get apiBaseUrl(): string {
    return process.env['EBAY_SANDBOX'] === 'true'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
  }

  /**
   * Run the full bootstrap. Returns a report with the destination id, the
   * topics subscribed (each with its subscription id), and any per-step
   * errors.
   */
  async bootstrap(opts?: {
    endpointUrl?: string;
    verificationToken?: string;
    destinationName?: string;
  }): Promise<{
    destinationId: string | null;
    subscriptions: Array<{ topic: string; subscriptionId: string | null; status: 'created' | 'exists' | 'failed'; error?: string }>;
    skipped: string[];
    notes: string[];
  }> {
    const notes: string[] = [];
    const subscriptions: Array<{ topic: string; subscriptionId: string | null; status: 'created' | 'exists' | 'failed'; error?: string }> = [];
    const skipped: string[] = [];

    const endpointUrl = opts?.endpointUrl ?? process.env['EBAY_WEBHOOK_ENDPOINT'];
    const verificationToken = opts?.verificationToken ?? process.env['EBAY_VERIFICATION_TOKEN'];
    const destinationName = opts?.destinationName ?? 'platform-notifications';

    if (!endpointUrl || !verificationToken) {
      throw new Error(
        'EBAY_WEBHOOK_ENDPOINT and EBAY_VERIFICATION_TOKEN must both be set before bootstrapping notifications',
      );
    }
    if (!/^[A-Za-z0-9_-]{32,80}$/.test(verificationToken)) {
      throw new Error(
        'EBAY_VERIFICATION_TOKEN must be 32–80 chars and contain only letters, digits, underscores, or hyphens',
      );
    }
    if (!endpointUrl.startsWith('https://')) {
      throw new Error('EBAY_WEBHOOK_ENDPOINT must be an https:// URL');
    }

    if (this.mockMode) {
      this.logger.log('[MOCK] Skipping notification bootstrap');
      return {
        destinationId: 'mock-destination',
        subscriptions: EbayNotificationBootstrapService.TOPICS.map((t) => ({
          topic: t,
          subscriptionId: `mock-sub-${t}`,
          status: 'created' as const,
        })),
        skipped: ['MARKETPLACE_ACCOUNT_DELETION (configure in dev portal)'],
        notes: [],
      };
    }

    const appToken = await this.mintAppToken();

    // Step 1: ensure destination.
    let destinationId: string | null = null;
    try {
      destinationId = await this.ensureDestination(
        appToken,
        destinationName,
        endpointUrl,
        verificationToken,
      );
    } catch (err) {
      this.logger.error(
        `Destination bootstrap failed: ${(err as Error)?.message ?? err}`,
      );
      throw err;
    }

    // Step 2: subscribe + enable per topic.
    for (const topic of EbayNotificationBootstrapService.TOPICS) {
      try {
        const result = await this.ensureSubscription(appToken, destinationId, topic);
        subscriptions.push(result);
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        subscriptions.push({ topic, subscriptionId: null, status: 'failed', error: msg });
        this.logger.warn(`Subscription for ${topic} failed: ${msg}`);
      }
    }

    // MARKETPLACE_ACCOUNT_DELETION is a developer-portal config, not API.
    skipped.push('MARKETPLACE_ACCOUNT_DELETION');
    notes.push(
      'Configure MARKETPLACE_ACCOUNT_DELETION in the eBay developer dashboard: ' +
        'Application Keys → Alerts and Notifications → Marketplace Account Deletion → ' +
        `set endpoint=${endpointUrl} and verification token`,
    );

    return { destinationId, subscriptions, skipped, notes };
  }

  /**
   * client_credentials grant. App-only token, 2h lifetime, no refresh.
   * Cached in-process (M-T2) to avoid re-minting on every bootstrap call
   * or signature-key fetch.
   */
  async mintAppToken(): Promise<string> {
    const now = Date.now();
    if (this.appTokenCache && now < this.appTokenCache.expiresAt) {
      return this.appTokenCache.token;
    }

    const appId = process.env['EBAY_APP_ID'];
    const certId = process.env['EBAY_CERT_ID'];
    if (!appId || !certId) {
      throw new Error('EBAY_APP_ID and EBAY_CERT_ID must be configured');
    }
    const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');
    const scope = 'https://api.ebay.com/oauth/api_scope';

    const response = await fetch(`${this.apiBaseUrl}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '<no body>');
      throw new Error(`client_credentials token mint failed: ${response.status} ${text}`);
    }

    const tokens = (await response.json()) as { access_token: string; expires_in: number };
    // expires_in is seconds; cache with a 60 s safety margin.
    this.appTokenCache = {
      token: tokens.access_token,
      expiresAt: now + Math.max(0, (tokens.expires_in - 60) * 1000),
    };
    return tokens.access_token;
  }

  private async ensureDestination(
    appToken: string,
    name: string,
    endpointUrl: string,
    verificationToken: string,
  ): Promise<string> {
    // First try to find an existing destination with this name (idempotency).
    const existing = await this.findDestinationByName(appToken, name);
    if (existing) {
      this.logger.log(`Re-using existing eBay notification destination: ${existing.destinationId} (${name})`);
      return existing.destinationId;
    }

    const response = await fetch(
      `${this.apiBaseUrl}/commerce/notification/v1/destination`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          status: 'ENABLED',
          endpoint: {
            url: endpointUrl,
            verificationToken,
          },
        }),
      },
    );

    if (response.status === 201 || response.status === 200) {
      // eBay returns the new destination id in the Location header
      // (/commerce/notification/v1/destination/{id}). Body sometimes empty.
      const location = response.headers.get('location') || '';
      const idFromLocation = location.split('/').pop();
      if (idFromLocation) {
        this.logger.log(`Created eBay notification destination: ${idFromLocation}`);
        return idFromLocation;
      }
      // Fallback: re-list and find by name.
      const refound = await this.findDestinationByName(appToken, name);
      if (refound) return refound.destinationId;
      throw new Error('Destination created but eBay returned no id and re-list could not find it');
    }

    const text = await response.text().catch(() => '<no body>');
    throw new Error(`createDestination -> ${response.status} ${text}`);
  }

  private async findDestinationByName(
    appToken: string,
    name: string,
  ): Promise<{ destinationId: string } | null> {
    const response = await fetch(
      `${this.apiBaseUrl}/commerce/notification/v1/destination?limit=200`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${appToken}`, Accept: 'application/json' },
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { destinations?: Array<{ destinationId: string; name?: string }> };
    return (data.destinations ?? []).find((d) => d.name === name) ?? null;
  }

  private async ensureSubscription(
    appToken: string,
    destinationId: string,
    topic: string,
  ): Promise<{ topic: string; subscriptionId: string | null; status: 'created' | 'exists' | 'failed' }> {
    // Look for an existing subscription on this (destinationId, topic).
    const existing = await this.findSubscription(appToken, destinationId, topic);
    if (existing) {
      // Make sure it's enabled.
      if (existing.status !== 'ENABLED') {
        await this.enableSubscription(appToken, existing.subscriptionId);
      }
      return { topic, subscriptionId: existing.subscriptionId, status: 'exists' };
    }

    const createResponse = await fetch(
      `${this.apiBaseUrl}/commerce/notification/v1/subscription`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicId: topic,
          status: 'ENABLED',
          destinationId,
          payload: { format: 'JSON', schemaVersion: '1.0' },
        }),
      },
    );

    if (createResponse.status === 201 || createResponse.status === 200) {
      const location = createResponse.headers.get('location') || '';
      const id = location.split('/').pop();
      if (id) return { topic, subscriptionId: id, status: 'created' };
      // Fallback: re-list
      const refound = await this.findSubscription(appToken, destinationId, topic);
      if (refound) return { topic, subscriptionId: refound.subscriptionId, status: 'created' };
      throw new Error('Subscription created but eBay returned no id');
    }

    const text = await createResponse.text().catch(() => '<no body>');
    throw new Error(`createSubscription(${topic}) -> ${createResponse.status} ${text}`);
  }

  private async findSubscription(
    appToken: string,
    destinationId: string,
    topic: string,
  ): Promise<{ subscriptionId: string; status: string } | null> {
    const response = await fetch(
      `${this.apiBaseUrl}/commerce/notification/v1/subscription?topic_id=${encodeURIComponent(topic)}&limit=200`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${appToken}`, Accept: 'application/json' },
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      subscriptions?: Array<{ subscriptionId: string; destinationId: string; topicId?: string; status: string }>;
    };
    const match = (data.subscriptions ?? []).find(
      (s) => s.destinationId === destinationId && (s.topicId ?? topic) === topic,
    );
    return match ? { subscriptionId: match.subscriptionId, status: match.status } : null;
  }

  private async enableSubscription(appToken: string, subscriptionId: string): Promise<void> {
    const response = await fetch(
      `${this.apiBaseUrl}/commerce/notification/v1/subscription/${subscriptionId}/enable`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${appToken}` },
      },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '<no body>');
      this.logger.warn(`Failed to enable subscription ${subscriptionId}: ${response.status} ${text}`);
    }
  }
}
