import { IsString, IsEmail, MinLength, MaxLength, Matches, IsOptional, IsEnum, IsNotIn } from 'class-validator';
import { Transform } from 'class-transformer';

const RESERVED_SUBDOMAINS = [
  'www', 'api', 'app', 'admin', 'dashboard', 'mail', 'email',
  'ftp', 'ssh', 'login', 'auth', 'signup', 'register', 'help',
  'support', 'status', 'docs', 'blog', 'cdn', 'static', 'assets',
  'test', 'staging', 'dev', 'demo', 'sandbox', 'ns1', 'ns2',
  'smtp', 'pop', 'imap', 'webmail', 'portal', 'billing',
];

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
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, {
    message: 'Subdomain must contain only lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.',
  })
  @IsNotIn(RESERVED_SUBDOMAINS, {
    message: 'This subdomain is reserved and cannot be used',
  })
  subdomain!: string;

  @IsEnum(PaymentProvider)
  paymentProvider!: PaymentProvider;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'baseCurrency must be a valid 3-letter ISO 4217 currency code (e.g., USD, EUR, GBP)',
  })
  baseCurrency?: string;
}
