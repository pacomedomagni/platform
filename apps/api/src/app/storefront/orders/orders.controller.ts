import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  Headers,
  Req,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { PaymentsService } from '../payments/payments.service';
import { CustomerAuthService } from '../auth/customer-auth.service';
import { ListOrdersDto } from './dto';
import { StoreAdminGuard } from '@platform/auth';

@Controller('store/orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly authService: CustomerAuthService
  ) {}

  /**
   * List customer's orders
   * GET /api/v1/store/orders
   */
  @Get()
  async listOrders(
    @Req() req: Request,
    @Headers('authorization') authHeader: string,
    @Query() query: ListOrdersDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const customerId = await this.getCustomerId(authHeader, tenantId);
    return this.ordersService.listOrders(tenantId, customerId, query);
  }

  /**
   * Get order detail (authenticated customer)
   * GET /api/v1/store/orders/:id
   */
  @Get(':id')
  async getOrder(
    @Req() req: Request,
    @Headers('authorization') authHeader: string,
    @Param('id') orderId: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const customerId = await this.getCustomerId(authHeader, tenantId);
    return this.ordersService.getOrder(tenantId, orderId, customerId);
  }

  /**
   * Get order by order number (guest lookup)
   * GET /api/v1/store/orders/lookup/:orderNumber
   */
  // Phase 1 W1.6: tighter per-IP rate so guest lookup cannot be used to
  // brute-force order numbers at 7k/day. Also enforces a 14-day age cutoff
  // in the service layer (see orders.service getOrderByNumber).
  @Throttle({ short: { limit: 3, ttl: 60000 }, long: { limit: 50, ttl: 24 * 60 * 60 * 1000 } })
  @Get('lookup/:orderNumber')
  async lookupOrder(
    @Req() req: Request,
    @Param('orderNumber') orderNumber: string,
    @Query('email') email: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    if (!email) {
      throw new BadRequestException('Email required for order lookup');
    }
    return this.ordersService.getOrderByNumber(tenantId, orderNumber, email);
  }

  /**
   * Cancel an order (authenticated customer)
   * POST /api/v1/store/orders/:id/cancel
   */
  @Post(':id/cancel')
  async cancelOrder(
    @Req() req: Request,
    @Headers('authorization') authHeader: string,
    @Param('id') orderId: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const customerId = await this.getCustomerId(authHeader, tenantId);
    // Verify ownership
    await this.ordersService.getOrder(tenantId, orderId, customerId);
    // Fix #32: Use customer transition map (more restrictive, e.g. no cancel after shipment)
    return this.ordersService.updateOrderStatus(tenantId, orderId, 'CANCELLED', undefined, { isCustomer: true });
  }

  // ============ ADMIN ENDPOINTS ============

  /**
   * Get order stats (admin)
   * GET /api/v1/store/orders/admin/stats
   */
  @Get('admin/stats')
  @UseGuards(StoreAdminGuard)
  async getOrderStats(
    @Req() req: Request,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.ordersService.getOrderStats(tenantId);
  }

  /**
   * List all orders (admin)
   * GET /api/v1/store/orders/admin/all
   */
  @Get('admin/all')
  @UseGuards(StoreAdminGuard)
  async listAllOrders(
    @Req() req: Request,
    @Query() query: ListOrdersDto & { search?: string }
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.ordersService.listAllOrders(tenantId, query);
  }

  /**
   * Get order detail (admin)
   * GET /api/v1/store/orders/admin/:id
   */
  @Get('admin/:id')
  @UseGuards(StoreAdminGuard)
  async getOrderAdmin(
    @Req() req: Request,
    @Param('id') orderId: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.ordersService.getOrder(tenantId, orderId);
  }

  /**
   * Update order status (admin)
   * PUT /api/v1/store/orders/admin/:id/status
   */
  @Put('admin/:id/status')
  @UseGuards(StoreAdminGuard)
  async updateOrderStatus(
    @Req() req: Request,
    @Param('id') orderId: string,
    @Body() body: { status: string; carrier?: string; trackingNumber?: string; adminNotes?: string }
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.ordersService.updateOrderStatus(tenantId, orderId, body.status, {
      carrier: body.carrier,
      trackingNumber: body.trackingNumber,
      adminNotes: body.adminNotes,
    });
  }

  /**
   * Process refund for order (admin)
   * POST /api/v1/store/orders/admin/:id/refund
   */
  @Post('admin/:id/refund')
  @UseGuards(StoreAdminGuard)
  async refundOrder(
    @Req() req: Request,
    @Param('id') orderId: string,
    @Body() body: { amount?: number; reason?: string }
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    // Map free-text reason to Stripe's accepted reason enum, defaulting to 'requested_by_customer'
    const reasonMap: Record<string, 'duplicate' | 'fraudulent' | 'requested_by_customer'> = {
      duplicate: 'duplicate',
      fraudulent: 'fraudulent',
      requested_by_customer: 'requested_by_customer',
    };
    const stripeReason = body.reason
      ? reasonMap[body.reason] || 'requested_by_customer'
      : 'requested_by_customer';

    return this.paymentsService.createRefund(tenantId, orderId, body.amount, stripeReason);
  }

  // ============ HELPERS ============

  private async getCustomerId(authHeader: string, tenantId: string): Promise<string> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization required');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header');
    }

    const payload = await this.authService.verifyToken(token);
    if (payload.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid token');
    }
    return payload.customerId;
  }
}
