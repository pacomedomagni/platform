import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ==========================================
// Store Currency DTOs
// ==========================================

export class CreateStoreCurrencyDto {
  @IsString()
  currencyCode!: string; // ISO 4217

  @IsString()
  symbol!: string;

  @IsEnum(['before', 'after'])
  @IsOptional()
  symbolPosition?: 'before' | 'after';

  @IsNumber()
  @Min(0)
  @Max(8)
  @IsOptional()
  decimalPlaces?: number;

  @IsString()
  @IsOptional()
  decimalSeparator?: string;

  @IsString()
  @IsOptional()
  thousandsSeparator?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  exchangeRate?: number;

  @IsBoolean()
  @IsOptional()
  isBaseCurrency?: boolean;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

export class UpdateStoreCurrencyDto {
  @IsString()
  @IsOptional()
  symbol?: string;

  @IsEnum(['before', 'after'])
  @IsOptional()
  symbolPosition?: 'before' | 'after';

  @IsNumber()
  @Min(0)
  @Max(8)
  @IsOptional()
  decimalPlaces?: number;

  @IsString()
  @IsOptional()
  decimalSeparator?: string;

  @IsString()
  @IsOptional()
  thousandsSeparator?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  exchangeRate?: number;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

export class UpdateExchangeRatesDto {
  rates!: Record<string, number>; // currencyCode -> rate
}

// ==========================================
// Product Price Override DTOs
// ==========================================

export class SetProductPriceOverrideDto {
  @IsString()
  productId!: string;

  @IsString()
  currencyCode!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  compareAtPrice?: number;
}

export class BulkSetPriceOverridesDto {
  @IsString()
  currencyCode!: string;

  overrides!: Array<{
    productId: string;
    price: number;
    compareAtPrice?: number;
  }>;
}

// ==========================================
// Currency Conversion Response
// ==========================================

export interface CurrencyInfo {
  code: string;
  symbol: string;
  symbolPosition: string;
  decimalPlaces: number;
  decimalSeparator: string;
  thousandsSeparator: string;
  exchangeRate: number;
  isBaseCurrency: boolean;
}

export interface ConvertedPrice {
  original: {
    amount: number;
    currency: string;
  };
  converted: {
    amount: number;
    currency: string;
    formatted: string;
  };
}
