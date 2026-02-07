import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, Prisma } from '@platform/db';
import { StoreCurrency } from '@prisma/client';
import {
  CreateStoreCurrencyDto,
  UpdateStoreCurrencyDto,
  SetProductPriceOverrideDto,
  CurrencyInfo,
  ConvertedPrice,
} from './currency.dto';

interface TenantContext {
  tenantId: string;
}

// Common currency data
const CURRENCY_DATA: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
  CNY: { symbol: '¥', name: 'Chinese Yuan' },
  INR: { symbol: '₹', name: 'Indian Rupee' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  CHF: { symbol: 'Fr', name: 'Swiss Franc' },
  MXN: { symbol: '$', name: 'Mexican Peso' },
  BRL: { symbol: 'R$', name: 'Brazilian Real' },
  KRW: { symbol: '₩', name: 'South Korean Won' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar' },
  HKD: { symbol: 'HK$', name: 'Hong Kong Dollar' },
  SEK: { symbol: 'kr', name: 'Swedish Krona' },
  NOK: { symbol: 'kr', name: 'Norwegian Krone' },
  DKK: { symbol: 'kr', name: 'Danish Krone' },
  NZD: { symbol: 'NZ$', name: 'New Zealand Dollar' },
  ZAR: { symbol: 'R', name: 'South African Rand' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham' },
};

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // Store Currency Management
  // ==========================================

  /**
   * Get all enabled currencies for a store
   */
  async getStoreCurrencies(ctx: TenantContext) {
    const currencies = await this.prisma.storeCurrency.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ isBaseCurrency: 'desc' }, { currencyCode: 'asc' }],
    });

    return currencies.map(c => this.formatCurrency(c));
  }

  /**
   * Get enabled currencies only (for storefront)
   */
  async getEnabledCurrencies(ctx: TenantContext) {
    const currencies = await this.prisma.storeCurrency.findMany({
      where: { tenantId: ctx.tenantId, isEnabled: true },
      orderBy: [{ isBaseCurrency: 'desc' }, { currencyCode: 'asc' }],
    });

    return currencies.map(c => this.formatCurrency(c));
  }

  /**
   * Get base currency for tenant
   */
  async getBaseCurrency(ctx: TenantContext): Promise<CurrencyInfo | null> {
    const currency = await this.prisma.storeCurrency.findFirst({
      where: { tenantId: ctx.tenantId, isBaseCurrency: true },
    });

    return currency ? this.formatCurrency(currency) : null;
  }

  /**
   * Create a store currency
   */
  async createStoreCurrency(ctx: TenantContext, dto: CreateStoreCurrencyDto) {
    const existing = await this.prisma.storeCurrency.findFirst({
      where: { tenantId: ctx.tenantId, currencyCode: dto.currencyCode },
    });

    if (existing) {
      throw new BadRequestException(`Currency ${dto.currencyCode} already exists`);
    }

    // If this is the first currency or marked as base, ensure only one base
    if (dto.isBaseCurrency) {
      await this.prisma.storeCurrency.updateMany({
        where: { tenantId: ctx.tenantId, isBaseCurrency: true },
        data: { isBaseCurrency: false },
      });
    }

    // Check if this is the first currency
    const count = await this.prisma.storeCurrency.count({
      where: { tenantId: ctx.tenantId },
    });

    const currency = await this.prisma.storeCurrency.create({
      data: {
        tenantId: ctx.tenantId,
        currencyCode: dto.currencyCode.toUpperCase(),
        symbol: dto.symbol,
        symbolPosition: dto.symbolPosition || 'before',
        decimalPlaces: dto.decimalPlaces ?? 2,
        decimalSeparator: dto.decimalSeparator || '.',
        thousandsSeparator: dto.thousandsSeparator || ',',
        exchangeRate: dto.exchangeRate ?? 1,
        isBaseCurrency: dto.isBaseCurrency ?? (count === 0),
        isEnabled: dto.isEnabled ?? true,
      },
    });

    return this.formatCurrency(currency);
  }

  /**
   * Update a store currency
   */
  async updateStoreCurrency(ctx: TenantContext, currencyCode: string, dto: UpdateStoreCurrencyDto) {
    const currency = await this.prisma.storeCurrency.findFirst({
      where: { tenantId: ctx.tenantId, currencyCode: currencyCode.toUpperCase() },
    });

    if (!currency) {
      throw new NotFoundException(`Currency ${currencyCode} not found`);
    }

    const updated = await this.prisma.storeCurrency.update({
      where: { id: currency.id },
      data: {
        symbol: dto.symbol,
        symbolPosition: dto.symbolPosition,
        decimalPlaces: dto.decimalPlaces,
        decimalSeparator: dto.decimalSeparator,
        thousandsSeparator: dto.thousandsSeparator,
        exchangeRate: dto.exchangeRate,
        isEnabled: dto.isEnabled,
        lastRateUpdate: dto.exchangeRate !== undefined ? new Date() : undefined,
      },
    });

    return this.formatCurrency(updated);
  }

  /**
   * Set a currency as the base currency
   */
  async setBaseCurrency(ctx: TenantContext, currencyCode: string) {
    const currency = await this.prisma.storeCurrency.findFirst({
      where: { tenantId: ctx.tenantId, currencyCode: currencyCode.toUpperCase() },
    });

    if (!currency) {
      throw new NotFoundException(`Currency ${currencyCode} not found`);
    }

    await this.prisma.$transaction([
      this.prisma.storeCurrency.updateMany({
        where: { tenantId: ctx.tenantId, isBaseCurrency: true },
        data: { isBaseCurrency: false },
      }),
      this.prisma.storeCurrency.update({
        where: { id: currency.id },
        data: { isBaseCurrency: true, exchangeRate: 1 },
      }),
    ]);

    return { success: true, baseCurrency: currencyCode.toUpperCase() };
  }

  /**
   * Bulk update exchange rates
   */
  async updateExchangeRates(ctx: TenantContext, rates: Record<string, number>) {
    const updates = Object.entries(rates).map(([code, rate]) =>
      this.prisma.storeCurrency.updateMany({
        where: { tenantId: ctx.tenantId, currencyCode: code.toUpperCase() },
        data: { exchangeRate: rate, lastRateUpdate: new Date() },
      })
    );

    await this.prisma.$transaction(updates);

    return { updated: Object.keys(rates).length };
  }

  /**
   * Delete a store currency
   */
  async deleteStoreCurrency(ctx: TenantContext, currencyCode: string) {
    const currency = await this.prisma.storeCurrency.findFirst({
      where: { tenantId: ctx.tenantId, currencyCode: currencyCode.toUpperCase() },
    });

    if (!currency) {
      throw new NotFoundException(`Currency ${currencyCode} not found`);
    }

    if (currency.isBaseCurrency) {
      throw new BadRequestException('Cannot delete the base currency');
    }

    // Delete related price overrides
    await this.prisma.productPriceOverride.deleteMany({
      where: { tenantId: ctx.tenantId, currencyCode: currencyCode.toUpperCase() },
    });

    await this.prisma.storeCurrency.delete({
      where: { id: currency.id },
    });

    return { deleted: true };
  }

  // ==========================================
  // Price Conversion
  // ==========================================

  /**
   * Convert price to target currency
   */
  async convertPrice(
    ctx: TenantContext,
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ConvertedPrice> {
    const [from, to] = await Promise.all([
      this.prisma.storeCurrency.findFirst({
        where: { tenantId: ctx.tenantId, currencyCode: fromCurrency.toUpperCase() },
      }),
      this.prisma.storeCurrency.findFirst({
        where: { tenantId: ctx.tenantId, currencyCode: toCurrency.toUpperCase() },
      }),
    ]);

    if (!from) {
      throw new BadRequestException(`Source currency ${fromCurrency} not found`);
    }
    if (!to) {
      throw new BadRequestException(`Target currency ${toCurrency} not found`);
    }

    // Convert: amount in FROM -> base -> TO
    const baseAmount = amount / Number(from.exchangeRate);
    const convertedAmount = baseAmount * Number(to.exchangeRate);

    // Round to decimal places
    const rounded = Math.round(convertedAmount * Math.pow(10, to.decimalPlaces)) / Math.pow(10, to.decimalPlaces);

    return {
      original: { amount, currency: fromCurrency.toUpperCase() },
      converted: {
        amount: rounded,
        currency: toCurrency.toUpperCase(),
        formatted: this.formatAmount(rounded, this.formatCurrency(to)),
      },
    };
  }

  /**
   * Get product price in specified currency
   */
  async getProductPrice(
    ctx: TenantContext,
    productId: string,
    currencyCode: string
  ) {
    const currency = await this.prisma.storeCurrency.findFirst({
      where: { tenantId: ctx.tenantId, currencyCode: currencyCode.toUpperCase() },
    });

    if (!currency) {
      throw new BadRequestException(`Currency ${currencyCode} not configured`);
    }

    // Check for price override
    const override = await this.prisma.productPriceOverride.findFirst({
      where: { productListingId: productId, currencyCode: currencyCode.toUpperCase() },
    });

    if (override) {
      return {
        productId,
        currency: currencyCode.toUpperCase(),
        price: Number(override.price),
        compareAtPrice: override.compareAtPrice ? Number(override.compareAtPrice) : null,
        formatted: this.formatAmount(Number(override.price), this.formatCurrency(currency)),
        isOverride: true,
      };
    }

    // Get base price and convert
    const product = await this.prisma.productListing.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const baseCurrency = await this.getBaseCurrency(ctx);
    const basePrice = Number(product.price);
    const convertedPrice = baseCurrency
      ? basePrice * Number(currency.exchangeRate) / (baseCurrency.exchangeRate || 1)
      : basePrice * Number(currency.exchangeRate);

    const rounded = Math.round(convertedPrice * Math.pow(10, currency.decimalPlaces)) / Math.pow(10, currency.decimalPlaces);

    return {
      productId,
      currency: currencyCode.toUpperCase(),
      price: rounded,
      compareAtPrice: product.compareAtPrice
        ? Math.round(Number(product.compareAtPrice) * Number(currency.exchangeRate) * Math.pow(10, currency.decimalPlaces)) / Math.pow(10, currency.decimalPlaces)
        : null,
      formatted: this.formatAmount(rounded, this.formatCurrency(currency)),
      isOverride: false,
    };
  }

  // ==========================================
  // Price Overrides
  // ==========================================

  /**
   * Set price override for a product
   */
  async setProductPriceOverride(ctx: TenantContext, dto: SetProductPriceOverrideDto) {
    const currency = await this.prisma.storeCurrency.findFirst({
      where: { tenantId: ctx.tenantId, currencyCode: dto.currencyCode.toUpperCase() },
    });

    if (!currency) {
      throw new BadRequestException(`Currency ${dto.currencyCode} not configured`);
    }

    const existing = await this.prisma.productPriceOverride.findFirst({
      where: { productListingId: dto.productId, currencyCode: dto.currencyCode.toUpperCase() },
    });

    if (existing) {
      const updated = await this.prisma.productPriceOverride.update({
        where: { id: existing.id },
        data: {
          price: dto.price,
          compareAtPrice: dto.compareAtPrice,
        },
      });
      return updated;
    }

    return this.prisma.productPriceOverride.create({
      data: {
        tenantId: ctx.tenantId,
        productListingId: dto.productId,
        currencyCode: dto.currencyCode.toUpperCase(),
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
      },
    });
  }

  /**
   * Get all price overrides for a currency
   */
  async getPriceOverrides(ctx: TenantContext, currencyCode: string) {
    const overrides = await this.prisma.productPriceOverride.findMany({
      where: { tenantId: ctx.tenantId, currencyCode: currencyCode.toUpperCase() },
      include: { productListing: { select: { id: true, displayName: true, price: true } } },
    });

    return overrides.map(o => ({
      productId: o.productListingId,
      productName: o.productListing.displayName,
      basePrice: Number(o.productListing.price),
      currency: o.currencyCode,
      overridePrice: Number(o.price),
      compareAtPrice: o.compareAtPrice ? Number(o.compareAtPrice) : null,
    }));
  }

  /**
   * Delete price override
   */
  async deletePriceOverride(ctx: TenantContext, productId: string, currencyCode: string) {
    const override = await this.prisma.productPriceOverride.findFirst({
      where: { productListingId: productId, currencyCode: currencyCode.toUpperCase() },
    });

    if (!override) {
      throw new NotFoundException('Price override not found');
    }

    await this.prisma.productPriceOverride.delete({
      where: { id: override.id },
    });

    return { deleted: true };
  }

  // ==========================================
  // Utilities
  // ==========================================

  /**
   * Get available currencies (static list)
   */
  getAvailableCurrencies() {
    return Object.entries(CURRENCY_DATA).map(([code, data]) => ({
      code,
      symbol: data.symbol,
      name: data.name,
    }));
  }

  private formatCurrency(currency: StoreCurrency): CurrencyInfo {
    return {
      code: currency.currencyCode,
      symbol: currency.symbol,
      symbolPosition: currency.symbolPosition,
      decimalPlaces: currency.decimalPlaces,
      decimalSeparator: currency.decimalSeparator,
      thousandsSeparator: currency.thousandsSeparator,
      exchangeRate: Number(currency.exchangeRate),
      isBaseCurrency: currency.isBaseCurrency,
    };
  }

  private formatAmount(amount: number, currency: CurrencyInfo): string {
    const parts = amount.toFixed(currency.decimalPlaces).split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, currency.thousandsSeparator);
    const decPart = parts[1] || '';
    
    const number = decPart
      ? `${intPart}${currency.decimalSeparator}${decPart}`
      : intPart;

    return currency.symbolPosition === 'before'
      ? `${currency.symbol}${number}`
      : `${number}${currency.symbol}`;
  }
}
