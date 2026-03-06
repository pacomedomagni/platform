import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsEnum,
  IsArray,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Marketplace Integration DTOs
 * Provides input validation for all marketplace endpoints
 */

// ============================================
// Connection DTOs
// ============================================

export class CreateConnectionDto {
  @IsEnum(['EBAY'], { message: 'Only EBAY platform is currently supported' })
  platform!: 'EBAY';

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(['EBAY_US', 'EBAY_UK', 'EBAY_GB', 'EBAY_DE', 'EBAY_FR', 'EBAY_IT', 'EBAY_ES', 'EBAY_CA', 'EBAY_AU'], {
    message: 'marketplaceId must be a valid eBay marketplace (e.g. EBAY_US, EBAY_UK, EBAY_DE)',
  })
  marketplaceId?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

// ============================================
// Listing DTOs
// ============================================

export class ListingOverridesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateListingDto {
  @IsUUID()
  connectionId!: string;

  @IsUUID()
  productListingId!: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ListingOverridesDto)
  overrides?: ListingOverridesDto;
}

export class CreateDirectListingDto {
  @IsUUID()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  productListingId!: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80, { message: 'Title must not exceed 80 characters (eBay limit)' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(55, { message: 'Subtitle must not exceed 55 characters (eBay limit)' })
  subtitle?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsNumber()
  @Min(0.01)
  price!: number;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsEnum(
    [
      'NEW', 'LIKE_NEW', 'NEW_OTHER', 'NEW_WITH_DEFECTS',
      'MANUFACTURER_REFURBISHED', 'CERTIFIED_REFURBISHED',
      'EXCELLENT_REFURBISHED', 'VERY_GOOD_REFURBISHED',
      'GOOD_REFURBISHED', 'SELLER_REFURBISHED',
      'USED_EXCELLENT', 'USED_VERY_GOOD', 'USED_GOOD', 'USED_ACCEPTABLE',
      'FOR_PARTS_OR_NOT_WORKING',
      'PRE_OWNED_EXCELLENT', 'PRE_OWNED_FAIR',
    ],
    { message: 'condition must be a valid eBay item condition' }
  )
  condition!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  conditionDescription?: string;

  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsOptional()
  @IsString()
  secondaryCategoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsObject()
  itemSpecifics?: Record<string, string[]>;

  @IsOptional()
  @IsObject()
  platformData?: Record<string, any>;

  // Format & Auction
  @IsOptional()
  @IsEnum(['FIXED_PRICE', 'AUCTION'], { message: 'format must be FIXED_PRICE or AUCTION' })
  format?: string;

  @IsOptional()
  @IsString()
  listingDuration?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  startPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reservePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  buyItNowPrice?: number;

  // Best Offer
  @IsOptional()
  @IsBoolean()
  bestOfferEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  autoAcceptPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  autoDeclinePrice?: number;

  // Additional listing fields
  @IsOptional()
  @IsBoolean()
  privateListing?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  lotSize?: number;

  @IsOptional()
  @IsString()
  epid?: string;

  // Item location (buyer-facing)
  @IsOptional()
  @IsString()
  itemLocationCity?: string;

  @IsOptional()
  @IsString()
  itemLocationState?: string;

  @IsOptional()
  @IsString()
  itemLocationPostalCode?: string;

  @IsOptional()
  @IsString()
  itemLocationCountry?: string;

  // Package details
  @IsOptional()
  @IsString()
  packageType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightValue?: number;

  @IsOptional()
  @IsString()
  weightUnit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dimensionLength?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dimensionWidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dimensionHeight?: number;

  @IsOptional()
  @IsString()
  dimensionUnit?: string;

  // Policies
  @IsOptional()
  @IsString()
  fulfillmentPolicyId?: string;

  @IsOptional()
  @IsString()
  paymentPolicyId?: string;

  @IsOptional()
  @IsString()
  returnPolicyId?: string;

  @IsOptional()
  @IsString()
  merchantLocationKey?: string;
}

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(55)
  subtitle?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  conditionDescription?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  secondaryCategoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsObject()
  itemSpecifics?: Record<string, string[]>;

  @IsOptional()
  @IsObject()
  platformData?: Record<string, any>;

  // Format & Auction
  @IsOptional()
  @IsString()
  listingDuration?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  startPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reservePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  buyItNowPrice?: number;

