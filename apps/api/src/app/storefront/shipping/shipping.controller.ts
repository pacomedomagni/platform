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
  Query,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { ShippingService } from './shipping.service';
import { EasyPostService } from './easypost.service';
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
  constructor(
    private readonly shippingService: ShippingService,
    private readonly easyPostService: EasyPostService,
  ) {}

  @Post('calculate')
  async calculateShipping(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CalculateShippingDto,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.shippingService.calculateShipping(tenantId, dto);
  }

  // ── EasyPost Integration ──

  /**
   * Verify shipping address
   */
  @Post('verify-address')
  async verifyAddress(@Body() address: any) {
    return this.easyPostService.verifyAddress(address);
  }

  /**
   * Get shipping rates for checkout (uses EasyPost)
   */
  @Post('rates')
  async getRates(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      orderId: string;
      fromAddress: any;
      toAddress: any;
      parcel: any;
    },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.easyPostService.getRates(
      tenantId,
      body.orderId,
      body.fromAddress,
      body.toAddress,
      body.parcel,
    );
  }

  /**
   * Get tracking information
   */
  @Get('tracking/:trackingCode')
  async getTracking(
    @Param('trackingCode') trackingCode: string,
    @Query('carrier') carrier?: string,
  ) {
    return this.easyPostService.getTracking(trackingCode, carrier);
  }

  /**
   * EasyPost webhook receiver
   */
  @Post('webhooks/easypost')
  async handleWebhook(@Body() event: any) {
    return this.easyPostService.handleWebhook(event);
  }
}

// ── Admin EasyPost Routes ──

@Controller('store/admin/shipping')
@UseGuards(StoreAdminGuard)
export class ShippingEasyPostAdminController {
  constructor(private readonly easyPostService: EasyPostService) {}

  /**
   * Purchase shipping label (admin only)
   */
  @Post('labels')
  async buyLabel(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      orderId: string;
      rateId: string;
      insuranceAmount?: number;
    },
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.easyPostService.buyLabel(
      tenantId,
      body.orderId,
      body.rateId,
      body.insuranceAmount,
    );
  }

  /**
   * Create return label (admin only)
   */
  @Post('returns/:shipmentId/label')
  async createReturnLabel(
    @Headers('x-tenant-id') tenantId: string,
    @Param('shipmentId') shipmentId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.easyPostService.createReturnLabel(tenantId, shipmentId);
  }

  /**
   * Get shipping analytics (admin only)
   */
  @Get('analytics')
  async getAnalytics(
    @Headers('x-tenant-id') tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.easyPostService.getShippingAnalytics(
      tenantId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
