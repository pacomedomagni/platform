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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayInquiriesService } from './ebay-inquiries.service';

/**
 * eBay Inquiries & Case Management Controller
 * Manages INR inquiries and eBay cases via the Post-Order API.
 */
@Controller('marketplace/inquiries')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayInquiriesController {
  constructor(private inquiriesService: EbayInquiriesService) {}

  /**
   * Search inquiries
   * GET /api/marketplace/inquiries?connectionId=...&status=...&limit=...&offset=...
   */
  @Get()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getInquiries(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    return this.inquiriesService.getInquiries(connectionId, { status, limit, offset });
  }

  /**
   * Search cases
   * GET /api/marketplace/inquiries/cases?connectionId=...&status=...&limit=...&offset=...
   *
   * NOTE: This route is defined BEFORE the :inquiryId route to avoid
   * "cases" being captured as an inquiryId parameter.
   */
  @Get('cases')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getCases(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    return this.inquiriesService.getCases(connectionId, { status, limit, offset });
  }

  /**
   * Get case detail
   * GET /api/marketplace/inquiries/cases/:caseId?connectionId=...
   */
  @Get('cases/:caseId')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getCase(
    @Tenant() tenantId: string,
    @Param('caseId') caseId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    return this.inquiriesService.getCase(connectionId, caseId);
  }

  /**
   * Appeal a case decision
   * POST /api/marketplace/inquiries/cases/:caseId/appeal
   */
  @Post('cases/:caseId/appeal')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async appealCase(
    @Tenant() tenantId: string,
    @Param('caseId') caseId: string,
    @Body() body: { connectionId: string; comments: string }
  ) {
    if (!body.connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    if (!body.comments) {
      throw new HttpException('comments is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.inquiriesService.appealCase(body.connectionId, caseId, body.comments);
    return { success: true, message: 'Case appeal submitted', ...result };
  }

  /**
   * Get inquiry detail
   * GET /api/marketplace/inquiries/:inquiryId?connectionId=...
   */
  @Get(':inquiryId')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getInquiry(
    @Tenant() tenantId: string,
    @Param('inquiryId') inquiryId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    return this.inquiriesService.getInquiry(connectionId, inquiryId);
  }

  /**
   * Provide shipment info on an inquiry
   * POST /api/marketplace/inquiries/:inquiryId/shipment-info
   */
  @Post(':inquiryId/shipment-info')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async provideShipmentInfo(
    @Tenant() tenantId: string,
    @Param('inquiryId') inquiryId: string,
    @Body() body: { connectionId: string; trackingNumber: string; carrier: string }
  ) {
    if (!body.connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    if (!body.trackingNumber || !body.carrier) {
      throw new HttpException('trackingNumber and carrier are required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.inquiriesService.provideShipmentInfo(
      body.connectionId,
      inquiryId,
      body.trackingNumber,
      body.carrier
    );
    return { success: true, message: 'Shipment info provided', ...result };
  }

  /**
   * Issue refund on an inquiry
   * POST /api/marketplace/inquiries/:inquiryId/refund
   */
  @Post(':inquiryId/refund')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async issueInquiryRefund(
    @Tenant() tenantId: string,
    @Param('inquiryId') inquiryId: string,
    @Body() body: { connectionId: string; amount?: number; comment?: string }
  ) {
    if (!body.connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.inquiriesService.issueInquiryRefund(
      body.connectionId,
      inquiryId,
      body.amount,
      body.comment
    );
    return { success: true, message: 'Inquiry refund issued', ...result };
  }

  /**
   * Escalate an inquiry to an eBay case
   * POST /api/marketplace/inquiries/:inquiryId/escalate
   */
  @Post(':inquiryId/escalate')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async escalateInquiry(
    @Tenant() tenantId: string,
    @Param('inquiryId') inquiryId: string,
    @Body() body: { connectionId: string }
  ) {
    if (!body.connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.inquiriesService.escalateInquiry(body.connectionId, inquiryId);
    return { success: true, message: 'Inquiry escalated to case', ...result };
  }

  /**
   * Send message on an inquiry
   * POST /api/marketplace/inquiries/:inquiryId/message
   */
  @Post(':inquiryId/message')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async sendInquiryMessage(
    @Tenant() tenantId: string,
    @Param('inquiryId') inquiryId: string,
    @Body() body: { connectionId: string; message: string }
  ) {
    if (!body.connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    if (!body.message) {
      throw new HttpException('message is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.inquiriesService.sendInquiryMessage(
      body.connectionId,
      inquiryId,
      body.message
    );
    return { success: true, message: 'Message sent on inquiry', ...result };
  }
}
