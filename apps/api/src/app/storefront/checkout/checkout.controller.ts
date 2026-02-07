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
import { CheckoutService } from './checkout.service';
import { CustomerAuthService } from '../auth/customer-auth.service';
import { CreateCheckoutDto, UpdateCheckoutDto } from './dto';

@Controller('store/checkout')
export class CheckoutController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly customerAuthService: CustomerAuthService,
  ) {}

  /**
   * Extract optional customer ID from Bearer token (PAY-1)
   * Returns undefined for anonymous/guest users
   */
  private async getOptionalCustomerId(authHeader?: string, tenantId?: string): Promise<string | undefined> {
    if (!authHeader || !tenantId) return undefined;
    try {
      const [type, token] = authHeader.split(' ');
      if (type !== 'Bearer' || !token) return undefined;
      const payload = await this.customerAuthService.verifyToken(token);
      if (payload.tenantId !== tenantId) return undefined;
      return payload.customerId;
    } catch {
      return undefined;
    }
  }

  /**
   * Verify order ownership before allowing access
   * Prevents unauthorized access to other customers' orders
   */
  private async verifyOrderOwnership(
    tenantId: string,
    orderId: string,
    customerId?: string,
    email?: string
  ): Promise<void> {
    const order = await this.checkoutService.getCheckout(tenantId, orderId);

    // Order must belong to either the authenticated customer OR match the email (for guest checkouts)
    const belongsToCustomer = customerId && order.customerId === customerId;
    const belongsToEmail = email && order.email?.toLowerCase() === email.toLowerCase();

    if (!belongsToCustomer && !belongsToEmail) {
      throw new ForbiddenException('You do not have access to this order');
    }
  }

  /**
   * Create checkout from cart
   * POST /api/v1/store/checkout
   */
  @Post()
  @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 checkouts per minute - strict to prevent abuse
  async createCheckout(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string | undefined,
    @Body() dto: CreateCheckoutDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    const customerId = await this.getOptionalCustomerId(authHeader, tenantId);
    return this.checkoutService.createCheckout(tenantId, dto, customerId);
  }

  /**
   * Get checkout/order by ID
   * GET /api/v1/store/checkout/:id
   */
  @Get(':id')
  @Throttle({ medium: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  async getCheckout(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') orderId: string,
    @Headers('authorization') authHeader?: string,
    @Headers('x-customer-email') email?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const customerId = await this.getOptionalCustomerId(authHeader, tenantId);
    // Verify order ownership before allowing access
    await this.verifyOrderOwnership(tenantId, orderId, customerId, email);

    return this.checkoutService.getCheckout(tenantId, orderId);
  }

  /**
   * Get checkout by order number
   * GET /api/v1/store/checkout/order/:orderNumber
   */
  @Get('order/:orderNumber')
  @Throttle({ medium: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  async getCheckoutByOrderNumber(
    @Headers('x-tenant-id') tenantId: string,
    @Param('orderNumber') orderNumber: string,
    @Headers('authorization') authHeader?: string,
    @Headers('x-customer-email') email?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const customerId = await this.getOptionalCustomerId(authHeader, tenantId);
    const order = await this.checkoutService.getCheckoutByOrderNumber(tenantId, orderNumber);

    // Verify order ownership
    const belongsToCustomer = customerId && order.customerId === customerId;
    const belongsToEmail = email && order.email?.toLowerCase() === email.toLowerCase();

    if (!belongsToCustomer && !belongsToEmail) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  /**
   * Update checkout info
   * PUT /api/v1/store/checkout/:id
   */
  @Put(':id')
  @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async updateCheckout(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') orderId: string,
    @Body() dto: UpdateCheckoutDto,
    @Headers('authorization') authHeader?: string,
    @Headers('x-customer-email') email?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const customerId = await this.getOptionalCustomerId(authHeader, tenantId);
    // Verify order ownership before allowing modifications
    await this.verifyOrderOwnership(tenantId, orderId, customerId, email);

    return this.checkoutService.updateCheckout(tenantId, orderId, dto);
  }

  /**
   * Retry creating a payment intent for an order where Stripe failed during checkout.
   * POST /api/v1/store/checkout/:id/retry-payment
   */
  @Post(':id/retry-payment')
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  async retryPaymentIntent(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') orderId: string,
    @Headers('authorization') authHeader?: string,
    @Headers('x-customer-email') email?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const customerId = await this.getOptionalCustomerId(authHeader, tenantId);
    await this.verifyOrderOwnership(tenantId, orderId, customerId, email);

    return this.checkoutService.retryPaymentIntent(tenantId, orderId);
  }

  /**
   * Cancel checkout/order
   * DELETE /api/v1/store/checkout/:id
   */
  @Delete(':id')
  @Throttle({ medium: { limit: 5, ttl: 60000 } }) // 5 requests per minute - strict for cancellations
  async cancelCheckout(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') orderId: string,
    @Headers('authorization') authHeader?: string,
    @Headers('x-customer-email') email?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const customerId = await this.getOptionalCustomerId(authHeader, tenantId);
    // Verify order ownership before allowing cancellation
    await this.verifyOrderOwnership(tenantId, orderId, customerId, email);

    return this.checkoutService.cancelCheckout(tenantId, orderId);
  }
}
