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
  async listCurrencies(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const currencies = await this.currencyService.listCurrencies(tenantId);
    // Only return enabled currencies for public endpoint
    return currencies.filter(c => c.isEnabled);
  }

  @Get('price/:productId')
  @UseGuards(StorePublishedGuard)
  async getProductPrice(
    @Req() req: Request,
    @Param('productId') productId: string,
    @Query('currency') currency?: string,
    @Query('variantId') variantId?: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
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
  async listAllCurrencies(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.listCurrencies(tenantId);
  }

  @Post('admin/currencies')
  @UseGuards(StoreAdminGuard)
  async createCurrency(
    @Req() req: Request,
    @Body() dto: CreateCurrencyDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.createCurrency(tenantId, dto);
  }

  @Put('admin/currencies/:code')
  @UseGuards(StoreAdminGuard)
  async updateCurrency(
    @Req() req: Request,
    @Param('code') code: string,
    @Body() dto: UpdateCurrencyDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.updateCurrency(tenantId, code, dto);
  }

  @Delete('admin/currencies/:code')
  @UseGuards(StoreAdminGuard)
  async deleteCurrency(
    @Req() req: Request,
    @Param('code') code: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.deleteCurrency(tenantId, code);
  }

  @Post('admin/currencies/:code/set-base')
  @UseGuards(StoreAdminGuard)
  async setBaseCurrency(
    @Req() req: Request,
    @Param('code') code: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.setBaseCurrency(tenantId, code);
  }

  @Post('admin/currencies/update-rates')
  @UseGuards(StoreAdminGuard)
  async updateExchangeRates(
    @Req() req: Request,
    @Body() rates: Record<string, number>
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.updateExchangeRates(tenantId, rates);
  }

  // ============ PRICE OVERRIDES - ADMIN ============

  @Get('admin/products/:productId/prices')
  @UseGuards(StoreAdminGuard)
  async getProductPrices(
    @Req() req: Request,
    @Param('productId') productId: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.getProductPrices(tenantId, productId);
  }

  @Post('admin/products/:productId/prices')
  @UseGuards(StoreAdminGuard)
  async setProductPriceOverride(
    @Req() req: Request,
    @Param('productId') productId: string,
    @Body() dto: SetPriceOverrideDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.setProductPriceOverride(tenantId, productId, dto);
  }

  @Delete('admin/products/:productId/prices/:currency')
  @UseGuards(StoreAdminGuard)
  async removeProductPriceOverride(
    @Req() req: Request,
    @Param('productId') productId: string,
    @Param('currency') currency: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.removeProductPriceOverride(tenantId, productId, currency);
  }

  @Post('admin/variants/:variantId/prices')
  @UseGuards(StoreAdminGuard)
  async setVariantPriceOverride(
    @Req() req: Request,
    @Param('variantId') variantId: string,
    @Body() dto: SetPriceOverrideDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.currencyService.setVariantPriceOverride(tenantId, variantId, dto);
  }

  // ============ SHIPPING CARRIERS - ADMIN ============

  @Get('admin/shipping/carriers')
  @UseGuards(StoreAdminGuard)
  async listCarriers(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.listCarriers(tenantId);
  }

  @Get('admin/shipping/carriers/:id')
  @UseGuards(StoreAdminGuard)
  async getCarrier(
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.getCarrier(tenantId, id);
  }

  @Post('admin/shipping/carriers')
  @UseGuards(StoreAdminGuard)
  async createCarrier(
    @Req() req: Request,
    @Body() dto: CreateCarrierDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.createCarrier(tenantId, dto);
  }

  @Put('admin/shipping/carriers/:id')
  @UseGuards(StoreAdminGuard)
  async updateCarrier(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCarrierDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.updateCarrier(tenantId, id, dto);
  }

  @Delete('admin/shipping/carriers/:id')
  @UseGuards(StoreAdminGuard)
  async deleteCarrier(
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.deleteCarrier(tenantId, id);
  }

  // ============ SHIPPING ZONES - ADMIN ============

  @Get('admin/shipping/zones')
  @UseGuards(StoreAdminGuard)
  async listZones(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.listZones(tenantId);
  }

  @Post('admin/shipping/zones')
  @UseGuards(StoreAdminGuard)
  async createZone(
    @Req() req: Request,
    @Body() dto: CreateZoneDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.createZone(tenantId, dto);
  }

  @Put('admin/shipping/zones/:id')
  @UseGuards(StoreAdminGuard)
  async updateZone(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateZoneDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.updateZone(tenantId, id, dto);
  }

  @Delete('admin/shipping/zones/:id')
  @UseGuards(StoreAdminGuard)
  async deleteZone(
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.deleteZone(tenantId, id);
  }

  // ============ SHIPPING RATES - ADMIN ============

  @Get('admin/shipping/rates')
  @UseGuards(StoreAdminGuard)
  async listRates(
    @Req() req: Request,
    @Query('zoneId') zoneId?: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.listRates(tenantId, zoneId);
  }

  @Post('admin/shipping/rates')
  @UseGuards(StoreAdminGuard)
  async createRate(
    @Req() req: Request,
    @Body() dto: CreateRateDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.createRate(tenantId, dto);
  }

  @Put('admin/shipping/rates/:id')
  @UseGuards(StoreAdminGuard)
  async updateRate(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRateDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.updateRate(tenantId, id, dto);
  }

  @Delete('admin/shipping/rates/:id')
  @UseGuards(StoreAdminGuard)
  async deleteRate(
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.deleteRate(tenantId, id);
  }

  // ============ WEIGHT TIERS - ADMIN ============

  @Post('admin/shipping/weight-tiers')
  @UseGuards(StoreAdminGuard)
  async addWeightTier(
    @Req() req: Request,
    @Body() dto: CreateWeightTierDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.addWeightTier(tenantId, dto);
  }

  @Delete('admin/shipping/weight-tiers/:id')
  @UseGuards(StoreAdminGuard)
  async deleteWeightTier(
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.deleteWeightTier(tenantId, id);
  }

  // ============ SHIPMENTS - ADMIN ============

  @Get('admin/shipments')
  @UseGuards(StoreAdminGuard)
  async listShipments(
    @Req() req: Request,
    @Query('orderId') orderId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
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
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.getShipment(tenantId, id);
  }

  @Post('admin/shipments')
  @UseGuards(StoreAdminGuard)
  async createShipment(
    @Req() req: Request,
    @Body() dto: CreateShipmentDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.createShipment(tenantId, dto);
  }

  @Put('admin/shipments/:id')
  @UseGuards(StoreAdminGuard)
  async updateShipment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.updateShipment(tenantId, id, dto);
  }

  @Post('admin/shipments/:id/ship')
  @UseGuards(StoreAdminGuard)
  async markAsShipped(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('trackingNumber') trackingNumber?: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.markAsShipped(tenantId, id, trackingNumber);
  }

  @Post('admin/shipments/:id/deliver')
  @UseGuards(StoreAdminGuard)
  async markAsDelivered(
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.markAsDelivered(tenantId, id);
  }

  @Post('admin/shipments/:id/events')
  @UseGuards(StoreAdminGuard)
  async addTrackingEvent(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AddTrackingEventDto
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.addTrackingEvent(tenantId, id, dto);
  }
}
