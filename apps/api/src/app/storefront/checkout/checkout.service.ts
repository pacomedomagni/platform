/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { StripeService } from '../payments/stripe.service';
import { CreateCheckoutDto, UpdateCheckoutDto } from './dto';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService
  ) {}

  /**
   * Create order from cart and initialize payment
   */
  async createCheckout(tenantId: string, dto: CreateCheckoutDto, customerId?: string) {
    // Get cart with items
    const cart = await this.prisma.cart.findFirst({
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

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Validate stock availability
    for (const item of cart.items) {
      const availableQty = item.product.item.warehouseItemBalances.reduce(
        (sum, b) => sum + Number(b.actualQty) - Number(b.reservedQty),
        0
      );

      if (item.quantity > availableQty) {
        throw new BadRequestException(
          `Insufficient stock for ${item.product.displayName}. Available: ${availableQty}`
        );
      }
    }

    // Generate order number
    const orderNumber = await this.generateOrderNumber(tenantId);

    // Use billing address or shipping address
    const billingAddress = dto.billingAddress || dto.shippingAddress;

    // Create order
    const order = await this.prisma.order.create({
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
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { status: 'converted' },
    });

    // Create Stripe Payment Intent
    let stripeClientSecret: string | null = null;
    try {
      // Generate deterministic idempotency key to prevent duplicate charges on retry
      const idempotencyKey = `pi_${tenantId}_${order.id}`;

      const paymentIntent = await this.stripeService.createPaymentIntent(
        Number(cart.grandTotal),
        'usd',
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          tenantId,
          customerEmail: dto.email,
        },
        idempotencyKey
      );

      // Update order with Stripe payment intent ID
      await this.prisma.order.update({
        where: { id: order.id },
        data: { stripePaymentIntentId: paymentIntent.id },
      });

      stripeClientSecret = paymentIntent.client_secret;
    } catch (error) {
      // Log error but don't fail checkout - payment can be retried
      console.error('Failed to create Stripe payment intent:', error);
    }

    return this.mapOrderToCheckoutResponse(order, stripeClientSecret);
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
    if (order.stripePaymentIntentId && order.paymentStatus === 'PENDING') {
      try {
        const paymentIntent = await this.stripeService.getPaymentIntent(
          order.stripePaymentIntentId
        );
        clientSecret = paymentIntent.client_secret;
      } catch (error) {
        console.error('Failed to get Stripe payment intent:', error);
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
   */
  async cancelCheckout(tenantId: string, orderId: string) {
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

    // Cancel Stripe payment intent if exists
    if (order.stripePaymentIntentId) {
      try {
        await this.stripeService.cancelPaymentIntent(order.stripePaymentIntentId);
      } catch (error) {
        console.error('Failed to cancel Stripe payment intent:', error);
      }
    }

    // Update order status
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // Restore cart if possible
    if (order.cartId) {
      await this.prisma.cart.update({
        where: { id: order.cartId },
        data: { status: 'active' },
      });
    }

    return { success: true, message: 'Order cancelled' };
  }

  // ============ HELPERS ============

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const date = new Date();
    const prefix = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Get count of orders this month for sequential number
    const count = await this.prisma.order.count({
      where: {
        tenantId,
        orderNumber: { startsWith: prefix },
      },
    });

    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  private mapOrderToCheckoutResponse(order: any, clientSecret: string | null) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      phone: order.phone,
      status: order.status,
      paymentStatus: order.paymentStatus,
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
      stripeClientSecret: clientSecret,
    };
  }
}
