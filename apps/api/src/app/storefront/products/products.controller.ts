import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  ListProductsDto,
  CreateProductListingDto,
  UpdateProductListingDto,
  CreateCategoryDto,
} from './dto';
import { StoreAdminGuard } from '@platform/auth';

@Controller('api/v1/store')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * List published products (public)
   * GET /api/v1/store/products
   */
  @Get('products')
  async listProducts(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: ListProductsDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.listProducts(tenantId, query);
  }

  /**
   * Get featured products (public)
   * GET /api/v1/store/products/featured
   */
  @Get('products/featured')
  async getFeaturedProducts(
    @Headers('x-tenant-id') tenantId: string,
    @Query('limit') limit?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.getFeaturedProducts(
      tenantId,
      limit ? parseInt(limit, 10) : 8
    );
  }

  /**
   * Get product by slug (public)
   * GET /api/v1/store/products/:slug
   */
  @Get('products/:slug')
  async getProduct(
    @Headers('x-tenant-id') tenantId: string,
    @Param('slug') slug: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.getProductBySlug(tenantId, slug);
  }

  /**
   * List categories (public)
   * GET /api/v1/store/categories
   */
  @Get('categories')
  async listCategories(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.listCategories(tenantId);
  }

  /**
   * Get category by slug (public)
   * GET /api/v1/store/categories/:slug
   */
  @Get('categories/:slug')
  async getCategory(
    @Headers('x-tenant-id') tenantId: string,
    @Param('slug') slug: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.getCategoryBySlug(tenantId, slug);
  }

  // ============ ADMIN ENDPOINTS ============

  /**
   * Create product listing (admin)
   * POST /api/v1/store/admin/products
   */
  @Post('admin/products')
  @UseGuards(StoreAdminGuard)
  async createProduct(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateProductListingDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.createProductListing(tenantId, dto);
  }

  /**
   * Update product listing (admin)
   * PUT /api/v1/store/admin/products/:id
   */
  @Put('admin/products/:id')
  @UseGuards(StoreAdminGuard)
  async updateProduct(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductListingDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.updateProductListing(tenantId, id, dto);
  }

  /**
   * Create category (admin)
   * POST /api/v1/store/admin/categories
   */
  @Post('admin/categories')
  @UseGuards(StoreAdminGuard)
  async createCategory(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateCategoryDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.createCategory(tenantId, dto);
  }
}
