/**
 * eBay API Type Definitions
 *
 * Practical interfaces for eBay REST (Sell APIs) and SOAP (Trading API)
 * data shapes used throughout the eBay integration services.
 *
 * These types are intentionally permissive (generous use of optional fields)
 * because eBay API responses vary by context, marketplace, and account state.
 */

// ============================================================================
// Money & Common
// ============================================================================

/** eBay money/amount representation used across all APIs */
export interface EbayAmount {
  value: string;
  currency?: string;
}

/** Trading API money representation (SOAP style) */
export interface EbayTradingAmount {
  _value?: number | string;
  Value?: number | string;
  _attrs?: { currencyID?: string };
  CurrencyID?: string;
}

// ============================================================================
// Paginated Response
// ============================================================================

/** Generic paginated response wrapper for eBay REST APIs */
export interface EbayPaginatedResponse<T> {
  total?: number;
  size?: number;
  limit?: number;
  offset?: number;
  href?: string;
  next?: string;
  prev?: string;
  [key: string]: T[] | number | string | undefined;
}

// ============================================================================
// Orders & Fulfillment
// ============================================================================

export interface EbayOrderBuyer {
  username?: string;
  buyerRegistrationAddress?: {
    email?: string;
    fullName?: string;
  };
}

export interface EbayContactAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface EbayShippingStep {
  shipTo?: {
    fullName?: string;
    contactAddress?: EbayContactAddress;
  };
  shippingCarrierCode?: string;
  shippingServiceCode?: string;
}

export interface EbayFulfillmentStartInstruction {
  shippingStep?: EbayShippingStep;
  fulfillmentInstructionsType?: string;
}

export interface EbayPaymentSummary {
  payments?: Array<{
    paymentDate?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    amount?: EbayAmount;
  }>;
  totalDueSeller?: EbayAmount;
}

export interface EbayPricingSummary {
  priceSubtotal?: EbayAmount;
  deliveryCost?: EbayAmount;
  tax?: EbayAmount;
  total?: EbayAmount;
  priceDiscount?: EbayAmount;
  adjustment?: EbayAmount;
}

/** Shape of a line item within an eBay order (Fulfillment API) */
export interface EbayLineItem {
  lineItemId?: string;
  title?: string;
  sku?: string;
  quantity?: number;
  lineItemCost?: EbayAmount;
  legacyItemId?: string;
  legacyVariationId?: string;
  itemLocation?: EbayContactAddress;
  deliveryCost?: EbayAmount;
  total?: EbayAmount;
  tax?: Array<{
    amount?: EbayAmount;
    taxType?: string;
  }>;
  properties?: {
    buyerProtection?: boolean;
  };
}

/** Shape of an eBay order from the Fulfillment API */
export interface EbayOrder {
  orderId?: string;
  creationDate?: string;
  lastModifiedDate?: string;
  orderFulfillmentStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'FULFILLED' | string;
  orderPaymentStatus?: 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED' | string;
  buyer?: EbayOrderBuyer;
  pricingSummary?: EbayPricingSummary;
  paymentSummary?: EbayPaymentSummary;
  fulfillmentStartInstructions?: EbayFulfillmentStartInstruction[];
  lineItems?: EbayLineItem[];
  cancelStatus?: {
    cancelState?: string;
    cancelRequests?: Array<{
      cancelReason?: string;
      cancelRequestDate?: string;
    }>;
  };
  salesRecordReference?: string;
  totalFeeBasisAmount?: EbayAmount;
  totalMarketplaceFee?: EbayAmount;
}

/** Shape for shipping fulfillment data (creating a shipment on an order) */
export interface EbayFulfillment {
  fulfillmentId?: string;
  lineItems?: Array<{
    lineItemId: string;
    quantity: number;
  }>;
  shippingCarrierCode?: string;
  trackingNumber?: string;
  shippedDate?: string;
}

/** Response from getOrders endpoint */
export interface EbayGetOrdersResponse {
  orders?: EbayOrder[];
  total?: number;
  limit?: number;
  offset?: number;
  href?: string;
  next?: string;
}

/** Response from issueRefund endpoint */
export interface EbayRefundResponse {
  refundId?: string;
  refundStatus?: string;
}

// ============================================================================
// Inventory
// ============================================================================

export interface EbayProductDetails {
  title: string;
  description: string;
  imageUrls: string[];
  aspects?: Record<string, string[]>;
  brand?: string;
  mpn?: string;
  upc?: string[];
  ean?: string[];
  isbn?: string[];
  epid?: string;
  subtitle?: string;
}

export interface EbayAvailability {
  shipToLocationAvailability?: {
    quantity: number;
  };
}

