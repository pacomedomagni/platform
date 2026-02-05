import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { StripeService } from './stripe.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService
  ) {}

  /**
   * Get payment configuration for frontend
   */
  getConfig() {
    return {
      publicKey: this.stripeService.getPublicKey(),
      isConfigured: this.stripeService.isConfigured(),
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
    
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripeService.verifyWebhookSignature(payload, signature, webhookSecret);
    } catch (err) {
      this.logger.error('Webhook signature verification failed:', err);
      throw new BadRequestException('Webhook signature verification failed');
    }

    this.logger.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata['orderId'];
    
    if (!orderId) {
      this.logger.warn('Payment succeeded without orderId in metadata');
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      this.logger.warn(`Order not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    // Get charge details for card info
    const charges = paymentIntent.latest_charge;
    let cardBrand: string | null = null;
    let cardLast4: string | null = null;

    if (typeof charges === 'string') {
      // charges is a string ID, we don't have the full charge object
      // In a real scenario, we might fetch the charge
    } else if (charges) {
      const paymentMethod = charges.payment_method_details;
      if (paymentMethod?.card) {
        cardBrand = paymentMethod.card.brand || null;
        cardLast4 = paymentMethod.card.last4 || null;
      }
    }

    // Update order and create payment record
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'CAPTURED',
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          stripeChargeId: typeof charges === 'string' ? charges : charges?.id,
        },
      }),
      this.prisma.payment.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          amount: Number(order.grandTotal),
          currency: order.currency,
          method: 'card',
          status: 'CAPTURED',
          stripePaymentIntentId: paymentIntent.id,
          stripeChargeId: typeof charges === 'string' ? charges : charges?.id,
          cardBrand,
          cardLast4,
          capturedAt: new Date(),
        },
      }),
    ]);

    this.logger.log(`Payment succeeded for order: ${order.orderNumber}`);

    // TODO: Send order confirmation email
    // TODO: Reserve inventory
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata['orderId'];
    
    if (!orderId) {
      this.logger.warn('Payment failed without orderId in metadata');
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      this.logger.warn(`Order not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    const lastError = paymentIntent.last_payment_error;

    // Update order and create payment record
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED',
        },
      }),
      this.prisma.payment.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          amount: Number(order.grandTotal),
          currency: order.currency,
          method: 'card',
          status: 'FAILED',
          stripePaymentIntentId: paymentIntent.id,
          errorCode: lastError?.code || null,
          errorMessage: lastError?.message || null,
          failedAt: new Date(),
        },
      }),
    ]);

    this.logger.log(`Payment failed for order: ${order.orderNumber}`);
  }

  /**
   * Handle refund
   */
  private async handleChargeRefunded(charge: Stripe.Charge) {
    const paymentIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;

    if (!paymentIntentId) {
      this.logger.warn('Charge refunded without payment_intent');
      return;
    }

    const order = await this.prisma.order.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!order) {
      this.logger.warn(`Order not found for charge refund: ${charge.id}`);
      return;
    }

    const refundAmount = (charge.amount_refunded || 0) / 100;
    const isFullRefund = charge.refunded;

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        status: isFullRefund ? 'REFUNDED' : order.status,
        refundedAt: isFullRefund ? new Date() : undefined,
      },
    });

    this.logger.log(`Refund processed for order: ${order.orderNumber}, amount: ${refundAmount}`);
  }

  /**
   * Create refund for order
   */
  async createRefund(
    tenantId: string,
    orderId: string,
    amount?: number,
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.stripePaymentIntentId) {
      throw new BadRequestException('Order has no associated payment');
    }

    if (order.paymentStatus !== 'CAPTURED') {
      throw new BadRequestException('Order payment must be captured before refunding');
    }

    const refund = await this.stripeService.createRefund(
      order.stripePaymentIntentId,
      amount,
      reason
    );

    // Record will be created via webhook, but we can return preliminary info
    return {
      refundId: refund.id,
      amount: (refund.amount || 0) / 100,
      status: refund.status,
    };
  }

  /**
   * Get payments for an order
   */
  async getOrderPayments(tenantId: string, orderId: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        orderId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      method: p.method,
      cardBrand: p.cardBrand,
      cardLast4: p.cardLast4,
      createdAt: p.createdAt,
    }));
  }
}
