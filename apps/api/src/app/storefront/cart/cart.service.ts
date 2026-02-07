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
   * Wrapped in transaction to prevent race conditions on stock validation
   */
  async addItem(
    tenantId: string,
    cartId: string,
    dto: AddToCartDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Verify product exists and is published
      const product = await tx.productListing.findFirst({
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

      // Acquire advisory lock to prevent concurrent stock modifications
      const itemKey = `${tenantId}:${product.item.id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemKey}))`;

      // Check available stock INSIDE transaction (after lock acquired)
      const balances = await tx.warehouseItemBalance.findMany({
        where: {
          tenantId,
          itemId: product.item.id,
        },
      });

      const availableQty = balances.reduce(
        (sum, b) => sum + Number(b.actualQty) - Number(b.reservedQty),
        0
      );

      // Check if item already in cart
      const existingItem = await tx.cartItem.findFirst({
        where: {
          cartId,
          productId: dto.productId,
        },
      });

      const finalQuantity = existingItem
        ? existingItem.quantity + dto.quantity
        : dto.quantity;

      if (finalQuantity > availableQty) {
        throw new BadRequestException(
          `Only ${availableQty} items available in stock`
        );
      }

      // Upsert cart item atomically
      await tx.cartItem.upsert({
        where: {
          tenantId_cartId_productId: {
            tenantId,
            cartId,
            productId: dto.productId,
          },
        },
        update: {
          quantity: { increment: dto.quantity },
        },
        create: {
          tenantId,
          cartId,
          productId: dto.productId,
          quantity: dto.quantity,
          price: product.price,
        },
      });

      // Recalculate cart totals
      await this.recalculateCartInTx(tx, cartId);

      // Return cart data
      const cart = await tx.cart.findFirst({
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
    });
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
   * Uses transaction with SELECT FOR UPDATE to prevent race conditions
   */
  async applyCoupon(tenantId: string, cartId: string, code: string) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: { id: cartId, tenantId },
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      // Find coupon with FOR UPDATE lock to prevent concurrent usage
      const coupon = await tx.$queryRaw<any[]>`
        SELECT * FROM coupons
        WHERE "tenantId" = ${tenantId}
        AND UPPER(code) = ${code.toUpperCase()}
        AND "isActive" = true
        FOR UPDATE
      `;

      if (!coupon || coupon.length === 0) {
        throw new BadRequestException('Invalid coupon code');
      }

      const selectedCoupon = coupon[0];

      // Check validity
      const now = new Date();
      if (selectedCoupon.startsAt && new Date(selectedCoupon.startsAt) > now) {
        throw new BadRequestException('Coupon is not yet valid');
      }
      if (selectedCoupon.expiresAt && new Date(selectedCoupon.expiresAt) < now) {
        throw new BadRequestException('Coupon has expired');
      }
      if (selectedCoupon.usageLimit && selectedCoupon.timesUsed >= selectedCoupon.usageLimit) {
        throw new BadRequestException('Coupon usage limit reached');
      }

      // Check per-customer usage limit if customer is logged in
      if (cart.customerId && selectedCoupon.usageLimitPerCustomer) {
        const customerUsageCount = await tx.couponUsage.count({
          where: {
            tenantId,
            couponId: selectedCoupon.id,
            customerId: cart.customerId,
          },
        });

        if (customerUsageCount >= selectedCoupon.usageLimitPerCustomer) {
          throw new BadRequestException(
            'You have already reached the usage limit for this coupon'
          );
        }
      }

      // Check minimum order amount
      if (selectedCoupon.minimumOrderAmount && Number(cart.subtotal) < Number(selectedCoupon.minimumOrderAmount)) {
        throw new BadRequestException(
          `Minimum order amount of $${selectedCoupon.minimumOrderAmount} required`
        );
      }

      // Apply coupon to cart (timesUsed will be incremented when order is placed)
      await tx.cart.update({
        where: { id: cartId },
        data: { couponCode: selectedCoupon.code },
      });

      // Recalculate totals
      await this.recalculateCartInTx(tx, cartId);

      // Return cart data
      const updatedCart = await tx.cart.findFirst({
        where: { id: cartId, tenantId, status: 'active' },
        include: this.cartInclude,
      });

      if (!updatedCart) {
        throw new NotFoundException('Cart not found');
      }

      return this.mapCartToResponse(updatedCart);
    });
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
   * Uses atomic upsert to prevent race conditions
   */
  async mergeCart(
    tenantId: string,
    customerId: string,
    sessionToken: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Find anonymous cart
      const anonymousCart = await tx.cart.findFirst({
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
        // No anonymous cart to merge, find or create customer cart
        let customerCart = await tx.cart.findFirst({
          where: {
            tenantId,
            customerId,
            status: 'active',
          },
          include: this.cartInclude,
        });

        if (!customerCart) {
          customerCart = await tx.cart.create({
            data: {
              tenantId,
              customerId,
              status: 'active',
              lastActivityAt: new Date(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
            include: this.cartInclude,
          });
        }

        return this.mapCartToResponse(customerCart);
      }

      // Find or create customer cart
      let customerCart = await tx.cart.findFirst({
        where: {
          tenantId,
          customerId,
          status: 'active',
        },
      });

      if (!customerCart) {
        // Transfer anonymous cart to customer
        customerCart = await tx.cart.update({
          where: { id: anonymousCart.id },
          data: {
            customerId,
            sessionToken: null,
          },
        });
      } else {
        // Merge items from anonymous cart using atomic upsert
        for (const item of anonymousCart.items) {
          await tx.cartItem.upsert({
            where: {
              tenantId_cartId_productId: {
                tenantId,
                cartId: customerCart.id,
                productId: item.productId,
              },
            },
            update: {
              quantity: { increment: item.quantity },
            },
            create: {
              tenantId,
              cartId: customerCart.id,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            },
          });
        }

        // Delete anonymous cart
        await tx.cart.delete({
          where: { id: anonymousCart.id },
        });

        // Recalculate customer cart
        await this.recalculateCartInTx(tx, customerCart.id);
      }

      // Return updated cart
      const finalCart = await tx.cart.findFirst({
        where: { id: customerCart.id, tenantId, status: 'active' },
        include: this.cartInclude,
      });

      if (!finalCart) {
        throw new NotFoundException('Cart not found');
      }

      return this.mapCartToResponse(finalCart);
    });
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

  /**
   * Recalculate cart totals within a transaction
   * Used by transactional methods to avoid nested transactions
   */
  private async recalculateCartInTx(tx: any, cartId: string) {
    const cart = await tx.cart.findUnique({
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
      const coupon = await tx.coupon.findFirst({
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
    await tx.cart.update({
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
