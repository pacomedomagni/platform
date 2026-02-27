import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested, Min, Max, MaxLength, IsIn, IsNotEmpty, ArrayMaxSize } from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ============ VARIANTS ============

export class CreateAttributeTypeDto {
  @IsString()
  name: string;

  @IsString()
  displayName: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class CreateAttributeValueDto {
  @IsString()
  attributeTypeId: string;

  @IsString()
  value: string;

  @IsString()
  displayValue: string;

  @IsString()
  @IsOptional()
  colorHex?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class VariantAttributeDto {
  @IsString()
  attributeTypeId: string;

  @IsString()
  attributeValueId: string;
}

export class CreateVariantDto {
  @IsString()
  productListingId: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => value ? parseFloat(value) : undefined)
  price?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => value ? parseFloat(value) : undefined)
  compareAtPrice?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsNumber()
  @IsOptional()
  stockQty?: number;

  @IsBoolean()
  @IsOptional()
  trackInventory?: boolean;

  @IsBoolean()
  @IsOptional()
  allowBackorder?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantAttributeDto)
  attributes: VariantAttributeDto[];
}

export class UpdateVariantDto {
  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => value !== undefined ? parseFloat(value) : undefined)
  price?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => value !== undefined ? parseFloat(value) : undefined)
  compareAtPrice?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsNumber()
  @IsOptional()
  stockQty?: number;

  @IsBoolean()
  @IsOptional()
  trackInventory?: boolean;

  @IsBoolean()
  @IsOptional()
  allowBackorder?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

// ============ REVIEWS ============

export class CreateReviewDto {
  @IsString()
  productListingId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  pros?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  cons?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  reviewerName?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ArrayMaxSize(10)
  images?: string[];
}

export class ReviewVoteDto {
  @IsBoolean()
  isHelpful: boolean;
}

export class ModerateReviewDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AdminRespondDto {
  @IsString()
  response: string;
}

// ============ GIFT CARDS ============

export class CreateGiftCardDto {
  @IsNumber()
  @Min(1)
  initialValue: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsIn(['purchased', 'promotional', 'refund', 'manual'])
  sourceType: 'purchased' | 'promotional' | 'refund' | 'manual';

  @IsString()
  @IsOptional()
  sourceOrderId?: string;

  @IsString()
  @IsOptional()
  recipientEmail?: string;

  @IsString()
  @IsOptional()
  recipientName?: string;

  @IsString()
  @IsOptional()
  senderName?: string;

  @IsString()
  @IsOptional()
  personalMessage?: string;

  @IsString()
  @IsOptional()
  @IsIn(['email', 'print', 'physical'])
  deliveryMethod?: 'email' | 'print' | 'physical';

  @IsString()
  @IsOptional()
  expiresAt?: string;
}

export class RedeemGiftCardDto {
  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  pin?: string;
}

export class GiftCardTransactionDto {
  @IsString()
  @IsIn(['redemption', 'refund', 'adjustment', 'deduction'])
  type: 'redemption' | 'refund' | 'adjustment' | 'deduction';

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

// ============ WISHLIST ============

export class CreateWishlistDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty({ message: 'Wishlist name must not be empty if provided' })
  name?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

export class AddWishlistItemDto {
  @IsString()
  productListingId: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
