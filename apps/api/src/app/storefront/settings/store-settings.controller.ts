import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Req,
  BadRequestException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { StoreAdminGuard } from '@platform/auth';
import { StoreSettingsService } from './store-settings.service';
import { UpdateStoreSettingsDto, VerifyCustomDomainDto } from './store-settings.dto';

@Controller('store/admin/settings')
@UseGuards(StoreAdminGuard)
export class StoreSettingsController {
  constructor(private readonly settingsService: StoreSettingsService) {}

  @Get()
  async getSettings(@Req() req: Request) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.settingsService.getSettings(tenantId);
  }

  @Put()
  async updateSettings(
    @Req() req: Request,
    @Body() dto: UpdateStoreSettingsDto,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.settingsService.updateSettings(tenantId, dto);
  }

  @Post('verify-domain')
  async verifyDomain(
    @Req() req: Request,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: VerifyCustomDomainDto,
  ) {
    const tenantId = (req as any).resolvedTenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.settingsService.verifyCustomDomain(tenantId, dto.customDomain);
  }
}
