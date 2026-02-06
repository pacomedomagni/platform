import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@platform/auth';
import { SalesAnalyticsService } from './sales-analytics.service';
import { InventoryAnalyticsService } from './inventory-analytics.service';
import { ReportExportService } from './report-export.service';
import { Tenant } from '../tenant.middleware';
import {
  AnalyticsPeriodDto,
  SalesReportDto,
  CustomerAnalyticsDto,
  InventoryReportDto,
} from './analytics.dto';

@Controller('api/v1/analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(
    private readonly salesAnalytics: SalesAnalyticsService,
    private readonly inventoryAnalytics: InventoryAnalyticsService,
    private readonly reportExport: ReportExportService,
  ) {}

  private getContext(tenantId: string) {
    return { tenantId };
  }

  private parseDateRange(startDate?: string, endDate?: string) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate 
      ? new Date(startDate) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days

    return { start, end };
  }

  // ==========================================
  // Dashboard Analytics
  // ==========================================

  @Get('dashboard')
  async getDashboardAnalytics(
    @Tenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.salesAnalytics.getDashboardAnalytics(
      this.getContext(tenantId),
      start,
      end,
    );
  }

  // ==========================================
  // Sales Analytics
  // ==========================================

  @Get('sales/trends')
  async getSalesTrends(
    @Tenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.salesAnalytics.getSalesTrends(
      this.getContext(tenantId),
      start,
      end,
      groupBy || 'day',
    );
  }

  @Get('sales/top-products')
  async getTopSellingProducts(
    @Tenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.salesAnalytics.getTopSellingProducts(
      this.getContext(tenantId),
      start,
      end,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('sales/categories')
  async getCategoryPerformance(
    @Tenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.salesAnalytics.getCategoryPerformance(
      this.getContext(tenantId),
      start,
      end,
    );
  }

  @Get('sales/payment-methods')
  async getRevenueByPaymentMethod(
    @Tenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.salesAnalytics.getRevenueByPaymentMethod(
      this.getContext(tenantId),
      start,
      end,
    );
  }

  // ==========================================
  // Customer Analytics
  // ==========================================

  @Get('customers/cohorts')
  async getCustomerCohorts(
    @Tenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('cohortMonths') cohortMonths?: string,
  ) {
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.salesAnalytics.getCustomerCohorts(
      this.getContext(tenantId),
      start,
      end,
      cohortMonths ? parseInt(cohortMonths, 10) : 6,
    );
  }

  @Get('customers/ltv')
  async getCustomerLifetimeValue(
    @Tenant() tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.salesAnalytics.getCustomerLifetimeValue(
      this.getContext(tenantId),
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ==========================================
  // Inventory Analytics
  // ==========================================

  @Get('inventory/turnover')
  async getInventoryTurnover(
    @Tenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const { start, end } = this.parseDateRange(startDate, endDate);
    return this.inventoryAnalytics.getInventoryTurnover(
      this.getContext(tenantId),
      start,
      end,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('inventory/dead-stock')
  async getDeadStock(
    @Tenant() tenantId: string,
    @Query('days') days?: string,
  ) {
    return this.inventoryAnalytics.getDeadStock(
      this.getContext(tenantId),
      days ? parseInt(days, 10) : 90,
    );
  }

  @Get('inventory/low-stock')
  async getLowStockItems(
    @Tenant() tenantId: string,
    @Query('threshold') threshold?: string,
  ) {
    return this.inventoryAnalytics.getLowStockItems(
      this.getContext(tenantId),
      threshold ? parseInt(threshold, 10) : undefined,
    );
  }

  @Get('inventory/value')
  async getStockValueSummary(@Tenant() tenantId: string) {
    return this.inventoryAnalytics.getStockValueSummary(this.getContext(tenantId));
  }

  @Get('inventory/aging')
  async getInventoryAging(@Tenant() tenantId: string) {
    return this.inventoryAnalytics.getInventoryAging(this.getContext(tenantId));
  }

  @Get('inventory/forecast')
  async getSalesForecast(
    @Tenant() tenantId: string,
    @Query('productId') productId?: string,
    @Query('days') days?: string,
  ) {
    return this.inventoryAnalytics.getSalesForecast(
      this.getContext(tenantId),
      productId,
      days ? parseInt(days, 10) : 30,
    );
  }

  // ==========================================
  // Report Exports
  // ==========================================

  @Get('export/sales')
  async exportSalesReport(
    @Tenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Res() res: Response,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    await this.reportExport.exportSalesReport(
      this.getContext(tenantId),
      new Date(startDate),
      new Date(endDate),
      format,
      res,
    );
  }

  @Get('export/order-items')
  async exportOrderItemsReport(
    @Tenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Res() res: Response,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    await this.reportExport.exportOrderItemsReport(
      this.getContext(tenantId),
      new Date(startDate),
      new Date(endDate),
      format,
      res,
    );
  }

  @Get('export/inventory')
  async exportInventoryReport(
    @Tenant() tenantId: string,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Res() res: Response,
  ) {
    await this.reportExport.exportInventoryReport(
      this.getContext(tenantId),
      format,
      res,
    );
  }

  @Get('export/customers')
  async exportCustomersReport(
    @Tenant() tenantId: string,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Res() res: Response,
  ) {
    await this.reportExport.exportCustomersReport(
      this.getContext(tenantId),
      format,
      res,
    );
  }

  @Get('export/products-performance')
  async exportProductsPerformanceReport(
    @Tenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Res() res: Response,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    await this.reportExport.exportProductsPerformanceReport(
      this.getContext(tenantId),
      new Date(startDate),
      new Date(endDate),
      format,
      res,
    );
  }

  @Get('export/gift-cards')
  async exportGiftCardsReport(
    @Tenant() tenantId: string,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Res() res: Response,
  ) {
    await this.reportExport.exportGiftCardsReport(
      this.getContext(tenantId),
      format,
      res,
    );
  }
}
