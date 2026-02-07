import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe | null;
  private readonly logger = new Logger(StripeService.name);

  constructor() {
    const secretKey = process.env['STRIPE_SECRET_KEY'];
    
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2026-01-28.clover',
      });
      this.logger.log('Stripe initialized');
    } else {
      this.stripe = null;
      this.logger.warn('Stripe not configured - STRIPE_SECRET_KEY not set');
    }
  }

  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return this.stripe !== null;
  }

  /**
   * Create a Payment Intent
   *
   * @param amount - Amount in dollars (will be converted to cents)
   * @param currency - Currency code (default: 'usd')
   * @param metadata - Custom metadata to attach to the payment intent
   * @param idempotencyKey - Optional idempotency key for retry safety
   */
  async createPaymentIntent(
    amount: number,
    currency = 'usd',
    metadata: Record<string, string> = {},
    idempotencyKey?: string
  ): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new BadRequestException('Payment processing is not configured');
    }

    // Convert amount to cents
    const amountInCents = Math.round(amount * 100);

    // Generate idempotency key if not provided
    // Use orderId from metadata to create stable key
    const key = idempotencyKey || (metadata.orderId ? `pi_${metadata.orderId}` : undefined);

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        metadata,
      },
      key ? { idempotencyKey: key } : undefined
    );

    this.logger.log(`Created PaymentIntent: ${paymentIntent.id} for ${amount} ${currency} (key: ${key || 'none'})`);

    return paymentIntent;
  }

  /**
   * Get a Payment Intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new BadRequestException('Payment processing is not configured');
    }

    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Cancel a Payment Intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new BadRequestException('Payment processing is not configured');
    }

    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  /**
   * Capture a Payment Intent (for manual capture)
   */
  async capturePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new BadRequestException('Payment processing is not configured');
    }

    return this.stripe.paymentIntents.capture(paymentIntentId);
  }

  /**
   * Create a refund
   *
   * @param paymentIntentId - The payment intent to refund
   * @param amount - Optional partial refund amount in dollars (will be converted to cents)
   * @param reason - Reason for the refund
   * @param idempotencyKey - Optional idempotency key for retry safety
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer',
    idempotencyKey?: string
  ): Promise<Stripe.Refund> {
    if (!this.stripe) {
      throw new BadRequestException('Payment processing is not configured');
    }

    const refundData: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };

    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to cents
    }

    if (reason) {
      refundData.reason = reason;
    }

    // Generate idempotency key if not provided
    const key = idempotencyKey || `refund_${paymentIntentId}_${Date.now()}`;

    const refund = await this.stripe.refunds.create(
      refundData,
      { idempotencyKey: key }
    );

    this.logger.log(`Created refund: ${refund.id} for PaymentIntent: ${paymentIntentId} (key: ${key})`);

    return refund;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): Stripe.Event {
    if (!this.stripe) {
      throw new BadRequestException('Payment processing is not configured');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Create a customer
   */
  async createCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Customer> {
    if (!this.stripe) {
      throw new BadRequestException('Payment processing is not configured');
    }

    return this.stripe.customers.create({
      email,
      name,
      metadata,
    });
  }

  /**
   * Get public key for client-side
   */
  getPublicKey(): string | null {
    return process.env['STRIPE_PUBLIC_KEY'] || null;
  }
}
