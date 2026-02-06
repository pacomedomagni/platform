import { IsString, IsOptional, IsDateString, IsEnum, IsInt, Min, IsArray } from 'class-validator';

// ==========================================
// Analytics Query DTOs
// ==========================================

export class DateRangeDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class AnalyticsPeriodDto {
  @IsEnum(['day', 'week', 'month', 'quarter', 'year'])
  @IsOptional()
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}

export class SalesReportDto extends DateRangeDto {
  @IsEnum(['day', 'week', 'month'])
  @IsOptional()
  groupBy?: 'day' | 'week' | 'month';

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  productId?: string;
}

export class CustomerAnalyticsDto extends DateRangeDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  cohortMonths?: number;
}

export class InventoryReportDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  lowStockThreshold?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  deadStockDays?: number;

  @IsString()
  @IsOptional()
  categoryId?: string;
}

export class ExportReportDto {
  @IsEnum(['csv', 'json', 'pdf'])
  format!: 'csv' | 'json' | 'pdf';

  @IsString()
  reportType!: string;

  @IsOptional()
  filters?: Record<string, unknown>;
}

// ==========================================
// Response Types
// ==========================================

export interface SalesTrend {
  period: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  itemsSold: number;
}

export interface TopSellingProduct {
  productId: string;
  productName: string;
  productCode: string;
  quantitySold: number;
  revenue: number;
  orderCount: number;
}

export interface CategoryPerformance {
  categoryId: string;
  categoryName: string;
  revenue: number;
  orderCount: number;
  itemsSold: number;
  percentageOfTotal: number;
}

export interface CustomerCohort {
  cohortMonth: string;
  customersAcquired: number;
  totalRevenue: number;
  averageOrderValue: number;
  repeatPurchaseRate: number;
  retentionByMonth: Record<string, number>;
}

export interface CustomerLifetimeValue {
  averageLTV: number;
  medianLTV: number;
  topCustomers: Array<{
    customerId: string;
    email: string;
    totalSpent: number;
    orderCount: number;
    firstOrderDate: Date;
    lastOrderDate: Date;
  }>;
}

export interface InventoryTurnover {
  productId: string;
  productName: string;
  productCode: string;
  currentStock: number;
  unitsSold: number;
  turnoverRate: number;
  daysOfSupply: number;
}

export interface DeadStock {
  productId: string;
  productName: string;
  productCode: string;
  currentStock: number;
  stockValue: number;
  lastSoldDate: Date | null;
  daysSinceLastSale: number;
}

export interface SalesForecast {
  period: string;
  predictedRevenue: number;
  predictedUnits: number;
  confidence: number;
}

export interface DashboardAnalytics {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    totalCustomers: number;
    averageOrderValue: number;
    revenueGrowth: number;
    orderGrowth: number;
  };
  revenueByDay: SalesTrend[];
  topProducts: TopSellingProduct[];
  topCategories: CategoryPerformance[];
  recentOrders: Array<{
    orderId: string;
    orderNumber: string;
    customerEmail: string;
    total: number;
    status: string;
    createdAt: Date;
  }>;
}