  // Best Offer
  @IsOptional()
  @IsBoolean()
  bestOfferEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  autoAcceptPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  autoDeclinePrice?: number;

  // Additional
  @IsOptional()
  @IsBoolean()
  privateListing?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  lotSize?: number;

  @IsOptional()
  @IsString()
  epid?: string;

  // Item location
  @IsOptional()
  @IsString()
  itemLocationCity?: string;

  @IsOptional()
  @IsString()
  itemLocationState?: string;

  @IsOptional()
  @IsString()
  itemLocationPostalCode?: string;

  @IsOptional()
  @IsString()
  itemLocationCountry?: string;

  // Package
  @IsOptional()
  @IsString()
  packageType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightValue?: number;

  @IsOptional()
  @IsString()
  weightUnit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dimensionLength?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dimensionWidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dimensionHeight?: number;

  @IsOptional()
  @IsString()
  dimensionUnit?: string;

  // Policies
  @IsOptional()
  @IsString()
  fulfillmentPolicyId?: string;

  @IsOptional()
  @IsString()
  paymentPolicyId?: string;

  @IsOptional()
  @IsString()
  returnPolicyId?: string;
}

export class RejectListingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class GetListingsQueryDto {
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @IsOptional()
  @IsEnum(['draft', 'pending_approval', 'approved', 'publishing', 'published', 'ended', 'error'], {
    message: 'status must be a valid listing status',
  })
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}

// ============================================
// Order Sync DTOs
// ============================================

export class SyncOrdersDto {
  @IsUUID()
  connectionId!: string;
}

export class GetMarketplaceOrdersQueryDto {
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @IsOptional()
  @IsEnum(['NOT_STARTED', 'IN_PROGRESS', 'FULFILLED'], {
    message: 'fulfillmentStatus must be NOT_STARTED, IN_PROGRESS, or FULFILLED',
  })
  fulfillmentStatus?: string;

  @IsOptional()
  @IsEnum(['PAID', 'PENDING', 'FAILED', 'REFUNDED'], {
    message: 'paymentStatus must be PAID, PENDING, FAILED, or REFUNDED',
  })
  paymentStatus?: string;

  @IsOptional()
  @IsEnum(['pending', 'synced', 'error'], {
    message: 'syncStatus must be pending, synced, or error',
  })
  syncStatus?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}

export class FulfillOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  trackingNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  carrier!: string;
}

export class ScheduleListingDto {
  @IsString()
  @IsNotEmpty()
  scheduledDate!: string;
}

// ============================================
// Return DTOs
// ============================================

export class SyncReturnsDto {
  @IsUUID()
  connectionId!: string;
}

export class DeclineReturnDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class RefundReturnDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class SendReturnMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}

export class GetReturnsQueryDto {
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @IsOptional()
  @IsEnum(
    ['RETURN_REQUESTED', 'RETURN_ACCEPTED', 'RETURN_DECLINED', 'ITEM_SHIPPED', 'ITEM_RECEIVED', 'REFUND_ISSUED', 'CLOSED'],
    { message: 'status must be a valid return status' }
  )
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}

// ============================================
// Messaging DTOs
// ============================================

export class SyncMessagesDto {
  @IsUUID()
  connectionId!: string;
}

export class ReplyMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

export class GetMessagesQueryDto {
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @IsOptional()
  @IsEnum(['OPEN', 'RESPONDED', 'CLOSED'], {
    message: 'status must be OPEN, RESPONDED, or CLOSED',
  })
  status?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unreadOnly?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}

// ============================================
// Variation Listing DTOs
// ============================================

export class VariantDto {
  @IsString()
  @MinLength(1)
  sku!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;

  @IsNumber()
  @Min(0.01)
  price!: number;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsString()
  condition!: string;

  @IsObject()
  aspects!: Record<string, string[]>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}

export class CreateVariationListingDto {
  @IsUUID()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  productListingId!: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsString()
  @MaxLength(80)
  groupTitle!: string;

  @IsArray()
  @IsString({ each: true })
  variantAspects!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants!: VariantDto[];

  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsString()
  @IsNotEmpty()
  fulfillmentPolicyId!: string;

  @IsString()
  @IsNotEmpty()
  paymentPolicyId!: string;

  @IsString()
  @IsNotEmpty()
  returnPolicyId!: string;
}

