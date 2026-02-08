import {
  Controller, Get, Post, Param, Headers, Req,
  BadRequestException, UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { DigitalFulfillmentService } from './digital-fulfillment.service';

@Controller('store')
export class DigitalDownloadController {
  constructor(private readonly digitalService: DigitalFulfillmentService) {}

  /**
   * Get downloads for a customer (requires customer_token auth header)
   */
  @Get('downloads/customer')
  async getCustomerDownloads(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!auth) throw new BadRequestException('Authorization required');
    // Extract customer ID from JWT (simplified - in production use a guard)
    const token = auth.replace('Bearer ', '');
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const customerId = payload.sub || payload.customerId;
      if (!customerId) throw new BadRequestException('Invalid token');
      return this.digitalService.listCustomerDownloads(tenantId, customerId);
    } catch {
      throw new BadRequestException('Invalid authorization token');
    }
  }

  @Get('downloads/:orderId')
  async getDownloads(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
    @Param('orderId') orderId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!auth) throw new BadRequestException('Authorization required');
    return this.digitalService.getDownloads(tenantId, orderId);
  }

  @Post('downloads/:downloadId/track')
  async trackDownload(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
    @Param('downloadId') downloadId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!auth) throw new BadRequestException('Authorization required');
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
