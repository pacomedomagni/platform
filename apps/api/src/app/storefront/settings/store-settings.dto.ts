import { IsString, IsOptional, IsNumber, Min, Max, MaxLength, Matches } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i, {
    message: 'Custom domain must be a valid hostname',
  })
  customDomain?: string;
}

export class VerifyCustomDomainDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i, {
    message: 'Custom domain must be a valid hostname',
  })
  customDomain!: string;
}
