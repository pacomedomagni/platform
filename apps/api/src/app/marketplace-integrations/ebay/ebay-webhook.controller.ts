import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  HttpStatus,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PrismaService, bypassTenantGuard } from '@platform/db';
import { Prisma } from '@prisma/client';
import { EbayWebhookService } from './ebay-webhook.service';
import { EbayNotificationService } from './ebay-notification.service';

/**
 * eBay Webhook Controller
 * Handles incoming webhook notifications from eBay.
 * These endpoints are called externally by eBay and do NOT use AuthGuard.
 * Signature verification is performed via the X-EBAY-SIGNATURE header.
 */
@Controller('marketplace/ebay/webhooks')
@Throttle({ short: { limit: 30, ttl: 1000 } })
export class EbayWebhookController {
  private readonly logger = new Logger(EbayWebhookController.name);

  constructor(
    private webhookService: EbayWebhookService,
    private notificationService: EbayNotificationService,
    private prisma: PrismaService,
  ) {}

  /**
   * H9: persist a verified webhook in the DLQ before dispatching. eBay
   * does not retry inbound notifications, so a single handler crash =
   * permanent data loss without this row. The dedup unique on
   * `externalEventId` also protects against eBay re-delivery storms
   * (the Redis-backed dedup in EbayNotificationService is still the
   * primary guard, but it has TTL — this is the durable backstop).
   *
   * Returns the persisted row's id; null on persistence failure (logged
   * and swallowed — we never want DLQ failure to block ACKing eBay).
   */
  private async recordWebhookEvent(args: {
    topic: string;
    rawBody: string;
    headers: Record<string, string>;
    externalEventId: string | null;
  }): Promise<string | null> {
    try {
      const row = await bypassTenantGuard(() =>
        this.prisma.marketplaceWebhookEvent.create({
          data: {
            platform: 'EBAY',
            topic: args.topic,
            externalEventId: args.externalEventId,
            rawBody: args.rawBody,
            headers: args.headers as Prisma.InputJsonValue,
            status: 'received',
          },
          select: { id: true },
        }),
      );
      return row.id;
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      // Unique violation on externalEventId = legitimate re-delivery; not
      // an error, just don't re-dispatch.
      if (
        msg.includes('Unique constraint') ||
        msg.includes('marketplace_webhook_events_externalEventId_key')
      ) {
        this.logger.log(
          `Webhook ${args.externalEventId} already in DLQ — skipping duplicate dispatch`,
        );
        return null;
      }
      this.logger.error(`Failed to persist webhook to DLQ: ${msg}`);
      return null;
    }
  }

  /**
   * H9: mark a DLQ row done/failed after dispatch completes.
   */
  private async markWebhookEventResult(
    eventId: string | null,
    succeeded: boolean,
    error?: unknown,
  ): Promise<void> {
    if (!eventId) return;
    try {
      await bypassTenantGuard(() =>
        this.prisma.marketplaceWebhookEvent.update({
          where: { id: eventId },
          data: {
            status: succeeded ? 'done' : 'failed',
            processedAt: new Date(),
            lastAttemptAt: new Date(),
            attempts: { increment: 1 },
            errorMessage: succeeded
              ? null
              : ((error as Error)?.message ?? String(error)).slice(0, 2000),
          },
        }),
      );
    } catch (err) {
      this.logger.warn(`Failed to update DLQ row ${eventId}: ${(err as Error)?.message ?? err}`);
    }
  }

