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
import { Tenant } from '../../tenant.middleware';

@Controller('store/admin/settings')
@UseGuards(StoreAdminGuard)
export class StoreSettingsController {
  constructor(private readonly settingsService: StoreSettingsService) {}

  @Get()
  async getSettings(@Tenant() tenantId: string) {    return this.settingsService.getSettings(tenantId);
  }

  @Put()
  async updateSettings(
    @Tenant() tenantId: string,
    @Body() dto: UpdateStoreSettingsDto,
  ) {    return this.settingsService.updateSettings(tenantId, dto);
  }

  @Post('verify-domain')
  async verifyDomain(
    @Tenant() tenantId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: VerifyCustomDomainDto,
  ) {    return this.settingsService.verifyCustomDomain(tenantId, dto.customDomain);
  }
}
