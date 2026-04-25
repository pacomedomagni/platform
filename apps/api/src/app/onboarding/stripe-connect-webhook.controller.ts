import {
  Controller,
  Post,
  Headers,
  Req,
  Logger,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';
import { PrismaService } from '@platform/db';
import { StripeConnectService } from './stripe-connect.service';

@Controller('webhooks/stripe-connect')
export class StripeConnectWebhookController {
  private readonly logger = new Logger(StripeConnectWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeConnect: StripeConnectService,
  ) {}

  /**
   * POST /api/webhooks/stripe-connect
   * Handles Stripe Connect account webhooks
   */
  @Post()
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = process.env['STRIPE_CONNECT_WEBHOOK_SECRET'];
    if (!webhookSecret) {
      this.logger.error('STRIPE_CONNECT_WEBHOOK_SECRET not configured');
      throw new BadRequestException('Webhook not configured');
    }

    if (!request.rawBody) {
      throw new BadRequestException('Raw body is required');
    }

    let event: Stripe.Event;
    try {
      event = this.stripeConnect.verifyWebhookSignature(
        request.rawBody,
        signature,
        webhookSecret,
      );
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid signature');
    }

    this.logger.log(`Received Stripe Connect webhook: ${event.type}`);

    // Map the event's connected account id back to our tenant so the dedup
    // table is tenant-scoped (Phase 1 migration 20260424000000).
    const accountId = (event.account ?? (event.data.object as Stripe.Account)?.id) as
      | string
      | undefined;
    const tenant = accountId
      ? await this.prisma.tenant.findFirst({
          where: { stripeConnectAccountId: accountId },
          select: { id: true },
        })
      : null;

    if (!tenant) {
      this.logger.warn(
        `Stripe Connect webhook ${event.id} (${event.type}) has no matching tenant for account ${accountId} — acknowledging without dedup`,
      );
      return { received: true, duplicate: false };
    }

    // Webhook deduplication: prevent processing the same event twice
    const dedupeResult = await this.prisma.$queryRaw<{ already_processed: boolean }[]>`
      INSERT INTO processed_webhook_events (id, "tenantId", "eventId", "eventType", "processedAt")
      VALUES (gen_random_uuid(), ${tenant.id}, ${event.id}, ${event.type}, NOW())
      ON CONFLICT ("tenantId", "eventId") DO NOTHING
      RETURNING FALSE as already_processed
    `;

    if (!dedupeResult || dedupeResult.length === 0) {
      this.logger.log(`Duplicate Stripe Connect webhook event skipped: ${event.id}`);
      return { received: true, duplicate: true };
    }

    switch (event.type) {
      case 'account.updated':
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case 'account.application.deauthorized':
        await this.handleAccountDeauthorized(event.data.object as unknown as Stripe.Account);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handleAccountUpdated(account: Stripe.Account) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeConnectAccountId: account.id },
    });

    if (!tenant) {
      this.logger.warn(`No tenant found for Stripe account ${account.id}`);
      return;
    }

    const isActive = account.charges_enabled && account.details_submitted;

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        stripeChargesEnabled: account.charges_enabled,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeDetailsSubmitted: account.details_submitted,
        paymentProviderStatus: isActive ? 'active' : 'onboarding',
      },
    });

    this.logger.log(
      `Updated tenant ${tenant.id}: charges=${account.charges_enabled}, payouts=${account.payouts_enabled}, status=${isActive ? 'active' : 'onboarding'}`,
    );
  }

  private async handleAccountDeauthorized(account: Stripe.Account) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeConnectAccountId: account.id },
    });

    if (!tenant) return;

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        paymentProviderStatus: 'disabled',
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
      },
    });

    this.logger.log(`Deauthorized Stripe account for tenant ${tenant.id}`);
  }
}
