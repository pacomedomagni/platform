import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayFinancesService } from './ebay-finances.service';

/**
 * eBay Finances API Controller
 * Provides endpoints for payouts, transactions, summaries,
 * and seller funds via the eBay Finances API.
 */
@Controller('marketplace/finances')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayFinancesController {
  constructor(private financesService: EbayFinancesService) {}

  /**
   * List seller payouts
   * GET /api/marketplace/finances/payouts?connectionId=...&limit=...&offset=...&sort=...
   */
  @Get('payouts')
  @Roles('admin', 'System Manager')
  async getPayouts(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('filter') filter?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sort') sort?: string
  ) {
    return this.financesService.getPayouts(connectionId, {
      filter,
      limit,
      offset,
      sort,
    });
  }

  /**
   * Get payout summary
   * GET /api/marketplace/finances/payouts/summary?connectionId=...
   */
  @Get('payouts/summary')
  @Roles('admin', 'System Manager')
  async getPayoutSummary(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('filter') filter?: string
  ) {
    return this.financesService.getPayoutSummary(connectionId, filter);
  }

  /**
   * List seller transactions
   * GET /api/marketplace/finances/transactions?connectionId=...&limit=...&offset=...&sort=...
   */
  @Get('transactions')
  @Roles('admin', 'System Manager')
  async getTransactions(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('filter') filter?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sort') sort?: string
  ) {
    return this.financesService.getTransactions(connectionId, {
      filter,
      limit,
      offset,
      sort,
    });
  }

  /**
   * Get transaction summary
   * GET /api/marketplace/finances/transactions/summary?connectionId=...
   */
  @Get('transactions/summary')
  @Roles('admin', 'System Manager')
  async getTransactionSummary(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('filter') filter?: string
  ) {
    return this.financesService.getTransactionSummary(connectionId, filter);
  }

  /**
   * Get seller funds summary
   * GET /api/marketplace/finances/funds-summary?connectionId=...
   */
  @Get('funds-summary')
  @Roles('admin', 'System Manager')
  async getSellerFundsSummary(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.financesService.getSellerFundsSummary(connectionId);
  }
}
