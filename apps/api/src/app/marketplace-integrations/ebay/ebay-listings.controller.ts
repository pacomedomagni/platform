import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayListingsService } from './ebay-listings.service';
import {
  CreateDirectListingDto,
  CreateVariationListingDto,
  UpdatePublishedListingDto,
  SetOutOfStockControlDto,
} from '../shared/marketplace.dto';

/**
 * eBay-Specific Listings Controller
 * Exposes eBay-only listing operations that are NOT covered by
 * the unified `marketplace/listings` controller.
 *
 * Common CRUD / workflow routes (create, get, update, delete,
 * approve, reject, publish, schedule, sync-inventory, end)
 * are served by the unified ListingsController at `marketplace/listings`.
 */
@Controller('marketplace/ebay/listings')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 60, ttl: 60000 } })
export class EbayListingsController {
  constructor(private listingsService: EbayListingsService) {}

  /**
   * Create listing directly (without product reference)
   * POST /api/marketplace/ebay/listings/direct
   */
  @Post('direct')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createDirectListing(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: CreateDirectListingDto
  ) {
    return this.listingsService.createDirectListing(dto);
  }

  /**
   * Create multi-variation listing
   * POST /api/marketplace/ebay/listings/variations
   */
  @Post('variations')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async createVariationListing(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: CreateVariationListingDto
  ) {
    // M2: derive a deterministic, tenant-namespaced group key instead of
    // using the human-readable title (which collides on republish and
    // can contain chars eBay rejects).
    const groupKey = this.listingsService.generateInventoryGroupKey(
      tenantId,
      dto.productListingId,
    );

    return this.listingsService.createVariationListing({
      connectionId: dto.connectionId,
      groupKey,
      title: dto.groupTitle,
      description: dto.description,
      categoryId: dto.categoryId,
      imageUrls: [],
      aspects: {},
      variants: dto.variants.map((v) => ({
        sku: v.sku,
        productListingId: dto.productListingId,
        title: v.title,
        description: dto.description,
        price: v.price,
        quantity: v.quantity,
        condition: v.condition,
        imageUrls: v.photos || [],
        variantAspects: v.aspects,
      })),
      fulfillmentPolicyId: dto.fulfillmentPolicyId,
      paymentPolicyId: dto.paymentPolicyId,
      returnPolicyId: dto.returnPolicyId,
    });
  }

  /**
   * L19: bulk-create eBay draft listings from a parsed CSV payload.
   *
   * The client parses the CSV (browser-side or via a separate upload
   * pipeline) and posts a `rows` array. Each row is attempted
   * independently — partial failures are returned in the response so
   * the importer UI can mark which rows succeeded and re-prompt for
   * the rest.
   *
   * Drafts only. The seller publishes after review via the standard
   * publish endpoint.
   *
   * POST /api/marketplace/ebay/listings/bulk-import
   */
  @Post('bulk-import')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  @Throttle({ short: { limit: 2, ttl: 60_000 } })
  async bulkImport(
    @Tenant() tenantId: string,
    @Body() body: { rows: any[] },
  ) {
    if (!body || !Array.isArray(body.rows)) {
      return { succeeded: [], failed: [], error: 'Body must contain `rows: Array`' };
    }
    return this.listingsService.bulkCreateDirectListings(body.rows);
  }

  /**
   * Update published listing on eBay (price, quantity, description)
   * PATCH /api/marketplace/ebay/listings/:id/offer
   */
  @Patch(':id/offer')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async updatePublishedListing(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdatePublishedListingDto
  ) {
    return this.listingsService.updatePublishedListing(id, dto);
  }

  /**
   * H2: pre-publish aspect validation. Returns the same report the
   * Publish path uses internally — empty `missing`/`emptyValues`/
   * `invalidValues` means the listing will not be rejected on aspects
   * grounds. UI calls this to gate the Publish button so the seller
   * sees specific remediation instead of an opaque eBay edge error.
   *
   * GET /api/marketplace/ebay/listings/:id/validate-aspects
   */
  @Get(':id/validate-aspects')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async validateAspects(@Param('id') id: string) {
    return this.listingsService.validateListingAspects(id);
  }

  /**
   * Get Out-of-Stock Control preference
   * GET /api/marketplace/ebay/listings/out-of-stock-control?connectionId=...
   */
  @Get('out-of-stock-control')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getOutOfStockControl(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.listingsService.getOutOfStockControl(connectionId);
  }

  /**
   * Set Out-of-Stock Control preference
   * POST /api/marketplace/ebay/listings/out-of-stock-control
   */
  @Post('out-of-stock-control')
  @Roles('admin', 'System Manager')
  async setOutOfStockControl(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: SetOutOfStockControlDto
  ) {
    return this.listingsService.setOutOfStockControl(dto.connectionId, dto.enabled);
  }
}
