import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { CustomersService } from './customers.service';

@Controller('store/admin/customers')
@UseGuards(StoreAdminGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * List all customers with optional filtering
   */
  @Get()
  async listCustomers(
    @Headers('x-tenant-id') tenantId: string,
    @Query('search') search?: string,
    @Query('segment') segment?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    return this.customersService.listCustomers(
      tenantId,
      search,
      segment,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * Get customer statistics
   */
  @Get('stats')
  async getStats(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.customersService.getCustomerStats(tenantId);
  }

  /**
   * Get customer details
   */
  @Get(':id')
  async getCustomer(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.customersService.getCustomer(tenantId, id);
  }

  /**
   * Update customer profile
   */
  @Put(':id')
  async updateCustomer(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.customersService.updateCustomer(tenantId, id, body);
  }

  /**
   * Deactivate customer
   */
  @Delete(':id')
  async deleteCustomer(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.customersService.deleteCustomer(tenantId, id);
  }

  /**
   * Get customer orders
   */
  @Get(':id/orders')
  async getCustomerOrders(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.customersService.getCustomerOrders(tenantId, id);
  }
}
