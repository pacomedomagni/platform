/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import { StripeService } from '../payments/stripe.service';
import { StripeConnectService } from '../../onboarding/stripe-connect.service';
import { WebhookService } from '../../operations/webhook.service';
import { GiftCardsService } from '../ecommerce/gift-cards.service';
import { ShippingService } from '../shipping/shipping.service';
import { CreateCheckoutDto, UpdateCheckoutDto } from './dto';

const CHECKOUT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class CheckoutService {
  constructor(
    @InjectPinoLogger(CheckoutService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly webhookService: WebhookService,
    private readonly giftCardsService: GiftCardsService,
    private readonly shippingService: ShippingService,
  ) {}

  /**
   * Create order from cart and initialize payment
   * PAY-2: Entire flow wrapped in transaction
   * PAY-3: Cart locked with SELECT FOR UPDATE
   * PAY-4: Stock validated with advisory locks
   * PAY-5: Order number generated atomically
   */
  async createCheckout(tenantId: string, dto: CreateCheckoutDto, customerId?: string) {
    // Double-click protection: check if an order already exists for this cart
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        cartId: dto.cartId,
        tenantId,
        status: { not: 'CANCELLED' },
      },
      include: { items: true },
    });

    if (existingOrder) {
      // Return existing order instead of creating duplicate
      let clientSecret: string | null = null;
      if (existingOrder.stripePaymentIntentId && existingOrder.paymentStatus === 'PENDING') {
        try {
          const pi = await this.stripeService.getPaymentIntent(existingOrder.stripePaymentIntentId);
          clientSecret = pi.client_secret;
        } catch { /* ignore */ }
      }
      return this.mapOrderToCheckoutResponse(existingOrder, clientSecret);
    }

    // Clear cartId from any cancelled orders to avoid unique constraint conflict
    // (e.g. customer cancelled then re-ordered using the same cart)
    await this.prisma.order.updateMany({
      where: {
        cartId: dto.cartId,
        tenantId,
        status: 'CANCELLED',
      },
      data: { cartId: null },
    });

    // Run database operations inside a transaction; Stripe call stays outside
    const txResult = await this.prisma.$transaction(async (tx) => {
      // PAY-3: Lock cart row to prevent TOCTOU race
      const lockedCarts = await tx.$queryRaw<any[]>`
        SELECT id FROM carts
        WHERE id = ${dto.cartId} AND "tenantId" = ${tenantId} AND status = 'active'
        FOR UPDATE
      `;

      if (!lockedCarts || lockedCarts.length === 0) {
        throw new NotFoundException('Cart not found or already checked out');
      }

      // Fix #11: Extend cart expiry to prevent cleanup job race during checkout
      await tx.cart.update({
        where: { id: dto.cartId },
        data: { expiresAt: new Date(Date.now() + CHECKOUT_EXPIRY_MS) }, // 30 minutes
      });

      // Get cart with items (now that we hold the lock)
      const cart = await tx.cart.findFirst({
        where: {
          id: dto.cartId,
          tenantId,
          status: 'active',
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  item: {
                    include: {
                      warehouseItemBalances: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      // Validate order total is positive
      if (Number(cart.grandTotal) <= 0) {
        throw new BadRequestException('Order total must be greater than $0');
      }

      // Re-validate coupon at checkout time (may have expired or hit limit since added to cart)
      // Use FOR UPDATE to prevent concurrent orders from both passing the usage limit check
      if (cart.couponCode) {
        const lockedCoupons = await tx.$queryRaw<any[]>`
          SELECT * FROM coupons
          WHERE "tenantId" = ${tenantId} AND code = ${cart.couponCode}
          FOR UPDATE
        `;
        const coupon = lockedCoupons?.[0] || null;
        const now = new Date();
        const invalid = !coupon || !coupon.isActive
          || (coupon.expiresAt && new Date(coupon.expiresAt) < now)
          || (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit);

        if (invalid) {
          const removedCoupon = cart.couponCode;
          await tx.cart.update({
            where: { id: cart.id },
            data: { couponCode: null, discountAmount: 0 },
          });
          (cart as any).discountAmount = new Prisma.Decimal(0);
          (cart as any).couponCode = null;
          (cart as any).couponRemoved = removedCoupon;
          (cart as any).couponRemoveReason = !coupon || !coupon.isActive
            ? 'Coupon is no longer active'
            : (coupon.expiresAt && new Date(coupon.expiresAt) < now)
              ? 'Coupon has expired'
              : 'Coupon usage limit has been reached';
          // Recalculate grandTotal without discount
          (cart as any).grandTotal = new Prisma.Decimal(
            Number(cart.subtotal) + Number(cart.shippingTotal) + Number(cart.taxTotal)
          );
        }
      }

      // Validate all products still exist and are published
      for (const item of cart.items) {
        if (!item.product || !item.product.isPublished) {
          throw new BadRequestException(
            `"${item.product?.displayName || 'A product'}" is no longer available. Please remove it from your cart and try again.`
          );
        }
        if (!item.product.item) {
          throw new BadRequestException(
            `"${item.product.displayName}" cannot be purchased at this time. Please remove it from your cart.`
          );
        }
      }

      // PAY-4: Acquire advisory locks per item to prevent concurrent stock modifications
      for (const item of cart.items) {
        const itemKey = `${tenantId}:${item.product.item.id}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemKey}))`;
      }

      // Re-query fresh balances after acquiring locks
      for (const item of cart.items) {
        const freshBalances = await tx.warehouseItemBalance.findMany({
          where: { tenantId, itemId: item.product.item.id },
        });
        const availableQty = freshBalances.reduce(
          (sum, b) => sum + Number(b.actualQty) - Number(b.reservedQty),
          0
        );
        if (item.quantity > availableQty) {
          throw new BadRequestException(
            `Insufficient stock for ${item.product.displayName}. Available: ${availableQty}`
          );
        }
      }

      // PAY-5: Atomic order number generation
      const orderNumber = await this.generateOrderNumber(tx, tenantId);

      // Use billing address or shipping address
      const billingAddress = dto.billingAddress || dto.shippingAddress;

      // Issue #6: Resolve shipping rate from zone/rate system when shippingRateId is provided
      let finalShippingTotal = cart.shippingTotal;
      let finalGrandTotal = cart.grandTotal;
      let shippingMethodName: string | null = null;

      if (dto.shippingRateId) {
        const selectedRate = await tx.shippingRate.findFirst({
          where: {
            id: dto.shippingRateId,
            tenantId,
            isEnabled: true,
          },
        });

        if (!selectedRate) {
          throw new BadRequestException('Selected shipping rate not found or is no longer available');
        }

        // Check free shipping threshold
        const cartTotal = Number(cart.subtotal);
        const isFree = selectedRate.freeShippingThreshold
          && cartTotal >= Number(selectedRate.freeShippingThreshold);
        const ratePrice = isFree ? 0 : Number(selectedRate.price);

        // Recalculate totals with the selected rate
        const oldShipping = Number(cart.shippingTotal);
        const shippingDelta = ratePrice - oldShipping;
        finalShippingTotal = new Prisma.Decimal(ratePrice);
        finalGrandTotal = new Prisma.Decimal(Number(cart.grandTotal) + shippingDelta);

        shippingMethodName = selectedRate.name;
      } else {
        // Issue #6: Even without a specific rate ID, try zone-based calculation
        // using the actual shipping address from checkout for more accurate rates
        try {
          const shippingResult = await this.shippingService.calculateShipping(tenantId, {
            country: dto.shippingAddress.country,
            state: dto.shippingAddress.state,
            zipCode: dto.shippingAddress.postalCode,
            cartTotal: Number(cart.subtotal),
          });

          if (shippingResult.rates.length > 0) {
            const cheapestRate = shippingResult.rates[0];
            const oldShipping = Number(cart.shippingTotal);
            const shippingDelta = cheapestRate.price - oldShipping;
            finalShippingTotal = new Prisma.Decimal(cheapestRate.price);
            finalGrandTotal = new Prisma.Decimal(Number(cart.grandTotal) + shippingDelta);
            shippingMethodName = cheapestRate.name;
          }
        } catch {
          // If shipping calculation fails, use cart's pre-calculated shipping
        }
      }

      // Create order
      const order = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          customerId,
          cartId: cart.id,
          email: dto.email,
          phone: dto.phone,

          // Shipping address
          shippingFirstName: dto.shippingAddress.firstName,
          shippingLastName: dto.shippingAddress.lastName,
          shippingCompany: dto.shippingAddress.company,
          shippingAddressLine1: dto.shippingAddress.addressLine1,
          shippingAddressLine2: dto.shippingAddress.addressLine2,
          shippingCity: dto.shippingAddress.city,
          shippingState: dto.shippingAddress.state,
          shippingPostalCode: dto.shippingAddress.postalCode,
          shippingCountry: dto.shippingAddress.country,

          // Billing address
          billingFirstName: billingAddress.firstName,
          billingLastName: billingAddress.lastName,
          billingCompany: billingAddress.company,
          billingAddressLine1: billingAddress.addressLine1,
          billingAddressLine2: billingAddress.addressLine2,
          billingCity: billingAddress.city,
          billingState: billingAddress.state,
          billingPostalCode: billingAddress.postalCode,
          billingCountry: billingAddress.country,

          // Totals — use zone-based shipping when available (Issue #6)
          subtotal: cart.subtotal,
          shippingTotal: finalShippingTotal,
          taxTotal: cart.taxTotal,
          discountTotal: cart.discountAmount,
          grandTotal: finalGrandTotal,

          // Issue #6: Store the shipping method name on the order
          shippingMethod: shippingMethodName,

          // Notes
          customerNotes: dto.customerNotes,

          // Status
          status: 'PENDING',
          paymentStatus: 'PENDING',

          // Create order items
          items: {
            create: cart.items.map((item) => ({
              tenantId,
              productId: item.productId,
              sku: item.product.item.code,
              name: item.product.displayName,
              description: item.product.shortDescription,
              imageUrl: item.product.images?.[0] || null,
              quantity: item.quantity,
              unitPrice: item.price,
              totalPrice: Number(item.price) * item.quantity,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Mark cart as converted
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'converted' },
      });

      // ============ GIFT CARD REDEMPTION (inside transaction for automatic rollback) ============
      let giftCardDiscount = 0;
      let giftCardTransactionId: string | null = null;
      let chargeAmount = Number(order.grandTotal);

      if (dto.giftCardCode) {
        try {
          // Validate the gift card balance first (pass tx to use same transaction)
          const balanceCheck = await this.giftCardsService.checkBalance(
            tenantId,
            dto.giftCardCode,
            dto.giftCardPin,
            tx,
          );

          if (Number(balanceCheck.balance) > 0) {
            // Redeem the gift card against this order (pass tx to avoid nested transaction FK violation)
            const redemption = await this.giftCardsService.redeemForOrder(
              tenantId,
              order.id,
              { code: dto.giftCardCode, pin: dto.giftCardPin },
              chargeAmount,
              tx,
            );

            giftCardDiscount = redemption.amountRedeemed;
            giftCardTransactionId = redemption.transactionId;
            chargeAmount = chargeAmount - giftCardDiscount;

            // Store gift card amount on the order for retry logic
            await tx.order.update({
              where: { id: order.id },
              data: {
                giftCardDiscount,
              },
            });

            // If gift card covers the full amount, mark as paid — no external payment needed
            if (chargeAmount <= 0) {
              chargeAmount = 0;
              await tx.order.update({
                where: { id: order.id },
                data: {
                  paymentStatus: 'CAPTURED',
                  paymentMethod: 'gift_card',
                },
              });
              // Reflect the update on the local object so the response is accurate
              (order as any).paymentStatus = 'CAPTURED';
              (order as any).paymentMethod = 'gift_card';
            }
          }
        } catch (error) {
          // If gift card validation/redemption fails, log and continue with full payment
          this.logger.error(
            { err: error, orderId: order.id, giftCardCode: dto.giftCardCode },
            'Gift card redemption failed, proceeding with full payment',
          );
          giftCardDiscount = 0;
          giftCardTransactionId = null;
          chargeAmount = Number(order.grandTotal);
        }
      }

      return {
        order,
        giftCardDiscount,
        giftCardTransactionId,
        chargeAmount,
        couponRemoved: (cart as any).couponRemoved || null,
        couponRemoveReason: (cart as any).couponRemoveReason || null,
      };
    }, { timeout: 30000 });

    const { order: result, giftCardDiscount, giftCardTransactionId, chargeAmount, couponRemoved, couponRemoveReason } = txResult;

    // Create payment intent — route through connected account if tenant has one
    let stripeClientSecret: string | null = null;
    let paymentProvider: string = 'stripe';

    // Skip external payment if gift card covered the full amount
    if (chargeAmount > 0) {
      try {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            paymentProvider: true,
            paymentProviderStatus: true,
            stripeConnectAccountId: true,
            platformFeePercent: true,
            platformFeeFixed: true,
            squareLocationId: true,
          },
        });

        const idempotencyKey = `pi_${tenantId}_${result.id}`;
        const metadata = {
          orderId: result.id,
          orderNumber: result.orderNumber,
          tenantId,
          customerEmail: dto.email,
          ...(giftCardDiscount > 0 && { giftCardDiscount: String(giftCardDiscount) }),
        };

        // Determine currency from tenant configuration
        const tenantCurrency = (result.currency || 'usd').toLowerCase();

        if (
          tenant?.paymentProvider === 'stripe' &&
          tenant.stripeConnectAccountId &&
          tenant.paymentProviderStatus === 'active'
        ) {
          // Stripe Connect — charge on connected account with platform fee
          // Use chargeAmount (may be reduced by gift card partial redemption)
          const fee =
            chargeAmount * (Number(tenant.platformFeePercent) / 100) +
            Number(tenant.platformFeeFixed);

          const paymentIntent =
            await this.stripeConnectService.createConnectedPaymentIntent(
              tenant.stripeConnectAccountId,
              chargeAmount,
              tenantCurrency,
              fee,
              metadata,
              idempotencyKey,
            );

          await this.prisma.order.update({
            where: { id: result.id },
            data: { stripePaymentIntentId: paymentIntent.id },
          });

          stripeClientSecret = paymentIntent.client_secret;
          paymentProvider = 'stripe';
        } else if (
          tenant?.paymentProvider === 'square' &&
          tenant.paymentProviderStatus === 'active'
        ) {
          // Square — payment created after frontend card tokenization
          paymentProvider = 'square';
        } else {
          // Fallback: direct Stripe (for tenants without Connect setup)
          // Use chargeAmount (may be reduced by gift card partial redemption)
          const paymentIntent = await this.stripeService.createPaymentIntent(
            chargeAmount,
            tenantCurrency,
            metadata,
            idempotencyKey,
          );

          await this.prisma.order.update({
            where: { id: result.id },
            data: { stripePaymentIntentId: paymentIntent.id },
          });

          stripeClientSecret = paymentIntent.client_secret;
          paymentProvider = 'stripe';
        }
      } catch (error) {
        // Log error but don't fail checkout — payment can be retried via getCheckout or retryPaymentIntent
        this.logger.error({ err: error, orderId: result.id }, 'Failed to create payment intent');
      }
    } else {
      // Gift card covered the full amount — no external payment provider needed
      paymentProvider = 'gift_card';
    }

    const response = this.mapOrderToCheckoutResponse(result, stripeClientSecret, paymentProvider, {
      giftCardDiscount: giftCardDiscount > 0 ? giftCardDiscount : null,
      giftCardTransactionId,
    });

    // Include coupon removal notice if coupon was invalidated during checkout
    if (couponRemoved) {
      (response as any).couponRemoved = {
        code: couponRemoved,
        reason: couponRemoveReason,
      };
    }

    // Fire-and-forget: trigger order.created webhook
    this.webhookService.triggerEvent({ tenantId }, {
      event: 'order.created',
      payload: {
        orderId: result.id,
        orderNumber: result.orderNumber,
        email: result.email,
        grandTotal: Number(result.grandTotal),
        status: result.status,
        itemCount: result.items.length,
      },
      timestamp: new Date(),
    }).catch(err => this.logger.error({ err }, 'Webhook order.created failed'));

    return response;
  }

  /**
   * Retry creating a payment intent for an order that failed during initial checkout.
   * Called explicitly or auto-triggered by getCheckout().
   */
  async retryPaymentIntent(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
        paymentStatus: 'PENDING',
        stripePaymentIntentId: null,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found, already has payment, or is not pending');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        paymentProvider: true,
        paymentProviderStatus: true,
        stripeConnectAccountId: true,
        platformFeePercent: true,
        platformFeeFixed: true,
        squareLocationId: true,
      },
    });

    const idempotencyKey = `pi_${tenantId}_${orderId}`;
    const metadata: Record<string, string> = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId,
      customerEmail: order.email || '',
    };

    let clientSecret: string | null = null;
    let paymentProvider = 'stripe';

    const retryCurrency = (order.currency || 'usd').toLowerCase();

    // Subtract any gift card amount already applied to this order
    const giftCardDiscount = Number(order.giftCardDiscount || 0);
    const chargeAmount = Math.max(Number(order.grandTotal) - giftCardDiscount, 0);

    if (chargeAmount <= 0) {
      // Gift card covers the full amount — no external payment needed
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'CAPTURED',
          paymentMethod: 'gift_card',
        },
      });
      return { clientSecret: null, paymentProvider: 'gift_card', orderId: order.id };
    }

    if (giftCardDiscount > 0) {
      metadata.giftCardDiscount = String(giftCardDiscount);
    }

    if (
      tenant?.paymentProvider === 'stripe' &&
      tenant.stripeConnectAccountId &&
      tenant.paymentProviderStatus === 'active'
    ) {
      const fee =
        chargeAmount * (Number(tenant.platformFeePercent) / 100) +
        Number(tenant.platformFeeFixed);

      const paymentIntent =
        await this.stripeConnectService.createConnectedPaymentIntent(
          tenant.stripeConnectAccountId,
          chargeAmount,
          retryCurrency,
          fee,
          metadata,
          idempotencyKey,
        );

      await this.prisma.order.update({
        where: { id: order.id },
        data: { stripePaymentIntentId: paymentIntent.id },
      });

      clientSecret = paymentIntent.client_secret;
    } else {
      const paymentIntent = await this.stripeService.createPaymentIntent(
        chargeAmount,
        retryCurrency,
        metadata,
        idempotencyKey,
      );

      await this.prisma.order.update({
        where: { id: order.id },
        data: { stripePaymentIntentId: paymentIntent.id },
      });

      clientSecret = paymentIntent.client_secret;
    }

    return { clientSecret, paymentProvider, orderId: order.id };
  }

  /**
   * Get checkout/order by ID
   */
  async getCheckout(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Get Stripe client secret if payment is pending
    let clientSecret: string | null = null;
    if (order.paymentStatus === 'PENDING') {
      if (order.stripePaymentIntentId) {
        // Payment intent exists — retrieve the client secret
        try {
          const paymentIntent = await this.stripeService.getPaymentIntent(
            order.stripePaymentIntentId
          );
          clientSecret = paymentIntent.client_secret;
        } catch (error) {
          this.logger.error({ err: error, paymentIntentId: order.stripePaymentIntentId }, 'Failed to get Stripe payment intent');
        }
      } else {
        // Payment intent missing (Stripe call failed during checkout) — auto-retry
        try {
          const retryResult = await this.retryPaymentIntent(tenantId, orderId);
          clientSecret = retryResult.clientSecret;
        } catch (error) {
          this.logger.error({ err: error, orderId }, 'Auto-retry payment intent failed');
        }
      }
    }

    return this.mapOrderToCheckoutResponse(order, clientSecret);
  }

  /**
   * Get checkout by order number
   */
  async getCheckoutByOrderNumber(tenantId: string, orderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        tenantId,
        orderNumber,
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.mapOrderToCheckoutResponse(order, null);
  }

  /**
   * Update checkout info (before payment)
   */
  async updateCheckout(tenantId: string, orderId: string, dto: UpdateCheckoutDto) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
        paymentStatus: 'PENDING',
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found or already paid');
    }

    const updateData: any = {};

    if (dto.email) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;

    if (dto.shippingAddress) {
      updateData.shippingFirstName = dto.shippingAddress.firstName;
      updateData.shippingLastName = dto.shippingAddress.lastName;
      updateData.shippingCompany = dto.shippingAddress.company;
      updateData.shippingAddressLine1 = dto.shippingAddress.addressLine1;
      updateData.shippingAddressLine2 = dto.shippingAddress.addressLine2;
      updateData.shippingCity = dto.shippingAddress.city;
      updateData.shippingState = dto.shippingAddress.state;
      updateData.shippingPostalCode = dto.shippingAddress.postalCode;
      updateData.shippingCountry = dto.shippingAddress.country;
    }

    if (dto.billingAddress) {
      updateData.billingFirstName = dto.billingAddress.firstName;
      updateData.billingLastName = dto.billingAddress.lastName;
      updateData.billingCompany = dto.billingAddress.company;
      updateData.billingAddressLine1 = dto.billingAddress.addressLine1;
      updateData.billingAddressLine2 = dto.billingAddress.addressLine2;
      updateData.billingCity = dto.billingAddress.city;
      updateData.billingState = dto.billingAddress.state;
      updateData.billingPostalCode = dto.billingAddress.postalCode;
      updateData.billingCountry = dto.billingAddress.country;
    }

    if (dto.customerNotes !== undefined) updateData.customerNotes = dto.customerNotes;

    await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    return this.getCheckout(tenantId, orderId);
  }

  /**
   * Cancel checkout/order (before payment)
   * PAY-10: Wrapped in transaction, releases stock reservations
   */
  async cancelCheckout(tenantId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          tenantId,
          paymentStatus: 'PENDING',
        },
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
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found or already paid');
      }

      // Cancel Stripe payment intent if exists
      if (order.stripePaymentIntentId) {
        try {
          await this.stripeService.cancelPaymentIntent(order.stripePaymentIntentId);
        } catch (error) {
          this.logger.error({ err: error, paymentIntentId: order.stripePaymentIntentId, orderId }, 'Failed to cancel Stripe payment intent');
        }
      }

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });

      // PAY-10: Release stock reservations for each order item with advisory locks
      for (const item of order.items) {
        if (item.product?.item?.id) {
          // Acquire advisory lock to prevent concurrent stock modifications
          const itemKey = `${tenantId}:${item.product.item.id}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemKey}))`;

          // Safe decrement: only release if reservedQty >= quantity to prevent negative values
          await tx.$executeRaw`
            UPDATE warehouse_item_balances
            SET "reservedQty" = "reservedQty" - ${item.quantity}
            WHERE "tenantId" = ${tenantId}
              AND "itemId" = ${item.product.item.id}
              AND "reservedQty" >= ${item.quantity}
          `;
        }
      }

      // Reverse gift card transaction if one was applied
      const giftCardAmount = Number(order.giftCardDiscount || 0);
      if (giftCardAmount > 0) {
        try {
          // Find the gift card transaction for this order and reverse it
          const gcTransaction = await tx.giftCardTransaction.findFirst({
            where: { orderId, tenantId, type: 'redemption' },
            include: { giftCard: true },
          });

          if (gcTransaction && gcTransaction.giftCard) {
            const currentBalance = Number(gcTransaction.giftCard.currentBalance);
            const restoredBalance = currentBalance + giftCardAmount;

            // Create a reversal transaction
            await tx.giftCardTransaction.create({
              data: {
                tenantId,
                giftCardId: gcTransaction.giftCardId,
                type: 'refund',
                amount: giftCardAmount,
                balanceBefore: currentBalance,
                balanceAfter: restoredBalance,
                orderId,
                notes: `Reversed due to order cancellation (${order.orderNumber})`,
              },
            });

            // Restore the balance
            await tx.giftCard.update({
              where: { id: gcTransaction.giftCardId },
              data: {
                currentBalance: restoredBalance,
                status: 'active',
              },
            });
          }
        } catch (error) {
          this.logger.error(
            { err: error, orderId, tenantId },
            'Failed to reverse gift card on checkout cancellation',
          );
        }
      }

      // Restore cart if possible
      if (order.cartId) {
        await tx.cart.update({
          where: { id: order.cartId },
          data: { status: 'active' },
        });
      }

      return { success: true, message: 'Order cancelled' };
    });
  }

  // ============ HELPERS ============

  /**
   * PAY-5: Atomic order number generation using tenant counter
   */
  private async generateOrderNumber(tx: any, tenantId: string): Promise<string> {
    const date = new Date();
    const prefix = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Atomically increment and return the next order number
    const result = await tx.$queryRaw<any[]>`
      UPDATE tenants
      SET "nextOrderNumber" = "nextOrderNumber" + 1
      WHERE id = ${tenantId}
      RETURNING "nextOrderNumber"
    `;

    const seq = result[0]?.nextOrderNumber || 1;
    return `${prefix}-${String(seq).padStart(5, '0')}`;
  }

  private mapOrderToCheckoutResponse(
    order: any,
    clientSecret: string | null,
    paymentProvider?: string,
    giftCard?: { giftCardDiscount: number | null; giftCardTransactionId: string | null },
  ) {
    return {
      id: order.id,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      email: order.email,
      phone: order.phone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentProvider: paymentProvider || 'stripe',
      shippingAddress: order.shippingAddressLine1
        ? {
            firstName: order.shippingFirstName,
            lastName: order.shippingLastName,
            company: order.shippingCompany,
            addressLine1: order.shippingAddressLine1,
            addressLine2: order.shippingAddressLine2,
            city: order.shippingCity,
            state: order.shippingState,
            postalCode: order.shippingPostalCode,
            country: order.shippingCountry,
          }
        : null,
      billingAddress: order.billingAddressLine1
        ? {
            firstName: order.billingFirstName,
            lastName: order.billingLastName,
            company: order.billingCompany,
            addressLine1: order.billingAddressLine1,
            addressLine2: order.billingAddressLine2,
            city: order.billingCity,
            state: order.billingState,
            postalCode: order.billingPostalCode,
            country: order.billingCountry,
          }
        : null,
      items: order.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      subtotal: Number(order.subtotal),
      shippingTotal: Number(order.shippingTotal),
      taxTotal: Number(order.taxTotal),
      discountTotal: Number(order.discountTotal),
      grandTotal: Number(order.grandTotal),
      shippingMethod: order.shippingMethod || null,
      stripePaymentIntentId: order.stripePaymentIntentId,
      clientSecret: clientSecret,
      giftCardDiscount: giftCard?.giftCardDiscount ?? null,
      giftCardTransactionId: giftCard?.giftCardTransactionId ?? null,
    };
  }
}
