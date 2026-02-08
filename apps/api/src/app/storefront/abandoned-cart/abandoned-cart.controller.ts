import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { AbandonedCartService } from './abandoned-cart.service';

@Controller('store/admin/abandoned-carts')
@UseGuards(StoreAdminGuard)
export class AbandonedCartController {
  constructor(private readonly abandonedCartService: AbandonedCartService) {}

  /**
   * List abandoned carts with recovery status
   * GET /api/v1/store/admin/abandoned-carts
   */
  @Get()
  async listAbandonedCarts(
    @Headers('x-tenant-id') tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('cartId') cartId?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.abandonedCartService.listRecoveryEmails(tenantId, {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      status,
      cartId,
    });
  }

  /**
   * Get recovery statistics
   * GET /api/v1/store/admin/abandoned-carts/stats
   */
  @Get('stats')
  async getStats(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.abandonedCartService.getRecoveryStats(tenantId);
  }

  /**
   * Trigger recovery email scheduling
   * POST /api/v1/store/admin/abandoned-carts/schedule
   */
  @Post('schedule')
  async scheduleRecoveryEmails(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.abandonedCartService.scheduleRecoveryEmails(tenantId);
  }

  /**
   * Manually mark a cart as recovered
   * POST /api/v1/store/admin/abandoned-carts/:cartId/recover
   */
  @Post(':cartId/recover')
  async markRecovered(
    @Headers('x-tenant-id') tenantId: string,
    @Param('cartId') cartId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.abandonedCartService.markRecovered(tenantId, cartId);
  }
}