export interface EbayPackageWeightAndSize {
  packageType?: string;
  dimensions?: {
    height?: number;
    length?: number;
    width?: number;
    unit?: string;
  };
  weight?: {
    value?: number;
    unit?: string;
  };
}

/** Shape for inventory items (Inventory API) */
export interface EbayInventoryItem {
  sku?: string;
  locale?: string;
  product?: EbayProductDetails;
  condition?: string;
  conditionDescription?: string;
  availability?: EbayAvailability;
  packageWeightAndSize?: EbayPackageWeightAndSize;
  [key: string]: unknown;
}

/** Response from getInventoryItems endpoint */
export interface EbayGetInventoryItemsResponse {
  inventoryItems?: EbayInventoryItem[];
  total?: number;
  size?: number;
  limit?: number;
  offset?: number;
  href?: string;
  next?: string;
}

/** Inventory item group for multi-variation listings */
export interface EbayInventoryItemGroup {
  inventoryItemGroupKey?: string;
  title?: string;
  description?: string;
  imageUrls?: string[];
  aspects?: Record<string, string[]>;
  variantSKUs?: string[];
  variesBy?: {
    aspectsImageVariesBy?: string[];
    specifications?: Array<{ name: string; values: string[] }>;
  };
}

// ============================================================================
// Offers
// ============================================================================

export interface EbayBestOfferTerms {
  bestOfferEnabled?: boolean;
  autoAcceptPrice?: EbayAmount;
  autoDeclinePrice?: EbayAmount;
}

export interface EbayListingPolicies {
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  bestOfferTerms?: EbayBestOfferTerms;
}

export interface EbayOfferPricingSummary {
  price?: EbayAmount;
  auctionStartPrice?: EbayAmount;
  auctionReservePrice?: EbayAmount;
}

/** Shape for offers (Inventory API offers) */
export interface EbayOffer {
  offerId?: string;
  sku?: string;
  marketplaceId?: string;
  format?: string;
  availableQuantity?: number;
  categoryId?: string;
  secondaryCategoryId?: string;
  listingDescription?: string;
  listingDuration?: string;
  listingPolicies?: EbayListingPolicies;
  pricingSummary?: EbayOfferPricingSummary;
  merchantLocationKey?: string;
  includeCatalogProductDetails?: boolean;
  hideBuyerDetails?: boolean;
  lotSize?: number;
  listingStartDate?: string;
  status?: string;
  listing?: {
    listingId?: string;
  };
}

/** Response from getOffers endpoint */
export interface EbayGetOffersResponse {
  offers?: EbayOffer[];
  total?: number;
  size?: number;
  limit?: number;
  offset?: number;
  href?: string;
  next?: string;
}

/** Response from createOffer endpoint */
export interface EbayCreateOfferResponse {
  offerId: string;
}

/** Response from publishOffer endpoint */
export interface EbayPublishOfferResponse {
  listingId?: string;
}

/** Response from publishOfferByInventoryItemGroup endpoint */
export interface EbayPublishGroupResponse {
  listingId?: string;
  offers?: Array<{
    offerId?: string;
    sku?: string;
  }>;
}

// ============================================================================
// Account Policies
// ============================================================================

export interface EbayFulfillmentPolicy {
  fulfillmentPolicyId?: string;
  name?: string;
  marketplaceId?: string;
  description?: string;
  handlingTime?: {
    value?: number;
    unit?: string;
  };
  shippingOptions?: Array<{
    costType?: string;
    optionType?: string;
    shippingServices?: Array<{
      shippingCarrierCode?: string;
      shippingServiceCode?: string;
      shippingCost?: EbayAmount;
      additionalShippingCost?: EbayAmount;
    }>;
  }>;
}

export interface EbayPaymentPolicy {
  paymentPolicyId?: string;
  name?: string;
  marketplaceId?: string;
  description?: string;
  immediatePay?: boolean;
}

export interface EbayReturnPolicy {
  returnPolicyId?: string;
  name?: string;
  marketplaceId?: string;
  description?: string;
  returnsAccepted?: boolean;
  returnPeriod?: {
    value?: number;
    unit?: string;
  };
  returnShippingCostPayer?: string;
}

export interface EbayInventoryLocation {
  merchantLocationKey?: string;
  name?: string;
  merchantLocationStatus?: string;
  location?: {
    address?: EbayContactAddress;
  };
}

// ============================================================================
// Trading API: Feedback
// ============================================================================

