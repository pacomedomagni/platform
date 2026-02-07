import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Headers,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto, ApplyCouponDto, MergeCartDto } from './dto';

@Controller('store/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Verify cart ownership before allowing access
   * Prevents unauthorized access to other customers' carts
   */
  private async verifyCartOwnership(
    tenantId: string,
    cartId: string,
    customerId?: string,
    sessionToken?: string
  ): Promise<void> {
    const cart = await this.cartService.getCart(tenantId, cartId);

    // Cart must belong to either the authenticated customer OR the session
    const belongsToCustomer = customerId && cart.customerId === customerId;
    const belongsToSession = sessionToken && cart.sessionToken === sessionToken;

    if (!belongsToCustomer && !belongsToSession) {
      throw new ForbiddenException('You do not have access to this cart');
    }
  }

  /**
   * Get or create cart
   * GET /api/v1/store/cart
   */
  @Get()
  @Throttle({ medium: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  async getCart(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-customer-id') customerId?: string,
    @Headers('x-cart-session') sessionToken?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.cartService.getOrCreateCart(tenantId, customerId, sessionToken);
  }

  /**
   * Get cart by ID
   * GET /api/v1/store/cart/:id
   */
  @Get(':id')
  @Throttle({ medium: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  async getCartById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string,
    @Headers('x-customer-id') customerId?: string,
    @Headers('x-cart-session') sessionToken?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    // Verify cart ownership before allowing access
    await this.verifyCartOwnership(tenantId, cartId, customerId, sessionToken);

    return this.cartService.getCart(tenantId, cartId);
  }

  /**
   * Add item to cart
   * POST /api/v1/store/cart/:id/items
   */
  @Post(':id/items')
  @Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async addItem(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string,
    @Body() dto: AddToCartDto,
    @Headers('x-customer-id') customerId?: string,
    @Headers('x-cart-session') sessionToken?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    // Verify cart ownership before allowing modifications
    await this.verifyCartOwnership(tenantId, cartId, customerId, sessionToken);

    return this.cartService.addItem(tenantId, cartId, dto);
  }

  /**
   * Update cart item quantity
   * PUT /api/v1/store/cart/:id/items/:itemId
   */
  @Put(':id/items/:itemId')
  @Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async updateItem(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Headers('x-customer-id') customerId?: string,
    @Headers('x-cart-session') sessionToken?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    // Verify cart ownership before allowing modifications
    await this.verifyCartOwnership(tenantId, cartId, customerId, sessionToken);

    return this.cartService.updateItem(tenantId, cartId, itemId, dto);
  }

  /**
   * Remove item from cart
   * DELETE /api/v1/store/cart/:id/items/:itemId
   */
  @Delete(':id/items/:itemId')
  @Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async removeItem(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string,
    @Param('itemId') itemId: string,
    @Headers('x-customer-id') customerId?: string,
    @Headers('x-cart-session') sessionToken?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    // Verify cart ownership before allowing modifications
    await this.verifyCartOwnership(tenantId, cartId, customerId, sessionToken);

    return this.cartService.removeItem(tenantId, cartId, itemId);
  }

  /**
   * Apply coupon code
   * POST /api/v1/store/cart/:id/coupon
   */
  @Post(':id/coupon')
  @Throttle({ medium: { limit: 5, ttl: 60000 } }) // 5 requests per minute - strict to prevent coupon brute-forcing
  async applyCoupon(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string,
    @Body() dto: ApplyCouponDto,
    @Headers('x-customer-id') customerId?: string,
    @Headers('x-cart-session') sessionToken?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    // Verify cart ownership before allowing coupon application
    await this.verifyCartOwnership(tenantId, cartId, customerId, sessionToken);

    return this.cartService.applyCoupon(tenantId, cartId, dto.code);
  }

  /**
   * Remove coupon
   * DELETE /api/v1/store/cart/:id/coupon
   */
  @Delete(':id/coupon')
  @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async removeCoupon(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string,
    @Headers('x-customer-id') customerId?: string,
    @Headers('x-cart-session') sessionToken?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    // Verify cart ownership before allowing modifications
    await this.verifyCartOwnership(tenantId, cartId, customerId, sessionToken);

    return this.cartService.removeCoupon(tenantId, cartId);
  }

  /**
   * Merge anonymous cart into customer cart
   * POST /api/v1/store/cart/merge
   */
  @Post('merge')
  @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async mergeCart(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-customer-id') customerId: string,
    @Body() dto: MergeCartDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    if (!customerId) {
      throw new BadRequestException('Customer ID required for cart merge');
    }
    if (!dto.sessionToken) {
      throw new BadRequestException('Session token required for cart merge');
    }
    return this.cartService.mergeCart(tenantId, customerId, dto.sessionToken);
  }

  /**
   * Clear cart
   * DELETE /api/v1/store/cart/:id
   */
  @Delete(':id')
  @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async clearCart(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string,
    @Headers('x-customer-id') customerId?: string,
    @Headers('x-cart-session') sessionToken?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    // Verify cart ownership before allowing deletion
    await this.verifyCartOwnership(tenantId, cartId, customerId, sessionToken);

    return this.cartService.clearCart(tenantId, cartId);
  }
}
