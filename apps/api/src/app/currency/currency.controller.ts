import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../tenant.middleware';
import { CurrencyService } from './currency.service';
import {
  CreateStoreCurrencyDto,
  UpdateStoreCurrencyDto,
  SetProductPriceOverrideDto,
  BulkSetPriceOverridesDto,
} from './currency.dto';

@Controller('api/v1/currencies')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  // ==========================================
  // Public Endpoints (for storefront)
  // ==========================================

  @Get('available')
  getAvailableCurrencies() {
    return this.currencyService.getAvailableCurrencies();
  }

  @Get('store')
  async getStoreCurrencies(@Tenant() tenantId: string) {
    return this.currencyService.getEnabledCurrencies({ tenantId });
  }

  @Get('convert')
  async convertPrice(
    @Tenant() tenantId: string,
    @Query('amount') amount: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.currencyService.convertPrice(
      { tenantId },
      parseFloat(amount),
      from,
      to,
    );
  }

  @Get('product/:productId/price')
  async getProductPrice(
    @Tenant() tenantId: string,
    @Param('productId') productId: string,
    @Query('currency') currency: string,
  ) {
    return this.currencyService.getProductPrice({ tenantId }, productId, currency);
  }

  // ==========================================
  // Admin Endpoints
  // ==========================================

  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async getAllStoreCurrencies(@Tenant() tenantId: string) {
    return this.currencyService.getStoreCurrencies({ tenantId });
  }

  @Post('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async createStoreCurrency(
    @Tenant() tenantId: string,
    @Body() dto: CreateStoreCurrencyDto,
  ) {
    return this.currencyService.createStoreCurrency({ tenantId }, dto);
  }

  @Put('admin/:currencyCode')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async updateStoreCurrency(
    @Tenant() tenantId: string,
    @Param('currencyCode') currencyCode: string,
    @Body() dto: UpdateStoreCurrencyDto,
  ) {
    return this.currencyService.updateStoreCurrency({ tenantId }, currencyCode, dto);
  }

  @Post('admin/:currencyCode/set-base')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async setBaseCurrency(
    @Tenant() tenantId: string,
    @Param('currencyCode') currencyCode: string,
  ) {
    return this.currencyService.setBaseCurrency({ tenantId }, currencyCode);
  }

  @Post('admin/rates')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async updateExchangeRates(
    @Tenant() tenantId: string,
    @Body() dto: { rates: Record<string, number> },
  ) {
    return this.currencyService.updateExchangeRates({ tenantId }, dto.rates);
  }

  @Delete('admin/:currencyCode')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async deleteStoreCurrency(
    @Tenant() tenantId: string,
    @Param('currencyCode') currencyCode: string,
  ) {
    return this.currencyService.deleteStoreCurrency({ tenantId }, currencyCode);
  }

  // ==========================================
  // Price Override Endpoints
  // ==========================================

  @Get('admin/overrides/:currencyCode')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async getPriceOverrides(
    @Tenant() tenantId: string,
    @Param('currencyCode') currencyCode: string,
  ) {
    return this.currencyService.getPriceOverrides({ tenantId }, currencyCode);
  }

  @Post('admin/overrides')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async setProductPriceOverride(
    @Tenant() tenantId: string,
    @Body() dto: SetProductPriceOverrideDto,
  ) {
    return this.currencyService.setProductPriceOverride({ tenantId }, dto);
  }

  @Post('admin/overrides/bulk')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async bulkSetPriceOverrides(
    @Tenant() tenantId: string,
    @Body() dto: BulkSetPriceOverridesDto,
  ) {
    const results = [];
    for (const override of dto.overrides) {
      const result = await this.currencyService.setProductPriceOverride(
        { tenantId },
        {
          productId: override.productId,
          currencyCode: dto.currencyCode,
          price: override.price,
          compareAtPrice: override.compareAtPrice,
        },
      );
      results.push(result);
    }
    return { updated: results.length };
  }

  @Delete('admin/overrides/:productId/:currencyCode')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async deletePriceOverride(
    @Tenant() tenantId: string,
    @Param('productId') productId: string,
    @Param('currencyCode') currencyCode: string,
  ) {
    return this.currencyService.deletePriceOverride({ tenantId }, productId, currencyCode);
  }
}
