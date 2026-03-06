import {
  Controller,
  Post,
  Get,
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
import { EbayDisputesService } from './ebay-disputes.service';
import {
  AcceptDisputeDto,
  ContestDisputeDto,
  AddDisputeEvidenceDto,
} from '../shared/marketplace.dto';

/**
 * eBay Payment Disputes Controller
 * Manages payment disputes via the eBay Fulfillment API.
 */
@Controller('marketplace/disputes')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayDisputesController {
  constructor(private disputesService: EbayDisputesService) {}

  /**
   * List payment disputes
   * GET /api/marketplace/disputes?connectionId=...&status=...&limit=...&offset=...
   */
  @Get()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getDisputes(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    return this.disputesService.getDisputes(connectionId, { status, limit, offset });
  }

  /**
   * Get dispute activities
   * GET /api/marketplace/disputes/:disputeId/activities?connectionId=...
   *
   * NOTE: This route is defined BEFORE the generic :disputeId GET route
   * to prevent "activities" from being captured as a disputeId parameter.
   */
  @Get(':disputeId/activities')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getDisputeActivities(
    @Tenant() tenantId: string,
    @Param('disputeId') disputeId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    return this.disputesService.getDisputeActivities(connectionId, disputeId);
  }

  /**
   * Get dispute detail
   * GET /api/marketplace/disputes/:disputeId?connectionId=...
   */
  @Get(':disputeId')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getDispute(
    @Tenant() tenantId: string,
    @Param('disputeId') disputeId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    return this.disputesService.getDispute(connectionId, disputeId);
  }

  /**
   * Accept (absorb) a payment dispute
   * POST /api/marketplace/disputes/:disputeId/accept
   */
  @Post(':disputeId/accept')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async acceptDispute(
    @Tenant() tenantId: string,
    @Param('disputeId') disputeId: string,
    @Body(ValidationPipe) dto: AcceptDisputeDto
  ) {
    const result = await this.disputesService.acceptDispute(
      dto.connectionId,
      disputeId,
      dto.revision
    );
    return { success: true, message: 'Dispute accepted', ...result };
  }

  /**
   * Contest a payment dispute
   * POST /api/marketplace/disputes/:disputeId/contest
   */
  @Post(':disputeId/contest')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async contestDispute(
    @Tenant() tenantId: string,
    @Param('disputeId') disputeId: string,
    @Body(ValidationPipe) dto: ContestDisputeDto
  ) {
    const result = await this.disputesService.contestDispute(dto.connectionId, disputeId, {
      reason: dto.reason,
      revision: dto.revision,
    });
    return { success: true, message: 'Dispute contested', ...result };
  }

  /**
   * Add evidence to a payment dispute
   * POST /api/marketplace/disputes/:disputeId/evidence
   */
  @Post(':disputeId/evidence')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async addEvidence(
    @Tenant() tenantId: string,
    @Param('disputeId') disputeId: string,
    @Body(ValidationPipe) dto: AddDisputeEvidenceDto
  ) {
    const result = await this.disputesService.addEvidence(dto.connectionId, disputeId, {
      evidenceType: dto.evidenceType,
      lineItems: dto.lineItems,
      evidenceIds: dto.evidenceIds,
    });
    return { success: true, message: 'Evidence added to dispute', ...result };
  }
}
