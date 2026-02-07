import { Controller, Post, Body, Headers, BadRequestException, Logger } from '@nestjs/common';
import { EmailPreferencesService } from './email-preferences.service';
import { PrismaService } from '@platform/db';
import * as crypto from 'crypto';

interface SendGridEvent {
  email: string;
  event: string;
  reason?: string;
  status?: string;
  sg_event_id: string;
  sg_message_id: string;
  timestamp: number;
  type?: string;
  bounce_classification?: string;
  custom_args?: Record<string, string>;
}

@Controller('webhooks/sendgrid')
export class SendGridWebhookController {
  private readonly logger = new Logger(SendGridWebhookController.name);

  private readonly verificationKey: string;

  constructor(
    private readonly preferencesService: EmailPreferencesService,
    private readonly prisma: PrismaService,
  ) {
    const key = process.env['SENDGRID_WEBHOOK_VERIFICATION_KEY'];
    const env = process.env['NODE_ENV'];

    if (!key && (env === 'production' || env === 'staging')) {
      throw new Error(
        'SENDGRID_WEBHOOK_VERIFICATION_KEY must be set in production/staging environments',
      );
    }

    this.verificationKey = key || '';
  }

  /**
   * Handle SendGrid webhook events
   * Events: bounce, dropped, spam report, unsubscribe, etc.
   *
   * Configure in SendGrid:
   * https://app.sendgrid.com/settings/mail_settings > Event Webhook
   */
  @Post('events')
  async handleWebhook(
    @Headers('X-Twilio-Email-Event-Webhook-Signature') signature: string,
    @Headers('X-Twilio-Email-Event-Webhook-Timestamp') timestamp: string,
    @Body() events: SendGridEvent[],
  ) {
    // Verify webhook signature (mandatory)
    const isValid = this.verifySignature(
      JSON.stringify(events),
      signature,
      timestamp,
    );

    if (!isValid) {
      this.logger.warn('Invalid SendGrid webhook signature');
      throw new BadRequestException('Invalid signature');
    }

    this.logger.log(`Processing ${events.length} SendGrid events`);

    // Process each event
    for (const event of events) {
      try {
        await this.processEvent(event);
      } catch (error) {
        this.logger.error(
          `Failed to process event ${event.sg_event_id}:`,
          error,
        );
        // Continue processing other events
      }
    }

    return { success: true, processed: events.length };
  }

  /**
   * Process individual SendGrid event
   */
  private async processEvent(event: SendGridEvent) {
    const { email, event: eventType, reason, custom_args } = event;
    const tenantId = custom_args?.tenantId || null;

    this.logger.debug(
      `Processing ${eventType} event for ${email} (tenant: ${tenantId || 'unknown'})`,
    );

    switch (eventType) {
      case 'bounce':
        await this.handleBounce(email, event, tenantId);
        break;

      case 'dropped':
        await this.handleDropped(email, event, tenantId);
        break;

      case 'spamreport':
        await this.handleSpamReport(email, event, tenantId);
        break;

      case 'unsubscribe':
        await this.handleUnsubscribe(email, tenantId);
        break;

      case 'group_unsubscribe':
        await this.handleGroupUnsubscribe(email, tenantId);
        break;

      default:
        // Ignore other events (delivered, open, click, etc.)
        break;
    }
  }

  /**
   * Handle bounce event
   */
  private async handleBounce(email: string, event: SendGridEvent, tenantId: string | null) {
    // Determine if it's a hard or soft bounce
    const isHardBounce =
      event.status?.startsWith('5') ||
      event.bounce_classification === 'hard' ||
      event.type === 'blocked';

    const bounceType = isHardBounce ? 'hard_bounce' : 'soft_bounce';

    // Use tenantId from custom_args, fall back to tenant-scoped DB lookup
    const resolvedTenantId = tenantId || await this.getTenantIdFromEmail(email);

    if (resolvedTenantId) {
      await this.preferencesService.recordBounce(
        resolvedTenantId,
        email,
        bounceType,
        event.reason || `Status: ${event.status}`,
      );
    }

    this.logger.log(
      `Bounce recorded: ${email} (${bounceType})`,
    );
  }

