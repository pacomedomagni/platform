import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { ClsService } from 'nestjs-cls';
import { EbayStoreService } from './ebay-store.service';
import { EbayClientService } from './ebay-client.service';
import { ListingStatus, SyncStatus } from '../shared/marketplace.types';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * eBay Listings Management Service
 * Handles creating, publishing, and syncing eBay listings
 */
@Injectable()
export class EbayListingsService {
  private readonly logger = new Logger(EbayListingsService.name);

  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
    private ebayStore: EbayStoreService,
    private ebayClient: EbayClientService
  ) {}

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

    // Default SKU format
    const sku = `${product.item.code}-${connection.id.slice(0, 8)}`;

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
        categoryId: data.overrides?.categoryId || '9355', // Default category
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
    productListingId?: string;
    warehouseId?: string;
    title: string;
    description: string;
    price: number;
    quantity: number;
    condition: string;
    categoryId: string;
    photos?: string[];
    itemSpecifics?: Record<string, string[]>;
    platformData?: Record<string, any>;
  }) {
    const tenantId = this.cls.get('tenantId');

    // Verify connection
    const connection = await this.ebayStore.getConnection(data.connectionId);

    // Generate SKU
    const timestamp = Date.now().toString(36);
    const sku = data.productListingId
      ? `${data.productListingId.slice(0, 8)}-${connection.id.slice(0, 8)}`
      : `MANUAL-${timestamp}-${connection.id.slice(0, 8)}`;

    // Check if listing already exists (if productListingId provided)
    if (data.productListingId) {
      const existing = await this.prisma.marketplaceListing.findFirst({
        where: {
          connectionId: data.connectionId,
          productListingId: data.productListingId,
        },
      });

      if (existing) {
        throw new BadRequestException('Listing already exists for this product on this store');
      }
    }

    // Create marketplace listing
    const listing = await this.prisma.marketplaceListing.create({
      data: {
        tenantId,
        connectionId: data.connectionId,
        productListingId: data.productListingId,
        warehouseId: data.warehouseId,
        sku,
        title: data.title,
        description: data.description,
        price: new Decimal(data.price),
        quantity: data.quantity,
        condition: data.condition,
        categoryId: data.categoryId,
        photos: JSON.stringify(data.photos || []),
        itemSpecifics: data.itemSpecifics as any,
        platformData: JSON.stringify({
          format: 'FIXED_PRICE',
          listingDuration: 'GTC',
          ...(data.platformData || {}),
        }),
        status: ListingStatus.APPROVED, // Direct listings are auto-approved
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

    const where: any = { tenantId };
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
    description?: string;
    price?: number;
    quantity?: number;
    condition?: string;
    categoryId?: string;
    photos?: string[];
    itemSpecifics?: Record<string, string[]>;
    platformData?: any;
  }) {
    const listing = await this.getListing(listingId);

    if ([ListingStatus.PUBLISHED, ListingStatus.ENDED].includes(listing.status as any)) {
      throw new BadRequestException('Cannot edit published or ended listings');
    }

    const updated = await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.price && { price: new Decimal(data.price) }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.condition && { condition: data.condition }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.photos && { photos: JSON.stringify(data.photos) }),
        ...(data.itemSpecifics && { itemSpecifics: data.itemSpecifics as any }),
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
   * Publish listing to eBay
   */
  async publishListing(listingId: string) {
    const listing = await this.getListing(listingId);

    if (![ListingStatus.DRAFT, ListingStatus.APPROVED].includes(listing.status as any)) {
      throw new BadRequestException('Only draft or approved listings can be published');
    }

    // Verify connection is ready
    const isReady = await this.ebayStore.isConnectionReady(listing.connectionId);
    if (!isReady) {
      throw new BadRequestException('eBay connection is not fully configured. Please complete OAuth and fetch business policies.');
    }

    try {
      // Update status to publishing
      await this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: { status: ListingStatus.PUBLISHING },
      });

      // Get eBay client
      const client = await this.ebayStore.getClient(listing.connectionId);
      const photos = JSON.parse(listing.photos as string) as string[];

      // Step 1: Create inventory item
      const inventoryItem = await this.ebayClient.createOrReplaceInventoryItem(client, listing.sku, {
        product: {
          title: listing.title,
          description: listing.description,
          imageUrls: photos.slice(0, 12), // eBay limit: 12 images
          aspects: listing.itemSpecifics ? (listing.itemSpecifics as any) : undefined,
        },
        condition: listing.condition,
        availability: {
          shipToLocationAvailability: {
            quantity: listing.quantity,
          },
        },
        ...(listing.weightValue && {
          packageWeightAndSize: {
            weight: {
              value: listing.weightValue.toNumber(),
              unit: listing.weightUnit || 'POUND',
            },
            ...(listing.dimensionLength && {
              dimensions: {
                length: listing.dimensionLength.toNumber(),
                width: listing.dimensionWidth?.toNumber(),
                height: listing.dimensionHeight?.toNumber(),
                unit: listing.dimensionUnit || 'INCH',
              },
            }),
          },
        }),
      });

      // Step 2: Create offer
      const connection = listing.connection;
      const offer = await this.ebayClient.createOffer(client, {
        sku: listing.sku,
        marketplaceId: connection.marketplaceId || 'EBAY_US',
        format: 'FIXED_PRICE',
        availableQuantity: listing.quantity,
        categoryId: listing.categoryId,
        listingDescription: listing.description,
        pricingSummary: {
          price: {
            value: listing.price.toString(),
            currency: 'USD',
          },
        },
        listingPolicies: {
          fulfillmentPolicyId: listing.fulfillmentPolicyId || connection.fulfillmentPolicyId!,
          paymentPolicyId: listing.paymentPolicyId || connection.paymentPolicyId!,
          returnPolicyId: listing.returnPolicyId || connection.returnPolicyId!,
        },
        merchantLocationKey: connection.locationKey,
      });

      const offerId = offer.offerId;

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
      return updated;
    } catch (error) {
      this.logger.error(`Failed to publish listing ${listingId}`, error);

      await this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: {
          status: ListingStatus.ERROR,
          syncStatus: SyncStatus.ERROR,
          errorMessage: error.message || 'Failed to publish listing',
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
          errorMessage: `Inventory sync failed: ${error.message}`,
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
}
