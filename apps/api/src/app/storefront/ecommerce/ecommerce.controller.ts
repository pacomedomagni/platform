import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { VariantsService } from './variants.service';
import { ReviewsService } from './reviews.service';
import { GiftCardsService } from './gift-cards.service';
import { WishlistService } from './wishlist.service';
import { StoreAdminGuard } from '@platform/auth';
import {
  CreateAttributeTypeDto,
  CreateAttributeValueDto,
  CreateVariantDto,
  UpdateVariantDto,
  CreateReviewDto,
  ReviewVoteDto,
  ModerateReviewDto,
  AdminRespondDto,
  CreateGiftCardDto,
  RedeemGiftCardDto,
  GiftCardTransactionDto,
  CreateWishlistDto,
  AddWishlistItemDto,
} from './dto';
import { CustomerAuthService } from '../auth/customer-auth.service';

@Controller('store')
export class EcommerceController {
  constructor(
    private readonly variantsService: VariantsService,
    private readonly reviewsService: ReviewsService,
    private readonly giftCardsService: GiftCardsService,
    private readonly wishlistService: WishlistService,
    private readonly authService: CustomerAuthService
  ) {}

  // ============ VARIANTS - PUBLIC ============

  @Get('products/:productId/variants')
  async listVariants(
    @Headers('x-tenant-id') tenantId: string,
    @Param('productId') productId: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.variantsService.listVariants(tenantId, productId);
  }

  @Get('variants/:id')
  async getVariant(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.variantsService.getVariant(tenantId, id);
  }

  // ============ VARIANTS - ADMIN ============

  @Get('admin/attribute-types')
  @UseGuards(StoreAdminGuard)
  async listAttributeTypes(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.variantsService.listAttributeTypes(tenantId);
  }

  @Post('admin/attribute-types')
  @UseGuards(StoreAdminGuard)
  async createAttributeType(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateAttributeTypeDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.variantsService.createAttributeType(tenantId, dto);
  }

  @Put('admin/attribute-types/:id')
  @UseGuards(StoreAdminGuard)
  async updateAttributeType(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAttributeTypeDto>
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.variantsService.updateAttributeType(tenantId, id, dto);
  }

  @Delete('admin/attribute-types/:id')
  @UseGuards(StoreAdminGuard)
  async deleteAttributeType(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.variantsService.deleteAttributeType(tenantId, id);
  }

  @Post('admin/attribute-values')
  @UseGuards(StoreAdminGuard)
  async createAttributeValue(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateAttributeValueDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.variantsService.createAttributeValue(tenantId, dto);
  }

  @Post('admin/products/:productId/variants')
  @UseGuards(StoreAdminGuard)
  async createVariant(
    @Headers('x-tenant-id') tenantId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateVariantDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    dto.productListingId = productId;
    return this.variantsService.createVariant(tenantId, dto);
  }

  @Put('admin/variants/:id')
  @UseGuards(StoreAdminGuard)
  async updateVariant(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVariantDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.variantsService.updateVariant(tenantId, id, dto);
  }

  @Delete('admin/variants/:id')
  @UseGuards(StoreAdminGuard)
  async deleteVariant(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.variantsService.deleteVariant(tenantId, id);
  }

  // ============ REVIEWS - PUBLIC ============

