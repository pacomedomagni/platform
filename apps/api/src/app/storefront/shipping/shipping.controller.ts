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
    @Req() req: Request,
    @Body() dto: CreateZoneDto,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.createZone(tenantId, dto);
  }

  @Get('zones')
  async listZones(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.listZones(tenantId);
  }

  @Put('zones/:zoneId')
  async updateZone(
    @Req() req: Request,
    @Param('zoneId') zoneId: string,
    @Body() dto: UpdateZoneDto,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.updateZone(tenantId, zoneId, dto);
  }

  @Delete('zones/:zoneId')
  async deleteZone(
    @Req() req: Request,
    @Param('zoneId') zoneId: string,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.deleteZone(tenantId, zoneId);
  }

  // Rates
  @Post('zones/:zoneId/rates')
  async createRate(
    @Req() req: Request,
    @Param('zoneId') zoneId: string,
    @Body() dto: CreateRateDto,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.createRate(tenantId, zoneId, dto);
  }

  @Get('zones/:zoneId/rates')
  async listRates(
    @Req() req: Request,
    @Param('zoneId') zoneId: string,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.listRates(tenantId, zoneId);
  }

  @Put('rates/:rateId')
  async updateRate(
    @Req() req: Request,
    @Param('rateId') rateId: string,
    @Body() dto: Partial<CreateRateDto>,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.updateRate(tenantId, rateId, dto);
  }

  @Delete('rates/:rateId')
  async deleteRate(
    @Req() req: Request,
    @Param('rateId') rateId: string,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.deleteRate(tenantId, rateId);
  }
}

// ── Public Routes ──

@Controller('store/shipping')
@UseGuards(StorePublishedGuard)
export class ShippingPublicController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('calculate')
  async calculateShipping(
    @Req() req: Request,
    @Body() dto: CalculateShippingDto,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.calculateShipping(tenantId, dto);
  }

  @Get('rates')
  async getShippingRates(
    @Req() req: Request,
    @Query('country') country: string,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!country) throw new BadRequestException('Country code required');
    return this.shippingService.calculateShipping(tenantId, {
      country,
      cartTotal: 0,
    });
  }
}
