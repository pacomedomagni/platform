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
import { SuppliersService } from './suppliers.service';

@Controller('purchasing/suppliers')
@UseGuards(StoreAdminGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  /**
   * List all suppliers
   * GET /api/v1/purchasing/suppliers
   */
  @Get()
  async listSuppliers(
    @Headers('x-tenant-id') tenantId: string,
    @Query('search') search?: string,
    @Query('supplierGroup') supplierGroup?: string,
    @Query('country') country?: string,
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    return this.suppliersService.listSuppliers(tenantId, {
      search,
      supplierGroup,
      country,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * Get supplier statistics
   * GET /api/v1/purchasing/suppliers/stats
   */
  @Get('stats')
  async getStats(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.suppliersService.getSupplierStats(tenantId);
  }

  /**
   * Get filter options (groups, countries)
   * GET /api/v1/purchasing/suppliers/filters
   */
  @Get('filters')
  async getFilters(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.suppliersService.getSupplierFilters(tenantId);
  }

  /**
   * Get supplier details
   * GET /api/v1/purchasing/suppliers/:id
   */
  @Get(':id')
  async getSupplier(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.suppliersService.getSupplier(tenantId, id);
  }

  /**
   * Create new supplier
   * POST /api/v1/purchasing/suppliers
   */
  @Post()
  async createSupplier(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      code: string;
      supplierName: string;
      supplierType?: string;
      supplierGroup?: string;
      country?: string;
      taxId?: string;
      taxCategory?: string;
      taxWithholdingCategory?: string;
      defaultCurrency?: string;
      defaultPriceList?: string;
      defaultPaymentTerms?: string;
      paymentDays?: number;
      payableAccount?: string;
      expenseAccount?: string;
      primaryAddress?: string;
      primaryContact?: string;
      website?: string;
      notes?: string;
    },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.suppliersService.createSupplier(tenantId, body);
  }

  /**
   * Update supplier
   * PUT /api/v1/purchasing/suppliers/:id
   */
  @Put(':id')
  async updateSupplier(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      supplierName?: string;
      supplierType?: string;
      supplierGroup?: string;
      country?: string;
      taxId?: string;
      taxCategory?: string;
      taxWithholdingCategory?: string;
      defaultCurrency?: string;
      defaultPriceList?: string;
      defaultPaymentTerms?: string;
      paymentDays?: number;
      payableAccount?: string;
      expenseAccount?: string;
      primaryAddress?: string;
      primaryContact?: string;
      website?: string;
      notes?: string;
      isActive?: boolean;
      isFrozen?: boolean;
    },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.suppliersService.updateSupplier(tenantId, id, body);
  }

  /**
   * Delete supplier (soft delete)
   * DELETE /api/v1/purchasing/suppliers/:id
   */
  @Delete(':id')
  async deleteSupplier(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.suppliersService.deleteSupplier(tenantId, id);
  }
}