/** Shape for feedback entries from Trading API GetFeedback */
export interface EbayFeedbackEntry {
  FeedbackID?: string;
  CommentText?: string;
  CommentTime?: string;
  CommentType?: 'Positive' | 'Negative' | 'Neutral' | 'Withdrawn' | string;
  FeedbackRatingStar?: string;
  ItemID?: string;
  ItemTitle?: string;
  ItemPrice?: EbayTradingAmount;
  Role?: 'Buyer' | 'Seller' | string;
  FeedbackScore?: number;
  CommentingUser?: string;
  CommentingUserScore?: number;
  TransactionID?: string;
  OrderLineItemID?: string;
  ResponseReply?: string;
  FollowUp?: string;
}

/** Response from Trading API GetFeedback */
export interface EbayGetFeedbackResponse {
  FeedbackDetailArray?: {
    FeedbackDetail?: EbayFeedbackEntry[];
  };
  FeedbackDetailItemTotal?: number;
  FeedbackScore?: number;
  UniqueNegativeFeedbackCount?: number;
  UniqueNeutralFeedbackCount?: number;
  UniquePositiveFeedbackCount?: number;
  Ack?: string;
}

// ============================================================================
// Trading API: Messages
// ============================================================================

/** Shape for messages from Trading API GetMyMessages */
export interface EbayMessage {
  MessageID?: string;
  ExternalMessageID?: string;
  Sender?: string;
  RecipientUserID?: string;
  Subject?: string;
  Text?: string;
  Body?: string;
  ItemID?: string;
  ItemTitle?: string;
  ReceiveDate?: string;
  CreationDate?: string;
  MessageType?: 'AskSellerQuestion' | 'ResponseToASQQuestion' | string;
  Flagged?: boolean;
  Read?: boolean;
  Folder?: {
    FolderID?: number;
    FolderName?: string;
  };
  ResponseDetails?: {
    ResponseEnabled?: boolean;
    ResponseURL?: string;
  };
}

/** Response from Trading API GetMyMessages */
export interface EbayGetMyMessagesResponse {
  Messages?: {
    Message?: EbayMessage | EbayMessage[];
  };
  Ack?: string;
}

// ============================================================================
// Trading API: Best Offers
// ============================================================================

/** Shape for best offer responses from Trading API GetBestOffers */
export interface EbayBestOffer {
  BestOfferID?: string;
  Buyer?: {
    UserID?: string;
    Email?: string;
    FeedbackScore?: number;
  };
  Price?: EbayTradingAmount;
  Quantity?: number;
  BestOfferStatus?: 'Active' | 'Accepted' | 'Declined' | 'Expired' | 'Countered' | string;
  BuyerMessage?: string;
  CreationDate?: string;
  ExpirationDate?: string;
  CallStatus?: string;
}

/** Response from Trading API GetBestOffers */
export interface EbayGetBestOffersResponse {
  BestOfferArray?: {
    BestOffer?: EbayBestOffer[];
  };
  Item?: {
    ItemID?: string;
    BestOfferCount?: number;
  };
  Ack?: string;
}

// ============================================================================
// Trading API: Generic Response
// ============================================================================

/** Generic eBay Trading API (SOAP) response shape */
export interface EbayTradingResponse {
  Ack?: 'Success' | 'Warning' | 'Failure' | string;
  Errors?: Array<{
    ShortMessage?: string;
    LongMessage?: string;
    ErrorCode?: string;
    SeverityCode?: string;
    ErrorClassification?: string;
  }>;
  Timestamp?: string;
  Version?: string;
  Build?: string;
  [key: string]: unknown;
}

// ============================================================================
// Trading API: User Preferences
// ============================================================================

export interface EbayGetUserPreferencesResponse extends EbayTradingResponse {
  OutOfStockControlPreference?: boolean | string;
}

// ============================================================================
// eBay API Client Sub-API Shapes
// ============================================================================

/**
 * Sell Account API methods used via client.sell.account.
 * These are the typed subset of methods we actually call.
 */
export interface EbaySellAccountApi {
  getFulfillmentPolicies(marketplaceId: unknown): Promise<{ fulfillmentPolicies?: EbayFulfillmentPolicy[] }>;
  getReturnPolicies(marketplaceId: unknown): Promise<{ returnPolicies?: EbayReturnPolicy[] }>;
  getPaymentPolicies(marketplaceId: unknown): Promise<{ paymentPolicies?: EbayPaymentPolicy[] }>;
}

/**
 * Sell Fulfillment API methods used via client.sell.fulfillment.
 * These are the typed subset of methods we actually call.
 */
export interface EbaySellFulfillmentApi {
  getOrders(params: { filter?: string; limit?: number; offset?: number }): Promise<EbayGetOrdersResponse>;
  getOrder(orderId: string): Promise<EbayOrder>;
  createShippingFulfillment(orderId: string, data: unknown): Promise<EbayFulfillment>;
  issueRefund(orderId: string, data: unknown): Promise<EbayRefundResponse>;
}

