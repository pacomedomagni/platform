import { Injectable, Logger, NotFoundException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { StripeService } from './stripe.service';
import { SquarePaymentService } from '../../onboarding/square-payment.service';
import { EmailService } from '@platform/email';
import { StockMovementService } from '../../inventory-management/stock-movement.service';
import { FailedOperationsService } from '../../workers/failed-operations.service';
import { MovementType } from '../../inventory-management/inventory-management.dto';
import { OperationType } from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly squarePaymentService: SquarePaymentService,
    private readonly stockMovementService: StockMovementService,
    private readonly failedOperationsService: FailedOperationsService,
    @Optional() @Inject(EmailService) private readonly emailService?: EmailService
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

    // PAY-8: Check for duplicate webhook event
    const existingEvent = await this.prisma.processedWebhookEvent.findUnique({
      where: { eventId: event.id },
    });
    if (existingEvent) {
      this.logger.log(`Duplicate webhook event skipped: ${event.id}`);
      return { received: true, duplicate: true };
    }
    // Record event as processed before handling
    await this.prisma.processedWebhookEvent.create({
      data: { eventId: event.id, eventType: event.type },
    });

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
      include: {
        items: {
          include: {
            product: {
              include: {
                item: true,
              },
            },
          },
        },
        cart: true,
      },
    });

    if (!order) {
      this.logger.warn(`Order not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    // PAY-6: Verify payment amount matches order total
    const expectedAmountCents = Math.round(Number(order.grandTotal) * 100);
    if (Math.abs(paymentIntent.amount - expectedAmountCents) > 1) {
      this.logger.error(
        `Payment amount mismatch for order ${order.orderNumber}: ` +
        `expected ${expectedAmountCents} cents, got ${paymentIntent.amount} cents`
      );
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED',
        },
      });
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

    // CRITICAL: Process stock deduction and coupon tracking
    await this.processOrderFulfillment(order);

    // Send order confirmation email (async - non-critical)
    this.sendOrderConfirmationEmailAsync(order.id);
  }

  /**
   * Process order fulfillment: stock deduction and coupon tracking
   * CRITICAL: Must be executed after payment succeeds to prevent overselling
   */
  private async processOrderFulfillment(order: any) {
    // 1. Deduct stock from inventory
    try {
      await this.deductStockForOrder(order);
      this.logger.log(`Stock deducted for order: ${order.orderNumber}`);
    } catch (error) {
      this.logger.error(`CRITICAL: Stock deduction failed for ${order.orderNumber}:`, error);

      // Record failed operation for automatic retry
      await this.failedOperationsService.recordFailedOperation({
        tenantId: order.tenantId,
        operationType: OperationType.STOCK_DEDUCTION,
        referenceId: order.id,
        referenceType: 'order',
        payload: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          items: order.items.map((item: any) => ({
            itemCode: item.product.item.code,
            quantity: item.quantity,
            rate: Number(item.unitPrice),
          })),
          warehouseId: order.warehouseId || null, // Will be determined in retry
        },
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      this.logger.warn(`Stock deduction queued for retry: order ${order.orderNumber}`);
    }

    // 2. Track coupon usage
    try {
      await this.trackCouponUsage(order);
      if (Number(order.discountTotal) > 0) {
        this.logger.log(`Coupon usage tracked for order: ${order.orderNumber}`);
      }
    } catch (error) {
      this.logger.error(`CRITICAL: Coupon tracking failed for ${order.orderNumber}:`, error);

      // Record failed operation for automatic retry
      if (order.cart?.couponCode) {
        const coupon = await this.prisma.coupon.findFirst({
          where: {
            tenantId: order.tenantId,
            code: order.cart.couponCode,
          },
        });

        if (coupon) {
          await this.failedOperationsService.recordFailedOperation({
            tenantId: order.tenantId,
            operationType: OperationType.COUPON_TRACKING,
            referenceId: order.id,
            referenceType: 'order',
            payload: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              couponId: coupon.id,
              customerId: order.customerId,
            },
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
          });

          this.logger.warn(`Coupon tracking queued for retry: order ${order.orderNumber}`);
        }
      }
    }

    this.logger.log(`Order fulfillment completed for: ${order.orderNumber}`);
  }

  /**
   * Deduct stock for order items
   * Also releases stock reservations made during checkout
   */
  private async deductStockForOrder(order: any) {
    if (!order.items || order.items.length === 0) {
      this.logger.warn(`Order ${order.orderNumber} has no items to deduct stock`);
      return;
    }

    // Get default warehouse (in production, this would be based on shipping location)
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        tenantId: order.tenantId,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!warehouse) {
      throw new Error(`No active warehouse found for tenant ${order.tenantId}`);
    }

    // Prepare stock movement items
    const items = order.items.map((orderItem: any) => ({
      itemCode: orderItem.product.item.code,
      quantity: orderItem.quantity,
      rate: Number(orderItem.unitPrice),
    }));

    // Issue stock via stock movement service (this decrements actualQty)
    await this.stockMovementService.createMovement(
      { tenantId: order.tenantId },
      {
        movementType: MovementType.ISSUE,
        postingDate: new Date().toISOString().split('T')[0],
        warehouseCode: warehouse.code,
        items,
        reference: `Order ${order.orderNumber}`,
        remarks: `Stock issued for order ${order.orderNumber} (Payment ID: ${order.stripePaymentIntentId})`,
      }
    );

    // Release stock reservations (decrement reservedQty)
    // Stock was reserved during checkout, now we release it since actualQty was already decremented
    await this.releaseStockReservations(order, warehouse.id);

    this.logger.log(`Stock deducted and reservations released for order: ${order.orderNumber}`);
  }

  /**
   * Release stock reservations for order items
   * Called after stock movement is created (actualQty already decremented)
   */
  private async releaseStockReservations(order: any, warehouseId: string) {
    for (const orderItem of order.items) {
      await this.prisma.warehouseItemBalance.updateMany({
        where: {
          tenantId: order.tenantId,
          itemId: orderItem.product.item.id,
          warehouseId,
        },
        data: {
          reservedQty: { decrement: orderItem.quantity },
        },
      });
    }
  }

  /**
   * Track coupon usage and increment counter
   */
  private async trackCouponUsage(order: any) {
    // Only track if order has discount and coupon code
    if (Number(order.discountTotal) <= 0 || !order.cart?.couponCode) {
      return;
    }

    const couponCode = order.cart.couponCode;

    // Find the coupon
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        tenantId: order.tenantId,
        code: couponCode,
      },
    });

    if (!coupon) {
      this.logger.warn(`Coupon ${couponCode} not found for order ${order.orderNumber}`);
      return;
    }

    // Atomically increment usage and create tracking record
    await this.prisma.$transaction([
      // Increment coupon usage counter
      this.prisma.coupon.update({
        where: { id: coupon.id },
        data: { timesUsed: { increment: 1 } },
      }),
      // Create usage tracking record
      this.prisma.couponUsage.create({
        data: {
          tenantId: order.tenantId,
          couponId: coupon.id,
          customerId: order.customerId,
          orderId: order.id,
          usedAt: new Date(),
        },
      }),
    ]);

    this.logger.log(`Coupon ${couponCode} usage tracked for order: ${order.orderNumber}`);
  }

  /**
   * Send order confirmation email asynchronously (non-critical)
   */
  private async sendOrderConfirmationEmailAsync(orderId: string) {
    if (!this.emailService) {
      this.logger.warn('Email service not available, skipping order confirmation email');
      return;
    }

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          tenant: true,
        },
      });

      if (!order || !order.email) {
        this.logger.warn(`Cannot send email: order ${orderId} not found or no email`);
        return;
      }

      // Get payment info
      const payment = await this.prisma.payment.findFirst({
        where: { orderId, status: 'CAPTURED' },
      });

      await this.emailService.sendAsync({
        to: order.email,
        template: 'store-order-confirmation',
        subject: '', // Will be set by template
        context: {
          type: 'store-order-confirmation',
          tenantId: order.tenantId,
          recipientName: `${order.shippingFirstName} ${order.shippingLastName}`,
          recipientEmail: order.email,
          actionUrl: `${process.env['STORE_URL'] || process.env['FRONTEND_URL']}/storefront/account/orders?order=${order.orderNumber}`,
          company: {
            name: order.tenant.businessName || order.tenant.name,
            supportEmail: order.tenant.email || 'support@example.com',
          },
          order: {
            orderNumber: order.orderNumber,
            status: order.status,
            items: order.items.map(item => ({
              name: item.name,
              sku: item.sku || undefined,
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
              totalPrice: Number(item.totalPrice),
              image: item.imageUrl || undefined,
            })),
            subtotal: Number(order.subtotal),
            shipping: Number(order.shippingTotal),
            tax: Number(order.taxTotal),
            discount: Number(order.discountTotal) > 0 ? Number(order.discountTotal) : undefined,
            total: Number(order.grandTotal),
            currency: order.currency,
            shippingAddress: {
              name: `${order.shippingFirstName} ${order.shippingLastName}`,
              line1: order.shippingAddressLine1,
              line2: order.shippingAddressLine2 || undefined,
              city: order.shippingCity,
              state: order.shippingState,
              postalCode: order.shippingPostalCode,
              country: order.shippingCountry,
            },
            paymentMethod: payment?.cardBrand && payment?.cardLast4
              ? `${payment.cardBrand.charAt(0).toUpperCase() + payment.cardBrand.slice(1)} •••• ${payment.cardLast4}`
              : undefined,
          },
        },
      });

      this.logger.log(`Order confirmation email queued for order: ${order.orderNumber}`);
    } catch (error) {
      this.logger.error(`Failed to queue order confirmation email for order ${orderId}:`, error);
    }
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

    // PAY-9: Generate unique idempotency key including refund count to prevent collisions
    const existingRefundCount = await this.prisma.payment.count({
      where: { orderId, status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] } },
    });
    const idempotencyKey = `refund_${tenantId}_${orderId}_${amount || 'full'}_${existingRefundCount + 1}`;

    const refund = await this.stripeService.createRefund(
      order.stripePaymentIntentId,
      amount,
      reason,
      idempotencyKey
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

  /**
   * Process a Square payment for an order (after frontend card tokenization)
   */
  async processSquarePayment(tenantId: string, orderId: string, sourceId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentStatus !== 'PENDING') {
      throw new BadRequestException('Order is not pending payment');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        paymentProvider: true,
        squareLocationId: true,
        platformFeePercent: true,
        platformFeeFixed: true,
      },
    });

    if (tenant?.paymentProvider !== 'square') {
      throw new BadRequestException('Tenant is not configured for Square payments');
    }

    if (!tenant.squareLocationId) {
      throw new BadRequestException('Square location not configured');
    }

    const amount = Number(order.grandTotal);
    const platformFee =
      amount * (Number(tenant.platformFeePercent) / 100) + Number(tenant.platformFeeFixed);

    const idempotencyKey = `sq_${tenantId}_${orderId}`;

    const payment = await this.squarePaymentService.createPayment(
      tenantId,
      amount,
      order.currency || 'USD',
      platformFee,
      sourceId,
      idempotencyKey,
      tenant.squareLocationId,
      { orderId, tenantId },
    );

    // Record payment in our DB
    await this.prisma.payment.create({
      data: {
        tenantId,
        orderId,
        amount: order.grandTotal,
        currency: order.currency || 'USD',
        method: 'card',
        status: 'CAPTURED',
        capturedAt: new Date(),
      },
    });

    // Update order status
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'CAPTURED',
        status: 'CONFIRMED',
      },
    });

    return {
      success: true,
      paymentId: payment?.id,
      orderId,
    };
  }
}
