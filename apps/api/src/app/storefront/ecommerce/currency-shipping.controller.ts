import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { ShippingService } from './shipping.service';
import { StoreAdminGuard } from '@platform/auth';
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
  async listCurrencies(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const currencies = await this.currencyService.listCurrencies(tenantId);
    // Only return enabled currencies for public endpoint
    return currencies.filter(c => c.isEnabled);
  }

  @Get('price/:productId')
  async getProductPrice(
    @Headers('x-tenant-id') tenantId: string,
    @Param('productId') productId: string,
    @Query('currency') currency?: string,
    @Query('variantId') variantId?: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const currencyCode = currency || 'USD';
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
  async listAllCurrencies(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.listCurrencies(tenantId);
  }

  @Post('admin/currencies')
  @UseGuards(StoreAdminGuard)
  async createCurrency(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateCurrencyDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.createCurrency(tenantId, dto);
  }

  @Put('admin/currencies/:code')
  @UseGuards(StoreAdminGuard)
  async updateCurrency(
    @Headers('x-tenant-id') tenantId: string,
    @Param('code') code: string,
    @Body() dto: UpdateCurrencyDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.updateCurrency(tenantId, code, dto);
  }

  @Delete('admin/currencies/:code')
  @UseGuards(StoreAdminGuard)
  async deleteCurrency(
    @Headers('x-tenant-id') tenantId: string,
    @Param('code') code: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.deleteCurrency(tenantId, code);
  }

  @Post('admin/currencies/:code/set-base')
  @UseGuards(StoreAdminGuard)
  async setBaseCurrency(
    @Headers('x-tenant-id') tenantId: string,
    @Param('code') code: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.setBaseCurrency(tenantId, code);
  }

  @Post('admin/currencies/update-rates')
  @UseGuards(StoreAdminGuard)
  async updateExchangeRates(
    @Headers('x-tenant-id') tenantId: string,
    @Body() rates: Record<string, number>
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.updateExchangeRates(tenantId, rates);
  }

  // ============ PRICE OVERRIDES - ADMIN ============

  @Get('admin/products/:productId/prices')
  @UseGuards(StoreAdminGuard)
  async getProductPrices(
    @Headers('x-tenant-id') tenantId: string,
    @Param('productId') productId: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.getProductPrices(tenantId, productId);
  }

  @Post('admin/products/:productId/prices')
  @UseGuards(StoreAdminGuard)
  async setProductPriceOverride(
    @Headers('x-tenant-id') tenantId: string,
    @Param('productId') productId: string,
    @Body() dto: SetPriceOverrideDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.setProductPriceOverride(tenantId, productId, dto);
  }

  @Delete('admin/products/:productId/prices/:currency')
  @UseGuards(StoreAdminGuard)
  async removeProductPriceOverride(
    @Headers('x-tenant-id') tenantId: string,
    @Param('productId') productId: string,
    @Param('currency') currency: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.removeProductPriceOverride(tenantId, productId, currency);
  }

  @Post('admin/variants/:variantId/prices')
  @UseGuards(StoreAdminGuard)
  async setVariantPriceOverride(
    @Headers('x-tenant-id') tenantId: string,
    @Param('variantId') variantId: string,
    @Body() dto: SetPriceOverrideDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.setVariantPriceOverride(tenantId, variantId, dto);
  }

  // ============ SHIPPING CALCULATION - PUBLIC ============

  @Post('shipping/calculate')
  async calculateShipping(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CalculateShippingDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.calculateShipping(tenantId, dto);
  }

  // ============ SHIPPING CARRIERS - ADMIN ============

  @Get('admin/shipping/carriers')
  @UseGuards(StoreAdminGuard)
  async listCarriers(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.listCarriers(tenantId);
  }

  @Get('admin/shipping/carriers/:id')
  @UseGuards(StoreAdminGuard)
  async getCarrier(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.getCarrier(tenantId, id);
  }

  @Post('admin/shipping/carriers')
  @UseGuards(StoreAdminGuard)
  async createCarrier(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateCarrierDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.createCarrier(tenantId, dto);
  }

  @Put('admin/shipping/carriers/:id')
  @UseGuards(StoreAdminGuard)
  async updateCarrier(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCarrierDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.updateCarrier(tenantId, id, dto);
  }

  @Delete('admin/shipping/carriers/:id')
  @UseGuards(StoreAdminGuard)
  async deleteCarrier(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.deleteCarrier(tenantId, id);
  }

  // ============ SHIPPING ZONES - ADMIN ============

  @Get('admin/shipping/zones')
  @UseGuards(StoreAdminGuard)
  async listZones(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.listZones(tenantId);
  }

  @Post('admin/shipping/zones')
  @UseGuards(StoreAdminGuard)
  async createZone(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateZoneDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.createZone(tenantId, dto);
  }

  @Put('admin/shipping/zones/:id')
  @UseGuards(StoreAdminGuard)
  async updateZone(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateZoneDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.updateZone(tenantId, id, dto);
  }

  @Delete('admin/shipping/zones/:id')
  @UseGuards(StoreAdminGuard)
  async deleteZone(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.deleteZone(tenantId, id);
  }

  // ============ SHIPPING RATES - ADMIN ============

  @Get('admin/shipping/rates')
  @UseGuards(StoreAdminGuard)
  async listRates(
    @Headers('x-tenant-id') tenantId: string,
    @Query('zoneId') zoneId?: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.listRates(tenantId, zoneId);
  }

  @Post('admin/shipping/rates')
  @UseGuards(StoreAdminGuard)
  async createRate(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateRateDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.createRate(tenantId, dto);
  }

  @Put('admin/shipping/rates/:id')
  @UseGuards(StoreAdminGuard)
  async updateRate(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRateDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.updateRate(tenantId, id, dto);
  }

  @Delete('admin/shipping/rates/:id')
  @UseGuards(StoreAdminGuard)
  async deleteRate(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.deleteRate(tenantId, id);
  }

  // ============ WEIGHT TIERS - ADMIN ============

  @Post('admin/shipping/weight-tiers')
  @UseGuards(StoreAdminGuard)
  async addWeightTier(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateWeightTierDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.addWeightTier(tenantId, dto);
  }

  @Delete('admin/shipping/weight-tiers/:id')
  @UseGuards(StoreAdminGuard)
  async deleteWeightTier(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.deleteWeightTier(tenantId, id);
  }

  // ============ SHIPMENTS - ADMIN ============

  @Get('admin/shipments')
  @UseGuards(StoreAdminGuard)
  async listShipments(
    @Headers('x-tenant-id') tenantId: string,
    @Query('orderId') orderId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.listShipments(tenantId, {
      orderId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('admin/shipments/:id')
  @UseGuards(StoreAdminGuard)
  async getShipment(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.getShipment(tenantId, id);
  }

  @Post('admin/shipments')
  @UseGuards(StoreAdminGuard)
  async createShipment(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateShipmentDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.createShipment(tenantId, dto);
  }

  @Put('admin/shipments/:id')
  @UseGuards(StoreAdminGuard)
  async updateShipment(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.updateShipment(tenantId, id, dto);
  }

  @Post('admin/shipments/:id/ship')
  @UseGuards(StoreAdminGuard)
  async markAsShipped(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body('trackingNumber') trackingNumber?: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.markAsShipped(tenantId, id, trackingNumber);
  }

  @Post('admin/shipments/:id/deliver')
  @UseGuards(StoreAdminGuard)
  async markAsDelivered(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.markAsDelivered(tenantId, id);
  }

  @Post('admin/shipments/:id/events')
  @UseGuards(StoreAdminGuard)
  async addTrackingEvent(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: AddTrackingEventDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.addTrackingEvent(tenantId, id, dto);
  }
}
