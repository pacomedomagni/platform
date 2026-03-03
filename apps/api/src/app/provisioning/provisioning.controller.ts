import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProvisioningService } from './provisioning.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ApiKeyGuard, RequireApiKey } from '@platform/auth';

@Controller('provision')
@UseGuards(ApiKeyGuard)
@Throttle({ short: { limit: 3, ttl: 1000 }, medium: { limit: 10, ttl: 60000 } })
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  /**
   * POST /api/provision
   * Create a new tenant and start provisioning process
   * Requires API key in production
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireApiKey()
  async createTenant(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateTenantDto,
  ) {
    return this.provisioningService.createTenant(dto);
  }

  /**
   * GET /api/provision/:tenantId/status
   * Get the current provisioning status
   * H-TP-1: Requires API key to prevent unauthorized access to provisioning status
   */
  @Get(':tenantId/status')
  @HttpCode(HttpStatus.OK)
  @RequireApiKey()
  async getProvisioningStatus(@Param('tenantId') tenantId: string) {
    return this.provisioningService.getProvisioningStatus(tenantId);
  }

  /**
   * POST /api/provision/:tenantId/retry
   * Retry a failed provisioning
   * Requires API key in production
   */
  @Post(':tenantId/retry')
  @HttpCode(HttpStatus.OK)
  @RequireApiKey()
  async retryProvisioning(
    @Param('tenantId') tenantId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateTenantDto,
  ) {
    return this.provisioningService.retryProvisioning(tenantId, dto);
  }
}