  @Get('products/:productId/reviews')
  async getProductReviews(
    @Headers('x-tenant-id') tenantId: string,
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('rating') rating?: string,
    @Query('sortBy') sortBy?: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reviewsService.getProductReviews(tenantId, productId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      rating: rating ? parseInt(rating, 10) : undefined,
      sortBy: sortBy as 'helpful' | 'newest' | 'highest' | 'lowest' | undefined,
    });
  }

  @Post('products/:productId/reviews')
  async createReview(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Param('productId') productId: string,
    @Body() dto: CreateReviewDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const customerId = await this.getOptionalCustomerId(authHeader, tenantId);
    dto.productListingId = productId;
    return this.reviewsService.createReview(tenantId, customerId, dto);
  }

  @Post('reviews/:reviewId/vote')
  async voteReview(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Headers('x-session-token') sessionToken: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReviewVoteDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const customerId = await this.getOptionalCustomerId(authHeader, tenantId);
    return this.reviewsService.voteReview(tenantId, reviewId, customerId, sessionToken, dto);
  }

  // ============ REVIEWS - ADMIN ============

  @Get('admin/reviews')
  @UseGuards(StoreAdminGuard)
  async listReviewsAdmin(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('productId') productId?: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reviewsService.listReviewsAdmin(tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      productId,
    });
  }

  @Put('admin/reviews/:reviewId/moderate')
  @UseGuards(StoreAdminGuard)
  async moderateReview(
    @Headers('x-tenant-id') tenantId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: ModerateReviewDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reviewsService.moderateReview(tenantId, reviewId, dto, 'admin');
  }

  @Post('admin/reviews/bulk-moderate')
  @UseGuards(StoreAdminGuard)
  async bulkModerateReviews(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { reviewIds: string[]; status: 'approved' | 'rejected' }
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!body.reviewIds?.length) throw new BadRequestException('Review IDs required');
    let count = 0;
    for (const reviewId of body.reviewIds) {
      try {
        await this.reviewsService.moderateReview(
          tenantId,
          reviewId,
          { status: body.status } as ModerateReviewDto,
          'admin',
        );
        count++;
      } catch {
        // Skip reviews that fail moderation
      }
    }
    return { success: true, count };
  }

  @Post('admin/reviews/:reviewId/respond')
  @UseGuards(StoreAdminGuard)
  async adminRespondToReview(
    @Headers('x-tenant-id') tenantId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: AdminRespondDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reviewsService.adminRespond(tenantId, reviewId, dto);
  }

  @Delete('admin/reviews/:reviewId')
  @UseGuards(StoreAdminGuard)
  async deleteReview(
    @Headers('x-tenant-id') tenantId: string,
    @Param('reviewId') reviewId: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.reviewsService.deleteReview(tenantId, reviewId);
  }

  // ============ GIFT CARDS - PUBLIC ============

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Get('gift-cards/check')
  async checkGiftCardBalance(
    @Headers('x-tenant-id') tenantId: string,
    @Query('code') code: string,
    @Query('pin') pin?: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!code) throw new BadRequestException('Gift card code required');
    return this.giftCardsService.checkBalance(tenantId, code, pin);
  }

  // ============ GIFT CARDS - ADMIN ============

  @Get('admin/gift-cards')
  @UseGuards(StoreAdminGuard)
  async listGiftCards(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.giftCardsService.listGiftCards(tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
    });
  }

  @Get('admin/gift-cards/:id')
  @UseGuards(StoreAdminGuard)
  async getGiftCard(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.giftCardsService.getGiftCard(tenantId, id);
  }

  @Post('admin/gift-cards')
  @UseGuards(StoreAdminGuard)
  async createGiftCard(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateGiftCardDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.giftCardsService.createGiftCard(tenantId, dto, 'admin');
  }

  @Post('admin/gift-cards/:id/activate')
  @UseGuards(StoreAdminGuard)
  async activateGiftCard(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.giftCardsService.activateGiftCard(tenantId, id);
  }

  @Post('admin/gift-cards/:id/adjust')
  @UseGuards(StoreAdminGuard)
  async adjustGiftCardBalance(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: GiftCardTransactionDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.giftCardsService.adjustBalance(tenantId, id, dto, 'admin');
  }

  @Post('admin/gift-cards/:id/disable')
  @UseGuards(StoreAdminGuard)
  async disableGiftCard(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.giftCardsService.disableGiftCard(tenantId, id);
  }

  // ============ WISHLIST - AUTHENTICATED ============

  @Get('wishlist')
  async getWishlists(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const customerId = await this.getCustomerId(authHeader, tenantId);
    return this.wishlistService.getWishlists(tenantId, customerId);
  }

  @Get('wishlist/:id')
  async getWishlist(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const customerId = await this.getCustomerId(authHeader, tenantId);
    return this.wishlistService.getWishlist(tenantId, customerId, id);
  }

  @Post('wishlist')
  async createWishlist(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateWishlistDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const customerId = await this.getCustomerId(authHeader, tenantId);
    return this.wishlistService.createWishlist(tenantId, customerId, dto);
  }

  @Put('wishlist/:id')
  async updateWishlist(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() dto: CreateWishlistDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const customerId = await this.getCustomerId(authHeader, tenantId);
    return this.wishlistService.updateWishlist(tenantId, customerId, id, dto);
  }

  @Delete('wishlist/:id')
  async deleteWishlist(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const customerId = await this.getCustomerId(authHeader, tenantId);
    return this.wishlistService.deleteWishlist(tenantId, customerId, id);
  }

  @Post('wishlist/items')
  async addWishlistItem(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Body() dto: AddWishlistItemDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const customerId = await this.getCustomerId(authHeader, tenantId);
    return this.wishlistService.addItem(tenantId, customerId, dto);
  }

  @Post('wishlist/:wishlistId/items')
  async addItemToWishlist(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Param('wishlistId') wishlistId: string,
    @Body() dto: AddWishlistItemDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const customerId = await this.getCustomerId(authHeader, tenantId);
    return this.wishlistService.addItemToWishlist(tenantId, customerId, wishlistId, dto);
  }

  @Delete('wishlist/items/:itemId')
  async removeWishlistItem(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Param('itemId') itemId: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const customerId = await this.getCustomerId(authHeader, tenantId);
    return this.wishlistService.removeItem(tenantId, customerId, itemId);
  }

  @Post('wishlist/items/:itemId/move-to-cart')
  async moveWishlistItemToCart(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') authHeader: string,
    @Param('itemId') itemId: string,
    @Body('cartId') cartId: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!cartId) throw new BadRequestException('Cart ID required');
    const customerId = await this.getCustomerId(authHeader, tenantId);
    return this.wishlistService.moveToCart(tenantId, customerId, itemId, cartId);
  }

  // ============ WISHLIST - PUBLIC (SHARED) ============

  @Get('wishlist/shared/:shareToken')
  async getSharedWishlist(
    @Headers('x-tenant-id') tenantId: string,
    @Param('shareToken') shareToken: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.wishlistService.getSharedWishlist(tenantId, shareToken);
  }

  // ============ HELPERS ============

  private async getCustomerId(authHeader: string, tenantId: string): Promise<string> {
    if (!authHeader) {
      throw new BadRequestException('Authorization required');
    }
    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new BadRequestException('Invalid authorization header');
    }
    const payload = await this.authService.verifyToken(token);
    if (payload.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid token');
    }
    return payload.customerId;
  }

  private async getOptionalCustomerId(authHeader: string, tenantId: string): Promise<string | null> {
    if (!authHeader) return null;
    try {
      return await this.getCustomerId(authHeader, tenantId);
    } catch {
      return null;
    }
  }
}
