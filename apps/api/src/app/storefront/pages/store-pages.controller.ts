import { Controller, Get, Put, Delete, Param, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { StorePagesService } from './store-pages.service';
import { UpsertStorePageDto } from './store-pages.dto';
import { StoreAdminGuard } from '@platform/auth';
import { StorePublishedGuard } from '../../common/guards/store-published.guard';
import { Tenant } from '../../tenant.middleware';

@Controller('store')
export class StorePagesController {
  constructor(private readonly pagesService: StorePagesService) {}

  /**
   * GET /api/v1/store/pages — public, list published pages
   */
  @Get('pages')
  @UseGuards(StorePublishedGuard)
  async listPages(@Tenant() tenantId: string) {    return this.pagesService.listPages(tenantId, true);
  }

  /**
   * GET /api/v1/store/pages/:slug — public, get single page
   */
  @Get('pages/:slug')
  @UseGuards(StorePublishedGuard)
  async getPage(
    @Tenant() tenantId: string,
    @Param('slug') slug: string,
  ) {    return this.pagesService.getPage(tenantId, slug);
  }

  /**
   * PUT /api/v1/store/admin/pages/:slug — admin, upsert page
   */
  @Put('admin/pages/:slug')
  @UseGuards(StoreAdminGuard)
  async upsertPage(
    @Tenant() tenantId: string,
    @Param('slug') slug: string,
    @Body() dto: UpsertStorePageDto,
  ) {    return this.pagesService.upsertPage(tenantId, slug, dto);
  }

  /**
   * GET /api/v1/store/admin/pages — admin, list all pages (including unpublished)
   */
  @Get('admin/pages')
  @UseGuards(StoreAdminGuard)
  async listAllPages(@Tenant() tenantId: string) {    return this.pagesService.listPages(tenantId, false);
  }

  /**
   * DELETE /api/v1/store/admin/pages/:slug — admin, delete page
   */
  @Delete('admin/pages/:slug')
  @UseGuards(StoreAdminGuard)
  async deletePage(
    @Tenant() tenantId: string,
    @Param('slug') slug: string,
  ) {    return this.pagesService.deletePage(tenantId, slug);
  }
}
