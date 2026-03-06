import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayComplianceService } from './ebay-compliance.service';
import { SyncComplianceDto, SuppressViolationDto } from '../shared/marketplace.dto';

/**
 * eBay Compliance API Controller
 * Manages listing compliance violation monitoring, summaries, and suppression
 */
@Controller('marketplace/compliance')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class EbayComplianceController {
  constructor(private complianceService: EbayComplianceService) {}

  /**
   * Get locally synced violations with filtering and pagination
   * GET /api/marketplace/compliance/local?connectionId=...&complianceType=...&status=...&limit=...&offset=...
   */
  @Get('local')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getLocalViolations(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId?: string,
    @Query('complianceType') complianceType?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const result = await this.complianceService.getLocalViolations(tenantId, {
      connectionId,
      complianceType,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return { success: true, ...result };
  }

  /**
   * Get listing violations from eBay API, optionally filtered by compliance type
   * GET /api/marketplace/compliance?connectionId=...&complianceType=...
   */
  @Get()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getViolations(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('complianceType') complianceType?: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }

    const violations = await this.complianceService.getViolations(
      connectionId,
      tenantId,
      complianceType
    );

    return {
      success: true,
      ...violations,
    };
  }

  /**
   * Get violation count summary grouped by compliance type
   * GET /api/marketplace/compliance/summary?connectionId=...
   */
  @Get('summary')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getViolationSummary(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }

    const summary = await this.complianceService.getViolationSummary(
      connectionId,
      tenantId
    );

    return {
      success: true,
      ...summary,
    };
  }

  /**
   * Trigger a manual compliance violation sync
   * POST /api/marketplace/compliance/sync
   */
  @Post('sync')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async syncViolations(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: SyncComplianceDto
  ) {
    const result = await this.complianceService.syncViolations(tenantId, dto.connectionId);

    return {
      success: true,
      message: `Synced ${result.itemsSuccess}/${result.itemsTotal} violations`,
      ...result,
    };
  }

  /**
   * Suppress a known violation for a listing
   * POST /api/marketplace/compliance/:listingId/suppress
   */
  @Post(':listingId/suppress')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async suppressViolation(
    @Tenant() tenantId: string,
    @Param('listingId') listingId: string,
    @Body(ValidationPipe) dto: SuppressViolationDto
  ) {
    await this.complianceService.suppressViolation(dto.connectionId, tenantId, listingId, dto.complianceType);

    return {
      success: true,
      message: `Violation suppressed for listing ${listingId}`,
    };
  }
}
