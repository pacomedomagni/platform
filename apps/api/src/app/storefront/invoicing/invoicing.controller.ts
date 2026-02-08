import { Controller, Get, Post, Put, Delete, Param, Query, Body, Headers, BadRequestException, UseGuards } from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { InvoicingService } from './invoicing.service';

@Controller('store/admin/invoices')
@UseGuards(StoreAdminGuard)
export class InvoicingController {
  constructor(private readonly invoicingService: InvoicingService) {}

  @Get()
  async list(@Headers('x-tenant-id') tenantId: string, @Query() query: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.invoicingService.listInvoices(tenantId, query);
  }

  @Get('stats')
  async stats(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.invoicingService.getInvoiceStats(tenantId);
  }

  @Get(':id')
  async get(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.invoicingService.getInvoice(tenantId, id);
  }

  @Post()
  async create(@Headers('x-tenant-id') tenantId: string, @Body() body: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.invoicingService.createInvoice(tenantId, body);
  }

  @Put(':id')
  async update(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string, @Body() body: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.invoicingService.updateInvoice(tenantId, id, body);
  }

  @Post(':id/send')
  async send(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.invoicingService.sendInvoice(tenantId, id);
  }

  @Post(':id/payments')
  async recordPayment(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string, @Body() body: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.invoicingService.recordPayment(tenantId, id, body);
  }

  @Delete(':id')
  async delete(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.invoicingService.deleteInvoice(tenantId, id);
  }
}
