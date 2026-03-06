import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import {
  IMarketplaceConnectionsService,
  MARKETPLACE_CONNECTIONS_SERVICE,
} from '../shared/marketplace-service.interface';
import { CreateConnectionDto } from '../shared/marketplace.dto';

/**
 * Marketplace Connections Controller
 * Manages eBay/Amazon/etc connections for tenants.
 * Uses injected service token so the controller is platform-agnostic.
 */
@Controller('marketplace/connections')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class ConnectionsController {
  constructor(
    @Inject(MARKETPLACE_CONNECTIONS_SERVICE)
    private connectionsService: IMarketplaceConnectionsService
  ) {}

  /**
   * Create new marketplace connection
   * POST /api/marketplace/connections
   */
  @Post()
  @Roles('admin', 'System Manager')
  async createConnection(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: CreateConnectionDto
  ) {
    return this.connectionsService.createConnection({
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
    return this.connectionsService.getConnections();
  }

  /**
   * Get single connection
   * GET /api/marketplace/connections/:id
   */
  @Get(':id')
  async getConnection(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    return this.connectionsService.getConnection(id);
  }

  /**
   * Get connection status
   * GET /api/marketplace/connections/:id/status
   */
  @Get(':id/status')
  async getConnectionStatus(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    return this.connectionsService.getConnectionStatus(id);
  }

  /**
   * Disconnect connection (clear tokens)
   * POST /api/marketplace/connections/:id/disconnect
   */
  @Post(':id/disconnect')
  @Roles('admin', 'System Manager')
  async disconnectConnection(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    await this.connectionsService.disconnectConnection(id);
    return { success: true, message: 'Connection disconnected' };
  }

  /**
   * Get vacation mode status
   * GET /api/marketplace/connections/:id/vacation
   */
  @Get(':id/vacation')
  @Roles('admin', 'System Manager')
  async getVacationMode(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    return this.connectionsService.getVacationMode(id);
  }

  /**
   * Set vacation mode
   * POST /api/marketplace/connections/:id/vacation
   */
  @Post(':id/vacation')
  @Roles('admin', 'System Manager')
  async setVacationMode(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { enabled: boolean; returnMessage?: string }
  ) {
    return this.connectionsService.setVacationMode(id, body.enabled, body.returnMessage);
  }

  /**
   * Delete connection
   * DELETE /api/marketplace/connections/:id
   */
  @Delete(':id')
  @Roles('admin', 'System Manager')
  async deleteConnection(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    await this.connectionsService.deleteConnection(id);
    return { success: true, message: 'Connection deleted' };
  }
}
