import {
  Controller,
  Get,
  Put,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { StoreSettingsService } from './store-settings.service';
import { UpdateStoreSettingsDto } from './store-settings.dto';

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
}