// ============================================
// Campaign DTOs
// ============================================

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  marketplaceId!: string;

  @IsNumber()
  @Min(0)
  bidPercentage!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class AddAdToCampaignDto {
  @IsString()
  @IsNotEmpty()
  listingId!: string;

  @IsNumber()
  @Min(0)
  bidPercentage!: number;
}

// ============================================
// Offer DTOs
// ============================================

export class DeclineOfferDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CounterOfferDto {
  @IsNumber()
  @Min(0.01)
  counterPrice!: number;

  @IsOptional()
  @IsString()
  message?: string;
}

// ============================================
// Bulk Operations DTOs
// ============================================

export class CreateBulkTaskDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  feedType!: string;
}

export class UploadBulkFileDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  fileContent!: string;
}

export class SubmitBulkTaskDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;
}

export class BulkPriceQuantityItemDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;
}

export class BulkUpdatePriceQuantityDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPriceQuantityItemDto)
  items!: BulkPriceQuantityItemDto[];
}

// ============================================
// Shipping DTOs
// ============================================

export class GetShippingQuoteDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsOptional()
  @IsString()
  shippingOption?: string;
}

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  shippingQuoteId!: string;

  @IsString()
  @IsNotEmpty()
  rateId!: string;
}

// ============================================
// Feedback DTOs
// ============================================

export class RespondToFeedbackDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  feedbackId!: string;

  @IsString()
  @IsNotEmpty()
  responseText!: string;
}

export class LeaveFeedbackDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  buyerUsername!: string;

  @IsEnum(['Positive', 'Neutral', 'Negative'], {
    message: 'rating must be Positive, Neutral, or Negative',
  })
  rating!: 'Positive' | 'Neutral' | 'Negative';

  @IsString()
  @IsNotEmpty()
  comment!: string;
}

// ============================================
// Keyword DTOs
// ============================================

export class KeywordBidDto {
  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;
}

export class CreateKeywordDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  adGroupId!: string;

  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @IsEnum(['BROAD', 'EXACT', 'PHRASE'], {
    message: 'matchType must be BROAD, EXACT, or PHRASE',
  })
  matchType!: 'BROAD' | 'EXACT' | 'PHRASE';

  @IsOptional()
  @ValidateNested()
  @Type(() => KeywordBidDto)
  bid?: KeywordBidDto;
}

export class BulkKeywordItemDto {
  @IsString()
  @IsNotEmpty()
  adGroupId!: string;

  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @IsString()
  @IsNotEmpty()
  matchType!: string;

  @IsOptional()
  @IsObject()
  bid?: any;
}

export class BulkCreateKeywordsDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkKeywordItemDto)
  keywords!: BulkKeywordItemDto[];
}

export class CreateNegativeKeywordDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsOptional()
  @IsString()
  adGroupId?: string;

  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @IsString()
  @IsNotEmpty()
  matchType!: string;
}

// ============================================
// Inventory Location DTOs
// ============================================

export class LocationAddressDto {
  @IsString()
  @IsNotEmpty()
  addressLine1!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  stateOrProvince!: string;

  @IsString()
  @IsNotEmpty()
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;
}

export class CreateInventoryLocationDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  merchantLocationKey!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @ValidateNested()
  @Type(() => LocationAddressDto)
  address!: LocationAddressDto;

  @IsEnum(['WAREHOUSE', 'STORE'], {
    message: 'locationType must be WAREHOUSE or STORE',
  })
  locationType!: 'WAREHOUSE' | 'STORE';

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateInventoryLocationDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class ConnectionIdDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;
}

// ============================================
// Published Listing DTOs
// ============================================

export class OfferPriceDto {
  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;
}

export class UpdatePublishedListingDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => OfferPriceDto)
  price?: OfferPriceDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SetOutOfStockControlDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsBoolean()
  enabled!: boolean;
}

// ============================================
// Promotion DTOs
// ============================================

export class MarkdownPromotionItemDto {
  @IsString()
  @IsNotEmpty()
  listingId!: string;

  @IsNumber()
  @Min(0)
  discount!: number;
}

export class CreateMarkdownPromotionDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @IsString()
  @IsNotEmpty()
  endDate!: string;

  @IsString()
  @IsNotEmpty()
  marketplaceId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkdownPromotionItemDto)
  selectedItems!: MarkdownPromotionItemDto[];
}

