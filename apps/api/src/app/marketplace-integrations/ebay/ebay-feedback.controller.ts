import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayFeedbackService } from './ebay-feedback.service';

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
    @Body('connectionId') connectionId: string,
    @Body('feedbackId') feedbackId: string,
    @Body('responseText') responseText: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    if (!feedbackId) {
      throw new HttpException('feedbackId is required', HttpStatus.BAD_REQUEST);
    }
    if (!responseText) {
      throw new HttpException('responseText is required', HttpStatus.BAD_REQUEST);
    }

    await this.feedbackService.respondToFeedback(connectionId, tenantId, {
      feedbackId,
      responseText,
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
    @Body('connectionId') connectionId: string,
    @Body('orderId') orderId: string,
    @Body('buyerUsername') buyerUsername: string,
    @Body('rating') rating: 'Positive' | 'Neutral' | 'Negative',
    @Body('comment') comment: string
  ) {
    if (!connectionId) {
      throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST);
    }
    if (!orderId) {
      throw new HttpException('orderId is required', HttpStatus.BAD_REQUEST);
    }
    if (!buyerUsername) {
      throw new HttpException('buyerUsername is required', HttpStatus.BAD_REQUEST);
    }
    if (!rating || !['Positive', 'Neutral', 'Negative'].includes(rating)) {
      throw new HttpException(
        'rating is required and must be Positive, Neutral, or Negative',
        HttpStatus.BAD_REQUEST
      );
    }
    if (!comment) {
      throw new HttpException('comment is required', HttpStatus.BAD_REQUEST);
    }

    await this.feedbackService.leaveFeedback(connectionId, tenantId, {
      orderId,
      buyerUsername,
      rating,
      comment,
    });

    return {
      success: true,
      message: `${rating} feedback left for buyer ${buyerUsername}`,
    };
  }
}
