import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '@platform/db';

@Injectable()
export class StripeConnectService {
  private readonly stripe: Stripe | null;
  private readonly logger = new Logger(StripeConnectService.name);

  constructor(private readonly prisma: PrismaService) {
    const secretKey = process.env['STRIPE_SECRET_KEY'];
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2026-01-28.clover' as Stripe.LatestApiVersion,
      });
      this.logger.log('Stripe Connect initialized');
    } else {
      this.stripe = null;
      this.logger.warn('Stripe not configured — STRIPE_SECRET_KEY not set');
    }
  }

  private ensureStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }
    return this.stripe;
  }

  /**
   * Create a Stripe Connect Express account for a tenant
   */
  async createConnectAccount(
    tenantId: string,
    email: string,
    businessName: string,
  ): Promise<string> {
    const stripe = this.ensureStripe();

    const account = await stripe.accounts.create({
      type: 'express',
      email,
      business_type: 'company',
      company: { name: businessName },
      metadata: { tenantId },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        stripeConnectAccountId: account.id,
        paymentProviderStatus: 'onboarding',
      },
    });

    this.logger.log(`Created Stripe Connect account ${account.id} for tenant ${tenantId}`);
    return account.id;
  }

  /**
   * Generate an account link for Stripe Express onboarding
   */
  async getAccountLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<string> {
    const stripe = this.ensureStripe();

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return accountLink.url;
  }

  /**
   * Get Stripe Express dashboard login link for merchant
   */
  async createLoginLink(accountId: string): Promise<string> {
    const stripe = this.ensureStripe();
    const loginLink = await stripe.accounts.createLoginLink(accountId);
    return loginLink.url;
  }

  /**
   * Create a payment intent on a connected account with platform fee
   */
  async createConnectedPaymentIntent(
    accountId: string,
    amount: number,
    currency: string,
    platformFee: number,
    metadata: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<Stripe.PaymentIntent> {
    const stripe = this.ensureStripe();

    const amountInCents = Math.round(amount * 100);
    const feeInCents = Math.round(platformFee * 100);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        application_fee_amount: feeInCents,
        automatic_payment_methods: { enabled: true },
        metadata,
      },
      {
        stripeAccount: accountId,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    );

    this.logger.log(
      `Created connected PI ${paymentIntent.id} on account ${accountId}: $${amount} (fee: $${platformFee})`,
    );

    return paymentIntent;
  }

  /**
   * Create a refund on a connected account
   */
  async createConnectedRefund(
    paymentIntentId: string,
    stripeAccount: string,
    amount?: number,
    idempotencyKey?: string,
  ): Promise<Stripe.Refund> {
    const stripe = this.ensureStripe();

    const refundData: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };

    if (amount) {
      refundData.amount = Math.round(amount * 100);
    }

    return stripe.refunds.create(refundData, {
      stripeAccount,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
  }

  /**
   * Verify a Connect webhook event signature
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    const stripe = this.ensureStripe();
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Retrieve account details
   */
  async getAccount(accountId: string): Promise<Stripe.Account> {
    const stripe = this.ensureStripe();
    return stripe.accounts.retrieve(accountId);
  }

  /**
   * Get the Stripe publishable key
   */
  getPublicKey(): string | null {
    return process.env['STRIPE_PUBLIC_KEY'] || null;
  }
}
