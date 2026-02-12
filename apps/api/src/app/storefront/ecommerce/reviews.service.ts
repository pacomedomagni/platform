/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma, ProductReview } from '@prisma/client';
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
    options: { page?: number; limit?: number; rating?: number; sortBy?: 'helpful' | 'newest' | 'highest' | 'lowest' } = {}
  ) {
    const { page = 1, limit = 10, rating, sortBy = 'newest' } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductReviewWhereInput = {
      tenantId,
      productListingId,
      status: 'approved',
    };

    if (rating) {
      where.rating = rating;
    }

    // Determine sort order based on sortBy parameter
    let orderBy: Prisma.ProductReviewOrderByWithRelationInput;
    switch (sortBy) {
      case 'helpful':
        orderBy = { helpfulCount: 'desc' };
        break;
      case 'highest':
        orderBy = { rating: 'desc' };
        break;
      case 'lowest':
        orderBy = { rating: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
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
        orderBy,
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
    // Require authentication to prevent anonymous review spam
    if (!customerId) {
      throw new ForbiddenException('You must be logged in to write a review');
    }

    // Verify product exists
    const product = await this.prisma.productListing.findFirst({
      where: { id: dto.productListingId, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if customer already reviewed this product
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

    // Check for existing vote - build OR conditions only for provided identifiers
    const orConditions: any[] = [];
    if (customerId) orConditions.push({ customerId });
    if (sessionToken) orConditions.push({ sessionToken });

    if (orConditions.length === 0) {
      throw new BadRequestException('Must be logged in or have a session to vote');
    }

    const existingVote = await this.prisma.reviewVote.findFirst({
      where: {
        reviewId,
        OR: orConditions,
      },
    });

    if (existingVote) {
      // Update existing vote if different
      if (existingVote.isHelpful !== dto.isHelpful) {
        await this.prisma.$transaction(async (tx) => {
          await tx.reviewVote.update({
            where: { id: existingVote.id },
            data: { isHelpful: dto.isHelpful },
          });
          // Use raw SQL with GREATEST to prevent negative counts
          if (dto.isHelpful) {
            await tx.$executeRaw`
              UPDATE product_reviews
              SET "helpfulCount" = "helpfulCount" + 1,
                  "notHelpfulCount" = GREATEST("notHelpfulCount" - 1, 0)
              WHERE id = ${reviewId}
            `;
          } else {
            await tx.$executeRaw`
              UPDATE product_reviews
              SET "helpfulCount" = GREATEST("helpfulCount" - 1, 0),
                  "notHelpfulCount" = "notHelpfulCount" + 1
              WHERE id = ${reviewId}
            `;
          }
        });
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

    const where: Prisma.ProductReviewWhereInput = { tenantId };
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

    // Update product rating stats when approval status changes
    if (dto.status === 'approved' || dto.status === 'rejected') {
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

  private mapReviewToResponse(review: ProductReview) {
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
