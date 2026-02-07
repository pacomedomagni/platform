import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  Headers,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CustomerAuthService } from '../auth/customer-auth.service';
import { ListOrdersDto } from './dto';
import { StoreAdminGuard } from '@platform/auth';

@Controller('store/orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly authService: CustomerAuthService
  ) {}

  /**
   * List customer's orders
   * GET /api/v1/store/orders
   */
  @Get()
  async listOrders(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Query() query: ListOrdersDto
  ) {
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
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Param('id') orderId: string
  ) {
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
  @Get('lookup/:orderNumber')
  async lookupOrder(
    @Headers('x-tenant-id') tenantId: string,
    @Param('orderNumber') orderNumber: string,
    @Query('email') email: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    if (!email) {
      throw new BadRequestException('Email required for order lookup');
    }
    return this.ordersService.getOrderByNumber(tenantId, orderNumber, email);
  }

  // ============ ADMIN ENDPOINTS ============

  /**
   * List all orders (admin)
   * GET /api/v1/store/admin/orders
   */
  @Get('admin/all')
  @UseGuards(StoreAdminGuard)
  async listAllOrders(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: ListOrdersDto & { search?: string }
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.ordersService.listAllOrders(tenantId, query);
  }

  /**
   * Get order detail (admin)
   * GET /api/v1/store/admin/orders/:id
   */
  @Get('admin/:id')
  @UseGuards(StoreAdminGuard)
  async getOrderAdmin(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') orderId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.ordersService.getOrder(tenantId, orderId);
  }

  /**
   * Update order status (admin)
   * PUT /api/v1/store/admin/orders/:id/status
   */
  @Put('admin/:id/status')
  @UseGuards(StoreAdminGuard)
  async updateOrderStatus(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') orderId: string,
    @Body() body: { status: string; carrier?: string; trackingNumber?: string }
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.ordersService.updateOrderStatus(tenantId, orderId, body.status, {
      carrier: body.carrier,
      trackingNumber: body.trackingNumber,
    });
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
