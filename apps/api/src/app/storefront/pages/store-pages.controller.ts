import { Controller, Get, Put, Delete, Param, Body, Headers, UseGuards, BadRequestException } from '@nestjs/common';
import { StorePagesService } from './store-pages.service';
import { UpsertStorePageDto } from './store-pages.dto';
import { StoreAdminGuard } from '@platform/auth';

@Controller('store')
export class StorePagesController {
  constructor(private readonly pagesService: StorePagesService) {}

  /**
   * GET /api/v1/store/pages — public, list published pages
   */
  @Get('pages')
  async listPages(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.pagesService.listPages(tenantId, true);
  }

  /**
   * GET /api/v1/store/pages/:slug — public, get single page
   */
  @Get('pages/:slug')
  async getPage(
    @Headers('x-tenant-id') tenantId: string,
    @Param('slug') slug: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.pagesService.getPage(tenantId, slug);
  }

  /**
   * PUT /api/v1/store/admin/pages/:slug — admin, upsert page
   */
  @Put('admin/pages/:slug')
  @UseGuards(StoreAdminGuard)
  async upsertPage(
    @Headers('x-tenant-id') tenantId: string,
    @Param('slug') slug: string,
    @Body() dto: UpsertStorePageDto,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.pagesService.upsertPage(tenantId, slug, dto);
  }

  /**
   * GET /api/v1/store/admin/pages — admin, list all pages (including unpublished)
   */
  @Get('admin/pages')
  @UseGuards(StoreAdminGuard)
  async listAllPages(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.pagesService.listPages(tenantId, false);
  }

  /**
   * DELETE /api/v1/store/admin/pages/:slug — admin, delete page
   */
  @Delete('admin/pages/:slug')
  @UseGuards(StoreAdminGuard)
  async deletePage(
    @Headers('x-tenant-id') tenantId: string,
    @Param('slug') slug: string,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.pagesService.deletePage(tenantId, slug);
  }
}
