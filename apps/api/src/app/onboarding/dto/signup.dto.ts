import { IsString, IsEmail, MinLength, MaxLength, Matches, IsOptional, IsEnum } from 'class-validator';

export enum PaymentProvider {
  STRIPE = 'stripe',
  SQUARE = 'square',
}

export class SignupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  businessName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Subdomain must contain only lowercase letters, numbers, and hyphens',
  })
  subdomain!: string;

  @IsEnum(PaymentProvider)
  paymentProvider!: PaymentProvider;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  baseCurrency?: string;
}
