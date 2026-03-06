import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
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
    private notificationService: EbayNotificationService
  ) {}

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
   * POST /api/marketplace/ebay/webhooks/account-deletion
   */
  @Post('account-deletion')
  async handleAccountDeletion(@Req() req: Request, @Res() res: Response) {
    const signatureHeader = req.headers['x-ebay-signature'] as string;
    const body =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const parsedBody =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const timestamp = parsedBody?.metadata?.timestamp || '';

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
      timestamp
    );

    if (!isValid) {
      this.logger.warn('Account deletion webhook signature verification failed');
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: 'Invalid signature' });
    }

    try {
      await this.webhookService.handleAccountDeletion(parsedBody);
      this.logger.log('Account deletion webhook processed successfully');
      return res.status(HttpStatus.OK).json({ status: 'ok' });
    } catch (error) {
      this.logger.error('Failed to process account deletion webhook', error);
      // Return 200 to eBay so it does not retry endlessly; log the error internally
      return res.status(HttpStatus.OK).json({ status: 'ok' });
    }
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
  async handleNotification(@Req() req: Request, @Res() res: Response) {
    const signatureHeader = req.headers['x-ebay-signature'] as string;
    const body =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const parsedBody =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const timestamp = parsedBody?.metadata?.timestamp || '';

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
      timestamp
    );

    if (!isValid) {
      this.logger.warn('Notification webhook signature verification failed');
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: 'Invalid signature' });
    }

    try {
      const topic = parsedBody?.metadata?.topic || parsedBody?.topic || 'UNKNOWN';
      this.logger.log(`Processing eBay notification: ${topic}`);

      // Acknowledge immediately; route to notification handling asynchronously
      // to avoid eBay timeouts on long-running processing.
      this.routeNotification(parsedBody).catch((error) => {
        this.logger.error(
          `Failed to process eBay notification (topic: ${topic})`,
          error
        );
      });

      return res.status(HttpStatus.OK).json({ status: 'ok' });
    } catch (error) {
      this.logger.error('Failed to handle notification webhook', error);
      // Return 200 to eBay so it does not retry endlessly; log the error internally
      return res.status(HttpStatus.OK).json({ status: 'ok' });
    }
  }

  /**
   * Route the notification to the appropriate handler based on topic.
   * Account deletion is handled by EbayWebhookService directly;
   * other notification types can be extended here.
   */
  private async routeNotification(notification: any): Promise<void> {
    const topic =
      notification?.metadata?.topic || notification?.topic || 'UNKNOWN';

    switch (topic) {
      case 'MARKETPLACE_ACCOUNT_DELETION':
        await this.webhookService.handleAccountDeletion(notification);
        break;

      case 'ORDER_CREATED':
      case 'ORDER_UPDATED':
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
