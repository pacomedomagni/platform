import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { AdminCustomersService } from './admin-customers.service';

@Controller('store/admin/customers')
@UseGuards(StoreAdminGuard)
export class AdminCustomersController {
  constructor(private readonly customersService: AdminCustomersService) {}

  /**
   * List all customers (admin)
   * GET /api/v1/store/admin/customers
   */
  @Get()
  async listCustomers(
    @Headers('x-tenant-id') tenantId: string,
    @Query('search') search?: string,
    @Query('segment') segment?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.customersService.listCustomers(tenantId, { search, segment });
  }

  /**
   * Get single customer detail (admin)
   * GET /api/v1/store/admin/customers/:id
   */
  @Get(':id')
  async getCustomer(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') customerId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.customersService.getCustomer(tenantId, customerId);
  }

  /**
   * Get customer's orders (admin)
   * GET /api/v1/store/admin/customers/:id/orders
   */
  @Get(':id/orders')
  async getCustomerOrders(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') customerId: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.customersService.getCustomerOrders(tenantId, customerId);
  }

  /**
   * Update customer info (admin)
   * PUT /api/v1/store/admin/customers/:id
   */
  @Put(':id')
  async updateCustomer(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') customerId: string,
    @Body() body: { firstName?: string; lastName?: string; phone?: string; isActive?: boolean }
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.customersService.updateCustomer(tenantId, customerId, body);
  }
}
