/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { StripeService } from '../payments/stripe.service';
import { StripeConnectService } from '../../onboarding/stripe-connect.service';
import { CreateCheckoutDto, UpdateCheckoutDto } from './dto';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  /**
   * Create order from cart and initialize payment
   * PAY-2: Entire flow wrapped in transaction
   * PAY-3: Cart locked with SELECT FOR UPDATE
   * PAY-4: Stock validated with advisory locks
   * PAY-5: Order number generated atomically
   */
  async createCheckout(tenantId: string, dto: CreateCheckoutDto, customerId?: string) {
    // Run database operations inside a transaction; Stripe call stays outside
    const result = await this.prisma.$transaction(async (tx) => {
      // PAY-3: Lock cart row to prevent TOCTOU race
      const lockedCarts = await tx.$queryRaw<any[]>`
        SELECT id FROM carts
        WHERE id = ${dto.cartId} AND "tenantId" = ${tenantId} AND status = 'active'
        FOR UPDATE
      `;

      if (!lockedCarts || lockedCarts.length === 0) {
        throw new NotFoundException('Cart not found');
      }

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

      // Check B2B credit limit if customer is linked to B2B account
      if (customerId) {
        const storeCustomer = await tx.storeCustomer.findFirst({
          where: { id: customerId, tenantId },
          include: { customer: true },
        });

        if (storeCustomer?.customer && storeCustomer.customer.creditLimit) {
          const creditLimit = Number(storeCustomer.customer.creditLimit);
          const orderTotal = Number(cart.grandTotal);

          if (creditLimit > 0) {
            // LOGIC-4: Find ALL StoreCustomers linked to this B2B customer,
            // then sum unpaid orders across all of them
            const allLinkedStoreCustomers = await tx.storeCustomer.findMany({
              where: {
                tenantId,
                customerId: storeCustomer.customer.id,
              },
              select: { id: true },
            });
            const allCustomerIds = allLinkedStoreCustomers.map((sc) => sc.id);

            const unpaidOrders = await tx.order.findMany({
              where: {
                tenantId,
                customerId: { in: allCustomerIds },
                paymentStatus: { in: ['PENDING', 'AUTHORIZED'] },
              },
              select: { grandTotal: true },
            });

            const creditUsed = unpaidOrders.reduce(
              (sum, order) => sum + Number(order.grandTotal),
              0,
            );

            const availableCredit = creditLimit - creditUsed;

            if (orderTotal > availableCredit) {
              throw new BadRequestException(
                `Credit limit exceeded. Available credit: $${availableCredit.toFixed(2)}, Order total: $${orderTotal.toFixed(2)}`,
              );
            }
          }
        }
      }

      // PAY-4: Acquire advisory locks per item to prevent concurrent stock modifications
      for (const item of cart.items) {
        const itemKey = `${tenantId}:${item.product.item.id}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemKey}))`;
      }

      // Re-query fresh balances and RESERVE stock
      for (const item of cart.items) {
        // Fetch all balances for this item, sorted by creation (FIFO-ish reservation or just prefer older stock)
        const balances = await tx.warehouseItemBalance.findMany({
          where: { tenantId, itemId: item.product.item.id },
          orderBy: { createdAt: 'asc' },
        });

        // Calculate total available across all warehouses
        let remainingToReserve = item.quantity;

        for (const balance of balances) {
          if (remainingToReserve <= 0) break;

          const availableInBalance = Number(balance.actualQty) - Number(balance.reservedQty);
          
          if (availableInBalance > 0) {
            const take = Math.min(remainingToReserve, availableInBalance);
            
            // Reserve logic: Increment reservedQty
            await tx.warehouseItemBalance.update({
              where: { id: balance.id },
              data: { reservedQty: { increment: take } },
            });

            remainingToReserve -= take;
          }
        }

        if (remainingToReserve > 0) {
          throw new BadRequestException(
            `Insufficient stock for ${item.product.displayName}. Requested: ${item.quantity}, Shortage: ${remainingToReserve}`
          );
        }
      }

      // PAY-5: Atomic order number generation
      const orderNumber = await this.generateOrderNumber(tx, tenantId);

      // Use billing address or shipping address
      const billingAddress = dto.billingAddress || dto.shippingAddress;

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

          // Totals from cart
          subtotal: cart.subtotal,
          shippingTotal: cart.shippingTotal,
          taxTotal: cart.taxTotal,
          discountTotal: cart.discountAmount,
          grandTotal: cart.grandTotal,

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
              imageUrl: item.product.images[0] || null,
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

      return order;
    }, { timeout: 30000 });

    // Create payment intent — route through connected account if tenant has one
    let stripeClientSecret: string | null = null;
    let paymentProvider = 'stripe';
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
      };

      if (
        tenant?.paymentProvider === 'stripe' &&
        tenant.stripeConnectAccountId &&
        tenant.paymentProviderStatus === 'active'
      ) {
        // Stripe Connect — charge on connected account with platform fee
        const amount = Number(result.grandTotal);
        const fee =
          amount * (Number(tenant.platformFeePercent) / 100) +
          Number(tenant.platformFeeFixed);

        const paymentIntent =
          await this.stripeConnectService.createConnectedPaymentIntent(
            tenant.stripeConnectAccountId,
            amount,
            'usd',
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
        const paymentIntent = await this.stripeService.createPaymentIntent(
          Number(result.grandTotal),
          'usd',
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
      // Log error and FAIL checkout 
      this.logger.error('Failed to create payment intent:', error);
      throw new BadRequestException('Payment initialization failed. Please try again.');
    }

    return this.mapOrderToCheckoutResponse(result, stripeClientSecret, paymentProvider);
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
    const metadata = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId,
      customerEmail: order.email || '',
    };

    let clientSecret: string | null = null;
    const paymentProvider = 'stripe';

    if (
      tenant?.paymentProvider === 'stripe' &&
      tenant.stripeConnectAccountId &&
      tenant.paymentProviderStatus === 'active'
    ) {
      const amount = Number(order.grandTotal);
      const fee =
        amount * (Number(tenant.platformFeePercent) / 100) +
        Number(tenant.platformFeeFixed);

      const paymentIntent =
        await this.stripeConnectService.createConnectedPaymentIntent(
          tenant.stripeConnectAccountId,
          amount,
          'usd',
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
        Number(order.grandTotal),
        'usd',
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
          console.error('Failed to get Stripe payment intent:', error);
        }
      } else {
        // Payment intent missing (Stripe call failed during checkout) — auto-retry
        try {
          const retryResult = await this.retryPaymentIntent(tenantId, orderId);
          clientSecret = retryResult.clientSecret;
        } catch (error) {
          console.error('Auto-retry payment intent failed:', error);
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
          console.error('Failed to cancel Stripe payment intent:', error);
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

      // PAY-10 + RACE-2: Release stock reservations per-warehouse (FIFO, matching reservation pattern)
      for (const item of order.items) {
        if (item.product?.item?.id) {
          // Acquire advisory lock to prevent concurrent stock modifications
          const itemKey = `${tenantId}:${item.product.item.id}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemKey}))`;

          const balances = await tx.warehouseItemBalance.findMany({
            where: {
              tenantId,
              itemId: item.product.item.id,
              reservedQty: { gt: 0 },
            },
            orderBy: { createdAt: 'asc' },
          });

          let remainingToRelease = item.quantity;
          for (const balance of balances) {
            if (remainingToRelease <= 0) break;
            const reserved = Number(balance.reservedQty);
            const take = Math.min(remainingToRelease, reserved);
            if (take > 0) {
              await tx.warehouseItemBalance.update({
                where: { id: balance.id },
                data: { reservedQty: { decrement: take } },
              });
              remainingToRelease -= take;
            }
          }
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

  private mapOrderToCheckoutResponse(order: any, clientSecret: string | null, paymentProvider?: string) {
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
      stripePaymentIntentId: order.stripePaymentIntentId,
      clientSecret: clientSecret,
    };
  }
}
