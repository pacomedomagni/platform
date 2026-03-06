import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayFeedbackService } from './ebay-feedback.service';
import { RespondToFeedbackDto, LeaveFeedbackDto } from '../shared/marketplace.dto';

/**
 * eBay Feedback API Controller
 * Manages seller feedback retrieval, responses, and leaving feedback for buyers
 */
@Controller('marketplace/feedback')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class EbayFeedbackController {
  constructor(private feedbackService: EbayFeedbackService) {}

  /**
   * Get feedback entries from eBay
   * GET /api/marketplace/feedback?connectionId=...&page=...&entriesPerPage=...
   */
  @Get()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getFeedback(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Query('page') page?: string,
    @Query('entriesPerPage') entriesPerPage?: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }

    const feedback = await this.feedbackService.getFeedback(
      connectionId,
      tenantId,
      {
        page: page ? parseInt(page, 10) : undefined,
        entriesPerPage: entriesPerPage ? parseInt(entriesPerPage, 10) : undefined,
      }
    );

    return {
      success: true,
      ...feedback,
    };
  }

  /**
   * Get feedback summary counts
   * GET /api/marketplace/feedback/summary?connectionId=...
   */
  @Get('summary')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getFeedbackSummary(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }

    const summary = await this.feedbackService.getFeedbackSummary(
      connectionId,
      tenantId
    );

    return {
      success: true,
      ...summary,
    };
  }

  /**
   * Respond to feedback left by a buyer
   * POST /api/marketplace/feedback/respond
   */
  @Post('respond')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async respondToFeedback(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: RespondToFeedbackDto
  ) {
    await this.feedbackService.respondToFeedback(dto.connectionId, tenantId, {
      feedbackId: dto.feedbackId,
      responseText: dto.responseText,
    });

    return {
      success: true,
      message: 'Feedback response submitted successfully',
    };
  }

  /**
   * Leave feedback for a buyer
   * POST /api/marketplace/feedback/leave
   */
  @Post('leave')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async leaveFeedback(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: LeaveFeedbackDto
  ) {
    await this.feedbackService.leaveFeedback(dto.connectionId, tenantId, {
      orderId: dto.orderId,
      buyerUsername: dto.buyerUsername,
      rating: dto.rating,
      comment: dto.comment,
    });

    return {
      success: true,
      message: `${dto.rating} feedback left for buyer ${dto.buyerUsername}`,
    };
  }
}
