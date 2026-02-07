import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  Req,
  BadRequestException,
  RawBodyRequest,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreateRefundDto } from './dto';
import { StoreAdminGuard } from '@platform/auth';

@Controller('store/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Get payment configuration (public key)
   * GET /api/v1/store/payments/config
   */
  @Get('config')
  async getConfig() {
    return this.paymentsService.getConfig();
  }

  /**
   * Stripe webhook endpoint
   * POST /api/v1/store/payments/webhook
   */
  @Post('webhook')
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string
  ) {
    if (!request.rawBody) {
      throw new BadRequestException('Raw body is required');
    }
    return this.paymentsService.handleWebhook(request.rawBody, signature);
  }

  /**
   * Get payments for order
   * GET /api/v1/store/payments/order/:orderId
   */
  @Get('order/:orderId')
  async getOrderPayments(
    @Headers('x-tenant-id') tenantId: string,
    @Param('orderId') orderId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.paymentsService.getOrderPayments(tenantId, orderId);
  }

  /**
   * Create refund (admin)
   * POST /api/v1/store/payments/refund
   */
  @Post('refund')
  @UseGuards(StoreAdminGuard)
  async createRefund(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateRefundDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.paymentsService.createRefund(
      tenantId,
      dto.orderId,
      dto.amount,
      dto.reason
    );
  }
}
