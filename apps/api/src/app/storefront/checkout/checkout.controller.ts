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
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto, UpdateCheckoutDto } from './dto';

@Controller('api/v1/store/checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  /**
   * Create checkout from cart
   * POST /api/v1/store/checkout
   */
  @Post()
  async createCheckout(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-customer-id') customerId: string | undefined,
    @Body() dto: CreateCheckoutDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.checkoutService.createCheckout(tenantId, dto, customerId);
  }

  /**
   * Get checkout/order by ID
   * GET /api/v1/store/checkout/:id
   */
  @Get(':id')
  async getCheckout(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') orderId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.checkoutService.getCheckout(tenantId, orderId);
  }

  /**
   * Get checkout by order number
   * GET /api/v1/store/checkout/order/:orderNumber
   */
  @Get('order/:orderNumber')
  async getCheckoutByOrderNumber(
    @Headers('x-tenant-id') tenantId: string,
    @Param('orderNumber') orderNumber: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.checkoutService.getCheckoutByOrderNumber(tenantId, orderNumber);
  }

  /**
   * Update checkout info
   * PUT /api/v1/store/checkout/:id
   */
  @Put(':id')
  async updateCheckout(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') orderId: string,
    @Body() dto: UpdateCheckoutDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.checkoutService.updateCheckout(tenantId, orderId, dto);
  }

  /**
   * Cancel checkout/order
   * DELETE /api/v1/store/checkout/:id
   */
  @Delete(':id')
  async cancelCheckout(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') orderId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.checkoutService.cancelCheckout(tenantId, orderId);
  }
}
