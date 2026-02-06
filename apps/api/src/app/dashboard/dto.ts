import { IsOptional, IsDateString } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// Response types
export interface RevenueStats {
  today: number;
  yesterday: number;
  thisWeek: number;
  lastWeek: number;
  thisMonth: number;
  lastMonth: number;
  percentageChangeWeek: number;
  percentageChangeMonth: number;
}

export interface OrderStats {
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  todayCount: number;
  weekCount: number;
  monthCount: number;
}

export interface InventoryAlert {
  id: string;
  code: string;
  name: string;
  currentStock: number;
  reorderLevel: number;
  reorderQty: number;
  isOutOfStock: boolean;
}

export interface OverduePayment {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  amount: number;
  dueDate: Date;
  daysOverdue: number;
}

export interface RecentActivity {
  id: string;
  type: 'order' | 'payment' | 'customer' | 'product';
  action: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface TopProduct {
  id: string;
  code: string;
  name: string;
  salesCount: number;
  revenue: number;
}

export interface DashboardSummary {
  revenue: RevenueStats;
  orders: OrderStats;
  inventory: {
    lowStock: InventoryAlert[];
    outOfStock: InventoryAlert[];
    totalActive: number;
  };
  payments: {
    pendingCount: number;
    pendingTotal: number;
    capturedToday: number;
  };
  customers: {
    total: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  topProducts: TopProduct[];
  recentActivity: RecentActivity[];
}
