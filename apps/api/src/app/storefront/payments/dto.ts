import { IsString, IsNumber, IsOptional, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';

// L1: Moved from payments.controller.ts for consistency
// M5: Removed dead `amount` field — amount is derived from order.grandTotal on the backend
export class SquarePaymentDto {
  @IsString()
  orderId!: string;

  @IsString()
  sourceId!: string; // Card nonce from Square Web Payments SDK
}

export class CreateRefundDto {
  @IsString()
  orderId: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsIn(['duplicate', 'fraudulent', 'requested_by_customer'])
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

// L2: PaymentConfigResponseDto and PaymentResponseDto removed — they were unused
