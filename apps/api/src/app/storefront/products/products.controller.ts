import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  ListProductsDto,
  CreateProductListingDto,
  UpdateProductListingDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto';
import { CreateSimpleProductDto } from './simple-product.dto';
import { StoreAdminGuard } from '@platform/auth';
import { StorePublishedGuard } from '../../common/guards/store-published.guard';
import { Tenant } from '../../tenant.middleware';

@Controller('store')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * List published products (public)
   * GET /api/v1/store/products
   */
  @Get('products')
  @UseGuards(StorePublishedGuard)
  async listProducts(
    @Tenant() tenantId: string,
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
  @UseGuards(StorePublishedGuard)
  async getFeaturedProducts(
    @Tenant() tenantId: string,
    @Query('limit') limit?: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    const parsedLimit = limit ? parseInt(limit, 10) : 8;
    const clampedLimit = Math.min(Number.isNaN(parsedLimit) ? 8 : parsedLimit, 50);
    return this.productsService.getFeaturedProducts(
      tenantId,
      clampedLimit,
    );
  }

  /**
   * Get product by slug (public)
   * GET /api/v1/store/products/:slug
   */
  @Get('products/:slug')
  @UseGuards(StorePublishedGuard)
  async getProduct(
    @Tenant() tenantId: string,
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
  @UseGuards(StorePublishedGuard)
  async listCategories(@Tenant() tenantId: string) {
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
  @UseGuards(StorePublishedGuard)
  async getCategory(
    @Tenant() tenantId: string,
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
    @Tenant() tenantId: string,
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
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductListingDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.updateProductListing(tenantId, id, dto);
  }

  /**
   * Delete (soft-delete) a product listing (admin)
   * DELETE /api/v1/store/admin/products/:id
   */
  @Delete('admin/products/:id')
  @UseGuards(StoreAdminGuard)
  async deleteProduct(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.deleteProduct(tenantId, id);
  }

  /**
   * Simple product creation (merchant-friendly, auto-creates ERP Item)
   * POST /api/v1/store/admin/products/simple
   */
  @Post('admin/products/simple')
  @UseGuards(StoreAdminGuard)
  async createSimpleProduct(
    @Tenant() tenantId: string,
    @Body() dto: CreateSimpleProductDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.createSimpleProduct(tenantId, dto);
  }

  /**
   * List all products for admin (including unpublished)
   * GET /api/v1/store/admin/products
   */
  @Get('admin/products')
  @UseGuards(StoreAdminGuard)
  async listAdminProducts(
    @Tenant() tenantId: string,
    @Query() query: ListProductsDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.listAdminProducts(tenantId, query);
  }

  /**
   * Get single product by ID for admin (including unpublished)
   * GET /api/v1/store/admin/products/:id
   */
  @Get('admin/products/:id')
  @UseGuards(StoreAdminGuard)
  async getAdminProduct(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.getProductByIdAdmin(tenantId, id);
  }

  /**
   * Create category (admin)
   * POST /api/v1/store/admin/categories
   */
  @Post('admin/categories')
  @UseGuards(StoreAdminGuard)
  async createCategory(
    @Tenant() tenantId: string,
    @Body() dto: CreateCategoryDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.createCategory(tenantId, dto);
  }

  /**
   * Update category (admin)
   * PUT /api/v1/store/admin/categories/:id
   */
  @Put('admin/categories/:id')
  @UseGuards(StoreAdminGuard)
  async updateCategory(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.updateCategory(tenantId, id, dto);
  }

  /**
   * Delete (soft-delete) a category (admin)
   * DELETE /api/v1/store/admin/categories/:id
   */
  @Delete('admin/categories/:id')
  @UseGuards(StoreAdminGuard)
  async deleteCategory(
    @Tenant() tenantId: string,
    @Param('id') id: string
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.productsService.deleteCategory(tenantId, id);
  }
}
