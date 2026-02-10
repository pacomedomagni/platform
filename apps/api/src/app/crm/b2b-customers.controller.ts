import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { B2BCustomersService } from './b2b-customers.service';

@Controller('crm/customers')
@UseGuards(StoreAdminGuard)
export class B2BCustomersController {
  constructor(private readonly customersService: B2BCustomersService) {}

  /**
   * List all B2B customers
   * GET /api/v1/crm/customers
   */
  @Get()
  async listCustomers(
    @Headers('x-tenant-id') tenantId: string,
    @Query('search') search?: string,
    @Query('customerGroup') customerGroup?: string,
    @Query('territory') territory?: string,
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    return this.customersService.listCustomers(tenantId, {
      search,
      customerGroup,
      territory,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * Get customer statistics
   * GET /api/v1/crm/customers/stats
   */
  @Get('stats')
  async getStats(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.customersService.getCustomerStats(tenantId);
  }

  /**
   * Get filter options (groups, territories)
   * GET /api/v1/crm/customers/filters
   */
  @Get('filters')
  async getFilters(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.customersService.getCustomerFilters(tenantId);
  }

  /**
   * Get customer details
   * GET /api/v1/crm/customers/:id
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
   * Create new B2B customer
   * POST /api/v1/crm/customers
   */
  @Post()
  async createCustomer(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      code: string;
      customerName: string;
      customerType?: string;
      customerGroup?: string;
      territory?: string;
      taxId?: string;
      taxCategory?: string;
      defaultCurrency?: string;
      defaultPriceList?: string;
      defaultPaymentTerms?: string;
      creditLimit?: number;
      creditDays?: number;
      receivableAccount?: string;
      primaryAddress?: string;
      primaryContact?: string;
      website?: string;
      notes?: string;
    },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.customersService.createCustomer(tenantId, body);
  }

  /**
   * Update customer
   * PUT /api/v1/crm/customers/:id
   */
  @Put(':id')
  async updateCustomer(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      customerName?: string;
      customerType?: string;
      customerGroup?: string;
      territory?: string;
      taxId?: string;
      taxCategory?: string;
      defaultCurrency?: string;
      defaultPriceList?: string;
      defaultPaymentTerms?: string;
      creditLimit?: number;
      creditDays?: number;
      receivableAccount?: string;
      primaryAddress?: string;
      primaryContact?: string;
      website?: string;
      notes?: string;
      isActive?: boolean;
      isFrozen?: boolean;
    },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.customersService.updateCustomer(tenantId, id, body);
  }

  /**
   * Delete customer (soft delete)
   * DELETE /api/v1/crm/customers/:id
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
   * Link store customer to B2B customer
   * POST /api/v1/crm/customers/:id/link-store-customer
   */
  @Post(':id/link-store-customer')
  async linkStoreCustomer(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') customerId: string,
    @Body() body: { storeCustomerId: string },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.customersService.linkStoreCustomer(tenantId, customerId, body.storeCustomerId);
  }
}
