import { IsString, IsOptional, IsNotEmpty, IsNumber, IsInt, IsUUID, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class AddToCartDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  quantity: number;
}

export class UpdateCartItemDto {
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  quantity: number;
}

export class ApplyCouponDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;
}

export class CartItemResponseDto {
  id: string;
  product: {
    id: string;
    slug: string;
    displayName: string;
    price: number;
    compareAtPrice: number | null;
    images: string[];
    stockStatus: string;
  };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export class CartResponseDto {
  id: string;
  items: CartItemResponseDto[];
  itemCount: number;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountAmount: number;
  grandTotal: number;
  couponCode: string | null;
}

export class MergeCartDto {
  @IsNotEmpty()
  @IsString()
  sessionToken: string;
}
