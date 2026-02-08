import { Controller, Get, Post, Put, Delete, Param, Query, Body, Headers, BadRequestException, UseGuards } from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { TaxRulesService } from './tax-rules.service';

@Controller('store/admin/tax-rules')
@UseGuards(StoreAdminGuard)
export class TaxRulesController {
  constructor(private readonly taxRulesService: TaxRulesService) {}

  @Get()
  async list(@Headers('x-tenant-id') tenantId: string, @Query() query: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.taxRulesService.listTaxRules(tenantId, query);
  }

  @Post()
  async create(@Headers('x-tenant-id') tenantId: string, @Body() body: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.taxRulesService.createTaxRule(tenantId, body);
  }

  @Put(':id')
  async update(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string, @Body() body: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.taxRulesService.updateTaxRule(tenantId, id, body);
  }

  @Delete(':id')
  async delete(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.taxRulesService.deleteTaxRule(tenantId, id);
  }
}