  /**
   * Account deletion challenge handshake.
   * eBay sends a GET with `challenge_code` query param to verify the endpoint.
   * GET /api/marketplace/ebay/webhooks/account-deletion?challenge_code=xxx
   */
  @Get('account-deletion')
  async accountDeletionChallenge(
    @Query('challenge_code') challengeCode: string,
    @Res() res: Response
  ) {
    if (!challengeCode) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'challenge_code query parameter is required' });
    }

    const challengeResponse =
      this.webhookService.computeChallengeResponse(challengeCode);

    this.logger.log('Responded to eBay account-deletion challenge handshake');

    return res.status(HttpStatus.OK).json({ challengeResponse });
  }

  /**
   * Account deletion notification.
   * eBay sends a POST when a user requests account deletion.
   *
   * Pattern: verify signature SYNCHRONOUSLY (microseconds — cached pub key +
   * one ECDSA verify), 401 on missing/invalid, 200 + async processing on
   * valid. eBay does not retry inbound notifications, so a silent drop
   * after a 200 is permanent data loss — verifying before the ACK is the
   * only way to surface bad signatures (e.g. misconfigured verification
   * token, key rotation drift) as a 4xx eBay can flag on the dev dashboard.
   *
   * POST /api/marketplace/ebay/webhooks/account-deletion
   */
  @Post('account-deletion')
  async handleAccountDeletion(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const signatureHeader = req.headers['x-ebay-signature'] as string;

    // ECDSA verification is byte-exact. NestJS exposes req.rawBody when
    // bootstrapped with `rawBody: true` (see main.ts). Re-stringifying a
    // parsed JSON body would produce different bytes than eBay sent
    // (key ordering, whitespace, unicode escaping), causing verification
    // to fail intermittently in production.
    if (!req.rawBody) {
      this.logger.error(
        'CRITICAL: Account deletion webhook received without rawBody — bootstrap must enable rawBody:true. Returning 500 so eBay marks the delivery failed.'
      );
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: 'raw body unavailable' });
    }
    const body = req.rawBody.toString('utf8');

    if (!signatureHeader) {
      this.logger.warn(
        'Account deletion webhook received without X-EBAY-SIGNATURE header'
      );
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: 'Missing signature header' });
    }

    const isValid = await this.webhookService.verifySignature(
      body,
      signatureHeader,
    );

    if (!isValid) {
      this.logger.warn('Account deletion webhook signature verification failed');
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: 'Invalid signature' });
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(body);
    } catch (error) {
      this.logger.error('Account deletion webhook had unparseable JSON body', error);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'Malformed JSON body' });
    }

    // H9: persist to DLQ BEFORE dispatching. If the handler crashes, the
    // row sits in `failed` with the rawBody available for replay.
    const externalEventId =
      parsedBody?.notification?.notificationId ??
      parsedBody?.metadata?.notificationId ??
      null;
    const dlqId = await this.recordWebhookEvent({
      topic: 'MARKETPLACE_ACCOUNT_DELETION',
      rawBody: body,
      headers: { 'x-ebay-signature': signatureHeader },
      externalEventId,
    });

    // ACK immediately, process async — eBay expects <10s response.
    res.status(HttpStatus.OK).json({ status: 'ok' });

    this.webhookService
      .handleAccountDeletion(parsedBody)
      .then(() => this.markWebhookEventResult(dlqId, true))
      .catch((error) => {
        this.logger.error('Failed to process account deletion webhook asynchronously', error);
        return this.markWebhookEventResult(dlqId, false, error);
      });
  }

  /**
   * Notification challenge handshake.
   * eBay sends a GET with `challenge_code` query param to verify the endpoint.
   * GET /api/marketplace/ebay/webhooks/notifications?challenge_code=xxx
   */
  @Get('notifications')
  async notificationChallenge(
    @Query('challenge_code') challengeCode: string,
    @Res() res: Response
  ) {
    if (!challengeCode) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'challenge_code query parameter is required' });
    }

    const challengeResponse =
      this.webhookService.computeChallengeResponse(challengeCode);

    this.logger.log('Responded to eBay notifications challenge handshake');

    return res.status(HttpStatus.OK).json({ challengeResponse });
  }

  /**
   * Notification webhook handler.
   * eBay sends a POST for marketplace notifications (order updates, item changes, etc.).
   * POST /api/marketplace/ebay/webhooks/notifications
   */
  @Post('notifications')
  async handleNotification(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const signatureHeader = req.headers['x-ebay-signature'] as string;

    if (!req.rawBody) {
      this.logger.error(
        'CRITICAL: Notification webhook received without rawBody — bootstrap must enable rawBody:true. Returning 500 so eBay marks the delivery failed.'
      );
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: 'raw body unavailable' });
    }
    const body = req.rawBody.toString('utf8');

    if (!signatureHeader) {
      this.logger.warn(
        'Notification webhook received without X-EBAY-SIGNATURE header'
      );
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: 'Missing signature header' });
    }

    const isValid = await this.webhookService.verifySignature(
      body,
      signatureHeader,
    );

    if (!isValid) {
      this.logger.warn('Notification webhook signature verification failed');
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: 'Invalid signature' });
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(body);
    } catch (error) {
      this.logger.error('Notification webhook had unparseable JSON body', error);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'Malformed JSON body' });
    }

    const topic = parsedBody?.metadata?.topic || parsedBody?.topic || 'UNKNOWN';
    this.logger.log(`Processing eBay notification: ${topic}`);

    // H9: persist to DLQ BEFORE dispatching.
    const externalEventId =
      parsedBody?.metadata?.notificationId ??
      parsedBody?.metadata?.eventId ??
      parsedBody?.notificationId ??
      null;
    const dlqId = await this.recordWebhookEvent({
      topic,
      rawBody: body,
      headers: { 'x-ebay-signature': signatureHeader },
      externalEventId,
    });

    // ACK immediately; route async to keep response <10s.
    this.routeNotification(topic, parsedBody)
      .then(() => this.markWebhookEventResult(dlqId, true))
      .catch((error) => {
      this.logger.error(
        `Failed to process eBay notification (topic: ${topic})`,
        error
      );
      this.markWebhookEventResult(dlqId, false, error);
    });

    return res.status(HttpStatus.OK).json({ status: 'ok' });
  }

  /**
   * Dispatch a verified notification to its handler.
   *
   * Topic catalogue (Sell Notification API, EBAY_US, as of 2026):
   *   - MARKETPLACE_ACCOUNT_DELETION (legally required)
   *   - ITEM_SOLD, ITEM_OUT_OF_STOCK, ITEM_CLOSED
   *   - RETURN_CREATED, RETURN_UPDATED, RETURN_CLOSED
   *   - BUYER_CANCEL_REQUESTED, BUYER_CANCEL_CLOSED
   *   - CASE_CREATED, CASE_UPDATED (Money Back Guarantee)
   *   - PAYMENT_DISPUTE_CREATED, PAYMENT_DISPUTE_UPDATED
   *   - PAYOUT_INITIATED, PAYOUT_FAILED
   *   - FEEDBACK_RECEIVED
   *
   * There is NO ORDER_CREATED / ORDER_UPDATED topic — order detection is
   * via the 15-min getOrders poll (EbayOrderSyncService). Routes for those
   * topic strings are deliberately absent.
   */
  private async routeNotification(topic: string, notification: any): Promise<void> {
    switch (topic) {
      case 'MARKETPLACE_ACCOUNT_DELETION':
        await this.webhookService.handleAccountDeletion(notification);
        break;

      case 'ITEM_SOLD':
      case 'ITEM_OUT_OF_STOCK':
      case 'RETURN_CREATED':
      case 'RETURN_UPDATED':
        await this.notificationService.processNotification(topic, notification);
        break;

      default:
        this.logger.log(
          `Received unhandled eBay notification topic: ${topic}`
        );
        break;
    }
  }
}
