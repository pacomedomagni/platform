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
    ],
    { message: 'condition must be a valid eBay item condition' }
  )
  condition!: string;

  @IsString()
  @MinLength(1)
  categoryId!: string;

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
}

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

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
  categoryId?: string;

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
