/**
 * Marketplace Service Interface
 * Abstraction layer so the unified controllers are decoupled from eBay-specific services.
 * When adding a new marketplace (Amazon, Etsy, etc.), implement this interface
 * and register it with the MarketplaceServiceFactory.
 */

export interface IMarketplaceListingsService {
  createDirectListing(dto: any): Promise<any>;
  getListings(params: {
    connectionId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any>;
  getListing(id: string): Promise<any>;
  updateListing(id: string, dto: any): Promise<any>;
  approveListing(id: string, userId?: string): Promise<any>;
  rejectListing(id: string, userId?: string, reason?: string): Promise<any>;
  publishListing(id: string): Promise<any>;
  scheduleListing(id: string, scheduledDate: string): Promise<any>;
  syncListingInventory(id: string): Promise<void>;
  endListing(id: string): Promise<void>;
  deleteListing(id: string): Promise<void>;
}

export interface IMarketplaceConnectionsService {
  createConnection(params: {
    name: string;
    description?: string;
    marketplaceId?: string;
    isDefault?: boolean;
  }): Promise<any>;
  getConnections(): Promise<any>;
  getConnection(id: string): Promise<any>;
  getConnectionStatus(id: string): Promise<any>;
  disconnectConnection(id: string): Promise<void>;
  deleteConnection(id: string): Promise<void>;
  getVacationMode(id: string): Promise<any>;
  setVacationMode(id: string, enabled: boolean, returnMessage?: string): Promise<any>;
}

export const MARKETPLACE_LISTINGS_SERVICE = 'MARKETPLACE_LISTINGS_SERVICE';
export const MARKETPLACE_CONNECTIONS_SERVICE = 'MARKETPLACE_CONNECTIONS_SERVICE';
