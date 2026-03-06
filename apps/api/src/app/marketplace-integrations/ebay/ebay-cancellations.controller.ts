import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayCancellationsService } from './ebay-cancellations.service';
import { RequestCancellationDto, ConnectionIdDto } from '../shared/marketplace.dto';

/**
 * eBay Cancellations API Controller
 * Manages order cancellation requests via the eBay Post-Order API
 */
@Controller('marketplace/cancellations')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayCancellationsController {
  constructor(private cancellationsService: EbayCancellationsService) {}

  /**
   * List cancellation requests
   * GET /api/marketplace/cancellations?connectionId=...&status=...&limit=...&offset=...
   */
  @Get()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getCancellations(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.cancellationsService.getCancellations(connectionId, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * Get a single cancellation detail
   * GET /api/marketplace/cancellations/:cancelId?connectionId=...
   */
  @Get(':cancelId')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getCancellation(
    @Tenant() tenantId: string,
    @Param('cancelId') cancelId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.cancellationsService.getCancellation(connectionId, cancelId);
  }

  /**
   * Request a cancellation for an order
   * POST /api/marketplace/cancellations
   */
  @Post()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async requestCancellation(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: RequestCancellationDto
  ) {
    const result = await this.cancellationsService.requestCancellation(
      dto.connectionId,
      dto.orderId,
      dto.reason
    );
    return { success: true, ...result };
  }

  /**
   * Approve a buyer's cancellation request
   * POST /api/marketplace/cancellations/:cancelId/approve
   */
  @Post(':cancelId/approve')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async approveCancellation(
    @Tenant() tenantId: string,
    @Param('cancelId') cancelId: string,
    @Body(ValidationPipe) dto: ConnectionIdDto
  ) {
    await this.cancellationsService.approveCancellation(dto.connectionId, cancelId);
    return { success: true, message: 'Cancellation approved' };
  }

  /**
   * Reject a buyer's cancellation request
   * POST /api/marketplace/cancellations/:cancelId/reject
   */
  @Post(':cancelId/reject')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async rejectCancellation(
    @Tenant() tenantId: string,
    @Param('cancelId') cancelId: string,
    @Body(ValidationPipe) dto: ConnectionIdDto
  ) {
    await this.cancellationsService.rejectCancellation(dto.connectionId, cancelId);
    return { success: true, message: 'Cancellation rejected' };
  }
}
