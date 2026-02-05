import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ProvisioningService } from './provisioning.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Controller('provision')
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  /**
   * POST /api/provision
   * Create a new tenant and start provisioning process
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTenant(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateTenantDto,
  ) {
    return this.provisioningService.createTenant(dto);
  }

  /**
   * GET /api/provision/:tenantId/status
   * Get the current provisioning status
   */
  @Get(':tenantId/status')
  @HttpCode(HttpStatus.OK)
  async getProvisioningStatus(@Param('tenantId') tenantId: string) {
    return this.provisioningService.getProvisioningStatus(tenantId);
  }

  /**
   * POST /api/provision/:tenantId/retry
   * Retry a failed provisioning
   */
  @Post(':tenantId/retry')
  @HttpCode(HttpStatus.OK)
  async retryProvisioning(
    @Param('tenantId') tenantId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateTenantDto,
  ) {
    return this.provisioningService.retryProvisioning(tenantId, dto);
  }
}
