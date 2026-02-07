import { IsString, IsOptional, IsNumber, Min, Max, MaxLength } from 'class-validator';

export class UpdateStoreSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  defaultTaxRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultShippingRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freeShippingThreshold?: number;
}
