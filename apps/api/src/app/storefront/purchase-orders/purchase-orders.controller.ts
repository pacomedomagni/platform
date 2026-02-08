import { Controller, Get, Post, Put, Delete, Param, Query, Body, Headers, BadRequestException, UseGuards } from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('store/admin/purchase-orders')
@UseGuards(StoreAdminGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  async list(@Headers('x-tenant-id') tenantId: string, @Query() query: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.purchaseOrdersService.listPurchaseOrders(tenantId, query);
  }

  @Get('stats')
  async stats(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.purchaseOrdersService.getPurchaseOrderStats(tenantId);
  }

  @Get(':id')
  async get(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.purchaseOrdersService.getPurchaseOrder(tenantId, id);
  }

  @Post()
  async create(@Headers('x-tenant-id') tenantId: string, @Body() body: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.purchaseOrdersService.createPurchaseOrder(tenantId, body);
  }

  @Put(':id')
  async update(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string, @Body() body: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.purchaseOrdersService.updatePurchaseOrder(tenantId, id, body);
  }

  @Post(':id/receive')
  async receiveGoods(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string, @Body() body: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.purchaseOrdersService.receiveGoods(tenantId, id, body);
  }

  @Delete(':id')
  async delete(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.purchaseOrdersService.deletePurchaseOrder(tenantId, id);
  }
}
