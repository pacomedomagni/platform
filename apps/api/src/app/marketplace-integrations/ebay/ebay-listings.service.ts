import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { EbayClientService } from './ebay-client.service';
import { EbayMediaService } from './ebay-media.service';
import { EbayTaxonomyService } from './ebay-taxonomy.service';
import { EbayPolicyService } from './ebay-policy.service';
import { MarketplaceAuditService } from '../shared/marketplace-audit.service';
import { ListingStatus, SyncStatus } from '../shared/marketplace.types';
import { FailedOperationsService } from '../../workers/failed-operations.service';
import { OperationType, Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

/**
 * eBay Listings Management Service
 * Handles creating, publishing, and syncing eBay listings
 */
@Injectable()
export class EbayListingsService {
  private readonly logger = new Logger(EbayListingsService.name);
  private readonly mockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true';

  /**
   * Map marketplace site ID to the appropriate currency code.
   */
  private static readonly MARKETPLACE_CURRENCY_MAP: Record<string, string> = {
    EBAY_US: 'USD',
    EBAY_UK: 'GBP',
    EBAY_GB: 'GBP',
    EBAY_DE: 'EUR',
    EBAY_FR: 'EUR',
    EBAY_IT: 'EUR',
    EBAY_ES: 'EUR',
    EBAY_CA: 'CAD',
    EBAY_AU: 'AUD',
  };

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private ebayClient: EbayClientService,
    private mediaService: EbayMediaService,
    private taxonomyService: EbayTaxonomyService,
    private policyService: EbayPolicyService,
    private audit: MarketplaceAuditService,
    private failedOps: FailedOperationsService,
  ) {}

  /**
   * Schedule a deferred retry for deleting an orphaned eBay inventory
   * item. Use this from rollback paths instead of best-effort logging,
   * because eBay's offer purge is asynchronous: the inline delete
   * frequently fails with "inventory item is referenced by an offer"
   * until eBay finishes tearing down the withdrawn offer.
   */
  private async scheduleInventoryItemDelete(
    tenantId: string,
    connectionId: string,
    sku: string,
    cause: string,
  ): Promise<void> {
    try {
      await this.failedOps.recordFailedOperation({
        tenantId,
        operationType: OperationType.EBAY_INVENTORY_ITEM_DELETE,
        referenceId: sku,
        referenceType: 'ebay_inventory_item',
        payload: { connectionId, sku } as Prisma.JsonValue,
        errorMessage: cause,
      });
    } catch (e) {
      // Don't let retry-enqueue itself cascade. Log and move on; the
      // operator can clean orphans manually if the failed-ops table is
      // unavailable for some reason.
      this.logger.error(
        `Failed to enqueue retry for orphaned eBay inventory item ${sku}`,
        e
      );
    }
  }

  /**
   * Determine the currency for a given eBay marketplace ID.
   */
  private getMarketplaceCurrency(marketplaceId: string): string {
    return EbayListingsService.MARKETPLACE_CURRENCY_MAP[marketplaceId] || 'USD';
  }

  /**
   * Create eBay listing from NoSlag product
   */
  async createListingFromProduct(data: {
    connectionId: string;
    productListingId: string;
    warehouseId?: string;
    overrides?: {
      price?: number;
      quantity?: number;
      condition?: string;
      categoryId?: string;
      title?: string;
      description?: string;
    };
  }) {
    const tenantId = this.cls.get('tenantId');

    // Verify connection
    const connection = await this.ebayStore.getConnection(data.connectionId);

    // Fetch NoSlag product
    const product = await this.prisma.productListing.findFirst({
      where: { id: data.productListingId, tenantId },
      include: {
        item: true,
        category: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Get warehouse stock if specified
    let availableQuantity = data.overrides?.quantity;
    if (data.warehouseId && !availableQuantity) {
      const balance = await this.prisma.warehouseItemBalance.findUnique({
        where: {
          tenantId_itemId_warehouseId: {
            tenantId,
            itemId: product.itemId,
            warehouseId: data.warehouseId,
          },
        },
      });
      availableQuantity = balance
        ? Math.max(0, balance.actualQty.toNumber() - balance.reservedQty.toNumber())
        : 0;
    }

    // SKU is built from productListingId (guaranteed unique) + connectionId,
    // matching the unified createDirectListing path. Using item.code instead
    // would collide between two ProductListings backed by the same Item
    // (e.g. variant A and variant B of the same SKU sold at different prices),
    // tripping the @@unique([connectionId, sku]) constraint.
    const sku = `${data.productListingId}-${connection.id}`;

    // Check if listing already exists
    const existing = await this.prisma.marketplaceListing.findFirst({
      where: {
        connectionId: data.connectionId,
        productListingId: data.productListingId,
      },
    });

    if (existing) {
      throw new BadRequestException('Listing already exists for this product on this store');
    }

    // categoryId is required — eBay rejects offers without a valid leaf
    // category, and silently defaulting to a single hardcoded one ("Cell
    // Phones & Smartphones") routinely landed listings in the wrong
    // marketplace section, triggering buyer complaints and seller
    // violations. Caller must pick a category via EbayTaxonomyService.
    if (!data.overrides?.categoryId) {
      throw new BadRequestException(
        'categoryId is required. Use the eBay taxonomy API to resolve a category for this product before creating the listing.'
      );
    }

    // Create marketplace listing (draft)
    const listing = await this.prisma.marketplaceListing.create({
      data: {
        tenantId,
        connectionId: data.connectionId,
        productListingId: data.productListingId,
        warehouseId: data.warehouseId,
        sku,
        title: data.overrides?.title || product.displayName,
        description: data.overrides?.description || product.longDescription || product.shortDescription || '',
        price: new Decimal(data.overrides?.price || product.price.toNumber()),
        quantity: availableQuantity || 1,
        condition: data.overrides?.condition || 'NEW',
        categoryId: data.overrides.categoryId,
        photos: JSON.stringify(product.images || []),
        platformData: JSON.stringify({
          format: 'FIXED_PRICE',
          listingDuration: 'GTC', // Good 'til cancelled
        }),
        status: ListingStatus.DRAFT,
        syncStatus: SyncStatus.PENDING,
      },
    });

    this.logger.log(`Created eBay listing draft ${listing.id} for product ${product.displayName}`);
    return listing;
  }

  /**
   * Create eBay listing directly (without product reference)
   * Used when listing data is provided directly from the frontend
   */
  async createDirectListing(data: {
    connectionId: string;
    productListingId: string;
    warehouseId?: string;
    title: string;
    subtitle?: string;
    description: string;
    price: number;
    quantity: number;
    condition: string;
    conditionDescription?: string;
    categoryId: string;
    secondaryCategoryId?: string;
    photos?: string[];
    itemSpecifics?: Record<string, string[]>;
    platformData?: Record<string, any>;
    // Listing format
    format?: string;
    listingDuration?: string;
    // Auction fields
    startPrice?: number;
    reservePrice?: number;
    buyItNowPrice?: number;
    // Best Offer
    bestOfferEnabled?: boolean;
    autoAcceptPrice?: number;
    autoDeclinePrice?: number;
    // Additional fields
    privateListing?: boolean;
    lotSize?: number;
    epid?: string;
    // Item location
    itemLocationCity?: string;
    itemLocationState?: string;
    itemLocationPostalCode?: string;
    itemLocationCountry?: string;
    // Package
    packageType?: string;
    weightValue?: number;
    weightUnit?: string;
    dimensionLength?: number;
    dimensionWidth?: number;
    dimensionHeight?: number;
    dimensionUnit?: string;
    // Policies
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
    merchantLocationKey?: string;
    // P0 shipping overrides
    handlingTimeDays?: number;
    shippingCostType?: string;
    shippingServices?: Array<{
      serviceCode: string;
      cost: number;
      additionalCost?: number;
      freeShipping?: boolean;
      priority?: number;
    }>;
  }) {
    const tenantId = this.cls.get('tenantId');

    // Verify connection
    const connection = await this.ebayStore.getConnection(data.connectionId);

    // Generate SKU using full IDs to avoid collision risk
    const sku = `${data.productListingId}-${connection.id}`;

    // Check if listing already exists for this product on this connection
    const existing = await this.prisma.marketplaceListing.findFirst({
      where: {
        connectionId: data.connectionId,
        productListingId: data.productListingId,
      },
    });

    if (existing) {
      throw new BadRequestException('Listing already exists for this product on this store');
    }

    const format = data.format || 'FIXED_PRICE';

    // Create marketplace listing
    const listing = await this.prisma.marketplaceListing.create({
      data: {
        tenantId,
        connectionId: data.connectionId,
        productListingId: data.productListingId,
        warehouseId: data.warehouseId,
        sku,
        title: data.title,
        subtitle: data.subtitle,
        description: data.description,
        price: new Decimal(data.price),
        quantity: data.quantity,
        condition: data.condition,
        conditionDescription: data.conditionDescription,
        categoryId: data.categoryId,
        secondaryCategoryId: data.secondaryCategoryId,
        photos: JSON.stringify(data.photos || []),
        itemSpecifics: data.itemSpecifics ? JSON.stringify(data.itemSpecifics) : null,
        // Format & auction
        format,
        listingDuration: data.listingDuration || (format === 'AUCTION' ? 'DAYS_7' : 'GTC'),
        startPrice: data.startPrice ? new Decimal(data.startPrice) : null,
        reservePrice: data.reservePrice ? new Decimal(data.reservePrice) : null,
        buyItNowPrice: data.buyItNowPrice ? new Decimal(data.buyItNowPrice) : null,
        // Best Offer
        bestOfferEnabled: data.bestOfferEnabled || false,
        autoAcceptPrice: data.autoAcceptPrice ? new Decimal(data.autoAcceptPrice) : null,
        autoDeclinePrice: data.autoDeclinePrice ? new Decimal(data.autoDeclinePrice) : null,
        // Additional
        privateListing: data.privateListing || false,
        lotSize: data.lotSize,
        epid: data.epid,
        // Item location
        itemLocationCity: data.itemLocationCity,
        itemLocationState: data.itemLocationState,
        itemLocationPostalCode: data.itemLocationPostalCode,
        itemLocationCountry: data.itemLocationCountry,
        // Package
        packageType: data.packageType,
        weightValue: data.weightValue ? new Decimal(data.weightValue) : null,
        weightUnit: data.weightUnit,
        dimensionLength: data.dimensionLength ? new Decimal(data.dimensionLength) : null,
        dimensionWidth: data.dimensionWidth ? new Decimal(data.dimensionWidth) : null,
        dimensionHeight: data.dimensionHeight ? new Decimal(data.dimensionHeight) : null,
        dimensionUnit: data.dimensionUnit,
        // Policies
        fulfillmentPolicyId: data.fulfillmentPolicyId,
        paymentPolicyId: data.paymentPolicyId,
        returnPolicyId: data.returnPolicyId,
        // Shipping overrides — applied at publish time via lazy policy clone
        handlingTimeDays: data.handlingTimeDays,
        shippingCostType: data.shippingCostType,
        shippingServices: data.shippingServices ? (data.shippingServices as any) : undefined,
        platformData: JSON.stringify({
          ...(data.platformData || {}),
          merchantLocationKey: data.merchantLocationKey,
        }),
        status: ListingStatus.DRAFT,
        syncStatus: SyncStatus.PENDING,
      },
    });

    this.logger.log(`Created direct eBay listing ${listing.id}: ${listing.title}`);
    return listing;
  }

  /**
   * Get listings for current tenant
   */
  async getListings(filters?: {
    connectionId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const tenantId = this.cls.get('tenantId');

    const where: Prisma.MarketplaceListingWhereInput = { tenantId };
    if (filters?.connectionId) where.connectionId = filters.connectionId;
    if (filters?.status) where.status = filters.status;

    const listings = await this.prisma.marketplaceListing.findMany({
      where,
      include: {
        productListing: {
          include: { item: true },
        },
        connection: true,
        warehouse: true,
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });

    return listings;
  }

  /**
   * Get single listing by ID
   */
  async getListing(listingId: string) {
    const tenantId = this.cls.get('tenantId');
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: { id: listingId, tenantId },
      include: {
        productListing: {
          include: { item: true },
        },
        connection: true,
        warehouse: true,
        approvedBy: true,
        rejectedBy: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  /**
   * Update listing
   */
  async updateListing(listingId: string, data: {
    title?: string;
    subtitle?: string;
    description?: string;
    price?: number;
    quantity?: number;
    condition?: string;
    conditionDescription?: string;
    categoryId?: string;
    secondaryCategoryId?: string;
    photos?: string[];
    itemSpecifics?: Record<string, string[]>;
    platformData?: any;
    // Format & auction
    format?: string;
    listingDuration?: string;
    startPrice?: number;
    reservePrice?: number;
    buyItNowPrice?: number;
    // Best Offer
    bestOfferEnabled?: boolean;
    autoAcceptPrice?: number;
    autoDeclinePrice?: number;
    // Additional
    privateListing?: boolean;
    lotSize?: number;
    epid?: string;
    // Item location
    itemLocationCity?: string;
    itemLocationState?: string;
    itemLocationPostalCode?: string;
    itemLocationCountry?: string;
    // Package
    packageType?: string;
    weightValue?: number;
    weightUnit?: string;
    dimensionLength?: number;
    dimensionWidth?: number;
    dimensionHeight?: number;
    dimensionUnit?: string;
    // Policies
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
    // P0 shipping overrides
    handlingTimeDays?: number;
    shippingCostType?: string;
    shippingServices?: Array<{
      serviceCode: string;
      cost: number;
      additionalCost?: number;
      freeShipping?: boolean;
      priority?: number;
    }>;
  }) {
    const listing = await this.getListing(listingId);

    if ([ListingStatus.PUBLISHED, ListingStatus.ENDED].includes(listing.status as any)) {
      throw new BadRequestException('Cannot edit published or ended listings');
    }

    const updated = await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.subtitle !== undefined && { subtitle: data.subtitle || null }),
        ...(data.description && { description: data.description }),
        ...(data.price && { price: new Decimal(data.price) }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.condition && { condition: data.condition }),
        ...(data.conditionDescription !== undefined && { conditionDescription: data.conditionDescription || null }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.secondaryCategoryId !== undefined && { secondaryCategoryId: data.secondaryCategoryId || null }),
        ...(data.photos && { photos: JSON.stringify(data.photos) }),
        ...(data.itemSpecifics && { itemSpecifics: data.itemSpecifics as any }),
        // Format & auction
        ...(data.format && { format: data.format }),
        ...(data.listingDuration && { listingDuration: data.listingDuration }),
        ...(data.startPrice !== undefined && { startPrice: data.startPrice ? new Decimal(data.startPrice) : null }),
        ...(data.reservePrice !== undefined && { reservePrice: data.reservePrice ? new Decimal(data.reservePrice) : null }),
        ...(data.buyItNowPrice !== undefined && { buyItNowPrice: data.buyItNowPrice ? new Decimal(data.buyItNowPrice) : null }),
        // Best Offer
        ...(data.bestOfferEnabled !== undefined && { bestOfferEnabled: data.bestOfferEnabled }),
        ...(data.autoAcceptPrice !== undefined && { autoAcceptPrice: data.autoAcceptPrice ? new Decimal(data.autoAcceptPrice) : null }),
        ...(data.autoDeclinePrice !== undefined && { autoDeclinePrice: data.autoDeclinePrice ? new Decimal(data.autoDeclinePrice) : null }),
        // Additional
        ...(data.privateListing !== undefined && { privateListing: data.privateListing }),
        ...(data.lotSize !== undefined && { lotSize: data.lotSize || null }),
        ...(data.epid !== undefined && { epid: data.epid || null }),
        // Item location
        ...(data.itemLocationCity !== undefined && { itemLocationCity: data.itemLocationCity || null }),
        ...(data.itemLocationState !== undefined && { itemLocationState: data.itemLocationState || null }),
        ...(data.itemLocationPostalCode !== undefined && { itemLocationPostalCode: data.itemLocationPostalCode || null }),
        ...(data.itemLocationCountry !== undefined && { itemLocationCountry: data.itemLocationCountry || null }),
        // Package
        ...(data.packageType !== undefined && { packageType: data.packageType || null }),
        ...(data.weightValue !== undefined && { weightValue: data.weightValue ? new Decimal(data.weightValue) : null }),
        ...(data.weightUnit !== undefined && { weightUnit: data.weightUnit || null }),
        ...(data.dimensionLength !== undefined && { dimensionLength: data.dimensionLength ? new Decimal(data.dimensionLength) : null }),
        ...(data.dimensionWidth !== undefined && { dimensionWidth: data.dimensionWidth ? new Decimal(data.dimensionWidth) : null }),
        ...(data.dimensionHeight !== undefined && { dimensionHeight: data.dimensionHeight ? new Decimal(data.dimensionHeight) : null }),
        ...(data.dimensionUnit !== undefined && { dimensionUnit: data.dimensionUnit || null }),
        // Policies
        ...(data.fulfillmentPolicyId !== undefined && { fulfillmentPolicyId: data.fulfillmentPolicyId || null }),
        ...(data.paymentPolicyId !== undefined && { paymentPolicyId: data.paymentPolicyId || null }),
        ...(data.returnPolicyId !== undefined && { returnPolicyId: data.returnPolicyId || null }),
        // Shipping overrides
        ...(data.handlingTimeDays !== undefined && { handlingTimeDays: data.handlingTimeDays ?? null }),
        ...(data.shippingCostType !== undefined && { shippingCostType: data.shippingCostType || null }),
        ...(data.shippingServices !== undefined && { shippingServices: data.shippingServices as any }),
        ...(data.platformData && {
          platformData: JSON.stringify({
            ...JSON.parse(listing.platformData as string),
            ...data.platformData,
          }),
        }),
      },
    });

    this.logger.log(`Updated listing ${listingId}`);
    return updated;
  }

  /**
   * Approve listing
   */
  async approveListing(listingId: string, userId: string) {
    const listing = await this.getListing(listingId);

    if (listing.status !== ListingStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only pending listings can be approved');
    }

    const updated = await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.APPROVED,
        approvedById: userId,
        approvedAt: new Date(),
      },
    });

    this.logger.log(`Approved listing ${listingId}`);
    return updated;
  }

  /**
   * Reject listing
   */
  async rejectListing(listingId: string, userId: string, reason: string) {
    const listing = await this.getListing(listingId);

    if (listing.status !== ListingStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only pending listings can be rejected');
    }

    const updated = await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.DRAFT,
        rejectedById: userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    this.logger.log(`Rejected listing ${listingId}: ${reason}`);
    return updated;
  }

  /**
   * Publish listing to eBay.
   *
   * Two-person rule: only Admin / System Manager can publish a DRAFT
   * directly. Inventory Managers must wait for an approver to move the
   * listing to APPROVED first. The role check lives here, not in the
   * controller, so the rule holds regardless of caller path.
   */
  async publishListing(
    listingId: string,
    options: { userRoles?: string[] } = {}
  ) {
    const listing = await this.getListing(listingId);

    const normalizedRoles = (options.userRoles ?? []).map((r) => r.toLowerCase());
    const isPrivileged =
      normalizedRoles.includes('admin') ||
      normalizedRoles.includes('system manager');

    const allowedStatuses = isPrivileged
      ? [ListingStatus.DRAFT, ListingStatus.APPROVED]
      : [ListingStatus.APPROVED];

    if (!allowedStatuses.includes(listing.status as any)) {
      throw new BadRequestException(
        isPrivileged
          ? 'Only draft or approved listings can be published'
          : 'Only approved listings can be published. Ask an admin to approve this listing first.'
      );
    }

    // Optimistic lock: atomically claim the listing for publishing.
    // If another request already moved the status away from DRAFT/APPROVED, count will be 0.
    const lockResult = await this.prisma.marketplaceListing.updateMany({
      where: {
        id: listingId,
        status: { in: [ListingStatus.DRAFT, ListingStatus.APPROVED] },
      },
      data: { status: ListingStatus.PUBLISHING },
    });

    if (lockResult.count === 0) {
      throw new ConflictException('Listing is already being published or has been moved to another status');
    }

    // Verify connection is ready
    const isReady = await this.ebayStore.isConnectionReady(listing.connectionId);
    if (!isReady) {
      // Revert status since we already changed it
      await this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: { status: listing.status },
      });
      throw new BadRequestException('eBay connection is not fully configured. Please complete OAuth and fetch business policies.');
    }

    // C4: Validate merchantLocationKey before publishing
    const connection = listing.connection;
    if (!connection.locationKey) {
      await this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: { status: listing.status },
      });
      throw new BadRequestException(
        'No inventory location configured. Please create an inventory location via Settings before publishing.'
      );
    }

    let inventoryItemCreated = false;
    let offerCreated = false;
    let offerId: string | undefined;
    let client: any;

    try {
      // Get eBay client
      client = await this.ebayStore.getClient(listing.connectionId);
      const photos = JSON.parse(listing.photos as string) as string[];

      // C1: Upload images to eBay Picture Services (EPS) before creating inventory item.
      // Downloads each image from MinIO storage, uploads binary to eBay EPS.
      // eBay requires EPS-hosted URLs for full listing features (zoom, 24 images, etc).
      const epsImageUrls = await this.ebayClient.uploadImagesToEps(
        listing.connectionId, photos.slice(0, 24), this.mediaService
      );

      // Parse platformData for product identifiers and other stored fields
      const platformData = listing.platformData
        ? JSON.parse(listing.platformData as string)
        : {};

      // M8: Validate item specifics/aspects against eBay taxonomy if available
      if (listing.itemSpecifics && listing.categoryId) {
        try {
          const aspects = await this.taxonomyService.getItemAspectsForCategory(
            listing.connectionId, connection.marketplaceId || 'EBAY_US', listing.categoryId
          );
          const requiredAspects = aspects
            .filter((a: any) => a.aspectConstraint?.aspectRequired)
            .map((a: any) => a.localizedAspectName);
          const providedAspects = Object.keys(listing.itemSpecifics as any);
          const missing = requiredAspects.filter((a: string) => !providedAspects.includes(a));
          if (missing.length > 0) {
            this.logger.warn(`Listing ${listingId} missing required aspects: ${missing.join(', ')}`);
          }
        } catch {
          // Non-blocking: if taxonomy lookup fails, proceed anyway
        }
      }

      // Step 1: Create inventory item
      const productPayload: any = {
        title: listing.title,
        description: listing.description,
        imageUrls: epsImageUrls, // Use EPS-hosted URLs instead of raw S3 URLs
        aspects: listing.itemSpecifics ? (listing.itemSpecifics as any) : undefined,
      };

      // Wire product identifiers from platformData
      if (platformData.brand) productPayload.brand = platformData.brand;
      if (platformData.mpn) productPayload.mpn = platformData.mpn;
      if (platformData.upc) productPayload.upc = Array.isArray(platformData.upc) ? platformData.upc : [platformData.upc];
      if (platformData.ean) productPayload.ean = Array.isArray(platformData.ean) ? platformData.ean : [platformData.ean];
      if (platformData.isbn) productPayload.isbn = Array.isArray(platformData.isbn) ? platformData.isbn : [platformData.isbn];
      if (listing.epid) productPayload.epid = listing.epid;
      if (listing.subtitle) productPayload.subtitle = listing.subtitle;

      // L4: Include video IDs if present (uploaded via Media API)
      if (platformData.videoIds && Array.isArray(platformData.videoIds) && platformData.videoIds.length > 0) {
        productPayload.videoIds = platformData.videoIds;
      }

      const inventoryItem = await this.ebayClient.createOrReplaceInventoryItem(client, listing.sku, {
        product: productPayload,
        condition: listing.condition,
        conditionDescription: listing.conditionDescription || undefined,
        availability: {
          shipToLocationAvailability: {
            quantity: listing.quantity,
          },
        },
        ...(listing.weightValue || listing.packageType ? {
          packageWeightAndSize: {
            ...(listing.packageType && { packageType: listing.packageType }),
            ...(listing.weightValue && {
              weight: {
                value: listing.weightValue.toNumber(),
                unit: listing.weightUnit || 'POUND',
              },
            }),
            ...(listing.dimensionLength && {
              dimensions: {
                length: listing.dimensionLength.toNumber(),
                width: listing.dimensionWidth?.toNumber(),
                height: listing.dimensionHeight?.toNumber(),
                unit: listing.dimensionUnit || 'INCH',
              },
            }),
          },
        } : {}),
      });
      inventoryItemCreated = true;

      // Step 2: Create offer
      const marketplaceId = connection.marketplaceId || 'EBAY_US';
      const currency = this.getMarketplaceCurrency(marketplaceId);
      const format = listing.format || 'FIXED_PRICE';

      // Build pricing summary
      const pricingSummary: any = {};
      if (format === 'AUCTION') {
        // For auctions: auctionStartPrice = starting bid (required),
        // price = Buy It Now price (optional), auctionReservePrice = reserve (optional)
        if (listing.startPrice) {
          pricingSummary.auctionStartPrice = { value: listing.startPrice.toString(), currency };
        }
        if (listing.reservePrice) {
          pricingSummary.auctionReservePrice = { value: listing.reservePrice.toString(), currency };
        }
        if (listing.buyItNowPrice) {
          pricingSummary.price = { value: listing.buyItNowPrice.toString(), currency };
        }
      } else {
        // Fixed price: price is required
        pricingSummary.price = { value: listing.price.toString(), currency };
      }

      // Resolve fulfillment policy — applying any per-listing shipping
      // overrides (handling time, cost type, shipping services) by lazily
      // cloning the base policy. If no overrides are set, this is a
      // no-op pass-through.
      const baseFulfillmentPolicyId =
        listing.fulfillmentPolicyId || connection.fulfillmentPolicyId!;
      const overrideShippingServices = Array.isArray((listing as any).shippingServices)
        ? ((listing as any).shippingServices as Array<{
            serviceCode: string;
            cost: number;
            additionalCost?: number;
            freeShipping?: boolean;
            priority?: number;
          }>)
        : undefined;
      const resolvedFulfillmentPolicyId = await this.policyService.ensureFulfillmentPolicyMatching(
        client,
        marketplaceId,
        baseFulfillmentPolicyId,
        {
          handlingTimeDays: (listing as any).handlingTimeDays ?? undefined,
          shippingCostType: (listing as any).shippingCostType ?? undefined,
          shippingServices: overrideShippingServices,
        }
      );

      // Build listing policies with best offer
      const listingPolicies: any = {
        fulfillmentPolicyId: resolvedFulfillmentPolicyId,
        paymentPolicyId: listing.paymentPolicyId || connection.paymentPolicyId!,
        returnPolicyId: listing.returnPolicyId || connection.returnPolicyId!,
      };
      if (listing.bestOfferEnabled) {
        listingPolicies.bestOfferTerms = {
          bestOfferEnabled: true,
          ...(listing.autoAcceptPrice && {
            autoAcceptPrice: { value: listing.autoAcceptPrice.toString(), currency },
          }),
          ...(listing.autoDeclinePrice && {
            autoDeclinePrice: { value: listing.autoDeclinePrice.toString(), currency },
          }),
        };
      }

      const offer = await this.ebayClient.createOffer(client, {
        sku: listing.sku,
        marketplaceId,
        format,
        availableQuantity: listing.quantity,
        categoryId: listing.categoryId,
        secondaryCategoryId: listing.secondaryCategoryId || undefined,
        listingDescription: listing.description,
        listingDuration: listing.listingDuration || (format === 'AUCTION' ? 'DAYS_7' : 'GTC'),
        pricingSummary,
        listingPolicies,
        merchantLocationKey: connection.locationKey,
        hideBuyerDetails: listing.privateListing || undefined,
        includeCatalogProductDetails: listing.epid ? true : undefined,
        lotSize: listing.lotSize || undefined,
        listingStartDate: platformData.scheduledPublishDate || undefined,
      });

      offerId = offer.offerId;
      offerCreated = true;

      // Step 3: Publish offer
      const publishResult = await this.ebayClient.publishOffer(client, offerId);

      // Update listing with eBay IDs
      const updated = await this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: {
          externalOfferId: offerId,
          externalListingId: publishResult.listingId,
          status: ListingStatus.PUBLISHED,
          syncStatus: SyncStatus.SYNCED,
          publishedAt: new Date(),
          inventoryItemPayload: inventoryItem as any,
          offerPayload: offer as any,
          publishResult: publishResult as any,
          errorMessage: null,
        },
      });

      this.logger.log(`Published listing ${listingId} to eBay: ${publishResult.listingId}`);

      // Audit log: listing published
      try {
        await this.audit.logListingPublished(listingId, listing.title, publishResult.listingId, 'EBAY');
      } catch {
        // Non-critical
      }

      return updated;
    } catch (error) {
      this.logger.error(`Failed to publish listing ${listingId}`, error);

      // Rollback partially created eBay resources. The withdraw is
      // synchronous on our side but eBay's offer purge is async; if we
      // try to delete the inventory item right after withdraw, eBay
      // often returns "inventory item is referenced by an offer". So we
      // attempt the delete inline once; on failure, schedule a deferred
      // retry via FailedOperationsService instead of leaving an orphan.
      if (client) {
        if (offerCreated && offerId) {
          try {
            await this.ebayClient.withdrawOffer(client, offerId);
            this.logger.log(`Rolled back offer ${offerId} for listing ${listingId}`);
          } catch (rollbackError) {
            this.logger.error(`Failed to rollback offer ${offerId}`, rollbackError);
          }
        }

        if (inventoryItemCreated) {
          try {
            await this.ebayClient.deleteInventoryItem(client, listing.sku);
            this.logger.log(`Rolled back inventory item ${listing.sku} for listing ${listingId}`);
          } catch (rollbackError) {
            this.logger.warn(
              `Inline delete of inventory item ${listing.sku} failed (likely eBay's async offer purge). Scheduling retry.`,
              rollbackError
            );
            await this.scheduleInventoryItemDelete(
              listing.tenantId,
              listing.connectionId,
              listing.sku,
              `Publish-rollback inline delete failed: ${(rollbackError as Error)?.message ?? 'unknown'}`,
            );
          }
        }
      }

      await this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: {
          status: ListingStatus.ERROR,
          syncStatus: SyncStatus.ERROR,
          errorMessage: error?.message || String(error) || 'Failed to publish listing',
        },
      });

      throw error;
    }
  }

  /**
   * Sync inventory quantity to eBay for a specific listing
   */
  async syncListingInventory(listingId: string) {
    const listing = await this.getListing(listingId);

    if (listing.status !== ListingStatus.PUBLISHED || !listing.externalOfferId) {
      return; // Skip non-published listings
    }

    try {
      // Get current NoSlag inventory
      if (listing.warehouseId) {
        const balance = await this.prisma.warehouseItemBalance.findUnique({
          where: {
            tenantId_itemId_warehouseId: {
              tenantId: listing.tenantId,
              itemId: listing.productListing.itemId,
              warehouseId: listing.warehouseId,
            },
          },
        });

        const availableQty = balance
          ? Math.max(0, balance.actualQty.toNumber() - balance.reservedQty.toNumber())
          : 0;

        // Update eBay
        const client = await this.ebayStore.getClient(listing.connectionId);
        await this.ebayClient.updateInventoryQuantity(client, listing.sku, availableQty);

        // Update local listing
        await this.prisma.marketplaceListing.update({
          where: { id: listingId },
          data: {
            quantity: availableQty,
            syncStatus: SyncStatus.SYNCED,
            errorMessage: null,
          },
        });

        this.logger.log(`Synced inventory for listing ${listingId}: ${availableQty}`);
      }
    } catch (error) {
      this.logger.error(`Failed to sync inventory for listing ${listingId}`, error);

      await this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: {
          syncStatus: SyncStatus.ERROR,
          errorMessage: `Inventory sync failed: ${error?.message || String(error)}`,
        },
      });
    }
  }

  /**
   * End listing on eBay
   */
  async endListing(listingId: string) {
    const listing = await this.getListing(listingId);

    if (listing.status !== ListingStatus.PUBLISHED || !listing.externalOfferId) {
      throw new BadRequestException('Only published listings can be ended');
    }

    try {
      const client = await this.ebayStore.getClient(listing.connectionId);
      await this.ebayClient.withdrawOffer(client, listing.externalOfferId);

      await this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: {
          status: ListingStatus.ENDED,
          endedAt: new Date(),
        },
      });

      this.logger.log(`Ended listing ${listingId}`);

      // Audit log: listing ended
      try {
        await this.audit.logListingEnded(listingId, listing.title, 'EBAY');
      } catch {
        // Non-critical
      }
    } catch (error) {
      this.logger.error(`Failed to end listing ${listingId}`, error);
      throw error;
    }
  }

  /**
   * Delete listing (only drafts)
   */
  async deleteListing(listingId: string) {
    const listing = await this.getListing(listingId);

    if (listing.status !== ListingStatus.DRAFT) {
      throw new BadRequestException('Only draft listings can be deleted');
    }

    await this.prisma.marketplaceListing.delete({ where: { id: listingId } });
    this.logger.log(`Deleted listing ${listingId}`);
  }

  /**
   * Schedule a listing to be published at a future date.
   * The scheduled date must be in the future and within 3 weeks.
   * When publishListing runs, it will include scheduledStartTime in the offer payload
   * if a scheduledDate is set in platformData.
   */
  async scheduleListingPublish(listingId: string, scheduledDate: Date): Promise<any> {
    const listing = await this.getListing(listingId);

    const now = new Date();
    if (scheduledDate <= now) {
      throw new BadRequestException('Scheduled date must be in the future');
    }

    const threeWeeksFromNow = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
    if (scheduledDate > threeWeeksFromNow) {
      throw new BadRequestException('Scheduled date must be within 3 weeks from now');
    }

    if (![ListingStatus.DRAFT, ListingStatus.APPROVED].includes(listing.status as any)) {
      throw new BadRequestException('Only draft or approved listings can be scheduled');
    }

    if (this.mockMode) {
      this.logger.log(`[MOCK] Scheduled listing ${listingId} for ${scheduledDate.toISOString()}`);
      return { listingId, scheduledDate, status: 'SCHEDULED' };
    }

    const existingPlatformData = listing.platformData
      ? JSON.parse(listing.platformData as string)
      : {};

    await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        platformData: JSON.stringify({
          ...existingPlatformData,
          scheduledPublishDate: scheduledDate.toISOString(),
        }),
      },
    });

    this.logger.log(`Scheduled listing ${listingId} for ${scheduledDate.toISOString()}`);
    return { listingId, scheduledDate, status: 'SCHEDULED' };
  }

  /**
   * IMarketplaceListingsService interface method.
   * Delegates to scheduleListingPublish with the parsed date.
   */
  async scheduleListing(id: string, scheduledDate: string): Promise<any> {
    return this.scheduleListingPublish(id, new Date(scheduledDate));
  }

  /**
   * Set the Out-of-Stock Control preference for an eBay account.
   * When enabled, listings with 0 quantity remain active (hidden from search)
   * instead of ending automatically.
   * Uses Trading API SetUserPreferences.
   */
  async setOutOfStockControl(connectionId: string, enabled: boolean): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Set OutOfStockControl to ${enabled} for connection ${connectionId}`
      );
      return { outOfStockControl: enabled };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      await (client as any).trading.SetUserPreferences({
        OutOfStockControlPreference: enabled,
      });

      this.logger.log(`Set OutOfStockControl to ${enabled} for connection ${connectionId}`);
      return { outOfStockControl: enabled };
    } catch (error) {
      this.logger.error(
        `Failed to set OutOfStockControl for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get the current Out-of-Stock Control preference for an eBay account.
   * Uses Trading API GetUserPreferences.
   */
  async getOutOfStockControl(connectionId: string): Promise<any> {
    if (this.mockMode) {
      this.logger.log(
        `[MOCK] Fetched OutOfStockControl for connection ${connectionId}`
      );
      return { outOfStockControl: false };
    }

    const client = await this.ebayStore.getClient(connectionId);

    try {
      const response = await (client as any).trading.GetUserPreferences({
        ShowOutOfStockControlPreference: true,
      });

      const outOfStockControl =
        response?.OutOfStockControlPreference === true ||
        response?.OutOfStockControlPreference === 'true';

      this.logger.log(
        `Fetched OutOfStockControl for connection ${connectionId}: ${outOfStockControl}`
      );
      return { outOfStockControl };
    } catch (error) {
      this.logger.error(
        `Failed to get OutOfStockControl for connection ${connectionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Update a published listing's offer (price, quantity, description)
   * Uses eBay Inventory API updateOffer for live listing modifications.
   */
  async updatePublishedListing(
    listingId: string,
    data: {
      price?: { value: string; currency: string };
      quantity?: number;
      description?: string;
    }
  ) {
    const listing = await this.getListing(listingId);

    if (listing.status !== ListingStatus.PUBLISHED || !listing.externalOfferId) {
      throw new BadRequestException('Only published listings with an active offer can be updated');
    }

    // H4: Check 250 revision/day limit before updating
    if (!(await this.ebayClient.checkRevisionLimit(listingId))) {
      throw new BadRequestException(
        'Listing has reached the eBay daily revision limit (250). Try again tomorrow.'
      );
    }

    const client = await this.ebayStore.getClient(listing.connectionId);

    const updatePayload: any = {};
    if (data.price) {
      updatePayload.pricingSummary = { price: data.price };
    }
    if (data.quantity !== undefined) {
      updatePayload.availableQuantity = data.quantity;
    }
    if (data.description) {
      updatePayload.listingDescription = data.description;
    }

    await this.ebayClient.updateOffer(client, listing.externalOfferId, updatePayload);

    // Update local record
    const localUpdate: any = {};
    if (data.price) {
      localUpdate.price = new Decimal(data.price.value);
    }
    if (data.quantity !== undefined) {
      localUpdate.quantity = data.quantity;
    }

    if (Object.keys(localUpdate).length > 0) {
      await this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: localUpdate,
      });
    }

    this.logger.log(`Updated published listing ${listingId} offer`);
    return { success: true, listingId };
  }

  /**
   * Create a multi-variation listing.
   * Creates individual inventory items for each variant, groups them,
   * and publishes the group.
   */
  async createVariationListing(data: {
    connectionId: string;
    groupKey: string;
    title: string;
    description: string;
    categoryId: string;
    imageUrls: string[];
    aspects: Record<string, string[]>;
    variants: Array<{
      sku: string;
      productListingId: string;
      title: string;
      description: string;
      price: number;
      quantity: number;
      condition: string;
      imageUrls: string[];
      variantAspects: Record<string, string[]>;
    }>;
    fulfillmentPolicyId: string;
    paymentPolicyId: string;
    returnPolicyId: string;
    merchantLocationKey?: string;
  }) {
    if (!data.fulfillmentPolicyId || !data.paymentPolicyId || !data.returnPolicyId) {
      throw new Error(
        'Variation listing requires fulfillmentPolicyId, paymentPolicyId, and returnPolicyId'
      );
    }

    const tenantId = this.cls.get('tenantId');
    const connection = await this.ebayStore.getConnection(data.connectionId);
    const client = await this.ebayStore.getClient(data.connectionId);
    const currency = this.getMarketplaceCurrency(connection.marketplaceId);

    // Track partially-created eBay-side resources for rollback on any
    // failure between here and step 4. The previous shape only rolled back
    // inventory items, leaving orphaned groups + leaving local DB out of
    // sync if step 4 partially failed.
    const createdSkus: string[] = [];
    let groupCreated = false;
    let publishResult: Awaited<ReturnType<EbayClientService['publishOfferByInventoryItemGroup']>> | undefined;

    try {
      // Step 1: Create inventory items for each variant
      for (const variant of data.variants) {
        await this.ebayClient.createOrReplaceInventoryItem(client, variant.sku, {
          product: {
            title: variant.title,
            description: variant.description,
            imageUrls: variant.imageUrls,
            aspects: variant.variantAspects,
          },
          condition: variant.condition,
          availability: {
            shipToLocationAvailability: { quantity: variant.quantity },
          },
        });
        createdSkus.push(variant.sku);
      }

      // Step 2: Create inventory item group
      const variesByAspects = Object.keys(data.variants[0]?.variantAspects || {});
      await this.ebayClient.createOrReplaceInventoryItemGroup(client, data.groupKey, {
        title: data.title,
        description: data.description,
        imageUrls: data.imageUrls,
        aspects: data.aspects,
        variantSKUs: data.variants.map((v) => v.sku),
        variesBy: {
          aspectsImageVariesBy: variesByAspects,
          specifications: variesByAspects.map((aspect) => ({
            name: aspect,
            values: [...new Set(data.variants.flatMap((v) => v.variantAspects[aspect] || []))],
          })),
        },
      });
      groupCreated = true;

      // Step 3: Publish the group as a single multi-variation listing
      publishResult = await this.ebayClient.publishOfferByInventoryItemGroup(client, {
        inventoryItemGroupKey: data.groupKey,
        marketplaceId: connection.marketplaceId,
        offers: data.variants.map((v) => ({
          sku: v.sku,
          marketplaceId: connection.marketplaceId,
          format: 'FIXED_PRICE',
          availableQuantity: v.quantity,
          categoryId: data.categoryId,
          listingPolicies: {
            fulfillmentPolicyId: data.fulfillmentPolicyId,
            paymentPolicyId: data.paymentPolicyId,
            returnPolicyId: data.returnPolicyId,
          },
          pricingSummary: {
            price: { value: String(v.price), currency },
          },
          merchantLocationKey: data.merchantLocationKey,
        })),
      });

      // Build a SKU→offerId index so we can stamp the per-variant offer IDs
      // on the local records in step 4. Without these, the inventory-sync
      // cron (which filters externalOfferId IS NOT NULL) would skip every
      // variation listing forever — silent inventory drift.
      const offerIdBySku = new Map<string, string>();
      for (const o of publishResult.offers ?? []) {
        if (o.sku && o.offerId) offerIdBySku.set(o.sku, o.offerId);
      }
      const groupListingId = publishResult.listingId;

      // Step 4: Create local listing records atomically. If any one fails,
      // none get committed and the catch block tears down the eBay-side
      // resources too.
      const listings = await this.prisma.$transaction(
        data.variants.map((variant) =>
          this.prisma.marketplaceListing.create({
            data: {
              tenantId,
              connectionId: data.connectionId,
              productListingId: variant.productListingId,
              sku: variant.sku,
              title: variant.title,
              description: variant.description,
              price: new Decimal(variant.price),
              quantity: variant.quantity,
              condition: variant.condition,
              categoryId: data.categoryId,
              status: ListingStatus.PUBLISHED,
              syncStatus: SyncStatus.SYNCED,
              publishedAt: new Date(),
              inventoryGroupKey: data.groupKey,
              externalOfferId: offerIdBySku.get(variant.sku) ?? null,
              externalListingId: groupListingId ?? null,
              isVariation: true,
              variantAspects: variant.variantAspects as any,
              platformData: JSON.stringify({ variantAspects: variant.variantAspects, currency }),
            },
          })
        )
      );

      this.logger.log(
        `Created multi-variation listing group ${data.groupKey} with ${data.variants.length} variants (listingId=${groupListingId})`
      );
      return { groupKey: data.groupKey, listings, publishResult };
    } catch (error) {
      // Best-effort rollback in reverse order. Each step is independent so
      // we don't bail on the first failure — log and keep cleaning.
      this.logger.error(
        `Variation publish failed for group ${data.groupKey}; rolling back eBay-side resources`,
        error
      );

      if (publishResult?.listingId) {
        // Withdraw any per-SKU offers eBay accepted before the failure.
        for (const o of publishResult.offers ?? []) {
          if (!o.offerId) continue;
          try {
            await this.ebayClient.withdrawOffer(client, o.offerId);
          } catch (e) {
            this.logger.error(`Rollback: failed to withdraw offer ${o.offerId}`, e);
          }
        }
      }

      if (groupCreated) {
        try {
          await this.ebayClient.deleteInventoryItemGroup(client, data.groupKey);
        } catch (e) {
          this.logger.error(`Rollback: failed to delete inventory group ${data.groupKey}`, e);
        }
      }

      for (const sku of createdSkus) {
        try {
          await this.ebayClient.deleteInventoryItem(client, sku);
        } catch (e) {
          this.logger.warn(
            `Rollback: inline delete of variant inventory item ${sku} failed; scheduling retry`,
            e
          );
          await this.scheduleInventoryItemDelete(
            tenantId,
            data.connectionId,
            sku,
            `Variation publish-rollback inline delete failed: ${(e as Error)?.message ?? 'unknown'}`,
          );
        }
      }

      throw error;
    }
  }
}
