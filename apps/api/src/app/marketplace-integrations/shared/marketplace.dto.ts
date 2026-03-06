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
}
