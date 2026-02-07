import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  IsNotEmpty,
  IsIn,
} from 'class-validator';

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  countries?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  states?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  zipCodes?: string[];

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateZoneDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  countries?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  states?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  zipCodes?: string[];

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class CreateRateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn(['flat', 'weight', 'price'])
  @IsOptional()
  type?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxOrderAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minWeight?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxWeight?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  freeShippingThreshold?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedDaysMin?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedDaysMax?: number;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

export class CalculateShippingDto {
  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  zipCode?: string;

  @IsNumber()
  @Min(0)
  cartTotal: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cartWeight?: number;
}
