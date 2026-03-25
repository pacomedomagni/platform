import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  Req,
  BadRequestException,
  UnauthorizedException,
  RawBodyRequest,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreateRefundDto, SquarePaymentDto } from './dto';
import { StoreAdminGuard } from '@platform/auth';
import { SquarePaymentService } from '../../onboarding/square-payment.service';
import { CustomerAuthService } from '../auth/customer-auth.service';
import { CustomerAuthGuard } from '../auth/customer-auth.guard';

@Controller('store/payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly squarePaymentService: SquarePaymentService,
    private readonly authService: CustomerAuthService,
  ) {}

  /**
   * Get payment configuration (public key, provider info)
   * GET /api/v1/store/payments/config
   */
  @Get('config')
  async getConfig(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    return this.paymentsService.getConfig(tenantId);
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
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
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
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Headers('authorization') authHeader?: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    if (!authHeader) {
      throw new BadRequestException('Authentication required');
    }
    // Verify order ownership to prevent IDOR
    const [type, token] = (authHeader || '').split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header');
    }
    const payload = await this.authService.verifyToken(token);
    if (payload.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid token');
    }
    return this.paymentsService.getOrderPayments(tenantId, orderId, payload.customerId);
  }

  /**
   * Create refund (admin)
   * POST /api/v1/store/payments/refund
   */
  @Post('refund')
  @UseGuards(StoreAdminGuard)
  async createRefund(
    @Req() req: Request,
    @Body() dto: CreateRefundDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
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
  @UseGuards(CustomerAuthGuard)
  async processSquarePayment(
    @Req() req: Request,
    @Body() dto: SquarePaymentDto,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.paymentsService.processSquarePayment(tenantId, dto.orderId, dto.sourceId);
  }
}
