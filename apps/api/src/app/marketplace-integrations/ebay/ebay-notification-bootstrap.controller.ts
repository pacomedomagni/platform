import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { PrismaService, bypassTenantGuard } from '@platform/db';
import { EbayNotificationBootstrapService } from './ebay-notification-bootstrap.service';
import { EbayWebhookService } from './ebay-webhook.service';
import { EbayNotificationService } from './ebay-notification.service';

/**
 * H6: admin endpoint to bootstrap eBay platform notifications.
 *
 * Notification subscription is PLATFORM-WIDE — one destination, N
 * subscriptions, all bound to the same `EBAY_APP_ID`. This endpoint is
 * meant to be run once per environment (sandbox + prod) after the app
 * credentials and webhook endpoint URL are in place. It's idempotent:
 * re-running with the same env vars is a no-op.
 *
 * NOT a per-tenant operation. Restricted to platform admins.
 */
@Controller('marketplace/ebay/admin/notifications')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ default: { limit: 5, ttl: 60_000 } })
export class EbayNotificationBootstrapController {
  constructor(
    private bootstrapService: EbayNotificationBootstrapService,
    private prisma: PrismaService,
    private webhookService: EbayWebhookService,
    private notificationService: EbayNotificationService,
  ) {}

  /**
   * Bootstrap (or repair) the platform notification destination and
   * subscriptions for ITEM_*, RETURN_*, BUYER_CANCEL_*, CASE_*,
   * PAYMENT_DISPUTE_*, PAYOUT_*, FEEDBACK_RECEIVED.
   *
   * MARKETPLACE_ACCOUNT_DELETION is not bootstrapped here — eBay only
   * lets you configure that one through the developer-portal UI.
   *
   * POST /api/marketplace/ebay/admin/notifications/bootstrap
   * Body (optional): { endpointUrl?, verificationToken?, destinationName? }
   */
  @Post('bootstrap')
  @Roles('admin', 'System Manager')
  async bootstrap(
    @Body()
    body: {
      endpointUrl?: string;
      verificationToken?: string;
      destinationName?: string;
    } = {},
  ) {
    try {
      return await this.bootstrapService.bootstrap(body);
    } catch (err) {
      throw new HttpException(
        { error: (err as Error)?.message ?? String(err) },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * H9: list webhook DLQ rows. Filterable by status + platform.
   * Returns the most recent first, capped at `limit` (default 50,
   * max 200). The rawBody column is intentionally truncated server-
   * side — the admin UI fetches the full body via `/dlq/:id` when
   * the operator clicks into a row, to keep the list lightweight.
   *
   * GET /api/marketplace/ebay/admin/notifications/dlq?status=failed&limit=50
   */
  @Get('dlq')
  @Roles('admin', 'System Manager')
  async listDlq(
    @Query('status') status?: string,
    @Query('topic') topic?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(Math.max(parseInt(limit ?? '50', 10) || 50, 1), 200);
    const where: any = { platform: 'EBAY' };
    if (status && ['received', 'processing', 'done', 'failed'].includes(status)) {
      where.status = status;
    }
    if (topic) {
      where.topic = topic;
    }

    const rows = await bypassTenantGuard(() =>
      this.prisma.marketplaceWebhookEvent.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take,
        select: {
          id: true,
          tenantId: true,
          topic: true,
          externalEventId: true,
          status: true,
          receivedAt: true,
          processedAt: true,
          attempts: true,
          lastAttemptAt: true,
          errorMessage: true,
        },
      }),
    );

    return { rows, count: rows.length };
  }

  /**
   * H9: full payload for a single DLQ row, including rawBody — used by
   * the admin UI when the operator drills into a failure to read the
   * eBay payload that caused the crash.
   *
   * GET /api/marketplace/ebay/admin/notifications/dlq/:id
   */
  @Get('dlq/:id')
  @Roles('admin', 'System Manager')
  async getDlqRow(@Param('id') id: string) {
    const row = await bypassTenantGuard(() =>
      this.prisma.marketplaceWebhookEvent.findUnique({ where: { id } }),
    );
    if (!row) {
      throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
    }
    return row;
  }

  /**
   * H9: replay a DLQ row. Re-dispatches the persisted payload through
   * the same handler the original webhook hit. Used by ops to recover
   * from handler-side bugs after a fix is deployed.
   *
   * Replay does NOT re-verify the signature — the row only exists in
   * the DLQ because verification succeeded the first time. Re-verifying
   * would require re-fetching the public key for an old kid that may
   * have rotated, and we'd lose data we already trust.
   *
   * POST /api/marketplace/ebay/admin/notifications/dlq/:id/replay
   */
  @Post('dlq/:id/replay')
  @Roles('admin', 'System Manager')
  async replayDlq(@Param('id') id: string) {
    const row = await bypassTenantGuard(() =>
      this.prisma.marketplaceWebhookEvent.findUnique({ where: { id } }),
    );
    if (!row) {
      throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(row.rawBody);
    } catch (err) {
      throw new HttpException(
        { error: 'Stored rawBody is not valid JSON; cannot replay' },
        HttpStatus.BAD_REQUEST,
      );
    }

    await bypassTenantGuard(() =>
      this.prisma.marketplaceWebhookEvent.update({
        where: { id: row.id },
        data: { status: 'processing', lastAttemptAt: new Date(), attempts: { increment: 1 } },
      }),
    );

    try {
      if (row.topic === 'MARKETPLACE_ACCOUNT_DELETION') {
        await this.webhookService.handleAccountDeletion(parsed);
      } else {
        await this.notificationService.processNotification(row.topic, parsed);
      }
      await bypassTenantGuard(() =>
        this.prisma.marketplaceWebhookEvent.update({
          where: { id: row.id },
          data: { status: 'done', processedAt: new Date(), errorMessage: null },
        }),
      );
      return { ok: true, id: row.id };
    } catch (err) {
      const msg = ((err as Error)?.message ?? String(err)).slice(0, 2000);
      await bypassTenantGuard(() =>
        this.prisma.marketplaceWebhookEvent.update({
          where: { id: row.id },
          data: { status: 'failed', errorMessage: msg },
        }),
      );
      throw new HttpException(
        { error: 'Replay failed', detail: msg },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
