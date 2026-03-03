import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { SalesAnalyticsService } from './sales-analytics.service';
import { InventoryAnalyticsService } from './inventory-analytics.service';
import { ReportExportService } from './report-export.service';
import { Tenant } from '../tenant.middleware';
import {
  AnalyticsPeriodDto,
  SalesReportDto,
  CustomerAnalyticsDto,
} from './analytics.dto';

@Controller('analytics')
@UseGuards(AuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    private readonly salesAnalytics: SalesAnalyticsService,
    private readonly inventoryAnalytics: InventoryAnalyticsService,
    private readonly reportExport: ReportExportService,
  ) {}

  private getContext(tenantId: string) {
    return { tenantId };
  }

  /**
   * Parse and validate a numeric string parameter.
   * Returns the parsed integer or the provided default if the value is missing or NaN. (M3)
   */
  private safeParseInt(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private parseDateRange(startDate?: string, endDate?: string) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days

    // Validate date ranges (M2): endDate must be >= startDate
    if (start > end) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }

    // Validate dates are actually valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    return { start, end };
  }

  // ==========================================
  // Dashboard Analytics
  // ==========================================

  @Get('dashboard')
  @Roles('admin')
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
  @Roles('admin')
  async getSalesTrends(
    @Tenant() tenantId: string,
    @Query() query: SalesReportDto,
  ) {
    const { start, end } = this.parseDateRange(query.startDate, query.endDate);
    const validGroupBy = ['day', 'week', 'month'].includes(query.groupBy || '')
      ? (query.groupBy as 'day' | 'week' | 'month')
      : 'day';
    return this.salesAnalytics.getSalesTrends(
      this.getContext(tenantId),
      start,
      end,
      validGroupBy,
    );
  }

  @Get('sales/top-products')
  @Roles('admin')
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
      this.safeParseInt(limit, 10),
    );
  }

  @Get('sales/categories')
  @Roles('admin')
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
  @Roles('admin')
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
  @Roles('admin')
  async getCustomerCohorts(
    @Tenant() tenantId: string,
    @Query() query: CustomerAnalyticsDto,
  ) {
    const { start, end } = this.parseDateRange(query.startDate, query.endDate);
    return this.salesAnalytics.getCustomerCohorts(
      this.getContext(tenantId),
      start,
      end,
      query.cohortMonths ?? 6,
    );
  }

  @Get('customers/ltv')
  @Roles('admin')
  async getCustomerLifetimeValue(
    @Tenant() tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.salesAnalytics.getCustomerLifetimeValue(
      this.getContext(tenantId),
      this.safeParseInt(limit, 20),
    );
  }

  // ==========================================
  // Inventory Analytics
  // ==========================================

  @Get('inventory/turnover')
  @Roles('admin')
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
      this.safeParseInt(limit, 50),
    );
  }

  @Get('inventory/dead-stock')
  @Roles('admin')
  async getDeadStock(
    @Tenant() tenantId: string,
    @Query('days') days?: string,
  ) {
    return this.inventoryAnalytics.getDeadStock(
      this.getContext(tenantId),
      this.safeParseInt(days, 90),
    );
  }

  @Get('inventory/low-stock')
  @Roles('admin')
  async getLowStockItems(
    @Tenant() tenantId: string,
    @Query('threshold') threshold?: string,
  ) {
    return this.inventoryAnalytics.getLowStockItems(
      this.getContext(tenantId),
      threshold ? this.safeParseInt(threshold, 10) : undefined,
    );
  }

  @Get('inventory/value')
  @Roles('admin')
  async getStockValueSummary(@Tenant() tenantId: string) {
    return this.inventoryAnalytics.getStockValueSummary(this.getContext(tenantId));
  }

  @Get('inventory/aging')
  @Roles('admin')
  async getInventoryAging(@Tenant() tenantId: string) {
    return this.inventoryAnalytics.getInventoryAging(this.getContext(tenantId));
  }

  @Get('inventory/forecast')
  @Roles('admin')
  async getSalesForecast(
    @Tenant() tenantId: string,
    @Query('productId') productId?: string,
    @Query('days') days?: string,
  ) {
    return this.inventoryAnalytics.getSalesForecast(
      this.getContext(tenantId),
      productId,
      this.safeParseInt(days, 30),
    );
  }

  // ==========================================
  // Report Exports
  // ==========================================

  @Get('export/sales')
  @Roles('admin')
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
  @Roles('admin')
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
  @Roles('admin')
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
  @Roles('admin')
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
  @Roles('admin')
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
  @Roles('admin')
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
