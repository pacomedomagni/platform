/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma, WarehouseItemBalance } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { AddToCartDto, UpdateCartItemDto } from './dto';

type CartWithRelations = Prisma.CartGetPayload<{
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
}>;

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
          // PAY-14: Filter out expired carts
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
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
          // PAY-14: Filter out expired carts
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
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
        // PAY-14: Filter out expired carts
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
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
        // PAY-14: Filter out expired carts
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
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
          cartId_productId_variantId: {
            cartId,
            productId: dto.productId,
            variantId: (dto as any).variantId || null,
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

      // Reserve stock for this item
      await this.reserveStock(tx, tenantId, product.item.id, dto.quantity);

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
    return this.prisma.$transaction(async (tx) => {
      const cartItem = await tx.cartItem.findFirst({
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

      const oldQuantity = cartItem.quantity;

      if (dto.quantity === 0) {
        // Remove item and release reservation
        await this.releaseReservation(
          tx,
          tenantId,
          cartItem.product.item.id,
          oldQuantity
        );
        await tx.cartItem.delete({
          where: { id: itemId },
        });
      } else {
        // Acquire advisory lock to prevent concurrent stock modifications
        const itemKey = `${tenantId}:${cartItem.product.item.id}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemKey}))`;

        // Check stock (including current reservation)
        const balances = await tx.warehouseItemBalance.findMany({
          where: {
            tenantId,
            itemId: cartItem.product.item.id,
          },
        });

        const availableQty = balances.reduce(
          (sum, b) => sum + Number(b.actualQty) - Number(b.reservedQty),
          0
        );

        // Add back the current reservation to get true available
        const trueAvailable = availableQty + oldQuantity;

        if (dto.quantity > trueAvailable) {
          throw new BadRequestException(
            `Only ${trueAvailable} items available in stock`
          );
        }

        // Update reservation
        await this.updateReservation(
          tx,
          tenantId,
          cartItem.product.item.id,
          oldQuantity,
          dto.quantity
        );

        // Update cart item
        await tx.cartItem.update({
          where: { id: itemId },
          data: { quantity: dto.quantity },
        });
      }

      // Recalculate cart totals
      await this.recalculateCartInTx(tx, cartId);

      // Return cart data
      const cart = await tx.cart.findFirst({
        where: { id: cartId, tenantId, status: 'active' },
        include: this.cartInclude,
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      return this.mapCartToResponse(cart);
    });
  }

  /**
   * Remove item from cart
   */
  async removeItem(tenantId: string, cartId: string, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const cartItem = await tx.cartItem.findFirst({
        where: {
          id: itemId,
          cartId,
          cart: { tenantId },
        },
        include: {
          product: {
            include: {
              item: true,
            },
          },
        },
      });

      if (!cartItem) {
        throw new NotFoundException('Cart item not found');
      }

      // Release stock reservation
      await this.releaseReservation(
        tx,
        tenantId,
        cartItem.product.item.id,
        cartItem.quantity
      );

      // Remove item
      await tx.cartItem.delete({
        where: { id: itemId },
      });

      // Recalculate cart totals
      await this.recalculateCartInTx(tx, cartId);

      // Return cart data
      const cart = await tx.cart.findFirst({
        where: { id: cartId, tenantId, status: 'active' },
        include: this.cartInclude,
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      return this.mapCartToResponse(cart);
    });
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
              cartId_productId_variantId: {
                cartId: customerCart.id,
                productId: item.productId,
                variantId: item.variantId || null,
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
    return this.prisma.$transaction(async (tx) => {
      // Release all stock reservations
      await this.releaseAllReservations(tx, tenantId, cartId);

      // Delete cart items
      await tx.cartItem.deleteMany({
        where: { cartId },
      });

      // Reset cart totals
      await tx.cart.update({
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

      // Return cart data
      const cart = await tx.cart.findFirst({
        where: { id: cartId, tenantId, status: 'active' },
        include: this.cartInclude,
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      return this.mapCartToResponse(cart);
    });
  }

  // ============ INTERNAL HELPERS ============

  /**
   * Reserve stock for a cart item
   * Increments reservedQty in warehouse balances
   */
  private async reserveStock(
    tx: Prisma.TransactionClient,
    tenantId: string,
    itemId: string,
    quantity: number
  ): Promise<void> {
    // Get default warehouse (in production, this would be based on location/shipping address)
    const warehouse = await tx.warehouse.findFirst({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!warehouse) {
      throw new BadRequestException('No active warehouse found');
    }

    // Atomically increment reservedQty
    await tx.warehouseItemBalance.upsert({
      where: {
        tenantId_itemId_warehouseId: {
          tenantId,
          itemId,
          warehouseId: warehouse.id,
        },
      },
      update: {
        reservedQty: { increment: quantity },
      },
      create: {
        tenantId,
        itemId,
        warehouseId: warehouse.id,
        actualQty: 0,
        reservedQty: quantity,
      },
    });
  }

  /**
   * Release stock reservation for a cart item
   * Decrements reservedQty in warehouse balances
   */
  private async releaseReservation(
    tx: Prisma.TransactionClient,
    tenantId: string,
    itemId: string,
    quantity: number
  ): Promise<void> {
    const warehouse = await tx.warehouse.findFirst({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!warehouse) {
      return; // Silently skip if no warehouse
    }

    // Atomically decrement reservedQty
    await tx.warehouseItemBalance.updateMany({
      where: {
        tenantId,
        itemId,
        warehouseId: warehouse.id,
      },
      data: {
        reservedQty: { decrement: quantity },
      },
    });
  }

  /**
   * Update stock reservation when cart item quantity changes
   * Adjusts reservedQty by the delta (can be positive or negative)
   */
  private async updateReservation(
    tx: Prisma.TransactionClient,
    tenantId: string,
    itemId: string,
    oldQuantity: number,
    newQuantity: number
  ): Promise<void> {
    const delta = newQuantity - oldQuantity;
    if (delta === 0) return;

    if (delta > 0) {
      // Increased quantity - reserve more stock
      await this.reserveStock(tx, tenantId, itemId, delta);
    } else {
      // Decreased quantity - release some reservation
      await this.releaseReservation(tx, tenantId, itemId, Math.abs(delta));
    }
  }

  /**
   * Release all stock reservations for a cart
   * Called when cart is cleared or expired
   */
  private async releaseAllReservations(
    tx: Prisma.TransactionClient,
    tenantId: string,
    cartId: string
  ): Promise<void> {
    const cart = await tx.cart.findUnique({
      where: { id: cartId },
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

    if (!cart) return;

    for (const item of cart.items) {
      await this.releaseReservation(
        tx,
        tenantId,
        item.product.item.id,
        item.quantity
      );
    }
  }

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

    // PAY-12: Fetch tenant-specific rates (fall back to defaults)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: cart.tenantId },
      select: { defaultTaxRate: true, defaultShippingRate: true, freeShippingThreshold: true },
    });
    const taxRate = tenant ? Number(tenant.defaultTaxRate) : DEFAULT_TAX_RATE;
    const shippingRate = tenant ? Number(tenant.defaultShippingRate) : DEFAULT_SHIPPING_RATE;
    const freeThreshold = tenant ? Number(tenant.freeShippingThreshold) : FREE_SHIPPING_THRESHOLD;

    // PAY-11: Calculate in integer cents to avoid floating-point errors
    let subtotalCents = 0;
    for (const item of cart.items) {
      subtotalCents += Math.round(Number(item.price) * 100) * item.quantity;
    }

    // Calculate shipping in cents
    const shippingCents = subtotalCents >= Math.round(freeThreshold * 100) ? 0 : Math.round(shippingRate * 100);

    // Calculate discount in cents
    let discountCents = 0;
    if (cart.couponCode) {
      const coupon = await this.prisma.coupon.findFirst({
        where: { tenantId: cart.tenantId, code: cart.couponCode },
      });

      if (coupon) {
        if (coupon.discountType === 'percentage') {
          discountCents = Math.round(subtotalCents * (Number(coupon.discountValue) / 100));
        } else {
          discountCents = Math.round(Number(coupon.discountValue) * 100);
        }

        if (coupon.maximumDiscount) {
          discountCents = Math.min(discountCents, Math.round(Number(coupon.maximumDiscount) * 100));
        }

        discountCents = Math.min(discountCents, subtotalCents);
      }
    }

    // Calculate tax in cents (on subtotal - discount)
    const taxableCents = subtotalCents - discountCents;
    const taxCents = Math.round(taxableCents * taxRate);

    // Calculate grand total in cents
    const grandTotalCents = subtotalCents - discountCents + shippingCents + taxCents;

    // Convert back to dollars for storage
    await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        subtotal: subtotalCents / 100,
        shippingTotal: shippingCents / 100,
        taxTotal: taxCents / 100,
        discountAmount: discountCents / 100,
        grandTotal: grandTotalCents / 100,
        lastActivityAt: new Date(),
        // PAY-14: Extend expiry on activity
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  /**
   * Recalculate cart totals within a transaction
   * Used by transactional methods to avoid nested transactions
   */
  private async recalculateCartInTx(tx: Prisma.TransactionClient, cartId: string) {
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

    // PAY-12: Fetch tenant-specific rates (fall back to defaults)
    const tenant = await tx.tenant.findUnique({
      where: { id: cart.tenantId },
      select: { defaultTaxRate: true, defaultShippingRate: true, freeShippingThreshold: true },
    });
    const taxRate = tenant ? Number(tenant.defaultTaxRate) : DEFAULT_TAX_RATE;
    const shippingRate = tenant ? Number(tenant.defaultShippingRate) : DEFAULT_SHIPPING_RATE;
    const freeThreshold = tenant ? Number(tenant.freeShippingThreshold) : FREE_SHIPPING_THRESHOLD;

    // PAY-11: Calculate in integer cents to avoid floating-point errors
    let subtotalCents = 0;
    for (const item of cart.items) {
      subtotalCents += Math.round(Number(item.price) * 100) * item.quantity;
    }

    // Calculate shipping in cents
    const shippingCents = subtotalCents >= Math.round(freeThreshold * 100) ? 0 : Math.round(shippingRate * 100);

    // Calculate discount in cents
    let discountCents = 0;
    if (cart.couponCode) {
      const coupon = await tx.coupon.findFirst({
        where: { tenantId: cart.tenantId, code: cart.couponCode },
      });

      if (coupon) {
        if (coupon.discountType === 'percentage') {
          discountCents = Math.round(subtotalCents * (Number(coupon.discountValue) / 100));
        } else {
          discountCents = Math.round(Number(coupon.discountValue) * 100);
        }

        if (coupon.maximumDiscount) {
          discountCents = Math.min(discountCents, Math.round(Number(coupon.maximumDiscount) * 100));
        }

        discountCents = Math.min(discountCents, subtotalCents);
      }
    }

    // Calculate tax in cents (on subtotal - discount)
    const taxableCents = subtotalCents - discountCents;
    const taxCents = Math.round(taxableCents * taxRate);

    // Calculate grand total in cents
    const grandTotalCents = subtotalCents - discountCents + shippingCents + taxCents;

    // Convert back to dollars for storage
    await tx.cart.update({
      where: { id: cartId },
      data: {
        subtotal: subtotalCents / 100,
        shippingTotal: shippingCents / 100,
        taxTotal: taxCents / 100,
        discountAmount: discountCents / 100,
        grandTotal: grandTotalCents / 100,
        lastActivityAt: new Date(),
        // PAY-14: Extend expiry on activity
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

  private mapCartToResponse(cart: CartWithRelations) {
    return {
      id: cart.id,
      customerId: cart.customerId,
      sessionToken: cart.sessionToken,
      items: cart.items.map((item) => {
        const availableQty = item.product.item!.warehouseItemBalances.reduce(
          (sum: number, b: WarehouseItemBalance) => sum + Number(b.actualQty) - Number(b.reservedQty),
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
      itemCount: cart.items.reduce((sum: number, item) => sum + item.quantity, 0),
      subtotal: Number(cart.subtotal),
      shippingTotal: Number(cart.shippingTotal),
      taxTotal: Number(cart.taxTotal),
      discountAmount: Number(cart.discountAmount),
      grandTotal: Number(cart.grandTotal),
      couponCode: cart.couponCode,
    };
  }
}
