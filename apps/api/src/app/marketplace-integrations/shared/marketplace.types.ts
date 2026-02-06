/**
 * Common types for marketplace integrations
 */

export enum MarketplacePlatform {
  EBAY = 'EBAY',
  AMAZON = 'AMAZON',
  ETSY = 'ETSY',
  SHOPIFY = 'SHOPIFY',
}

export enum ListingStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  ENDED = 'ended',
  ERROR = 'error',
}

export enum SyncStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  ERROR = 'error',
}

export enum SyncType {
  INVENTORY_SYNC = 'inventory_sync',
  ORDER_SYNC = 'order_sync',
  LISTING_SYNC = 'listing_sync',
}

export enum SyncDirection {
  TO_MARKETPLACE = 'to_marketplace',
  FROM_MARKETPLACE = 'from_marketplace',
  BIDIRECTIONAL = 'bidirectional',
}

export enum SyncLogStatus {
  SUCCESS = 'success',
  PARTIAL = 'partial',
  FAILED = 'failed',
}

export interface MarketplaceConnectionConfig {
  appId: string;
  certId: string;
  devId?: string;
  ruName: string;
  refreshToken?: string;
  siteId: number;
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  locationKey?: string;
}

export interface EbayTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface EbayBusinessPolicies {
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
}
