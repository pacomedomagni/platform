/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import {
  CreateReviewDto,
  ReviewVoteDto,
  ModerateReviewDto,
  AdminRespondDto,
} from './dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============ PUBLIC ENDPOINTS ============

  async getProductReviews(
    tenantId: string,
    productListingId: string,
    options: { page?: number; limit?: number; rating?: number } = {}
  ) {
    const { page = 1, limit = 10, rating } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      productListingId,
      status: 'approved',
    };

    if (rating) {
      where.rating = rating;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.productReview.count({ where }),
    ]);

    // Calculate rating distribution
    const ratingDistribution = await this.prisma.productReview.groupBy({
      by: ['rating'],
      where: {
        tenantId,
        productListingId,
        status: 'approved',
      },
      _count: true,
    });

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingDistribution.forEach((r) => {
      distribution[r.rating] = r._count;
    });

    return {
      reviews: reviews.map((r) => this.mapReviewToResponse(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      ratingDistribution: distribution,
    };
  }

  async createReview(tenantId: string, customerId: string | null, dto: CreateReviewDto) {
    // Verify product exists
    const product = await this.prisma.productListing.findFirst({
      where: { id: dto.productListingId, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if customer already reviewed this product
    if (customerId) {
      const existingReview = await this.prisma.productReview.findFirst({
        where: {
          tenantId,
          productListingId: dto.productListingId,
          customerId,
        },
      });

      if (existingReview) {
        throw new BadRequestException('You have already reviewed this product');
      }
    }

    // Check for verified purchase
    let isVerifiedPurchase = false;
    if (customerId) {
      const purchase = await this.prisma.orderItem.findFirst({
        where: {
          tenantId,
          productId: dto.productListingId,
          order: {
            customerId,
            status: 'DELIVERED',
          },
        },
      });
      isVerifiedPurchase = !!purchase;
    }

    // Get customer info for display
    let reviewerName = dto.reviewerName;
    if (customerId && !reviewerName) {
      const customer = await this.prisma.storeCustomer.findUnique({
        where: { id: customerId },
        select: { firstName: true, lastName: true },
      });
      if (customer) {
        reviewerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Anonymous';
      }
    }

    const review = await this.prisma.productReview.create({
      data: {
        tenantId,
        productListingId: dto.productListingId,
        customerId,
        rating: dto.rating,
        title: dto.title,
        content: dto.content,
        pros: dto.pros,
        cons: dto.cons,
        reviewerName: reviewerName || 'Anonymous',
        isVerifiedPurchase,
        images: dto.images || [],
        status: 'pending', // Requires moderation
      },
    });

    return this.mapReviewToResponse(review);
  }

  async voteReview(tenantId: string, reviewId: string, customerId: string | null, sessionToken: string | null, dto: ReviewVoteDto) {
    const review = await this.prisma.productReview.findFirst({
      where: { id: reviewId, tenantId },
    });

    if (!review || review.status !== 'approved') {
      throw new NotFoundException('Review not found');
    }

    // Check for existing vote
    const existingVote = await this.prisma.reviewVote.findFirst({
      where: {
        reviewId,
        OR: [
          { customerId: customerId || undefined },
          { sessionToken: sessionToken || undefined },
        ],
      },
    });

    if (existingVote) {
      // Update existing vote if different
      if (existingVote.isHelpful !== dto.isHelpful) {
        await this.prisma.$transaction([
          this.prisma.reviewVote.update({
            where: { id: existingVote.id },
            data: { isHelpful: dto.isHelpful },
          }),
          this.prisma.productReview.update({
            where: { id: reviewId },
            data: {
              helpfulCount: { increment: dto.isHelpful ? 1 : -1 },
              notHelpfulCount: { increment: dto.isHelpful ? -1 : 1 },
            },
          }),
        ]);
      }
    } else {
      // Create new vote
      await this.prisma.$transaction([
        this.prisma.reviewVote.create({
          data: {
            reviewId,
            customerId,
            sessionToken,
            isHelpful: dto.isHelpful,
          },
        }),
        this.prisma.productReview.update({
          where: { id: reviewId },
          data: dto.isHelpful
            ? { helpfulCount: { increment: 1 } }
            : { notHelpfulCount: { increment: 1 } },
        }),
      ]);
    }

    return { success: true };
  }

  // ============ ADMIN ENDPOINTS ============

  async listReviewsAdmin(
    tenantId: string,
    options: { page?: number; limit?: number; status?: string; productId?: string } = {}
  ) {
    const { page = 1, limit = 20, status, productId } = options;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (productId) where.productListingId = productId;

    const [reviews, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          productListing: {
            select: { id: true, displayName: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.productReview.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async moderateReview(tenantId: string, reviewId: string, dto: ModerateReviewDto, moderatorId: string) {
    const review = await this.prisma.productReview.findFirst({
      where: { id: reviewId, tenantId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const updatedReview = await this.prisma.productReview.update({
      where: { id: reviewId },
      data: {
        status: dto.status,
        moderatedAt: new Date(),
        moderatedBy: moderatorId,
        moderationNotes: dto.notes,
      },
    });

    // Update product rating stats if approved
    if (dto.status === 'approved') {
      await this.updateProductRatingStats(tenantId, review.productListingId);
    }

    return updatedReview;
  }

  async adminRespond(tenantId: string, reviewId: string, dto: AdminRespondDto) {
    const review = await this.prisma.productReview.findFirst({
      where: { id: reviewId, tenantId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return this.prisma.productReview.update({
      where: { id: reviewId },
      data: {
        adminResponse: dto.response,
        adminRespondedAt: new Date(),
      },
    });
  }

  async deleteReview(tenantId: string, reviewId: string) {
    const review = await this.prisma.productReview.findFirst({
      where: { id: reviewId, tenantId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    await this.prisma.productReview.delete({ where: { id: reviewId } });

    // Update product rating stats
    await this.updateProductRatingStats(tenantId, review.productListingId);

    return { success: true };
  }

  // ============ HELPERS ============

  private async updateProductRatingStats(tenantId: string, productListingId: string) {
    const stats = await this.prisma.productReview.aggregate({
      where: {
        tenantId,
        productListingId,
        status: 'approved',
      },
      _avg: { rating: true },
      _count: true,
    });

    await this.prisma.productListing.update({
      where: { id: productListingId },
      data: {
        averageRating: stats._avg.rating || 0,
        reviewCount: stats._count,
      },
    });
  }

  private mapReviewToResponse(review: any) {
    return {
      id: review.id,
      rating: review.rating,
      title: review.title,
      content: review.content,
      pros: review.pros,
      cons: review.cons,
      reviewerName: review.reviewerName,
      isVerifiedPurchase: review.isVerifiedPurchase,
      images: review.images,
      helpfulCount: review.helpfulCount,
      notHelpfulCount: review.notHelpfulCount,
      adminResponse: review.adminResponse,
      adminRespondedAt: review.adminRespondedAt,
      createdAt: review.createdAt,
    };
  }
}
