import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayInventoryLocationsService } from './ebay-inventory-locations.service';

/**
 * eBay Inventory Locations API Controller
 * Manages inventory locations (warehouses and stores) for eBay
 */
@Controller('marketplace/inventory-locations')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayInventoryLocationsController {
  constructor(private locationsService: EbayInventoryLocationsService) {}

  /**
   * List all inventory locations
   * GET /api/marketplace/inventory-locations?connectionId=...
   */
  @Get()
  async getLocations(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.locationsService.getLocations(connectionId);
  }

  /**
   * Get a single inventory location
   * GET /api/marketplace/inventory-locations/:key?connectionId=...
   */
  @Get(':key')
  async getLocation(
    @Tenant() tenantId: string,
    @Param('key') key: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.locationsService.getLocation(connectionId, key);
  }

  /**
   * Create an inventory location
   * POST /api/marketplace/inventory-locations
   */
  @Post()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createLocation(
    @Tenant() tenantId: string,
    @Body()
    body: {
      connectionId: string;
      merchantLocationKey: string;
      name: string;
      address: {
        addressLine1: string;
        city: string;
        stateOrProvince: string;
        postalCode: string;
        country: string;
      };
      locationType: 'WAREHOUSE' | 'STORE';
      phone?: string;
    }
  ) {
    return this.locationsService.createLocation(body.connectionId, {
      merchantLocationKey: body.merchantLocationKey,
      name: body.name,
      address: body.address,
      locationType: body.locationType,
      phone: body.phone,
    });
  }

  /**
   * Update an inventory location
   * PATCH /api/marketplace/inventory-locations/:key
   */
  @Patch(':key')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async updateLocation(
    @Tenant() tenantId: string,
    @Param('key') key: string,
    @Body()
    body: {
      connectionId: string;
      name?: string;
      phone?: string;
    }
  ) {
    await this.locationsService.updateLocation(body.connectionId, key, {
      name: body.name,
      phone: body.phone,
    });
    return { success: true, message: 'Inventory location updated' };
  }

  /**
   * Delete an inventory location
   * DELETE /api/marketplace/inventory-locations/:key?connectionId=...
   */
  @Delete(':key')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async deleteLocation(
    @Tenant() tenantId: string,
    @Param('key') key: string,
    @Query('connectionId') connectionId: string
  ) {
    await this.locationsService.deleteLocation(connectionId, key);
    return { success: true, message: 'Inventory location deleted' };
  }

  /**
   * Enable a disabled inventory location
   * POST /api/marketplace/inventory-locations/:key/enable
   */
  @Post(':key/enable')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async enableLocation(
    @Tenant() tenantId: string,
    @Param('key') key: string,
    @Body() body: { connectionId: string }
  ) {
    await this.locationsService.enableLocation(body.connectionId, key);
    return { success: true, message: 'Inventory location enabled' };
  }

  /**
   * Disable an inventory location
   * POST /api/marketplace/inventory-locations/:key/disable
   */
  @Post(':key/disable')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async disableLocation(
    @Tenant() tenantId: string,
    @Param('key') key: string,
    @Body() body: { connectionId: string }
  ) {
    await this.locationsService.disableLocation(body.connectionId, key);
    return { success: true, message: 'Inventory location disabled' };
  }
}
