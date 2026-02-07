import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { StoreSettingsService } from './store-settings.service';
import { UpdateStoreSettingsDto, VerifyCustomDomainDto } from './store-settings.dto';

@Controller('store/admin/settings')
@UseGuards(StoreAdminGuard)
export class StoreSettingsController {
  constructor(private readonly settingsService: StoreSettingsService) {}

  @Get()
  async getSettings(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.settingsService.getSettings(tenantId);
  }

  @Put()
  async updateSettings(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: UpdateStoreSettingsDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.settingsService.updateSettings(tenantId, dto);
  }

  @Post('verify-domain')
  async verifyDomain(
    @Headers('x-tenant-id') tenantId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: VerifyCustomDomainDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.settingsService.verifyCustomDomain(tenantId, dto.customDomain);
  }
}