export class CreateOrderPromotionDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @IsString()
  @IsNotEmpty()
  endDate!: string;

  @IsString()
  @IsNotEmpty()
  marketplaceId!: string;

  @IsObject()
  discountRules!: any;
}

export class CreateCodedCouponDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  couponCode!: string;

  @IsEnum(['PERCENTAGE', 'FIXED_AMOUNT'], {
    message: 'discountType must be PERCENTAGE or FIXED_AMOUNT',
  })
  discountType!: 'PERCENTAGE' | 'FIXED_AMOUNT';

  @IsNumber()
  @Min(0)
  discountValue!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  listingIds?: string[];
}

export class VolumePricingTierDto {
  @IsNumber()
  @Min(1)
  minQuantity!: number;

  @IsNumber()
  @Min(0)
  discountPercentage!: number;
}

export class CreateVolumePricingDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  listingIds!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VolumePricingTierDto)
  tiers!: VolumePricingTierDto[];

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

// ============================================
// Cross-Border Trade DTOs
// ============================================

export class CrossBorderPriceDto {
  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;
}

export class ListItemCrossBorderDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsString()
  @IsNotEmpty()
  targetMarketplace!: string;

  @ValidateNested()
  @Type(() => CrossBorderPriceDto)
  price!: CrossBorderPriceDto;

  @IsString()
  @IsNotEmpty()
  fulfillmentPolicyId!: string;

  @IsString()
  @IsNotEmpty()
  returnPolicyId!: string;

  @IsOptional()
  @IsString()
  paymentPolicyId?: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;
}

// ============================================
// Negotiation DTOs
// ============================================

export class NegotiationPriceDto {
  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;
}

export class SendNegotiationOfferDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  listingId!: string;

  @ValidateNested()
  @Type(() => NegotiationPriceDto)
  offeredPrice!: NegotiationPriceDto;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsBoolean()
  allowCounterOffer?: boolean;
}

// ============================================
// Inquiry DTOs
// ============================================

export class AppealCaseDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  comments!: string;
}

export class ProvideShipmentInfoDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  trackingNumber!: string;

  @IsString()
  @IsNotEmpty()
  carrier!: string;
}

export class IssueInquiryRefundDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SendInquiryMessageDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}

// ============================================
// Dispute DTOs
// ============================================

export class AcceptDisputeDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsOptional()
  @IsNumber()
  revision?: number;
}

export class ContestDisputeDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsNumber()
  revision?: number;
}

export class AddDisputeEvidenceDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  evidenceType!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lineItems?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceIds?: string[];
}

// ============================================
// Cancellation DTOs
// ============================================

export class RequestCancellationDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsEnum(['BUYER_ASKED_CANCEL', 'OUT_OF_STOCK', 'ADDRESS_ISSUES'], {
    message: 'reason must be BUYER_ASKED_CANCEL, OUT_OF_STOCK, or ADDRESS_ISSUES',
  })
  reason!: 'BUYER_ASKED_CANCEL' | 'OUT_OF_STOCK' | 'ADDRESS_ISSUES';
}

// ============================================
// Media DTOs
// ============================================

export class UploadImageFromUrlDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  imageUrl!: string;
}

export class UploadImageFromFileDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  fileContent!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;
}

// ============================================
// Store Category DTOs
// ============================================

export class CreateCustomPageDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsBoolean()
  leftNav?: boolean;
}

export class StoreCategoryItemDto {
  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsNumber()
  parentId?: number;
}

export class SetStoreCategoriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreCategoryItemDto)
  categories!: StoreCategoryItemDto[];
}

// ============================================
// Email Campaign DTOs
// ============================================

export class CreateEmailCampaignDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  emailBody!: string;

  @IsString()
  @IsNotEmpty()
  audienceType!: string;

  @IsOptional()
  @IsString()
  scheduledDate?: string;
}

// ============================================
// Order Refund DTOs
// ============================================

export class IssueOrderRefundDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lineItemIds?: string[];
}

// ============================================
// Connection Additional DTOs
// ============================================

export class SetVacationModeDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  returnMessage?: string;
}

// ============================================
// Compliance DTOs
// ============================================

export class SyncComplianceDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;
}

export class SuppressViolationDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsOptional()
  @IsString()
  complianceType?: string;
}
