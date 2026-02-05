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
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto, ApplyCouponDto, MergeCartDto } from './dto';

@Controller('api/v1/store/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Get or create cart
   * GET /api/v1/store/cart
   */
  @Get()
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
  async getCartById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.cartService.getCart(tenantId, cartId);
  }

  /**
   * Add item to cart
   * POST /api/v1/store/cart/:id/items
   */
  @Post(':id/items')
  async addItem(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string,
    @Body() dto: AddToCartDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.cartService.addItem(tenantId, cartId, dto);
  }

  /**
   * Update cart item quantity
   * PUT /api/v1/store/cart/:id/items/:itemId
   */
  @Put(':id/items/:itemId')
  async updateItem(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.cartService.updateItem(tenantId, cartId, itemId, dto);
  }

  /**
   * Remove item from cart
   * DELETE /api/v1/store/cart/:id/items/:itemId
   */
  @Delete(':id/items/:itemId')
  async removeItem(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string,
    @Param('itemId') itemId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.cartService.removeItem(tenantId, cartId, itemId);
  }

  /**
   * Apply coupon code
   * POST /api/v1/store/cart/:id/coupon
   */
  @Post(':id/coupon')
  async applyCoupon(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string,
    @Body() dto: ApplyCouponDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.cartService.applyCoupon(tenantId, cartId, dto.code);
  }

  /**
   * Remove coupon
   * DELETE /api/v1/store/cart/:id/coupon
   */
  @Delete(':id/coupon')
  async removeCoupon(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.cartService.removeCoupon(tenantId, cartId);
  }

  /**
   * Merge anonymous cart into customer cart
   * POST /api/v1/store/cart/merge
   */
  @Post('merge')
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
  async clearCart(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') cartId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.cartService.clearCart(tenantId, cartId);
  }
}
