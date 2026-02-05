import { IsString, IsEmail, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  businessName: string;

  @IsEmail()
  ownerEmail: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  ownerPassword: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Domain must contain only lowercase letters, numbers, and hyphens',
  })
  domain: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  baseCurrency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class ProvisioningStatusDto {
  tenantId: string;
  status: ProvisioningStatus;
  progress: number;
  currentStep?: string;
  estimatedSecondsRemaining?: number;
  error?: string;
  completedAt?: string;
}

export enum ProvisioningStatus {
  PENDING = 'PENDING',
  CREATING_TENANT = 'CREATING_TENANT',
  CREATING_USER = 'CREATING_USER',
  SEEDING_ACCOUNTS = 'SEEDING_ACCOUNTS',
  SEEDING_WAREHOUSE = 'SEEDING_WAREHOUSE',
  SEEDING_UOMS = 'SEEDING_UOMS',
  SEEDING_DEFAULTS = 'SEEDING_DEFAULTS',
  READY = 'READY',
  FAILED = 'FAILED',
}

export const PROVISIONING_STEPS = [
  { status: ProvisioningStatus.CREATING_TENANT, progress: 10, label: 'Creating tenant...' },
  { status: ProvisioningStatus.CREATING_USER, progress: 20, label: 'Creating admin user...' },
  { status: ProvisioningStatus.SEEDING_ACCOUNTS, progress: 40, label: 'Setting up chart of accounts...' },
  { status: ProvisioningStatus.SEEDING_WAREHOUSE, progress: 60, label: 'Creating default warehouse...' },
  { status: ProvisioningStatus.SEEDING_UOMS, progress: 80, label: 'Setting up units of measure...' },
  { status: ProvisioningStatus.SEEDING_DEFAULTS, progress: 90, label: 'Configuring defaults...' },
  { status: ProvisioningStatus.READY, progress: 100, label: 'Ready!' },
];