/**
 * Sell Inventory API methods used via client.sell.inventory.
 * These are the typed subset of methods we actually call.
 */
export interface EbaySellInventoryApi {
  createOrReplaceInventoryItem(sku: string, data: unknown): Promise<unknown>;
  getInventoryItem(sku: string): Promise<EbayInventoryItem>;
  deleteInventoryItem(sku: string): Promise<void>;
  getInventoryItems(params?: { limit?: number; offset?: number; sku?: string }): Promise<EbayGetInventoryItemsResponse>;
  createOffer(data: unknown): Promise<EbayCreateOfferResponse>;
  publishOffer(offerId: string): Promise<EbayPublishOfferResponse>;
  withdrawOffer(offerId: string): Promise<void>;
  getOffers(params: { sku?: string; format?: string; limit?: number; offset?: number }): Promise<EbayGetOffersResponse>;
  updateOffer(offerId: string, data: unknown): Promise<unknown>;
  createOrReplaceInventoryItemGroup(groupKey: string, data: unknown): Promise<unknown>;
  getInventoryItemGroup(groupKey: string): Promise<EbayInventoryItemGroup>;
  deleteInventoryItemGroup(groupKey: string): Promise<void>;
  publishOfferByInventoryItemGroup(data: unknown): Promise<EbayPublishGroupResponse>;
  getInventoryLocations(): Promise<{ locations?: EbayInventoryLocation[] }>;
}

/**
 * Trading API methods used via client.trading.
 * These correspond to eBay SOAP/Trading API calls.
 */
export interface EbayTradingApi {
  GetMyMessages(params: Record<string, unknown>): Promise<EbayGetMyMessagesResponse>;
  AddMemberMessageAAQToPartner(params: Record<string, unknown>): Promise<EbayTradingResponse>;
  GetBestOffers(params: Record<string, unknown>): Promise<EbayGetBestOffersResponse>;
  RespondToBestOffer(params: Record<string, unknown>): Promise<EbayTradingResponse>;
  GetFeedback(params: Record<string, unknown>): Promise<EbayGetFeedbackResponse>;
  LeaveFeedback(params: Record<string, unknown>): Promise<EbayTradingResponse>;
  RespondToFeedback(params: Record<string, unknown>): Promise<EbayTradingResponse>;
  SetUserPreferences(params: Record<string, unknown>): Promise<EbayTradingResponse>;
  GetUserPreferences(params: Record<string, unknown>): Promise<EbayGetUserPreferencesResponse>;
}

/**
 * Typed overlay for the eBay API client.
 *
 * The ebay-api SDK's own types are incomplete -- many sub-APIs and methods
 * return `any` or are missing entirely. This interface captures the shape
 * of the methods we actually use so we can progressively remove `as any` casts.
 *
 * Usage:
 *   const client = await this.ebayStore.getClient(connectionId);
 *   const typed = client as unknown as EbayApiClient;
 *   // or use the helper cast when needed in specific call sites.
 */
export interface EbayApiClient {
  sell: {
    account: EbaySellAccountApi;
    fulfillment: EbaySellFulfillmentApi;
    inventory: EbaySellInventoryApi;
    analytics: {
      getTrafficReport(params: Record<string, unknown>): Promise<unknown>;
      findSellerStandardsProfiles(): Promise<unknown>;
      getCustomerServiceMetric(metricType: string, evaluationType: string): Promise<unknown>;
    };
    finances: {
      getPayouts(params: unknown): Promise<unknown>;
      getPayoutSummary(params: unknown): Promise<unknown>;
      getTransactions(params: unknown): Promise<unknown>;
      getTransactionSummary(params: unknown): Promise<unknown>;
      getSellerFundsSummary(): Promise<unknown>;
    };
    recommendation: {
      findListingRecommendations(body: unknown): Promise<unknown>;
    };
  };
  trading: EbayTradingApi;
  /** Raw access token (not always present) */
  authToken?: string;
  auth?: {
    oAuth2?: {
      accessToken?: string;
    };
  };
  /** Post-Order API helper (not in official types) */
  post?(path: string, options: { body: unknown }): Promise<unknown>;
}

// ============================================================================
// Extracted line item (local shape used after mapping eBay order data)
// ============================================================================

/** Locally mapped line item stored in MarketplaceOrder.itemsData */
export interface MappedOrderLineItem {
  lineItemId?: string;
  title?: string;
  sku?: string | null;
  quantity?: number;
  unitPrice?: string;
  currency?: string;
  legacyItemId?: string | null;
  legacyVariationId?: string | null;
  transactionId?: string | null;
}
