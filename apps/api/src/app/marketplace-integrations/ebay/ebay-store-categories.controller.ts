import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, RolesGuard, Roles } from '@platform/auth';
import { Tenant } from '../../tenant.middleware';
import { EbayStoreCategoriesService } from './ebay-store-categories.service';
import { CreateCustomPageDto, SetStoreCategoriesDto } from '../shared/marketplace.dto';

/**
 * eBay Store Categories API Controller
 * Manages custom store categories for eBay stores
 */
@Controller('marketplace/ebay/store-categories')
@UseGuards(AuthGuard, RolesGuard)
@Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
export class EbayStoreCategoriesController {
  constructor(private storeCategoriesService: EbayStoreCategoriesService) {}

  /**
   * Get all store categories
   * GET /api/marketplace/ebay/store-categories?connectionId=...
   */
  @Get()
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getStoreCategories(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.storeCategoriesService.getStoreCategories(connectionId);
  }

  /**
   * Get custom store pages
   * GET /api/marketplace/ebay/store-categories/pages?connectionId=...
   */
  @Get('pages')
  @Roles('admin', 'System Manager', 'Inventory Manager')
  async getCustomPages(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string
  ) {
    return this.storeCategoriesService.getCustomPages(connectionId);
  }

  /**
   * Create a custom store page
   * POST /api/marketplace/ebay/store-categories/pages
   */
  @Post('pages')
  @Roles('admin', 'System Manager')
  async createCustomPage(
    @Tenant() tenantId: string,
    @Body(ValidationPipe) dto: CreateCustomPageDto
  ) {
    return this.storeCategoriesService.createCustomPage(dto.connectionId, {
      name: dto.name,
      content: dto.content,
      leftNav: dto.leftNav,
    });
  }

  /**
   * Delete a custom store page
   * DELETE /api/marketplace/ebay/store-categories/pages/:pageId?connectionId=...
   */
  @Delete('pages/:pageId')
  @Roles('admin', 'System Manager')
  async deleteCustomPage(
    @Tenant() tenantId: string,
    @Param('pageId') pageId: string,
    @Query('connectionId') connectionId: string
  ) {
    await this.storeCategoriesService.deleteCustomPage(connectionId, pageId);
    return { success: true, message: 'Custom page deleted' };
  }

  /**
   * Set/update store categories
   * POST /api/marketplace/ebay/store-categories?connectionId=...
   */
  @Post()
  @Roles('admin', 'System Manager')
  async setStoreCategories(
    @Tenant() tenantId: string,
    @Query('connectionId') connectionId: string,
    @Body(ValidationPipe) dto: SetStoreCategoriesDto
  ) {
    await this.storeCategoriesService.setStoreCategories(
      connectionId,
      dto.categories
    );
    return { success: true, message: 'Store categories updated' };
  }

  /**
   * Delete a store category
   * DELETE /api/marketplace/ebay/store-categories/:categoryId?connectionId=...
   */
  @Delete(':categoryId')
  @Roles('admin', 'System Manager')
  async deleteStoreCategory(
    @Tenant() tenantId: string,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Query('connectionId') connectionId: string
  ) {
    await this.storeCategoriesService.deleteStoreCategory(connectionId, categoryId);
    return { success: true, message: 'Store category deleted' };
  }
}
