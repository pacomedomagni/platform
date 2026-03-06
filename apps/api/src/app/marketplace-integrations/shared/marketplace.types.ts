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

export enum ReturnStatus {
  RETURN_REQUESTED = 'RETURN_REQUESTED',
  RETURN_ACCEPTED = 'RETURN_ACCEPTED',
  RETURN_DECLINED = 'RETURN_DECLINED',
  ITEM_SHIPPED = 'ITEM_SHIPPED',
  ITEM_RECEIVED = 'ITEM_RECEIVED',
  REFUND_ISSUED = 'REFUND_ISSUED',
  CLOSED = 'CLOSED',
}

export enum MessageThreadStatus {
  OPEN = 'OPEN',
  RESPONDED = 'RESPONDED',
  CLOSED = 'CLOSED',
}

export enum MessageSender {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
}

export enum ListingFormat {
  FIXED_PRICE = 'FIXED_PRICE',
  AUCTION = 'AUCTION',
}

export enum CampaignStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
}

export enum MarketplacePermission {
  MARKETPLACE_VIEW = 'marketplace.view',
  CONNECTIONS_MANAGE = 'marketplace.connections.manage',
  LISTINGS_CREATE = 'marketplace.listings.create',
  LISTINGS_APPROVE = 'marketplace.listings.approve',
  LISTINGS_PUBLISH = 'marketplace.listings.publish',
  RETURNS_MANAGE = 'marketplace.returns.manage',
  MESSAGES_MANAGE = 'marketplace.messages.manage',
  CAMPAIGNS_MANAGE = 'marketplace.campaigns.manage',
  FINANCES_VIEW = 'marketplace.finances.view',
  SETTINGS_MANAGE = 'marketplace.settings.manage',
}

/** @deprecated Use the Prisma MarketplaceConnection model directly. Kept for reference. */
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
