import {
  Controller, Get, Post, Param, Headers,
  BadRequestException, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { DigitalFulfillmentService } from './digital-fulfillment.service';

@Controller('store')
export class DigitalDownloadController {
  constructor(private readonly digitalService: DigitalFulfillmentService) {}

  @Get('downloads/:orderId')
  async getDownloads(
    @Headers('x-tenant-id') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.digitalService.getDownloads(tenantId, orderId);
  }

  @Post('downloads/:downloadId/track')
  async trackDownload(
    @Headers('x-tenant-id') tenantId: string,
    @Param('downloadId') downloadId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.digitalService.trackDownload(tenantId, downloadId);
  }

  @Post('admin/orders/:orderId/fulfill-digital')
  @UseGuards(StoreAdminGuard)
  async fulfillDigital(
    @Headers('x-tenant-id') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.digitalService.createDownloadEntries(tenantId, orderId);
  }
}
