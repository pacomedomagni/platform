import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsEnum,
  IsArray,
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
  @IsString()
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

  @IsOptional()
  @IsUUID()
  productListingId?: string;

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

  @IsString()
  condition!: string;

  @IsString()
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
  @IsString()
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
