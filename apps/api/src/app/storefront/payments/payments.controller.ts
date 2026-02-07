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
import { SquarePaymentService } from '../../onboarding/square-payment.service';
import { IsString, IsNumber, IsOptional } from 'class-validator';

class SquarePaymentDto {
  @IsString()
  orderId!: string;

  @IsString()
  sourceId!: string; // Card nonce from Square Web Payments SDK

  @IsOptional()
  @IsNumber()
  amount?: number;
}

@Controller('store/payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly squarePaymentService: SquarePaymentService,
  ) {}

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
   * Get payments for order (PAY-7: requires auth - customer must own the order)
   * GET /api/v1/store/payments/order/:orderId
   */
  @Get('order/:orderId')
  async getOrderPayments(
    @Headers('x-tenant-id') tenantId: string,
    @Param('orderId') orderId: string,
    @Headers('authorization') authHeader?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    if (!authHeader) {
      throw new BadRequestException('Authentication required');
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

  /**
   * Process Square payment (after frontend card tokenization)
   * POST /api/v1/store/payments/square
   */
  @Post('square')
  async processSquarePayment(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: SquarePaymentDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.paymentsService.processSquarePayment(tenantId, dto.orderId, dto.sourceId);
  }
}
