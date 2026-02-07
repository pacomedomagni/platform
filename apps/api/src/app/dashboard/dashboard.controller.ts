import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@platform/auth';
import { Tenant } from '../tenant.middleware';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get full dashboard summary including revenue, orders, inventory, etc.
   */
  @Get('summary')
  async getSummary(@Tenant() tenantId: string) {
    return this.dashboardService.getSummary(tenantId);
  }

  /**
   * Get "What needs attention" - quick counts of items requiring action
   */
  @Get('attention')
  async getAttentionItems(@Tenant() tenantId: string) {
    return this.dashboardService.getAttentionItems(tenantId);
  }

  /**
   * Get revenue stats only (for quick refresh)
   */
  @Get('revenue')
  async getRevenue(@Tenant() tenantId: string) {
    const summary = await this.dashboardService.getSummary(tenantId);
    return summary.revenue;
  }

  /**
   * Get order stats only
   */
  @Get('orders')
  async getOrders(@Tenant() tenantId: string) {
    const summary = await this.dashboardService.getSummary(tenantId);
    return summary.orders;
  }

  /**
   * Get inventory alerts only
   */
  @Get('inventory')
  async getInventory(@Tenant() tenantId: string) {
    const summary = await this.dashboardService.getSummary(tenantId);
    return summary.inventory;
  }
}
