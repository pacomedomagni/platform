import {
  Controller, Get, Post, Param, Headers,
  BadRequestException, UseGuards,
} from '@nestjs/common';
import { StoreAdminGuard } from '@platform/auth';
import { DigitalFulfillmentService } from './digital-fulfillment.service';
import { CustomerAuthGuard } from '../auth/customer-auth.guard';
import { CurrentCustomer } from '../auth/current-customer.decorator';
import { CurrentTenant } from '../auth/current-tenant.decorator';

@Controller('store')
export class DigitalDownloadController {
  constructor(private readonly digitalService: DigitalFulfillmentService) {}

  /**
   * Get downloads for a customer (requires customer auth)
   */
  @Get('downloads/customer')
  @UseGuards(CustomerAuthGuard)
  async getCustomerDownloads(
    @CurrentTenant() tenantId: string,
    @CurrentCustomer() customerId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.digitalService.listCustomerDownloads(tenantId, customerId);
  }

  @Get('downloads/:orderId')
  @UseGuards(CustomerAuthGuard)
  async getDownloads(
    @CurrentTenant() tenantId: string,
    @CurrentCustomer() customerId: string,
    @Param('orderId') orderId: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.digitalService.getDownloads(tenantId, orderId);
  }

  @Post('downloads/:downloadId/track')
  @UseGuards(CustomerAuthGuard)
  async trackDownload(
    @CurrentTenant() tenantId: string,
    @CurrentCustomer() customerId: string,
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
