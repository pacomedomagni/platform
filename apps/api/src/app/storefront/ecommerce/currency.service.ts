import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma, StoreCurrency } from '@prisma/client';
import {
  CreateCurrencyDto,
  UpdateCurrencyDto,
  SetPriceOverrideDto,
} from './currency-shipping.dto';

type DecimalLike = Prisma.Decimal | number | string;

// Common currencies with default settings
const CURRENCY_PRESETS: Record<string, Partial<CreateCurrencyDto>> = {
  USD: { symbol: '$', symbolPosition: 'before', decimalPlaces: 2 },
  EUR: { symbol: '€', symbolPosition: 'before', decimalPlaces: 2 },
  GBP: { symbol: '£', symbolPosition: 'before', decimalPlaces: 2 },
  CAD: { symbol: 'CA$', symbolPosition: 'before', decimalPlaces: 2 },
  AUD: { symbol: 'A$', symbolPosition: 'before', decimalPlaces: 2 },
  JPY: { symbol: '¥', symbolPosition: 'before', decimalPlaces: 0 },
  CHF: { symbol: 'CHF ', symbolPosition: 'before', decimalPlaces: 2 },
  CNY: { symbol: '¥', symbolPosition: 'before', decimalPlaces: 2 },
  INR: { symbol: '₹', symbolPosition: 'before', decimalPlaces: 2 },
  MXN: { symbol: 'MX$', symbolPosition: 'before', decimalPlaces: 2 },
  BRL: { symbol: 'R$', symbolPosition: 'before', decimalPlaces: 2 },
  KRW: { symbol: '₩', symbolPosition: 'before', decimalPlaces: 0 },
};

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // Currency Management
  // ==========================================

  async listCurrencies(tenantId: string) {
    return this.prisma.storeCurrency.findMany({
      where: { tenantId },
      orderBy: [{ isBaseCurrency: 'desc' }, { currencyCode: 'asc' }],
    });
  }

  async getBaseCurrency(tenantId: string) {
    const base = await this.prisma.storeCurrency.findFirst({
      where: { tenantId, isBaseCurrency: true },
    });

    if (!base) {
      // Return default USD if not configured
      return {
        currencyCode: 'USD',
        symbol: '$',
        symbolPosition: 'before',
        decimalPlaces: 2,
        decimalSeparator: '.',
        thousandsSeparator: ',',
        exchangeRate: 1,
        isBaseCurrency: true,
      };
    }

    return base;
  }

  async createCurrency(tenantId: string, dto: CreateCurrencyDto) {
    const code = dto.currencyCode.toUpperCase();

    // Check if already exists
    const existing = await this.prisma.storeCurrency.findUnique({
      where: { tenantId_currencyCode: { tenantId, currencyCode: code } },
    });

    if (existing) {
      throw new BadRequestException(`Currency ${code} already exists`);
    }

    // Apply preset defaults if available
    const preset = CURRENCY_PRESETS[code] || {};
    
    // If this is set as base, unset any existing base
    if (dto.isBaseCurrency) {
      await this.prisma.storeCurrency.updateMany({
        where: { tenantId, isBaseCurrency: true },
        data: { isBaseCurrency: false },
      });
    }

    return this.prisma.storeCurrency.create({
      data: {
        tenantId,
        currencyCode: code,
        symbol: dto.symbol || preset.symbol || code,
        symbolPosition: dto.symbolPosition || preset.symbolPosition || 'before',
        decimalPlaces: dto.decimalPlaces ?? preset.decimalPlaces ?? 2,
        decimalSeparator: dto.decimalSeparator || '.',
        thousandsSeparator: dto.thousandsSeparator || ',',
        exchangeRate: dto.exchangeRate || 1,
        isBaseCurrency: dto.isBaseCurrency || false,
        isEnabled: dto.isEnabled ?? true,
      },
    });
  }

  async updateCurrency(tenantId: string, currencyCode: string, dto: UpdateCurrencyDto) {
    const code = currencyCode.toUpperCase();

    const currency = await this.prisma.storeCurrency.findUnique({
      where: { tenantId_currencyCode: { tenantId, currencyCode: code } },
    });

    if (!currency) {
      throw new NotFoundException(`Currency ${code} not found`);
    }

    return this.prisma.storeCurrency.update({
      where: { id: currency.id },
      data: {
        ...dto,
        lastRateUpdate: dto.exchangeRate ? new Date() : undefined,
      },
    });
  }

  async deleteCurrency(tenantId: string, currencyCode: string) {
    const code = currencyCode.toUpperCase();

    const currency = await this.prisma.storeCurrency.findUnique({
      where: { tenantId_currencyCode: { tenantId, currencyCode: code } },
    });

    if (!currency) {
      throw new NotFoundException(`Currency ${code} not found`);
    }

    if (currency.isBaseCurrency) {
      throw new BadRequestException('Cannot delete base currency');
    }

    await this.prisma.storeCurrency.delete({ where: { id: currency.id } });
    return { success: true };
  }

  async setBaseCurrency(tenantId: string, currencyCode: string) {
    const code = currencyCode.toUpperCase();

    const currency = await this.prisma.storeCurrency.findUnique({
      where: { tenantId_currencyCode: { tenantId, currencyCode: code } },
    });

    if (!currency) {
      throw new NotFoundException(`Currency ${code} not found`);
    }

    // Unset current base and set new one
    await this.prisma.$transaction([
      this.prisma.storeCurrency.updateMany({
        where: { tenantId, isBaseCurrency: true },
        data: { isBaseCurrency: false },
      }),
      this.prisma.storeCurrency.update({
        where: { id: currency.id },
        data: { isBaseCurrency: true, exchangeRate: 1 },
      }),
    ]);

    return this.prisma.storeCurrency.findUnique({
      where: { id: currency.id },
    });
  }

  // ==========================================
  // Exchange Rate Updates
  // ==========================================

  async updateExchangeRates(tenantId: string, rates: Record<string, number>) {
    const updated: string[] = [];

    for (const [code, rate] of Object.entries(rates)) {
      try {
        await this.prisma.storeCurrency.update({
          where: { tenantId_currencyCode: { tenantId, currencyCode: code } },
          data: { exchangeRate: rate, lastRateUpdate: new Date() },
        });
        updated.push(code);
      } catch {
        this.logger.warn(`Currency ${code} not found for tenant ${tenantId}`);
      }
    }

    return { updated, count: updated.length };
  }

  // ==========================================
  // Price Conversion
  // ==========================================

  async convertPrice(
    tenantId: string,
    amount: number | Prisma.Decimal,
    fromCurrency: string,
    toCurrency: string
  ): Promise<{ amount: number; rate: number }> {
    const amountNum = typeof amount === 'number' ? amount : Number(amount);
    
    if (fromCurrency === toCurrency) {
      return { amount: amountNum, rate: 1 };
    }

    const [from, to] = await Promise.all([
      this.prisma.storeCurrency.findUnique({
        where: { tenantId_currencyCode: { tenantId, currencyCode: fromCurrency } },
      }),
      this.prisma.storeCurrency.findUnique({
        where: { tenantId_currencyCode: { tenantId, currencyCode: toCurrency } },
      }),
    ]);

    const fromRate = from?.exchangeRate ? Number(from.exchangeRate) : 1;
    const toRate = to?.exchangeRate ? Number(to.exchangeRate) : 1;

    // Convert: amount / fromRate * toRate
    const converted = (amountNum / fromRate) * toRate;
    const rate = toRate / fromRate;

    return { amount: converted, rate };
  }

  formatPrice(amount: number | Prisma.Decimal, currency: {
    symbol: string;
    symbolPosition: string;
    decimalPlaces: number;
    decimalSeparator: string;
    thousandsSeparator: string;
  }): string {
    const num = typeof amount === 'number' ? amount : Number(amount);
    const fixed = num.toFixed(currency.decimalPlaces);
    const [whole, decimal] = fixed.split('.');
    
    // Add thousands separator
    const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, currency.thousandsSeparator);
    const formattedNumber = decimal 
      ? `${formattedWhole}${currency.decimalSeparator}${decimal}`
      : formattedWhole;

    return currency.symbolPosition === 'before'
      ? `${currency.symbol}${formattedNumber}`
      : `${formattedNumber}${currency.symbol}`;
  }

  // ==========================================
  // Product Price Overrides
  // ==========================================

  async setProductPriceOverride(
    tenantId: string,
    productListingId: string,
    dto: SetPriceOverrideDto
  ) {
    const product = await this.prisma.productListing.findFirst({
      where: { id: productListingId, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.productPriceOverride.upsert({
      where: {
        productListingId_currencyCode: {
          productListingId,
          currencyCode: dto.currencyCode,
        },
      },
      update: {
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
      },
      create: {
        tenantId,
        productListingId,
        currencyCode: dto.currencyCode,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
      },
    });
  }

  async removeProductPriceOverride(
    tenantId: string,
    productListingId: string,
    currencyCode: string
  ) {
    const override = await this.prisma.productPriceOverride.findFirst({
      where: { tenantId, productListingId, currencyCode },
    });

    if (!override) {
      throw new NotFoundException('Price override not found');
    }

    await this.prisma.productPriceOverride.delete({ where: { id: override.id } });
    return { success: true };
  }

  async getProductPrices(tenantId: string, productListingId: string) {
    const [product, overrides] = await Promise.all([
      this.prisma.productListing.findFirst({
        where: { id: productListingId, tenantId },
        select: { price: true, compareAtPrice: true },
      }),
      this.prisma.productPriceOverride.findMany({
        where: { productListingId },
      }),
    ]);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const overridesMap: Record<string, { price: number; compareAtPrice: number | null }> = {};
    for (const o of overrides) {
      overridesMap[o.currencyCode] = {
        price: Number(o.price),
        compareAtPrice: o.compareAtPrice ? Number(o.compareAtPrice) : null,
      };
    }

    return {
      basePrice: Number(product.price),
      baseCompareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
      overrides: overridesMap,
    };
  }

  // ==========================================
  // Variant Price Overrides
  // ==========================================

  async setVariantPriceOverride(
    tenantId: string,
    variantId: string,
    dto: SetPriceOverrideDto
  ) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, tenantId },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return this.prisma.variantPriceOverride.upsert({
      where: {
        variantId_currencyCode: {
          variantId,
          currencyCode: dto.currencyCode,
        },
      },
      update: {
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
      },
      create: {
        tenantId,
        variantId,
        currencyCode: dto.currencyCode,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
      },
    });
  }

  // ==========================================
  // Get Product Price in Currency
  // ==========================================

  async getProductPriceInCurrency(
    tenantId: string,
    productListingId: string,
    currencyCode: string,
    variantId?: string
  ) {
    const baseCurrency = await this.getBaseCurrency(tenantId);
    
    // Check for specific override first
    if (variantId) {
      const variantOverride = await this.prisma.variantPriceOverride.findUnique({
        where: { variantId_currencyCode: { variantId, currencyCode } },
      });
      
      if (variantOverride) {
        return {
          price: Number(variantOverride.price),
          compareAtPrice: variantOverride.compareAtPrice ? Number(variantOverride.compareAtPrice) : null,
          currencyCode,
          source: 'override',
        };
      }
    }

    // Check product override
    const productOverride = await this.prisma.productPriceOverride.findUnique({
      where: { productListingId_currencyCode: { productListingId, currencyCode } },
    });

    if (productOverride) {
      return {
        price: Number(productOverride.price),
        compareAtPrice: productOverride.compareAtPrice ? Number(productOverride.compareAtPrice) : null,
        currencyCode,
        source: 'override',
      };
    }

    // Convert from base price
    const product = await this.prisma.productListing.findUnique({
      where: { id: productListingId },
      include: {
        variants: variantId ? { where: { id: variantId } } : false,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const basePrice = variantId && product.variants?.[0]?.price
      ? product.variants[0].price
      : product.price;

    const { amount: convertedPrice, rate } = await this.convertPrice(
      tenantId,
      basePrice,
      baseCurrency.currencyCode,
      currencyCode
    );

    const compareAtConverted = product.compareAtPrice
      ? (await this.convertPrice(tenantId, product.compareAtPrice, baseCurrency.currencyCode, currencyCode)).amount
      : null;

    return {
      price: convertedPrice,
      compareAtPrice: compareAtConverted,
      currencyCode,
      source: 'converted',
      exchangeRate: rate,
    };
  }
}
