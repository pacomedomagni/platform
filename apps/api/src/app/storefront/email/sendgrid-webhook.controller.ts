import { Controller, Post, Body, Headers, BadRequestException, Logger } from '@nestjs/common';
import { EmailPreferencesService } from './email-preferences.service';
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
}

@Controller('webhooks/sendgrid')
export class SendGridWebhookController {
  private readonly logger = new Logger(SendGridWebhookController.name);

  constructor(private readonly preferencesService: EmailPreferencesService) {}

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
    // Verify webhook signature (optional but recommended)
    if (process.env['SENDGRID_WEBHOOK_VERIFICATION_KEY']) {
      const isValid = this.verifySignature(
        JSON.stringify(events),
        signature,
        timestamp,
      );

      if (!isValid) {
        this.logger.warn('Invalid SendGrid webhook signature');
        throw new BadRequestException('Invalid signature');
      }
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
    const { email, event: eventType, reason } = event;

    this.logger.debug(
      `Processing ${eventType} event for ${email}`,
    );

    switch (eventType) {
      case 'bounce':
        await this.handleBounce(email, event);
        break;

      case 'dropped':
        await this.handleDropped(email, event);
        break;

      case 'spamreport':
        await this.handleSpamReport(email, event);
        break;

      case 'unsubscribe':
        await this.handleUnsubscribe(email);
        break;

      case 'group_unsubscribe':
        await this.handleGroupUnsubscribe(email);
        break;

      default:
        // Ignore other events (delivered, open, click, etc.)
        break;
    }
  }

  /**
   * Handle bounce event
   */
  private async handleBounce(email: string, event: SendGridEvent) {
    // Determine if it's a hard or soft bounce
    const isHardBounce =
      event.status?.startsWith('5') ||
      event.bounce_classification === 'hard' ||
      event.type === 'blocked';

    const bounceType = isHardBounce ? 'hard_bounce' : 'soft_bounce';

    // Try to extract tenantId from custom args or use a default
    // In production, you'd want to include tenantId in SendGrid custom_args
    const tenantId = await this.getTenantIdFromEmail(email);

    if (tenantId) {
      await this.preferencesService.recordBounce(
        tenantId,
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
  private async handleDropped(email: string, event: SendGridEvent) {
    const tenantId = await this.getTenantIdFromEmail(email);

    if (tenantId) {
      await this.preferencesService.recordBounce(
        tenantId,
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
  private async handleSpamReport(email: string, event: SendGridEvent) {
    const tenantId = await this.getTenantIdFromEmail(email);

    if (tenantId) {
      // Record as complaint/spam
      await this.preferencesService.recordBounce(
        tenantId,
        email,
        'spam',
        'User marked email as spam',
      );

      // Also unsubscribe the user from all emails
      const customer = await this.getCustomerByEmail(tenantId, email);
      if (customer) {
        await this.preferencesService.unsubscribe(tenantId, customer.id, 'all');
      }
    }

    this.logger.log(`Spam report recorded: ${email}`);
  }

  /**
   * Handle unsubscribe event
   */
  private async handleUnsubscribe(email: string) {
    const tenantId = await this.getTenantIdFromEmail(email);

    if (tenantId) {
      const customer = await this.getCustomerByEmail(tenantId, email);
      if (customer) {
        await this.preferencesService.unsubscribe(tenantId, customer.id, 'all');
      }
    }

    this.logger.log(`Unsubscribe recorded: ${email}`);
  }

  /**
   * Handle group unsubscribe (unsubscribe from specific category)
   */
  private async handleGroupUnsubscribe(email: string) {
    // For now, treat group unsubscribe same as full unsubscribe
    // In future, you could map SendGrid unsubscribe groups to preference types
    await this.handleUnsubscribe(email);
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
      const verificationKey = process.env['SENDGRID_WEBHOOK_VERIFICATION_KEY'];
      if (!verificationKey) {
        return true; // Skip verification if key not configured
      }

      const timestampedPayload = timestamp + payload;
      const expectedSignature = crypto
        .createHmac('sha256', verificationKey)
        .update(timestampedPayload)
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
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
      // Import PrismaService dynamically to avoid circular deps
      const { PrismaService } = await import('@platform/db');
      const prisma = new PrismaService();

      const customer = await prisma.storeCustomer.findFirst({
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
      const { PrismaService } = await import('@platform/db');
      const prisma = new PrismaService();

      return prisma.storeCustomer.findFirst({
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