  /**
   * Handle dropped event (email was not sent)
   */
  private async handleDropped(email: string, event: SendGridEvent, tenantId: string | null) {
    const resolvedTenantId = tenantId || await this.getTenantIdFromEmail(email);

    if (resolvedTenantId) {
      await this.preferencesService.recordBounce(
        resolvedTenantId,
        email,
        'hard_bounce',
        event.reason || 'Email dropped by SendGrid',
      );
    }

    this.logger.log(`Dropped email recorded: ${email}`);
  }

  /**
   * Handle spam report
   */
  private async handleSpamReport(email: string, event: SendGridEvent, tenantId: string | null) {
    const resolvedTenantId = tenantId || await this.getTenantIdFromEmail(email);

    if (resolvedTenantId) {
      // Record as complaint/spam
      await this.preferencesService.recordBounce(
        resolvedTenantId,
        email,
        'spam',
        'User marked email as spam',
      );

      // Also unsubscribe the user from all emails
      const customer = await this.getCustomerByEmail(resolvedTenantId, email);
      if (customer) {
        await this.preferencesService.unsubscribe(resolvedTenantId, customer.id, 'all');
      }
    }

    this.logger.log(`Spam report recorded: ${email}`);
  }

  /**
   * Handle unsubscribe event
   */
  private async handleUnsubscribe(email: string, tenantId: string | null) {
    const resolvedTenantId = tenantId || await this.getTenantIdFromEmail(email);

    if (resolvedTenantId) {
      const customer = await this.getCustomerByEmail(resolvedTenantId, email);
      if (customer) {
        await this.preferencesService.unsubscribe(resolvedTenantId, customer.id, 'all');
      }
    }

    this.logger.log(`Unsubscribe recorded: ${email}`);
  }

  /**
   * Handle group unsubscribe (unsubscribe from specific category)
   */
  private async handleGroupUnsubscribe(email: string, tenantId: string | null) {
    // For now, treat group unsubscribe same as full unsubscribe
    // In future, you could map SendGrid unsubscribe groups to preference types
    await this.handleUnsubscribe(email, tenantId);
  }

  /**
   * Verify SendGrid webhook signature
   */
  private verifySignature(
    payload: string,
    signature: string,
    timestamp: string,
  ): boolean {
    try {
      if (!this.verificationKey) {
        return false; // Reject if key not configured
      }

      // SendGrid uses ECDSA with a public key, not HMAC
      const publicKey = this.verificationKey;
      const verifier = crypto.createVerify('sha256');
      verifier.update(timestamp + payload);

      return verifier.verify(publicKey, signature, 'base64');
    } catch (error) {
      this.logger.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Get tenantId from email address
   * In a real scenario, you might:
   * 1. Extract from custom_args in the event
   * 2. Query database to find customer by email
   * 3. Use email domain mapping
   */
  private async getTenantIdFromEmail(email: string): Promise<string | null> {
    try {
      // Note: This fallback lookup is only used when custom_args.tenantId
      // is not available. It may match the first tenant found for this email.
      // Prefer passing tenantId via SendGrid custom_args for accurate scoping.
      const customer = await this.prisma.storeCustomer.findFirst({
        where: { email: email.toLowerCase() },
        select: { tenantId: true },
      });

      return customer?.tenantId || null;
    } catch (error) {
      this.logger.error('Failed to get tenantId from email:', error);
      return null;
    }
  }

  /**
   * Get customer by email
   */
  private async getCustomerByEmail(tenantId: string, email: string) {
    try {
      return this.prisma.storeCustomer.findFirst({
        where: {
          tenantId,
          email: email.toLowerCase(),
        },
        select: { id: true, email: true },
      });
    } catch (error) {
      this.logger.error('Failed to get customer by email:', error);
      return null;
    }
  }
}
