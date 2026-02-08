import { Controller, Get, Post, Put, Delete, Param, Query, Body, Headers, BadRequestException, UseGuards } from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { ExpensesService } from './expenses.service';

@Controller('store/admin/expenses')
@UseGuards(StoreAdminGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  async list(@Headers('x-tenant-id') tenantId: string, @Query() query: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.expensesService.listExpenses(tenantId, query);
  }

  @Get('stats')
  async stats(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.expensesService.getExpenseStats(tenantId);
  }

  @Get('categories')
  async listCategories(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.expensesService.listCategories(tenantId);
  }

  @Post('categories')
  async createCategory(@Headers('x-tenant-id') tenantId: string, @Body() body: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.expensesService.createCategory(tenantId, body);
  }

  @Get(':id')
  async get(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.expensesService.getExpense(tenantId, id);
  }

  @Post()
  async create(@Headers('x-tenant-id') tenantId: string, @Body() body: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.expensesService.createExpense(tenantId, body);
  }

  @Put(':id')
  async update(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string, @Body() body: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.expensesService.updateExpense(tenantId, id, body);
  }

  @Delete(':id')
  async delete(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.expensesService.deleteExpense(tenantId, id);
  }

  @Post(':id/approve')
  async approve(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string, @Body() body: any) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.expensesService.approveExpense(tenantId, id, body.approvedBy);
  }
}
