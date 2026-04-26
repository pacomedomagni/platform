import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrencyService } from './currency.service';
import { ShippingService } from './shipping.service';
import { StoreAdminGuard } from '@platform/auth';
import { StorePublishedGuard } from '../../common/guards/store-published.guard';
import { Tenant } from '../../tenant.middleware';
import {
  CreateCurrencyDto,
  UpdateCurrencyDto,
  SetPriceOverrideDto,
  CreateCarrierDto,
  UpdateCarrierDto,
  CreateZoneDto,
  UpdateZoneDto,
  CreateRateDto,
  UpdateRateDto,
  CreateWeightTierDto,
  CalculateShippingDto,
  CreateShipmentDto,
  UpdateShipmentDto,
  AddTrackingEventDto,
} from './currency-shipping.dto';

@Controller('store')
export class CurrencyShippingController {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly shippingService: ShippingService
  ) {}

  // ============ CURRENCY - PUBLIC ============

  @Get('currencies')
  @UseGuards(StorePublishedGuard)
  async listCurrencies(@Tenant() tenantId: string) {    const currencies = await this.currencyService.listCurrencies(tenantId);
    // Only return enabled currencies for public endpoint
    return currencies.filter(c => c.isEnabled);
  }

  @Get('price/:productId')
  @UseGuards(StorePublishedGuard)
  async getProductPrice(
    @Tenant() tenantId: string,
    @Param('productId') productId: string,
    @Query('currency') currency?: string,
    @Query('variantId') variantId?: string
  ) {    const currencyCode = currency || 'USD';
    return this.currencyService.getProductPriceInCurrency(
      tenantId,
      productId,
      currencyCode,
      variantId
    );
  }

  // ============ CURRENCY - ADMIN ============

  @Get('admin/currencies')
  @UseGuards(StoreAdminGuard)
  async listAllCurrencies(@Tenant() tenantId: string) {    return this.currencyService.listCurrencies(tenantId);
  }

  @Post('admin/currencies')
  @UseGuards(StoreAdminGuard)
  async createCurrency(
    @Tenant() tenantId: string,
    @Body() dto: CreateCurrencyDto
  ) {    return this.currencyService.createCurrency(tenantId, dto);
  }

  @Put('admin/currencies/:code')
  @UseGuards(StoreAdminGuard)
  async updateCurrency(
    @Tenant() tenantId: string,
    @Param('code') code: string,
    @Body() dto: UpdateCurrencyDto
  ) {    return this.currencyService.updateCurrency(tenantId, code, dto);
  }

  @Delete('admin/currencies/:code')
  @UseGuards(StoreAdminGuard)
  async deleteCurrency(
    @Tenant() tenantId: string,
    @Param('code') code: string
  ) {    return this.currencyService.deleteCurrency(tenantId, code);
  }

  @Post('admin/currencies/:code/set-base')
  @UseGuards(StoreAdminGuard)
  async setBaseCurrency(
    @Tenant() tenantId: string,
    @Param('code') code: string
  ) {    return this.currencyService.setBaseCurrency(tenantId, code);
  }

  @Post('admin/currencies/update-rates')
  @UseGuards(StoreAdminGuard)
  async updateExchangeRates(
    @Tenant() tenantId: string,
    @Body() rates: Record<string, number>
  ) {    return this.currencyService.updateExchangeRates(tenantId, rates);
  }

  // ============ PRICE OVERRIDES - ADMIN ============

  @Get('admin/products/:productId/prices')
  @UseGuards(StoreAdminGuard)
  async getProductPrices(
    @Tenant() tenantId: string,
    @Param('productId') productId: string
  ) {    return this.currencyService.getProductPrices(tenantId, productId);
  }

  @Post('admin/products/:productId/prices')
  @UseGuards(StoreAdminGuard)
  async setProductPriceOverride(
    @Tenant() tenantId: string,
    @Param('productId') productId: string,
    @Body() dto: SetPriceOverrideDto
  ) {    return this.currencyService.setProductPriceOverride(tenantId, productId, dto);
  }

  @Delete('admin/products/:productId/prices/:currency')
  @UseGuards(StoreAdminGuard)
  async removeProductPriceOverride(
    @Tenant() tenantId: string,
    @Param('productId') productId: string,
    @Param('currency') currency: string
  ) {    return this.currencyService.removeProductPriceOverride(tenantId, productId, currency);
  }

  @Post('admin/variants/:variantId/prices')
  @UseGuards(StoreAdminGuard)
  async setVariantPriceOverride(
    @Tenant() tenantId: string,
    @Param('variantId') variantId: string,
    @Body() dto: SetPriceOverrideDto
  ) {    return this.currencyService.setVariantPriceOverride(tenantId, variantId, dto);
  }

  // ============ SHIPPING CARRIERS - ADMIN ============

  @Get('admin/shipping/carriers')
  @UseGuards(StoreAdminGuard)
  async listCarriers(@Tenant() tenantId: string) {    return this.shippingService.listCarriers(tenantId);
  }

  @Get('admin/shipping/carriers/:id')
  @UseGuards(StoreAdminGuard)
  async getCarrier(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {    return this.shippingService.getCarrier(tenantId, id);
  }

  @Post('admin/shipping/carriers')
  @UseGuards(StoreAdminGuard)
  async createCarrier(
    @Tenant() tenantId: string,
    @Body() dto: CreateCarrierDto
  ) {    return this.shippingService.createCarrier(tenantId, dto);
  }

  @Put('admin/shipping/carriers/:id')
  @UseGuards(StoreAdminGuard)
  async updateCarrier(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCarrierDto
  ) {    return this.shippingService.updateCarrier(tenantId, id, dto);
  }

  @Delete('admin/shipping/carriers/:id')
  @UseGuards(StoreAdminGuard)
  async deleteCarrier(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {    return this.shippingService.deleteCarrier(tenantId, id);
  }

  // ============ SHIPPING ZONES - ADMIN ============

  @Get('admin/shipping/zones')
  @UseGuards(StoreAdminGuard)
  async listZones(@Tenant() tenantId: string) {    return this.shippingService.listZones(tenantId);
  }

  @Post('admin/shipping/zones')
  @UseGuards(StoreAdminGuard)
  async createZone(
    @Tenant() tenantId: string,
    @Body() dto: CreateZoneDto
  ) {    return this.shippingService.createZone(tenantId, dto);
  }

  @Put('admin/shipping/zones/:id')
  @UseGuards(StoreAdminGuard)
  async updateZone(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateZoneDto
  ) {    return this.shippingService.updateZone(tenantId, id, dto);
  }

  @Delete('admin/shipping/zones/:id')
  @UseGuards(StoreAdminGuard)
  async deleteZone(
    @Tenant() tenantId: string,
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const actorId = (req as any).user?.userId ?? (req as any).user?.sub ?? (req as any).user?.id ?? undefined;
    return this.shippingService.deleteZone(tenantId, id, actorId);
  }

  /**
   * Restore a soft-deleted zone (used by Undo toast within ~5s).
   */
  @Post('admin/shipping/zones/:id/restore')
  @UseGuards(StoreAdminGuard)
  async restoreZone(
    @Tenant() tenantId: string,
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const actorId = (req as any).user?.userId ?? (req as any).user?.sub ?? (req as any).user?.id ?? undefined;
    return this.shippingService.restoreZone(tenantId, id, actorId);
  }

  // ============ SHIPPING RATES - ADMIN ============

  @Get('admin/shipping/rates')
  @UseGuards(StoreAdminGuard)
  async listRates(
    @Tenant() tenantId: string,
    @Query('zoneId') zoneId?: string
  ) {    return this.shippingService.listRates(tenantId, zoneId);
  }

  @Post('admin/shipping/rates')
  @UseGuards(StoreAdminGuard)
  async createRate(
    @Tenant() tenantId: string,
    @Body() dto: CreateRateDto
  ) {    return this.shippingService.createRate(tenantId, dto);
  }

  @Put('admin/shipping/rates/:id')
  @UseGuards(StoreAdminGuard)
  async updateRate(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRateDto
  ) {    return this.shippingService.updateRate(tenantId, id, dto);
  }

  @Delete('admin/shipping/rates/:id')
  @UseGuards(StoreAdminGuard)
  async deleteRate(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {    return this.shippingService.deleteRate(tenantId, id);
  }

  // ============ WEIGHT TIERS - ADMIN ============

  @Post('admin/shipping/weight-tiers')
  @UseGuards(StoreAdminGuard)
  async addWeightTier(
    @Tenant() tenantId: string,
    @Body() dto: CreateWeightTierDto
  ) {    return this.shippingService.addWeightTier(tenantId, dto);
  }

  @Delete('admin/shipping/weight-tiers/:id')
  @UseGuards(StoreAdminGuard)
  async deleteWeightTier(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {    return this.shippingService.deleteWeightTier(tenantId, id);
  }

  // ============ SHIPMENTS - ADMIN ============

  @Get('admin/shipments')
  @UseGuards(StoreAdminGuard)
  async listShipments(
    @Tenant() tenantId: string,
    @Query('orderId') orderId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {    return this.shippingService.listShipments(tenantId, {
      orderId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('admin/shipments/:id')
  @UseGuards(StoreAdminGuard)
  async getShipment(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {    return this.shippingService.getShipment(tenantId, id);
  }

  @Post('admin/shipments')
  @UseGuards(StoreAdminGuard)
  async createShipment(
    @Tenant() tenantId: string,
    @Body() dto: CreateShipmentDto
  ) {    return this.shippingService.createShipment(tenantId, dto);
  }

  @Put('admin/shipments/:id')
  @UseGuards(StoreAdminGuard)
  async updateShipment(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto
  ) {    return this.shippingService.updateShipment(tenantId, id, dto);
  }

  @Post('admin/shipments/:id/ship')
  @UseGuards(StoreAdminGuard)
  async markAsShipped(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body('trackingNumber') trackingNumber?: string
  ) {    return this.shippingService.markAsShipped(tenantId, id, trackingNumber);
  }

  @Post('admin/shipments/:id/deliver')
  @UseGuards(StoreAdminGuard)
  async markAsDelivered(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {    return this.shippingService.markAsDelivered(tenantId, id);
  }

  @Post('admin/shipments/:id/events')
  @UseGuards(StoreAdminGuard)
  async addTrackingEvent(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AddTrackingEventDto
  ) {    return this.shippingService.addTrackingEvent(tenantId, id, dto);
  }
}
