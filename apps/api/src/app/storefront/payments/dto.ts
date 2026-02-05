import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRefundDto {
  @IsString()
  orderId: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

export class PaymentConfigResponseDto {
  publicKey: string | null;
  isConfigured: boolean;
}

export class PaymentResponseDto {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  cardBrand: string | null;
  cardLast4: string | null;
  createdAt: Date;
}
