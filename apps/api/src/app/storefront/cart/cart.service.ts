/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { AddToCartDto, UpdateCartItemDto } from './dto';

// Tax rate - in production, this would come from tenant settings or tax service
const DEFAULT_TAX_RATE = 0.0825; // 8.25%
const DEFAULT_SHIPPING_RATE = 9.99;
const FREE_SHIPPING_THRESHOLD = 100;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create a cart for customer or anonymous session
   */
  async getOrCreateCart(
    tenantId: string,
    customerId?: string,
    sessionToken?: string
  ) {
    // If customer, try to find existing cart
    if (customerId) {
      const existingCart = await this.prisma.cart.findFirst({
        where: {
          tenantId,
          customerId,
          status: 'active',
        },
        include: this.cartInclude,
      });

      if (existingCart) {
        return this.mapCartToResponse(existingCart);
      }
    }

    // If session token, try to find existing cart
    if (sessionToken) {
      const existingCart = await this.prisma.cart.findFirst({
        where: {
          tenantId,
          sessionToken,
          status: 'active',
        },
        include: this.cartInclude,
      });

      if (existingCart) {
        return this.mapCartToResponse(existingCart);
      }
    }

    // Create new cart
    const newSessionToken = sessionToken || uuidv4();
    const cart = await this.prisma.cart.create({
      data: {
        tenantId,
        customerId,
        sessionToken: customerId ? null : newSessionToken,
        status: 'active',
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      include: this.cartInclude,
    });

    return this.mapCartToResponse(cart);
  }

  /**
   * Get cart by ID
   */
  async getCart(tenantId: string, cartId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        id: cartId,
        tenantId,
        status: 'active',
      },
      include: this.cartInclude,
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return this.mapCartToResponse(cart);
  }

  /**
   * Get cart by session token (for anonymous users)
   */
  async getCartBySession(tenantId: string, sessionToken: string) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        tenantId,
        sessionToken,
        status: 'active',
      },
      include: this.cartInclude,
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return this.mapCartToResponse(cart);
  }

  /**
   * Add item to cart
   */
  async addItem(
    tenantId: string,
    cartId: string,
    dto: AddToCartDto
  ) {
    // Verify product exists and is published
    const product = await this.prisma.productListing.findFirst({
      where: {
        id: dto.productId,
        tenantId,
        isPublished: true,
      },
      include: {
        item: {
          include: {
            warehouseItemBalances: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check available stock
    const availableQty = product.item.warehouseItemBalances.reduce(
      (sum, b) => sum + Number(b.actualQty) - Number(b.reservedQty),
      0
    );

    if (dto.quantity > availableQty) {
      throw new BadRequestException(
        `Only ${availableQty} items available in stock`
      );
    }

    // Check if item already in cart
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId,
        productId: dto.productId,
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + dto.quantity;
      if (newQuantity > availableQty) {
        throw new BadRequestException(
          `Only ${availableQty} items available in stock`
        );
      }

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          tenantId,
          cartId,
          productId: dto.productId,
          quantity: dto.quantity,
          price: product.price,
        },
      });
    }

    // Recalculate cart totals
    await this.recalculateCart(cartId);

    return this.getCart(tenantId, cartId);
  }

  /**
   * Update cart item quantity
   */
  async updateItem(
    tenantId: string,
    cartId: string,
    itemId: string,
    dto: UpdateCartItemDto
  ) {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId,
        cart: { tenantId },
      },
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
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    if (dto.quantity === 0) {
      // Remove item
      await this.prisma.cartItem.delete({
        where: { id: itemId },
      });
    } else {
      // Check stock
      const availableQty = cartItem.product.item.warehouseItemBalances.reduce(
        (sum, b) => sum + Number(b.actualQty) - Number(b.reservedQty),
        0
      );

      if (dto.quantity > availableQty) {
        throw new BadRequestException(
          `Only ${availableQty} items available in stock`
        );
      }

      await this.prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: dto.quantity },
      });
    }

    // Recalculate cart totals
    await this.recalculateCart(cartId);

    return this.getCart(tenantId, cartId);
  }

  /**
   * Remove item from cart
   */
  async removeItem(tenantId: string, cartId: string, itemId: string) {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId,
        cart: { tenantId },
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    // Recalculate cart totals
    await this.recalculateCart(cartId);

    return this.getCart(tenantId, cartId);
  }

  /**
   * Apply coupon code
   */
  async applyCoupon(tenantId: string, cartId: string, code: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { id: cartId, tenantId },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    // Find coupon
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        tenantId,
        code: code.toUpperCase(),
        isActive: true,
      },
    });

    if (!coupon) {
      throw new BadRequestException('Invalid coupon code');
    }

    // Check validity
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('Coupon is not yet valid');
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    // Check minimum order amount
    if (coupon.minimumOrderAmount && Number(cart.subtotal) < Number(coupon.minimumOrderAmount)) {
      throw new BadRequestException(
        `Minimum order amount of $${coupon.minimumOrderAmount} required`
      );
    }

    // Apply coupon
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponCode: coupon.code },
    });

    // Recalculate totals
    await this.recalculateCart(cartId);

    return this.getCart(tenantId, cartId);
  }

  /**
   * Remove coupon
   */
  async removeCoupon(tenantId: string, cartId: string) {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        couponCode: null,
        discountAmount: 0,
      },
    });

    await this.recalculateCart(cartId);

    return this.getCart(tenantId, cartId);
  }

  /**
   * Merge anonymous cart into customer cart
   */
  async mergeCart(
    tenantId: string,
    customerId: string,
    sessionToken: string
  ) {
    // Find anonymous cart
    const anonymousCart = await this.prisma.cart.findFirst({
      where: {
        tenantId,
        sessionToken,
        status: 'active',
      },
      include: {
        items: true,
      },
    });

    if (!anonymousCart) {
      // No anonymous cart to merge, just return customer cart
      return this.getOrCreateCart(tenantId, customerId);
    }

    // Find or create customer cart
    let customerCart = await this.prisma.cart.findFirst({
      where: {
        tenantId,
        customerId,
        status: 'active',
      },
    });

    if (!customerCart) {
      // Transfer anonymous cart to customer
      customerCart = await this.prisma.cart.update({
        where: { id: anonymousCart.id },
        data: {
          customerId,
          sessionToken: null,
        },
      });
    } else {
      // Merge items from anonymous cart
      for (const item of anonymousCart.items) {
        const existingItem = await this.prisma.cartItem.findFirst({
          where: {
            cartId: customerCart.id,
            productId: item.productId,
          },
        });

        if (existingItem) {
          await this.prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: existingItem.quantity + item.quantity },
          });
        } else {
          await this.prisma.cartItem.create({
            data: {
              tenantId,
              cartId: customerCart.id,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            },
          });
        }
      }

      // Delete anonymous cart
      await this.prisma.cart.delete({
        where: { id: anonymousCart.id },
      });

      // Recalculate customer cart
      await this.recalculateCart(customerCart.id);
    }

    return this.getCart(tenantId, customerCart.id);
  }

  /**
   * Clear cart
   */
  async clearCart(tenantId: string, cartId: string) {
    await this.prisma.cartItem.deleteMany({
      where: { cartId },
    });

    await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        subtotal: 0,
        shippingTotal: 0,
        taxTotal: 0,
        discountAmount: 0,
        grandTotal: 0,
        couponCode: null,
      },
    });

    return this.getCart(tenantId, cartId);
  }

  // ============ INTERNAL HELPERS ============

  /**
   * Recalculate cart totals
   */
  private async recalculateCart(cartId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) return;

    // Calculate subtotal
    let subtotal = 0;
    for (const item of cart.items) {
      subtotal += Number(item.price) * item.quantity;
    }

    // Calculate shipping
    const shippingTotal = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_RATE;

    // Calculate discount
    let discountAmount = 0;
    if (cart.couponCode) {
      const coupon = await this.prisma.coupon.findFirst({
        where: { tenantId: cart.tenantId, code: cart.couponCode },
      });

      if (coupon) {
        if (coupon.discountType === 'percentage') {
          discountAmount = subtotal * (Number(coupon.discountValue) / 100);
        } else {
          discountAmount = Number(coupon.discountValue);
        }

        // Apply maximum discount cap
        if (coupon.maximumDiscount) {
          discountAmount = Math.min(discountAmount, Number(coupon.maximumDiscount));
        }

        // Don't let discount exceed subtotal
        discountAmount = Math.min(discountAmount, subtotal);
      }
    }

    // Calculate tax (on subtotal - discount)
    const taxableAmount = subtotal - discountAmount;
    const taxTotal = taxableAmount * DEFAULT_TAX_RATE;

    // Calculate grand total
    const grandTotal = subtotal - discountAmount + shippingTotal + taxTotal;

    // Update cart
    await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        subtotal,
        shippingTotal,
        taxTotal,
        discountAmount,
        grandTotal,
        lastActivityAt: new Date(),
      },
    });
  }

  private readonly cartInclude = {
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
      orderBy: { createdAt: 'asc' as const },
    },
  };

  private mapCartToResponse(cart: any) {
    return {
      id: cart.id,
      sessionToken: cart.sessionToken,
      items: cart.items.map((item: any) => {
        const availableQty = item.product.item.warehouseItemBalances.reduce(
          (sum: number, b: any) => sum + Number(b.actualQty) - Number(b.reservedQty),
          0
        );

        return {
          id: item.id,
          product: {
            id: item.product.id,
            slug: item.product.slug,
            displayName: item.product.displayName,
            price: Number(item.product.price),
            compareAtPrice: item.product.compareAtPrice
              ? Number(item.product.compareAtPrice)
              : null,
            images: item.product.images,
            stockStatus:
              availableQty <= 0
                ? 'out_of_stock'
                : availableQty <= 5
                ? 'low_stock'
                : 'in_stock',
          },
          quantity: item.quantity,
          unitPrice: Number(item.price),
          totalPrice: Number(item.price) * item.quantity,
        };
      }),
      itemCount: cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      subtotal: Number(cart.subtotal),
      shippingTotal: Number(cart.shippingTotal),
      taxTotal: Number(cart.taxTotal),
      discountAmount: Number(cart.discountAmount),
      grandTotal: Number(cart.grandTotal),
      couponCode: cart.couponCode,
    };
  }
}
