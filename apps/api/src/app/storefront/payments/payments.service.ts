import { Injectable, Logger, NotFoundException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Money } from '@platform/business-logic';
import { StripeService } from './stripe.service';
import { StripeConnectService } from '../../onboarding/stripe-connect.service';
import { SquarePaymentService } from '../../onboarding/square-payment.service';
import { EmailService } from '@platform/email';
import { StockMovementService } from '../../inventory-management/stock-movement.service';
import { FailedOperationsService } from '../../workers/failed-operations.service';
import { NotificationService, NotificationType } from '../../operations/notification.service';
import { WebhookService } from '../../operations/webhook.service';
import { MovementType } from '../../inventory-management/inventory-management.dto';
import { OperationType, Prisma } from '@prisma/client';
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

    // Every PaymentIntent we create embeds tenantId in metadata
    // (see checkout.service.ts createPaymentIntent). Derive it here so the
    // dedup table is tenant-scoped.
    const tenantId =
      (event.data.object as { metadata?: Record<string, string> } | undefined)
        ?.metadata?.['tenantId'];

    if (!tenantId) {
      // Event types we don't own (or can't map to a tenant) are acknowledged
      // but not deduped. We never process them downstream.
      this.logger.warn(
        `Webhook event ${event.id} (${event.type}) has no tenantId metadata — acknowledging without dedup`,
      );
      return { received: true, duplicate: false };
    }

    // Phase 2 W2.3: operation-level idempotency. The previous
    // INSERT ... ON CONFLICT DO NOTHING used the Stripe event id as the sole
    // dedup key: a successful insert followed by a crash in the handler would
    // leave the marker in place, so the retry returned {duplicate:true}
    // and the order never got its stock deducted / status updated.
    //
    // New logic: we still insert the marker (tenant-scoped), but on conflict
    // we consult the downstream state to decide whether the previous attempt
    // actually completed. If not, we re-run the handler. The handlers
    // themselves already assert idempotency on order.paymentStatus, so re-runs
    // after a partial success are safe.
    const dedupeResult = await this.prisma.$queryRaw<{ already_processed: boolean }[]>`
      INSERT INTO processed_webhook_events (id, "tenantId", "eventId", "eventType", "processedAt")
      VALUES (gen_random_uuid(), ${tenantId}, ${event.id}, ${event.type}, NOW())
      ON CONFLICT ("tenantId", "eventId") DO NOTHING
      RETURNING FALSE as already_processed
    `;

    const alreadySeen = !dedupeResult || dedupeResult.length === 0;
    if (alreadySeen) {
      const safeToSkip = await this.isWebhookOutcomePersisted(event);
      if (safeToSkip) {
        this.logger.log(`Duplicate webhook event skipped (outcome persisted): ${event.id}`);
        return { received: true, duplicate: true };
      }
      this.logger.warn(
        `Duplicate webhook event ${event.id} but downstream state is incomplete — re-running handler`,
      );
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
   * C-2: did the downstream effect of `event` actually get persisted?
   *
   * The previous version read `order.paymentStatus` and `order.status` as
   * proxies for "fulfillment done". That conflation hid a real bug: a crash
   * between Order.update(CAPTURED) and processOrderFulfillment() left
   * paymentStatus=CAPTURED with stock un-deducted, and the next webhook
   * delivery saw "CAPTURED" → returned true → handler skipped → stock never
   * got deducted.
   *
   * The replacement reads explicit per-side-effect markers stamped by each
   * handler step as it commits. For payment_intent.succeeded the gate is
   * (paymentRecordedAt && stockIssuedAt); only when BOTH are set has the full
   * effect of that webhook actually completed.
   *
   * For payment_intent.succeeded retries that arrive AFTER a Square refund or
   * a charge.refunded webhook has already moved the order to REFUNDED state,
   * we still want to skip — the legitimate succeeded effect did happen and
   * we don't want to re-run stock deduction now. paymentRecordedAt covers
   * that: it's set on the *original* succeeded handler and survives.
   */
  private async isWebhookOutcomePersisted(event: Stripe.Event): Promise<boolean> {
    const obj = event.data.object as {
      metadata?: Record<string, string>;
      id?: string;
    };
    const orderId = obj?.metadata?.['orderId'];
    if (!orderId) {
      // No order reference — assume idempotent at the Stripe layer.
      return true;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        paymentStatus: true,
        paymentRecordedAt: true,
        stockIssuedAt: true,
        refundProcessedAt: true,
      },
    });
    if (!order) return true;

    switch (event.type) {
      case 'payment_intent.succeeded':
        // Both legs must be done before we skip the retry. If only payment
        // was recorded but stock wasn't issued, we MUST re-run so
        // processOrderFulfillment gets another chance. Its own audit-log
        // idempotency check (deductStockForOrder) prevents double deduction
        // if it had already partially run.
        return !!(order.paymentRecordedAt && order.stockIssuedAt);
      case 'payment_intent.payment_failed':
        return !!order.paymentRecordedAt;
      case 'charge.refunded':
        return !!order.refundProcessedAt;
      default:
        return true;
    }
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

    // C-2: split idempotency into two gates so a partial-completion retry
    // can resume at the right step. The previous "skip everything if
    // paymentStatus===CAPTURED" hid crashes between the order update and
    // stock deduction.
    //
    //   paymentRecordedAt set + stockIssuedAt set  → fully done, safe to skip
    //   paymentRecordedAt set + stockIssuedAt unset → payment captured but
    //                                                  fulfillment crashed;
    //                                                  jump to fulfillment
    //   neither set                                → run from the top
    const orderFullyHandled = !!(order.paymentRecordedAt && order.stockIssuedAt);
    if (orderFullyHandled) {
      this.logger.log(`Order ${order.orderNumber} already fully handled, skipping duplicate webhook`);
      return;
    }
    const paymentAlreadyRecorded = !!order.paymentRecordedAt;
    if (paymentAlreadyRecorded) {
      this.logger.warn(
        `Order ${order.orderNumber} has paymentRecordedAt but no stockIssuedAt — ` +
        `resuming fulfillment from a prior crash`
      );
      // processOrderFulfillment is itself idempotent: deductStockForOrder
      // checks the audit log for an existing stock movement before issuing.
      await this.processOrderFulfillment(order);
      return;
    }

    // PAY-6 (Phase 1 W1.6 + Phase 2 W2.2): Verify payment amount matches
    // exactly, computed end-to-end in Decimal so no float coercion can drift
    // by a cent. Money.toCents throws on sub-cent precision; that's the
    // intended invariant — every persisted price/discount must be 2dp.
    const expectedDecimal = Money.sub(order.grandTotal as never, order.giftCardDiscount ?? 0);
    const expectedAmountCents = Money.toCents(expectedDecimal);
    if (paymentIntent.amount !== expectedAmountCents) {
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

    // Update order and create payment record.
    // C-2: paymentRecordedAt is stamped here so the webhook idempotency check
    // can tell that *this* side effect committed, independent of fulfillment.
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'CAPTURED',
          status: 'CONFIRMED',
          confirmedAt: now,
          paymentRecordedAt: now,
          stripeChargeId: typeof charges === 'string' ? charges : charges?.id,
        },
      }),
      this.prisma.payment.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          amount: paymentIntent.amount / 100,
          currency: order.currency,
          method: 'card',
          status: 'CAPTURED',
          stripePaymentIntentId: paymentIntent.id,
          stripeChargeId: typeof charges === 'string' ? charges : charges?.id,
          cardBrand,
          cardLast4,
          capturedAt: now,
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

    // CRITICAL: Process stock deduction and coupon tracking.
    // C-2: stockIssuedAt is stamped INSIDE processOrderFulfillment after the
    // ISSUE stock movement commits, so a crash here leaves the marker null
    // and the webhook retry resumes deduction.
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

    // Idempotency: skip if a stock movement audit log already exists for this order
    // The reference field is stored in auditLog.meta as JSON, and docType='StockMovement'
    const existingMovement = await this.prisma.auditLog.findFirst({
      where: {
        tenantId: order.tenantId,
        docType: 'StockMovement',
        action: 'STOCK_MOVEMENT_CREATED',
        meta: {
          path: ['reference'],
          equals: `Order ${order.orderNumber}`,
        },
      },
    });
    if (existingMovement) {
      this.logger.log(`Stock already deducted for order ${order.orderNumber}, skipping`);
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

    // C-2: stamp stockIssuedAt so the webhook idempotency check can tell that
    // this side effect actually completed. Done after both ISSUE and reservation
    // release have committed.
    await this.prisma.order.update({
      where: { id: order.id },
      data: { stockIssuedAt: new Date() },
    });

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
        const itemId = orderItem.variant?.item?.id || orderItem.product.item.id;
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
   * Phase 2 W2.4: coupon usage is now reserved inside the checkout
   * transaction (see checkout.service: the coupon row is locked FOR UPDATE,
   * `timesUsed` is incremented, and a CouponUsage row is written *before*
   * the order-creation tx commits). This webhook-side handler is kept only
   * for the audit log entry; it no longer increments or writes usage.
   */
  private async trackCouponUsage(order: any) {
    if (Number(order.discountTotal) <= 0 || !order.couponCode) return;

    const alreadyRecorded = await this.prisma.couponUsage.findFirst({
      where: { tenantId: order.tenantId, orderId: order.id },
      select: { id: true, couponId: true },
    });

    if (!alreadyRecorded) {
      // Defensive: if for some reason the checkout tx did not create the
      // usage record (e.g. a legacy order pre-W2.4), record it now without
      // double-incrementing the counter.
      const coupon = await this.prisma.coupon.findFirst({
        where: { tenantId: order.tenantId, code: order.couponCode },
        select: { id: true },
      });
      if (!coupon) {
        this.logger.warn(`Coupon ${order.couponCode} not found for order ${order.orderNumber}`);
        return;
      }
      await this.prisma.couponUsage.create({
        data: {
          tenantId: order.tenantId,
          couponId: coupon.id,
          customerId: order.customerId,
          orderId: order.id,
          usedAt: new Date(),
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId: order.tenantId,
        userId: order.customerId,
        action: 'COUPON_PAID',
        docType: 'Order',
        docName: order.orderNumber,
        meta: {
          couponCode: order.couponCode,
          couponId: alreadyRecorded?.couponId ?? null,
          discountAmount: Number(order.discountTotal),
          orderId: order.id,
        },
      },
    });

    this.logger.log(`Coupon payment confirmed for order: ${order.orderNumber}`);
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
    const now = new Date();

    // Update order and create payment record.
    // C-2: paymentRecordedAt also stamped on FAILED so the webhook idempotency
    // check skips correctly on duplicate failed deliveries.
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED',
          paymentRecordedAt: now,
        },
      }),
      this.prisma.payment.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          amount: paymentIntent.amount / 100,
          currency: order.currency,
          method: 'card',
          status: 'FAILED',
          stripePaymentIntentId: paymentIntent.id,
          errorCode: lastError?.code || null,
          errorMessage: lastError?.message || null,
          failedAt: now,
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
    const now = new Date();

    // Create a Payment record for the refund and update order status atomically.
    // C-2: refundProcessedAt always stamped here so the webhook idempotency
    // check on charge.refunded retries skips correctly. Distinct from refundedAt,
    // which is only set on a *full* refund.
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          status: isFullRefund ? 'REFUNDED' : order.status,
          refundedAt: isFullRefund ? now : undefined,
          refundProcessedAt: now,
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
          refundedAt: now,
        },
      }),
    ]);

    // Return stock to inventory on full refund
    if (isFullRefund) {
      try {
        await this.returnStockForRefund(order);
      } catch (error) {
        this.logger.error(`CRITICAL: Stock return failed for refund on order ${order.orderNumber}:`, error);

        // Record failed operation for automatic retry (same pattern as stock deduction)
        await this.failedOperationsService.recordFailedOperation({
          tenantId: order.tenantId,
          operationType: OperationType.STOCK_RETURN,
          referenceId: order.id,
          referenceType: 'order',
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            type: 'refund_stock_return',
          },
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
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
   * Create refund for order (supports both Stripe and Square payments).
   *
   * C-3: serializes concurrent refund attempts via SELECT ... FOR UPDATE on
   * the order row. Two simultaneous refund clicks used to both pass the
   * "totalRefunded + requested <= orderTotal" check because the read happened
   * outside any transaction. With the row lock, the second attempt sees the
   * first's committed Payment row (or — for Stripe — its committed refund via
   * Stripe.listRefunds) and either succeeds for the remaining balance or
   * refuses.
   *
   * Stripe is the source of truth for prior refund total because our Payment
   * table can lag the charge.refunded webhook. listRefunds survives lost
   * webhooks, lost create-refund responses, and DB-vs-Stripe drift.
   */
  async createRefund(
    tenantId: string,
    orderId: string,
    amount?: number,
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock the order row. Concurrent refund attempts on the same order
      //    serialize here. Different orders proceed in parallel.
      const lockedRows = await tx.$queryRaw<Array<{
        id: string;
        tenantId: string;
        grandTotal: Prisma.Decimal;
        paymentStatus: string;
        stripePaymentIntentId: string | null;
        currency: string;
      }>>`
        SELECT id, "tenantId", "grandTotal", "paymentStatus",
               "stripePaymentIntentId", currency
          FROM orders
         WHERE id = ${orderId} AND "tenantId" = ${tenantId}
         FOR UPDATE
      `;
      const order = lockedRows[0];
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (!['CAPTURED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
        throw new BadRequestException('Order payment must be captured before refunding');
      }

      // 2. Compute totals in cents end-to-end so a half-cent never silently
      //    rounds in the attacker's favor.
      const orderTotalCents = Money.toCents(Money.dec(order.grandTotal as never));
      const requestedCents = amount != null
        ? Money.toCents(Money.dec(amount))
        : orderTotalCents;
      if (requestedCents <= 0) {
        throw new BadRequestException('Refund amount must be positive');
      }
      if (requestedCents > orderTotalCents) {
        throw new BadRequestException(
          `Refund amount (${requestedCents}c) exceeds order total (${orderTotalCents}c)`,
        );
      }

      // 3. Determine prior refunded total. Stripe is authoritative; fall back
      //    to our Payment table for Square (no listRefunds equivalent yet).
      let priorRefundedCents: number;
      const isStripeOrder = !!order.stripePaymentIntentId;
      let stripeConnectAccountId: string | null = null;

      if (isStripeOrder) {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { stripeConnectAccountId: true },
        });
        stripeConnectAccountId = tenant?.stripeConnectAccountId ?? null;

        const stripeRefunds = stripeConnectAccountId
          ? await this.stripeConnectService.listConnectedRefunds(
              order.stripePaymentIntentId!,
              stripeConnectAccountId,
            )
          : await this.stripeService.listRefunds(order.stripePaymentIntentId!);

        priorRefundedCents = stripeRefunds.reduce(
          (sum, r) => sum + (r.amount || 0),
          0,
        );
      } else {
        const existing = await tx.payment.findMany({
          where: {
            orderId,
            OR: [{ type: 'REFUND' }, { status: 'REFUNDED' }],
          },
        });
        priorRefundedCents = existing.reduce(
          (sum, p) => sum + Money.toCents(Money.dec(p.amount as never)),
          0,
        );
      }

      if (priorRefundedCents + requestedCents > orderTotalCents) {
        throw new BadRequestException(
          `Refund would exceed order total. ` +
          `Already refunded: ${priorRefundedCents}c, requested: ${requestedCents}c, ` +
          `order total: ${orderTotalCents}c`,
        );
      }

      // 4. Dispatch to provider. The Stripe call runs INSIDE the tx-await
      //    chain. If we crash after Stripe processes but before we commit,
      //    the row lock will be released by Postgres on connection drop and
      //    a retry will see the prior refund via listRefunds (above) and
      //    either short-circuit (idempotency-key match) or refuse.
      if (isStripeOrder) {
        return this.createStripeRefundLocked(
          order,
          tenantId,
          orderId,
          amount,
          reason,
          priorRefundedCents,
          requestedCents,
          stripeConnectAccountId,
          tx,
        );
      }

      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { paymentProvider: true },
      });
      if (tenant?.paymentProvider === 'square') {
        return this.createSquareRefundLocked(
          order,
          tenantId,
          orderId,
          amount,
          reason,
          priorRefundedCents,
          requestedCents,
          tx,
        );
      }

      throw new BadRequestException(
        'Order has no associated payment or unsupported payment provider',
      );
    }, {
      // Order-level lock; uncontended in practice for a given order.
      timeout: 30_000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Process a Stripe refund for an order. Runs INSIDE the
   * SELECT ... FOR UPDATE transaction opened by createRefund().
   *
   * C-3 idempotency key: previously `refund_${orderId}_${amountCents}`. That
   * was stable for the *same* logical refund, but a partial-success retry
   * with a different remaining-balance amount changed the key and Stripe
   * created a second refund. New formula keys on the cumulative refunded
   * range `${prior}_to_${prior+requested}`: a true retry of the same logical
   * refund recomputes the same key (same prior, same requested) and Stripe
   * dedupes; a follow-up refund after a partial success has a different prior
   * and gets a different key, which is what we want.
   */
  private async createStripeRefundLocked(
    order: { stripePaymentIntentId: string | null; grandTotal: Prisma.Decimal },
    tenantId: string,
    orderId: string,
    amount: number | undefined,
    reason: 'duplicate' | 'fraudulent' | 'requested_by_customer' | undefined,
    priorRefundedCents: number,
    requestedCents: number,
    stripeConnectAccountId: string | null,
    _tx: Prisma.TransactionClient,
  ) {
    if (!order.stripePaymentIntentId) {
      throw new BadRequestException('Order has no Stripe payment intent');
    }

    const idempotencyKey =
      `refund_${orderId}_${priorRefundedCents}_to_${priorRefundedCents + requestedCents}`;

    let refund: Stripe.Refund;
    if (stripeConnectAccountId) {
      refund = await this.stripeConnectService.createConnectedRefund(
        order.stripePaymentIntentId,
        stripeConnectAccountId,
        amount,
        idempotencyKey,
      );
    } else {
      refund = await this.stripeService.createRefund(
        order.stripePaymentIntentId,
        amount,
        reason,
        idempotencyKey,
      );
    }

    // The Payment row will be written by the charge.refunded webhook, but
    // we return preliminary info to the caller.
    return {
      refundId: refund.id,
      amount: (refund.amount || 0) / 100,
      status: refund.status,
    };
  }

  /**
   * Process a Square refund for an order. Runs INSIDE the row-locked
   * transaction opened by createRefund(). Square has no webhook for refunds
   * so we write the Payment row + update Order state synchronously, all
   * inside the same tx as the row lock so concurrent attempts can't both
   * succeed.
   */
  private async createSquareRefundLocked(
    order: { grandTotal: Prisma.Decimal; currency: string },
    tenantId: string,
    orderId: string,
    amount: number | undefined,
    reason: string | undefined,
    priorRefundedCents: number,
    requestedCents: number,
    tx: Prisma.TransactionClient,
  ) {
    // Find the captured Payment record that holds the Square payment ID
    // (stored in stripePaymentIntentId as a provider-agnostic reference).
    const capturedPayment = await tx.payment.findFirst({
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

    const orderTotalCents = Money.toCents(Money.dec(order.grandTotal as never));
    const newCumulativeCents = priorRefundedCents + requestedCents;
    const isFullRefund = newCumulativeCents >= orderTotalCents;
    const refundAmount = requestedCents / 100;
    const now = new Date();

    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        status: isFullRefund ? 'REFUNDED' : undefined,
        refundedAt: isFullRefund ? now : undefined,
        // C-2: Square refund commits the side effect synchronously here, so
        // mark refundProcessedAt now (no webhook will arrive to set it).
        refundProcessedAt: now,
      },
    });
    await tx.payment.create({
      data: {
        tenantId,
        orderId,
        amount: refundAmount,
        currency,
        method: 'card',
        type: 'REFUND',
        status: 'REFUNDED',
        stripePaymentIntentId: squarePaymentId,
        refundedAt: now,
      },
    });

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
