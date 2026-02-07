import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Headers,
  Param,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { ShippingService } from './shipping.service';
import {
  CreateZoneDto,
  UpdateZoneDto,
  CreateRateDto,
  CalculateShippingDto,
} from './shipping.dto';

// ── Admin Routes ──

@Controller('store/admin/shipping')
@UseGuards(StoreAdminGuard)
export class ShippingAdminController {
  constructor(private readonly shippingService: ShippingService) {}

  // Zones
  @Post('zones')
  async createZone(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateZoneDto,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.createZone(tenantId, dto);
  }

  @Get('zones')
  async listZones(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.listZones(tenantId);
  }

  @Put('zones/:zoneId')
  async updateZone(
    @Headers('x-tenant-id') tenantId: string,
    @Param('zoneId') zoneId: string,
    @Body() dto: UpdateZoneDto,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.updateZone(tenantId, zoneId, dto);
  }

  @Delete('zones/:zoneId')
  async deleteZone(
    @Headers('x-tenant-id') tenantId: string,
    @Param('zoneId') zoneId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.deleteZone(tenantId, zoneId);
  }

  // Rates
  @Post('zones/:zoneId/rates')
  async createRate(
    @Headers('x-tenant-id') tenantId: string,
    @Param('zoneId') zoneId: string,
    @Body() dto: CreateRateDto,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.createRate(tenantId, zoneId, dto);
  }

  @Get('zones/:zoneId/rates')
  async listRates(
    @Headers('x-tenant-id') tenantId: string,
    @Param('zoneId') zoneId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.listRates(tenantId, zoneId);
  }

  @Put('rates/:rateId')
  async updateRate(
    @Headers('x-tenant-id') tenantId: string,
    @Param('rateId') rateId: string,
    @Body() dto: Partial<CreateRateDto>,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.updateRate(tenantId, rateId, dto);
  }

  @Delete('rates/:rateId')
  async deleteRate(
    @Headers('x-tenant-id') tenantId: string,
    @Param('rateId') rateId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.deleteRate(tenantId, rateId);
  }
}

// ── Public Routes ──

@Controller('store/shipping')
export class ShippingPublicController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('calculate')
  async calculateShipping(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CalculateShippingDto,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.calculateShipping(tenantId, dto);
  }
}
