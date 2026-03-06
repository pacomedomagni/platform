import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';

/**
 * eBay Inventory Locations Service
 * Manages inventory locations (warehouses and stores) via the eBay Sell Inventory API.
 * Supports creating, updating, deleting, enabling, and disabling inventory locations.
 */
@Injectable()
export class EbayInventoryLocationsService {
  private readonly logger = new Logger(EbayInventoryLocationsService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService
  ) {}

  /**
   * List all inventory locations for a connection.
   */
  async getLocations(connectionId: string): Promise<any[]> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Fetched inventory locations for connection ${connectionId}`);
      return [
        {
          merchantLocationKey: 'warehouse-main',
          name: 'Main Warehouse',
          locationType: 'WAREHOUSE',
          address: {
            addressLine1: '123 Commerce St',
            city: 'Austin',
            stateOrProvince: 'TX',
            postalCode: '78701',
            country: 'US',
          },
          phone: '512-555-0100',
          locationStatus: 'ENABLED',
        },
        {
          merchantLocationKey: 'store-downtown',
          name: 'Downtown Store',
          locationType: 'STORE',
          address: {
            addressLine1: '456 Main Ave',
            city: 'Austin',
            stateOrProvince: 'TX',
            postalCode: '78702',
            country: 'US',
          },
          phone: '512-555-0200',
          locationStatus: 'ENABLED',
        },
      ];
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).inventory.getInventoryLocations();

      const locations = response?.locations || [];

      this.logger.log(
        `Fetched ${locations.length} inventory locations for connection ${connectionId}`
      );

      return locations.map((loc: any) => ({
        merchantLocationKey: loc.merchantLocationKey,
        name: loc.name || loc.location?.address?.city || loc.merchantLocationKey,
        locationType: loc.locationType,
        address: loc.location?.address || null,
        phone: loc.phone || null,
        locationStatus: loc.merchantLocationStatus || loc.locationStatus,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to fetch inventory locations for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a single inventory location by its merchant location key.
   */
  async getLocation(connectionId: string, merchantLocationKey: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Fetched inventory location ${merchantLocationKey} for connection ${connectionId}`
      );
      return {
        merchantLocationKey,
        name: 'Mock Location',
        locationType: 'WAREHOUSE',
        address: {
          addressLine1: '123 Commerce St',
          city: 'Austin',
          stateOrProvince: 'TX',
          postalCode: '78701',
          country: 'US',
        },
        phone: '512-555-0100',
        locationStatus: 'ENABLED',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client.sell as any).inventory.getInventoryLocation(
        merchantLocationKey
      );

      this.logger.log(
        `Fetched inventory location ${merchantLocationKey} for connection ${connectionId}`
      );

      return {
        merchantLocationKey: response.merchantLocationKey || merchantLocationKey,
        name: response.name || response.location?.address?.city || merchantLocationKey,
        locationType: response.locationType,
        address: response.location?.address || null,
        phone: response.phone || null,
        locationStatus: response.merchantLocationStatus || response.locationStatus,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch inventory location ${merchantLocationKey} for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Create a new inventory location.
   */
  async createLocation(
    connectionId: string,
    data: {
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
  ): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Created inventory location ${data.merchantLocationKey} (${data.name}) for connection ${connectionId}`
      );
      return {
        merchantLocationKey: data.merchantLocationKey,
        name: data.name,
        locationType: data.locationType,
        address: data.address,
        phone: data.phone || null,
        locationStatus: 'ENABLED',
      };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body: any = {
        location: {
          address: {
            addressLine1: data.address.addressLine1,
            city: data.address.city,
            stateOrProvince: data.address.stateOrProvince,
            postalCode: data.address.postalCode,
            country: data.address.country,
          },
        },
        locationTypes: [data.locationType],
        name: data.name,
        merchantLocationStatus: 'ENABLED',
      };

      if (data.phone) {
        body.phone = data.phone;
      }

      await (client.sell as any).inventory.createInventoryLocation(
        data.merchantLocationKey,
        body
      );

      this.logger.log(
        `Created inventory location ${data.merchantLocationKey} (${data.name}) for connection ${connectionId}`
      );

      return {
        merchantLocationKey: data.merchantLocationKey,
        name: data.name,
        locationType: data.locationType,
        address: data.address,
        phone: data.phone || null,
        locationStatus: 'ENABLED',
      };
    } catch (error) {
      this.logger.error(
        `Failed to create inventory location ${data.merchantLocationKey} for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Update an existing inventory location (name, phone).
   */
  async updateLocation(
    connectionId: string,
    merchantLocationKey: string,
    data: {
      name?: string;
      phone?: string;
    }
  ): Promise<void> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Updated inventory location ${merchantLocationKey} for connection ${connectionId}`
      );
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const body: any = {};
      if (data.name !== undefined) {
        body.name = data.name;
      }
      if (data.phone !== undefined) {
        body.phone = data.phone;
      }

      await (client.sell as any).inventory.updateInventoryLocation(
        merchantLocationKey,
        body
      );

      this.logger.log(
        `Updated inventory location ${merchantLocationKey} for connection ${connectionId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to update inventory location ${merchantLocationKey} for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete an inventory location.
   */
  async deleteLocation(connectionId: string, merchantLocationKey: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Deleted inventory location ${merchantLocationKey} for connection ${connectionId}`
      );
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client.sell as any).inventory.deleteInventoryLocation(
        merchantLocationKey
      );

      this.logger.log(
        `Deleted inventory location ${merchantLocationKey} for connection ${connectionId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete inventory location ${merchantLocationKey} for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Enable a disabled inventory location.
   */
  async enableLocation(connectionId: string, merchantLocationKey: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Enabled inventory location ${merchantLocationKey} for connection ${connectionId}`
      );
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client.sell as any).inventory.enableInventoryLocation(
        merchantLocationKey
      );

      this.logger.log(
        `Enabled inventory location ${merchantLocationKey} for connection ${connectionId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to enable inventory location ${merchantLocationKey} for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Disable an inventory location.
   */
  async disableLocation(connectionId: string, merchantLocationKey: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Disabled inventory location ${merchantLocationKey} for connection ${connectionId}`
      );
      return;
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client.sell as any).inventory.disableInventoryLocation(
        merchantLocationKey
      );

      this.logger.log(
        `Disabled inventory location ${merchantLocationKey} for connection ${connectionId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to disable inventory location ${merchantLocationKey} for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }
}
