import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayStoreService } from '../ebay/ebay-store.service';
import { CreateConnectionDto } from '../shared/marketplace.dto';

/**
 * Marketplace Connections Controller
 * Manages eBay/Amazon/etc connections for tenants
 */
@Controller('marketplace/connections')
@UseGuards(AuthGuard, RolesGuard)
export class ConnectionsController {
  constructor(private ebayStore: EbayStoreService) {}

  /**
   * Create new eBay connection
   * POST /api/marketplace/connections
   */
  @Post()
  @Roles('admin', 'System Manager')
  async createConnection(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: CreateConnectionDto
  ) {
    return this.ebayStore.createConnection({
      name: dto.name,
      description: dto.description,
      marketplaceId: dto.marketplaceId,
      isDefault: dto.isDefault,
    });
  }

  /**
   * Get all connections
   * GET /api/marketplace/connections
   */
  @Get()
  async getConnections(
    @Tenant() tenantId: string,
    @Query('platform') platform?: string
  ) {
    // Currently only eBay supported
    return this.ebayStore.getConnections();
  }

  /**
   * Get single connection
   * GET /api/marketplace/connections/:id
   */
  @Get(':id')
  async getConnection(@Param('id') id: string) {
    return this.ebayStore.getConnection(id);
  }

  /**
   * Get connection status
   * GET /api/marketplace/connections/:id/status
   */
  @Get(':id/status')
  async getConnectionStatus(@Param('id') id: string) {
    return this.ebayStore.getConnectionStatus(id);
  }

  /**
   * Disconnect connection (clear tokens)
   * POST /api/marketplace/connections/:id/disconnect
   */
  @Post(':id/disconnect')
  @Roles('admin', 'System Manager')
  async disconnectConnection(@Param('id') id: string) {
    await this.ebayStore.disconnectConnection(id);
    return { success: true, message: 'Connection disconnected' };
  }

  /**
   * Delete connection
   * DELETE /api/marketplace/connections/:id
   */
  @Delete(':id')
  @Roles('admin', 'System Manager')
  async deleteConnection(@Param('id') id: string) {
    await this.ebayStore.deleteConnection(id);
    return { success: true, message: 'Connection deleted' };
  }
}
