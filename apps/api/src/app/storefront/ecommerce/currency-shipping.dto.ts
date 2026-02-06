// Multi-Currency DTOs
export interface CreateCurrencyDto {
  currencyCode: string;
  symbol: string;
  symbolPosition?: 'before' | 'after';
  decimalPlaces?: number;
  decimalSeparator?: string;
  thousandsSeparator?: string;
  exchangeRate?: number;
  isBaseCurrency?: boolean;
  isEnabled?: boolean;
}

export interface UpdateCurrencyDto {
  symbol?: string;
  symbolPosition?: 'before' | 'after';
  decimalPlaces?: number;
  decimalSeparator?: string;
  thousandsSeparator?: string;
  exchangeRate?: number;
  isEnabled?: boolean;
}

export interface SetPriceOverrideDto {
  currencyCode: string;
  price: number;
  compareAtPrice?: number;
}

// Shipping DTOs
export interface CreateCarrierDto {
  name: string;
  code: string;
  type?: 'api' | 'flat' | 'weight' | 'custom';
  apiKey?: string;
  apiSecret?: string;
  accountNumber?: string;
  testMode?: boolean;
  settings?: Record<string, unknown>;
}

export interface UpdateCarrierDto {
  name?: string;
  type?: 'api' | 'flat' | 'weight' | 'custom';
  apiKey?: string;
  apiSecret?: string;
  accountNumber?: string;
  testMode?: boolean;
  isEnabled?: boolean;
  settings?: Record<string, unknown>;
}

export interface CreateZoneDto {
  name: string;
  countries?: string[];
  states?: string[];
  zipCodes?: string[];
  isDefault?: boolean;
}

export interface UpdateZoneDto {
  name?: string;
  countries?: string[];
  states?: string[];
  zipCodes?: string[];
  isDefault?: boolean;
}

export interface CreateRateDto {
  zoneId: string;
  carrierId?: string;
  name: string;
  description?: string;
  type?: 'flat' | 'weight' | 'price' | 'carrier';
  price: number;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  minWeight?: number;
  maxWeight?: number;
  freeShippingThreshold?: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  carrierServiceCode?: string;
  sortOrder?: number;
}

export interface UpdateRateDto {
  name?: string;
  description?: string;
  type?: 'flat' | 'weight' | 'price' | 'carrier';
  price?: number;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  minWeight?: number;
  maxWeight?: number;
  freeShippingThreshold?: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  carrierServiceCode?: string;
  isEnabled?: boolean;
  sortOrder?: number;
}

export interface CreateWeightTierDto {
  rateId: string;
  minWeight: number;
  maxWeight?: number;
  price: number;
  pricePerKg?: number;
}

export interface CalculateShippingDto {
  countryCode: string;
  stateCode?: string;
  postalCode?: string;
  weight?: number;
  orderTotal: number;
}

export interface CreateShipmentDto {
  orderId: string;
  carrierId?: string;
  carrierName: string;
  trackingNumber?: string;
  trackingUrl?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
}

export interface UpdateShipmentDto {
  trackingNumber?: string;
  trackingUrl?: string;
  status?: string;
  labelUrl?: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  shippedAt?: Date;
}

export interface AddTrackingEventDto {
  status: string;
  description?: string;
  location?: string;
  occurredAt: Date;
  rawData?: Record<string, unknown>;
}
