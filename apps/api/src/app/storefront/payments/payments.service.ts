import { Injectable, Logger, NotFoundException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { StripeService } from './stripe.service';
import { StripeConnectService } from '../../onboarding/stripe-connect.service';
import { SquarePaymentService } from '../../onboarding/square-payment.service';
import { EmailService } from '@platform/email';
import { StockMovementService } from '../../inventory-management/stock-movement.service';
import { FailedOperationsService } from '../../workers/failed-operations.service';
import { NotificationService, NotificationType } from '../../operations/notification.service';
import { WebhookService } from '../../operations/webhook.service';
import { MovementType } from '../../inventory-management/inventory-management.dto';
import { OperationType } from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly squarePaymentService: SquarePaymentService,
    private readonly stockMovementService: StockMovementService,
    private readonly failedOperationsService: FailedOperationsService,
    private readonly notificationService: NotificationService,
    private readonly webhookService: WebhookService,
    @Optional() @Inject(EmailService) private readonly emailService?: EmailService
  ) {}

  /**
   * Get payment configuration for frontend (tenant-aware)
   */
  async getConfig(tenantId?: string) {
    const base = {
      publicKey: this.stripeService.getPublicKey(),
      isConfigured: this.stripeService.isConfigured(),
      paymentProvider: 'stripe' as string,
      squareApplicationId: null as string | null,
      squareLocationId: null as string | null,
    };

    if (!tenantId) return base;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        paymentProvider: true,
        paymentProviderStatus: true,
        squareLocationId: true,
      },
    });

    if (tenant?.paymentProvider) {
      base.paymentProvider = tenant.paymentProvider;
    }

    if (
      tenant?.paymentProvider === 'square' &&
      tenant.paymentProviderStatus === 'active'
    ) {
      base.squareApplicationId = process.env['SQUARE_APPLICATION_ID'] || null;
      base.squareLocationId = tenant.squareLocationId || null;
      base.isConfigured = !!(base.squareApplicationId && tenant.squareLocationId);
    }

    return base;
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(payload: Buffer, signature: string) {
    const mockMode = process.env['MOCK_PAYMENTS'] === 'true';
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];

    if (!webhookSecret && !mockMode) {
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripeService.verifyWebhookSignature(payload, signature, webhookSecret || 'mock');
    } catch (err) {
      this.logger.error('Webhook signature verification failed:', err);
      throw new BadRequestException('Webhook signature verification failed');
    }

    // PAY-8: Atomic webhook deduplication using upsert to prevent race conditions
    // If two webhook deliveries arrive simultaneously, only one will process
    const dedupeResult = await this.prisma.$queryRaw<{ already_processed: boolean }[]>`
      INSERT INTO processed_webhook_events (id, "eventId", "eventType", "processedAt")
      VALUES (gen_random_uuid(), ${event.id}, ${event.type}, NOW())
      ON CONFLICT ("eventId") DO NOTHING
      RETURNING FALSE as already_processed
    `;
    
    // If no rows returned, the event was already processed (conflict occurred)
    if (!dedupeResult || dedupeResult.length === 0) {
      this.logger.log(`Duplicate webhook event skipped: ${event.id}`);
      return { received: true, duplicate: true };
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
      include: {
        items: {
          include: {
            product: {
              include: {
                item: true,
              },
            },
            variant: {
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

    // Idempotency: skip if order already fulfilled (prevents double stock deduction on webhook retry)
    if (order.paymentStatus === 'CAPTURED' || order.status === 'CONFIRMED') {
      this.logger.log(`Order ${order.orderNumber} already fulfilled, skipping duplicate webhook`);
      return;
    }

    // PAY-6: Verify payment amount matches order total (accounting for gift card discount)
    const giftCardApplied = Number(order.giftCardDiscount || 0);
    const expectedAmountCents = Math.round((Number(order.grandTotal) - giftCardApplied) * 100);
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
    let charge: Stripe.Charge | null = null;
    let cardBrand: string | null = null;
    let cardLast4: string | null = null;

    if (typeof paymentIntent.latest_charge === 'string') {
      // latest_charge is a string ID — fetch the full charge object to get card details
      try {
        charge = await this.stripeService.retrieveCharge(paymentIntent.latest_charge);
      } catch (err) {
        this.logger.warn(`Failed to retrieve charge ${paymentIntent.latest_charge}: ${err}`);
      }
    } else if (paymentIntent.latest_charge) {
      charge = paymentIntent.latest_charge as Stripe.Charge;
    }

    if (charge?.payment_method_details?.card) {
      cardBrand = charge.payment_method_details.card.brand || null;
      cardLast4 = charge.payment_method_details.card.last4 || null;
    }

    const charges = charge || paymentIntent.latest_charge;

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

    // Fire-and-forget: trigger payment.captured webhook
    this.webhookService.triggerEvent({ tenantId: order.tenantId }, {
      event: 'payment.captured',
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: Number(order.grandTotal),
        currency: order.currency,
        paymentIntentId: paymentIntent.id,
      },
      timestamp: new Date(),
    }).catch(err => this.logger.error(`Webhook payment.captured failed for order ${order.orderNumber}: ${err.message}`));

    // Notify merchant admins about new order
    this.notificationService.notifyNewOrder(
      { tenantId: order.tenantId },
      order.orderNumber,
      Number(order.grandTotal),
    ).catch(err => this.logger.error(`Failed to notify merchant of new order ${order.orderNumber}: ${err.message}`));

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

      // Notify merchant about stock deduction failure
      this.notificationService.createForRole(
        { tenantId: order.tenantId },
        'admin',
        {
          type: NotificationType.SYSTEM_ALERT,
          title: 'Stock Deduction Failed',
          message: `Stock deduction failed for order #${order.orderNumber}. Automatic retry queued.`,
          link: `/orders/${order.orderNumber}`,
          priority: 'urgent',
        },
      ).catch(err => this.logger.error(`Failed to notify stock deduction failure: ${err.message}`));

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

    // Prepare stock movement items (use variant's inventory item if available)
    const items = order.items.map((orderItem: any) => ({
      itemCode: orderItem.variant?.item?.code || orderItem.product.item.code,
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
   * Uses raw SQL to prevent reservedQty from going negative
   */
  private async releaseStockReservations(order: any, warehouseId: string) {
    await this.prisma.$transaction(async (tx) => {
      for (const orderItem of order.items) {
        const itemId = orderItem.product.item.id;
        const tenantId = order.tenantId;
        const qty = orderItem.quantity;

        // Acquire advisory lock to prevent concurrent modification
        const itemKey = `${tenantId}:${warehouseId}:${itemId}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemKey}))`;

        // Safe decrement: clamp to 0 to prevent negative reservedQty
        await tx.$executeRaw`
          UPDATE warehouse_item_balances
          SET "reservedQty" = GREATEST("reservedQty" - ${qty}, 0)
          WHERE "tenantId" = ${tenantId}
            AND "itemId" = ${itemId}
            AND "warehouseId" = ${warehouseId}
        `;
      }
    });
  }

  /**
   * Track coupon usage and increment counter
   */
  private async trackCouponUsage(order: any) {
    // Only track if order has discount and coupon code
    if (Number(order.discountTotal) <= 0 || !order.couponCode) {
      return;
    }

    const couponCode = order.couponCode;

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

    // Atomically increment usage, create tracking record, and audit log
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
      // Audit log for coupon usage (Fix #13: compliance and debugging)
      this.prisma.auditLog.create({
        data: {
          tenantId: order.tenantId,
          userId: order.customerId,
          action: 'COUPON_USED',
          docType: 'Order',
          docName: order.orderNumber,
          meta: {
            couponCode,
            couponId: coupon.id,
            discountAmount: Number(order.discountTotal),
            orderId: order.id,
          },
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

    // Don't overwrite CAPTURED/CONFIRMED if payment_failed arrives after payment_succeeded
    if (order.paymentStatus === 'CAPTURED' || order.status === 'CONFIRMED') {
      this.logger.warn(`Ignoring payment_failed for already-captured order ${order.orderNumber}`);
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

    // Release stock reservations on payment failure
    try {
      const fullOrder = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: { include: { item: true } },
              variant: { include: { item: true } },
            },
          },
        },
      });

      if (fullOrder) {
        const warehouse = await this.prisma.warehouse.findFirst({
          where: { tenantId: order.tenantId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });

        if (warehouse) {
          await this.releaseStockReservations(fullOrder, warehouse.id);
          this.logger.log(`Stock reservations released for failed payment on order: ${order.orderNumber}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to release stock for failed payment on order ${order.orderNumber}:`, error);
    }

    // Notify merchant admins about failed payment
    this.notificationService.createForRole(
      { tenantId: order.tenantId },
      'admin',
      {
        type: NotificationType.PAYMENT_FAILED,
        title: 'Payment Failed',
        message: `Payment failed for order #${order.orderNumber}: ${lastError?.message || 'Unknown error'}`,
        link: `/orders/${order.orderNumber}`,
        priority: 'high',
      },
    ).catch(err => this.logger.error(`Failed to notify merchant of payment failure: ${err.message}`));

    // Fire-and-forget: trigger payment.failed webhook
    this.webhookService.triggerEvent({ tenantId: order.tenantId }, {
      event: 'payment.failed',
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: Number(order.grandTotal),
        currency: order.currency,
        paymentIntentId: paymentIntent.id,
        errorCode: lastError?.code || null,
        errorMessage: lastError?.message || null,
      },
      timestamp: new Date(),
    }).catch(err => this.logger.error(`Webhook payment.failed failed for order ${order.orderNumber}: ${err.message}`));

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

    // Only process refund if payment was actually captured
    if (!['CAPTURED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      this.logger.warn(`Ignoring refund webhook for order ${order.orderNumber} with paymentStatus=${order.paymentStatus}`);
      return;
    }

    const refundAmount = (charge.amount_refunded || 0) / 100;
    const isFullRefund = charge.refunded;

    // Create a Payment record for the refund and update order status atomically
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          status: isFullRefund ? 'REFUNDED' : order.status,
          refundedAt: isFullRefund ? new Date() : undefined,
        },
      }),
      this.prisma.payment.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          amount: refundAmount,
          currency: order.currency,
          method: 'card',
          type: 'REFUND',
          status: 'REFUNDED',
          stripePaymentIntentId: typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id,
          stripeChargeId: charge.id,
          refundedAt: new Date(),
        },
      }),
    ]);

    // Return stock to inventory on full refund
    if (isFullRefund) {
      try {
        await this.returnStockForRefund(order);
      } catch (error) {
        this.logger.error(`Failed to return stock for refund on order ${order.orderNumber}: ${error}`);
      }
    }

    this.logger.log(`Refund processed for order: ${order.orderNumber}, amount: ${refundAmount}`);
  }

  /**
   * Return stock to inventory when an order is fully refunded
   * Creates a RECEIPT movement to add items back to the warehouse
   */
  private async returnStockForRefund(order: any) {
    const fullOrder = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                item: true,
              },
            },
            variant: {
              include: {
                item: true,
              },
            },
          },
        },
      },
    });

    if (!fullOrder || !fullOrder.items || fullOrder.items.length === 0) {
      this.logger.warn(`No items found for refund stock return on order ${order.orderNumber}`);
      return;
    }

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

    const items = fullOrder.items.map((orderItem: any) => ({
      itemCode: orderItem.variant?.item?.code || orderItem.product.item.code,
      quantity: orderItem.quantity,
      rate: Number(orderItem.unitPrice),
    }));

    await this.stockMovementService.createMovement(
      { tenantId: order.tenantId },
      {
        movementType: MovementType.RECEIPT,
        postingDate: new Date().toISOString().split('T')[0],
        warehouseCode: warehouse.code,
        items,
        reference: `Refund for Order ${order.orderNumber}`,
        remarks: `Stock returned for fully refunded order ${order.orderNumber}`,
      }
    );

    this.logger.log(`Stock returned to inventory for refunded order: ${order.orderNumber}`);
  }

  /**
   * Create refund for order (supports both Stripe and Square payments)
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

    if (!['CAPTURED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      throw new BadRequestException('Order payment must be captured before refunding');
    }

    // Validate refund amount
    const orderTotal = Number(order.grandTotal);
    if (amount !== undefined) {
      if (amount <= 0) {
        throw new BadRequestException('Refund amount must be positive');
      }
      if (amount > orderTotal) {
        throw new BadRequestException(`Refund amount (${amount}) exceeds order total (${orderTotal})`);
      }
    }

    // Track cumulative refunds to prevent exceeding order total
    // Query by type='REFUND' OR status='REFUNDED' to catch all refund records
    const existingRefunds = await this.prisma.payment.findMany({
      where: {
        orderId,
        OR: [
          { type: 'REFUND' },
          { status: 'REFUNDED' },
        ],
      },
    });
    const totalRefunded = existingRefunds.reduce((sum, p) => sum + Number(p.amount), 0);
    const refundAmount = amount ?? orderTotal;

    if (totalRefunded + refundAmount > orderTotal) {
      throw new BadRequestException(
        `Refund would exceed order total. Already refunded: ${totalRefunded}, requested: ${refundAmount}, order total: ${orderTotal}`
      );
    }

    // Determine payment provider: Stripe orders have stripePaymentIntentId on the order,
    // Square orders do not. Fall back to checking the tenant's paymentProvider setting.
    const isStripeOrder = !!order.stripePaymentIntentId;

    if (isStripeOrder) {
      return this.createStripeRefund(order, tenantId, orderId, amount, reason, existingRefunds);
    }

    // Check if this is a Square order by looking at the tenant's payment provider
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { paymentProvider: true },
    });

    if (tenant?.paymentProvider === 'square') {
      return this.createSquareRefund(order, tenantId, orderId, amount, reason);
    }

    throw new BadRequestException('Order has no associated payment or unsupported payment provider');
  }

  /**
   * Process a Stripe refund for an order
   */
  private async createStripeRefund(
    order: { stripePaymentIntentId: string | null; grandTotal: any },
    tenantId: string,
    orderId: string,
    amount?: number,
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer',
    existingRefunds: any[] = []
  ) {
    if (!order.stripePaymentIntentId) {
      throw new BadRequestException('Order has no Stripe payment intent');
    }

    // PAY-9: Generate unique idempotency key including refund count to prevent collisions
    const existingRefundCount = existingRefunds.length;
    const idempotencyKey = `refund_${tenantId}_${orderId}_${amount || 'full'}_${existingRefundCount + 1}`;

    // Check if tenant uses Stripe Connect (has a connected account)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeConnectAccountId: true },
    });

    let refund: Stripe.Refund;

    if (tenant?.stripeConnectAccountId) {
      // Use Stripe Connect service for connected account refunds
      refund = await this.stripeConnectService.createConnectedRefund(
        order.stripePaymentIntentId,
        tenant.stripeConnectAccountId,
        amount,
        idempotencyKey,
      );
    } else {
      // Use direct Stripe service for platform refunds
      refund = await this.stripeService.createRefund(
        order.stripePaymentIntentId,
        amount,
        reason,
        idempotencyKey
      );
    }

    // Record will be created via webhook, but we can return preliminary info
    return {
      refundId: refund.id,
      amount: (refund.amount || 0) / 100,
      status: refund.status,
    };
  }

  /**
   * Process a Square refund for an order
   */
  private async createSquareRefund(
    order: { grandTotal: any; currency?: string },
    tenantId: string,
    orderId: string,
    amount?: number,
    reason?: string,
  ) {
    // Find the captured Payment record that holds the Square payment ID
    // (stored in stripePaymentIntentId as a provider-agnostic reference)
    const capturedPayment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        tenantId,
        status: 'CAPTURED',
        stripePaymentIntentId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!capturedPayment?.stripePaymentIntentId) {
      throw new BadRequestException('No Square payment ID found for this order');
    }

    const squarePaymentId = capturedPayment.stripePaymentIntentId;
    const currency = order.currency || 'USD';

    const refund = await this.squarePaymentService.refundPayment(
      tenantId,
      squarePaymentId,
      amount,
      currency,
      reason || 'Requested by merchant',
    );

    // Update order payment status since Square doesn't have webhooks configured for refunds
    const orderTotal = Number(order.grandTotal);
    const refundAmount = amount ?? orderTotal;
    const isFullRefund = !amount || amount >= orderTotal;

    // Create a Payment record for the Square refund (enables cumulative refund tracking)
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          status: isFullRefund ? 'REFUNDED' : undefined,
          refundedAt: isFullRefund ? new Date() : undefined,
        },
      }),
      this.prisma.payment.create({
        data: {
          tenantId,
          orderId,
          amount: refundAmount,
          currency: currency,
          method: 'card',
          type: 'REFUND',
          status: 'REFUNDED',
          stripePaymentIntentId: squarePaymentId,
          refundedAt: new Date(),
        },
      }),
    ]);

    return {
      refundId: refund?.id || null,
      amount: refundAmount,
      status: refund?.status || 'COMPLETED',
    };
  }

  /**
   * Get payments for an order
   */
  async getOrderPayments(tenantId: string, orderId: string, customerId?: string) {
    // Verify order ownership when customerId is provided
    if (customerId) {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, tenantId, customerId },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
    }

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

    // M3: Subtract gift card discount from the amount charged to Square
    const giftCardApplied = Number(order.giftCardDiscount || 0);
    const amount = Number(order.grandTotal) - giftCardApplied;
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

    // Store the Square payment ID so refunds can reference it later.
    // We reuse the stripePaymentIntentId field as a provider-agnostic payment reference.
    const squarePaymentId = payment?.id || null;

    // Record payment and update order status atomically
    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          tenantId,
          orderId,
          amount: order.grandTotal,
          currency: order.currency || 'USD',
          method: 'card',
          status: 'CAPTURED',
          stripePaymentIntentId: squarePaymentId,
          capturedAt: new Date(),
        },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'CAPTURED',
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      }),
    ]);

    // CRITICAL: Process stock deduction and coupon tracking (same as Stripe flow)
    const fullOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                item: true,
              },
            },
            variant: {
              include: {
                item: true,
              },
            },
          },
        },
        cart: true,
      },
    });

    if (fullOrder) {
      // Notify merchant admins about new order (Square path)
      this.notificationService.notifyNewOrder(
        { tenantId },
        fullOrder.orderNumber,
        Number(fullOrder.grandTotal),
      ).catch(err => this.logger.error(`Failed to notify merchant of new order: ${err.message}`));

      await this.processOrderFulfillment(fullOrder);
      this.sendOrderConfirmationEmailAsync(fullOrder.id);
    }

    return {
      success: true,
      paymentId: payment?.id,
      orderId,
    };
  }
}
