import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Req,
  Param,
  Query,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StoreAdminGuard } from '@platform/auth';
import { StorePublishedGuard } from '../../common/guards/store-published.guard';
import { ShippingService } from './shipping.service';
import { Tenant } from '../../tenant.middleware';
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
    @Tenant() tenantId: string,
    @Body() dto: CreateZoneDto,
  ) {    return this.shippingService.createZone(tenantId, dto);
  }

  @Get('zones')
  async listZones(@Tenant() tenantId: string) {    return this.shippingService.listZones(tenantId);
  }

  @Put('zones/:zoneId')
  async updateZone(
    @Tenant() tenantId: string,
    @Param('zoneId') zoneId: string,
    @Body() dto: UpdateZoneDto,
  ) {    return this.shippingService.updateZone(tenantId, zoneId, dto);
  }

  @Delete('zones/:zoneId')
  async deleteZone(
    @Tenant() tenantId: string,
    @Param('zoneId') zoneId: string,
  ) {    return this.shippingService.deleteZone(tenantId, zoneId);
  }

  // Rates
  @Post('zones/:zoneId/rates')
  async createRate(
    @Tenant() tenantId: string,
    @Param('zoneId') zoneId: string,
    @Body() dto: CreateRateDto,
  ) {    return this.shippingService.createRate(tenantId, zoneId, dto);
  }

  @Get('zones/:zoneId/rates')
  async listRates(
    @Tenant() tenantId: string,
    @Param('zoneId') zoneId: string,
  ) {    return this.shippingService.listRates(tenantId, zoneId);
  }

  @Put('rates/:rateId')
  async updateRate(
    @Tenant() tenantId: string,
    @Param('rateId') rateId: string,
    @Body() dto: Partial<CreateRateDto>,
  ) {    return this.shippingService.updateRate(tenantId, rateId, dto);
  }

  @Delete('rates/:rateId')
  async deleteRate(
    @Tenant() tenantId: string,
    @Param('rateId') rateId: string,
  ) {    return this.shippingService.deleteRate(tenantId, rateId);
  }
}

// ── Public Routes ──

@Controller('store/shipping')
@UseGuards(StorePublishedGuard)
export class ShippingPublicController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('calculate')
  async calculateShipping(
    @Tenant() tenantId: string,
    @Body() dto: CalculateShippingDto,
  ) {    return this.shippingService.calculateShipping(tenantId, dto);
  }

  @Get('rates')
  async getShippingRates(
    @Tenant() tenantId: string,
    @Query('country') country: string,
  ) {    if (!country) throw new BadRequestException('Country code required');
    return this.shippingService.calculateShipping(tenantId, {
      country,
      cartTotal: 0,
    });
  }
}
