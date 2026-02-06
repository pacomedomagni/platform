import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested, Min, Max } from 'class-validator';
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
  @Transform(({ value }) => value ? parseFloat(value) : undefined)
  price?: number;

  @IsNumber()
  @IsOptional()
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
  @Transform(({ value }) => value !== undefined ? parseFloat(value) : undefined)
  price?: number;

  @IsNumber()
  @IsOptional()
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
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  pros?: string;

  @IsString()
  @IsOptional()
  cons?: string;

  @IsString()
  @IsOptional()
  reviewerName?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}

export class ReviewVoteDto {
  @IsBoolean()
  isHelpful: boolean;
}

export class ModerateReviewDto {
  @IsString()
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
  type: 'redemption' | 'refund' | 'adjustment';

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
